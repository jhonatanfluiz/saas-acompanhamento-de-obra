import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o Supabase com Service Role Key para ignorar RLS nas consultas administrativas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarDataHoraBRT(): string {
  return new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Função auxiliar para enviar texto via Evolution API ─────────────────────

async function enviarMensagemWhatsApp(remoteJid: string, text: string): Promise<void> {
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({ number: remoteJid, text, delay: 1200 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API respondeu com status ${response.status}: ${errorText}`);
  }
}

// ─── Handler Principal (GET): Cron de Lembretes / Cobranças Semanais ──────────

export async function GET(req: Request) {
  try {
    // 1. Validação de Segurança (Chave Secreta)
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('Authorization');
    const token =
      searchParams.get('token') ||
      (authHeader ? authHeader.replace('Bearer ', '') : null);

    const cronSecret =
      process.env.CRON_SECRET || 'chave_secreta_padrao_desenvolvimento_123';

    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const restrictionObraId = searchParams.get('obra_id');

    // 2. Buscar Obras ativas com suas fases e perguntas
    let dbQuery = supabase
      .from('obras')
      .select(`
        id,
        nome,
        progresso_total,
        manager_name,
        manager_phone,
        status,
        fases (
          id,
          nome,
          ordem,
          status,
          perguntas (
            id,
            texto_pergunta,
            ordem,
            peso,
            identificador_unico
          )
        )
      `)
      .in('status', ['ativa', 'atrasada']);

    if (restrictionObraId) {
      dbQuery = dbQuery.eq('id', restrictionObraId);
    }

    const { data: obras, error: obrasError } = await dbQuery;

    if (obrasError) throw obrasError;
    if (!obras || obras.length === 0) {
      return NextResponse.json(
        { message: 'Nenhuma obra ativa encontrada para envio de lembretes.', success: true, lembretes: [] },
        { status: 200 }
      );
    }

    const logsLembretes: any[] = [];
    let gatewayOffline = false;

    // 3. Iterar por cada Obra para achar a pergunta pendente e cobrar
    for (const obra of obras) {
      if (!obra.manager_phone) {
        console.log(`Obra "${obra.nome}" não possui telefone de gerente cadastrado para lembrete.`);
        continue;
      }

      // Encontrar a primeira fase não concluída (ordenada por 'ordem')
      const fasesPendentes = (obra.fases as any[]) || [];
      const faseAtiva = fasesPendentes
        .filter((f) => f.status !== 'concluida')
        .sort((a, b) => a.ordem - b.ordem)[0];

      if (!faseAtiva) {
        console.log(`Obra "${obra.nome}" já concluiu todas as suas fases.`);
        continue;
      }

      // Buscar respostas existentes para esta fase ativa
      const { data: respostas } = await supabase
        .from('respostas')
        .select('pergunta_id')
        .eq('fase_id', faseAtiva.id);

      const respondidasIds = respostas?.map((r) => r.pergunta_id) || [];

      // Achar a próxima pergunta pendente
      const perguntas = (faseAtiva.perguntas as any[]) || [];
      const perguntaPendente = perguntas
        .sort((a, b) => a.ordem - b.ordem)
        .find((p) => !respondidasIds.includes(p.id));

      if (!perguntaPendente) {
        console.log(`Sem perguntas pendentes para cobrar na fase "${faseAtiva.nome}" da obra "${obra.nome}".`);
        continue;
      }

      // Formatar número de telefone do WhatsApp
      const cleanPhone = obra.manager_phone.replace(/\D/g, '');
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;

      // Determinar contexto para instrução da pergunta
      const p2 = faseAtiva.perguntas.find((p: any) => p.ordem === 2);
      const isLegacy =
        faseAtiva.perguntas.length === 2 &&
        p2 &&
        (/percentual/i.test(p2.texto_pergunta) || /porcentagem/i.test(p2.texto_pergunta));
      const isPercentual = isLegacy && perguntaPendente.ordem === 2;
      const instructionText = isPercentual
        ? 'Por favor, responda apenas com *25%*, *50%*, *75%* ou *100%*.'
        : 'Por favor, responda apenas com *SIM*, *NÃO* ou *N/A*.';
      const textoId = perguntaPendente.identificador_unico
        ? `[${perguntaPendente.identificador_unico}] `
        : '';

      // Montar mensagem de Lembrete / Cobrança
      const mensagem =
        `🔔 *Lembrete de Acompanhamento de Obra*\n\n` +
        `Olá *${obra.manager_name || 'Mestre'}*!\n` +
        `Ainda não registramos sua resposta para o item semanal da obra *${obra.nome}*.\n\n` +
        `📌 *Fase:* ${faseAtiva.nome}\n` +
        `👉 *${textoId}${perguntaPendente.texto_pergunta}*\n\n` +
        `${instructionText}\n\n` +
        `⚠️ _Sua resposta é essencial para manter o painel da diretoria atualizado em tempo real._`;

      // Disparar lembrete via WhatsApp (Evolution API)
      let disparoStatus = 'sucesso';
      let erroDetalhe = null;

      try {
        await enviarMensagemWhatsApp(remoteJid, mensagem);
      } catch (err: any) {
        console.error(`Erro ao disparar lembrete para ${obra.nome}:`, err.message);
        disparoStatus = 'falha_gateway';
        erroDetalhe = err.message;
        gatewayOffline = true;
      }

      logsLembretes.push({
        obra_id: obra.id,
        obra_nome: obra.nome,
        manager_name: obra.manager_name || 'Mestre',
        manager_phone: cleanPhone,
        mensagem,
        pergunta_texto: perguntaPendente.texto_pergunta,
        pergunta_id: perguntaPendente.id,
        fase_id: faseAtiva.id,
        fase_nome: faseAtiva.nome,
        status: disparoStatus,
        erro: erroDetalhe,
        horario_lembrete: formatarDataHoraBRT(),
      });
    }

    return NextResponse.json(
      {
        success: true,
        gateway_offline: gatewayOffline,
        lembretes: logsLembretes,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro na execução do Cron de Lembretes:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
