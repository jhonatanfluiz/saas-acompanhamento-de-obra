import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o Supabase com Service Role Key para ignorar RLS nas consultas administrativas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function saudacaoHora(): string {
  // Horário de Brasília (UTC-3)
  const hora = new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

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

// ─── Handler Principal (GET): Cron de Disparos Semanais ──────────────────────

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

    const obraId = searchParams.get('obra_id');

    // 2. Buscar Obras ativas com suas fases e perguntas
    let dbQuery = supabase
      .from('obras')
      .select(`
        id,
        nome,
        progresso_total,
        manager_name,
        manager_phone,
        custom_greeting,
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

    if (obraId) {
      dbQuery = dbQuery.eq('id', obraId);
    }

    const { data: obras, error: obrasError } = await dbQuery;

    if (obrasError) throw obrasError;
    if (!obras || obras.length === 0) {
      return NextResponse.json(
        { message: 'Nenhuma obra ativa encontrada.', success: true, disparos: [] },
        { status: 200 }
      );
    }

    const logsDisparos: any[] = [];
    let gatewayOffline = false;

    // 3. Iterar por cada Obra para achar a pergunta pendente
    for (const obra of obras) {
      if (!obra.manager_phone) {
        console.log(`Obra "${obra.nome}" não possui telefone de gerente cadastrado.`);
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

      // Total de fases da obra (incluindo concluídas)
      const totalFases = fasesPendentes.length;
      const numFaseAtual = faseAtiva.ordem;

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
        console.log(
          `Todas as perguntas da fase "${faseAtiva.nome}" na obra "${obra.nome}" já foram respondidas.`
        );
        continue;
      }

      // Formatar número de telefone do WhatsApp
      const cleanPhone = obra.manager_phone.replace(/\D/g, '');
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;

      // Determinar contexto para instrução da pergunta
      const isPrimeiraPergunta = respondidasIds.length === 0;
      const p2 = faseAtiva.perguntas.find((p: any) => p.ordem === 2);
      const isLegacy =
        faseAtiva.perguntas.length === 2 &&
        p2 &&
        (/percentual/i.test(p2.texto_pergunta) || /porcentagem/i.test(p2.texto_pergunta));
      const isPercentual = isLegacy && perguntaPendente.ordem === 2;
      const instructionText = isPercentual
        ? 'Responda apenas com *25%*, *50%*, *75%* ou *100%*.'
        : 'Responda apenas com *SIM*, *NÃO* ou *N/A*.';
      const textoId = perguntaPendente.identificador_unico
        ? `[${perguntaPendente.identificador_unico}] `
        : '';

      // Montar mensagem
      let mensagem = '';

      if (isPrimeiraPergunta) {
        // Saudação contextualizada com hora do dia e progresso
        const saudacaoBase = saudacaoHora();
        let saudacao = `${saudacaoBase}, *${obra.manager_name || 'Mestre'}*! Chegou a hora do check semanal da obra *${obra.nome}* 📋`;

        if (obra.custom_greeting) {
          let tempGreeting = obra.custom_greeting;
          tempGreeting = tempGreeting
            .replace(/\[nome\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[gerente\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[mestre\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[obra\]/gi, obra.nome);

          if (obra.manager_name) {
            const escapedName = obra.manager_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\[${escapedName}\\]`, 'gi');
            tempGreeting = tempGreeting.replace(regex, obra.manager_name);
          }
          saudacao = tempGreeting;
        }

        mensagem =
          `🏗️ *Acompanhamento Semanal de Obra*\n\n` +
          `${saudacao}\n\n` +
          `📌 *Fase atual:* ${faseAtiva.nome} (${numFaseAtual} de ${totalFases})\n` +
          `📊 *Progresso da obra:* ${(obra.progresso_total ?? 0).toFixed(1)}%\n` +
          `🕐 *Horário:* ${formatarDataHoraBRT()}\n\n` +
          `Vamos começar! Primeiro item:\n\n` +
          `👉 *${textoId}${perguntaPendente.texto_pergunta}*\n\n` +
          instructionText;
      } else {
        // Retomada de questionário em andamento
        mensagem =
          `🔄 *Retomando seu questionário — ${obra.nome}*\n\n` +
          `📌 *Fase:* ${faseAtiva.nome} (${numFaseAtual} de ${totalFases})\n` +
          `📝 *Progresso nesta fase:* ${respondidasIds.length} de ${perguntas.length} respondidas\n\n` +
          `Continuando:\n\n` +
          `👉 *${textoId}${perguntaPendente.texto_pergunta}*\n\n` +
          instructionText;
      }

      // Disparar mensagem via WhatsApp (Evolution API)
      let disparoStatus = 'sucesso';
      let erroDetalhe = null;

      try {
        await enviarMensagemWhatsApp(remoteJid, mensagem);
      } catch (err: any) {
        console.error(`Erro ao disparar mensagem para ${obra.nome}:`, err.message);
        disparoStatus = 'falha_gateway';
        erroDetalhe = err.message;
        gatewayOffline = true;
      }

      logsDisparos.push({
        obra_id: obra.id,
        obra_nome: obra.nome,
        manager_name: obra.manager_name || 'Mestre',
        manager_phone: cleanPhone,
        mensagem,
        pergunta_texto: perguntaPendente.texto_pergunta,
        pergunta_id: perguntaPendente.id,
        pergunta_ordem: perguntaPendente.ordem,
        fase_id: faseAtiva.id,
        fase_nome: faseAtiva.nome,
        fase_num: numFaseAtual,
        total_fases: totalFases,
        progresso_obra: obra.progresso_total ?? 0,
        is_legacy: isLegacy,
        horario_disparo: formatarDataHoraBRT(),
        status: disparoStatus,
        erro: erroDetalhe,
      });
    }

    return NextResponse.json(
      {
        success: true,
        gateway_offline: gatewayOffline,
        disparos: logsDisparos,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro na execução do Cron:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}
