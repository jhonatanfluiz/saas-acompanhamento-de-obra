import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o Supabase com Service Role Key para ignorar RLS nas consultas administrativas
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(req: Request) {
  try {
    // 1. Validação de Segurança (Chave Secreta)
    const { searchParams } = new URL(req.url);
    const authHeader = req.headers.get('Authorization');
    const token = searchParams.get('token') || (authHeader ? authHeader.replace('Bearer ', '') : null);

    const cronSecret = process.env.CRON_SECRET || 'chave_secreta_padrao_desenvolvimento_123';

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
            ordem
          )
        )
      `)
      .eq('status', 'ativa');

    if (obraId) {
      dbQuery = dbQuery.eq('id', obraId);
    }

    const { data: obras, error: obrasError } = await dbQuery;

    if (obrasError) throw obrasError;
    if (!obras || obras.length === 0) {
      return NextResponse.json({ message: 'Nenhuma obra ativa encontrada.', success: true, disparos: [] }, { status: 200 });
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
        .filter(f => f.status !== 'concluida')
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

      const respondidasIds = respostas?.map(r => r.pergunta_id) || [];

      // Achar a próxima pergunta pendente
      const perguntas = (faseAtiva.perguntas as any[]) || [];
      const perguntaPendente = perguntas
        .sort((a, b) => a.ordem - b.ordem)
        .find(p => !respondidasIds.includes(p.id));

      if (!perguntaPendente) {
        console.log(`Todas as perguntas da fase "${faseAtiva.nome}" na obra "${obra.nome}" já foram respondidas.`);
        continue;
      }

      // Formatar número de telefone do WhatsApp
      const cleanPhone = obra.manager_phone.replace(/\D/g, '');
      const remoteJid = `${cleanPhone}@s.whatsapp.net`;

      // Montar mensagem customizada
      let mensagem = '';
      const isPrimeiraPergunta = respondidasIds.length === 0;

      if (isPrimeiraPergunta) {
        // Usa a saudação customizada se existir
        let saudacao = `Olá, ${obra.manager_name || 'Mestre'}! Vamos atualizar o avanço da obra "${obra.nome}"?`;
        
        if (obra.custom_greeting) {
          let tempGreeting = obra.custom_greeting;
          
          // Substitui placeholders genéricos de nome
          tempGreeting = tempGreeting
            .replace(/\[nome\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[gerente\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[mestre\]/gi, obra.manager_name || 'Mestre')
            .replace(/\[obra\]/gi, obra.nome);
            
          // Substitui também caso tenham colocado o próprio nome do gerente entre colchetes (ex: [divanil] ou [Divanil])
          if (obra.manager_name) {
            const escapedName = obra.manager_name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\[${escapedName}\\]`, 'gi');
            tempGreeting = tempGreeting.replace(regex, obra.manager_name);
          }
          
          saudacao = tempGreeting;
        }

        mensagem = `${saudacao}\n\nFase Atual: *${faseAtiva.nome}*\n\nPergunta 1:\n👉 *${perguntaPendente.texto_pergunta}*\n\nResponda apenas com *SIM* ou *NÃO*.`;
      } else {
        mensagem = `Anotado! Próxima pergunta da fase *${faseAtiva.nome}*:\n\n👉 *${perguntaPendente.texto_pergunta}*\n\nResponda apenas com *SIM* ou *NÃO*.`;
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
        mensagem: mensagem,
        pergunta_texto: perguntaPendente.texto_pergunta,
        pergunta_id: perguntaPendente.id,
        fase_id: faseAtiva.id,
        fase_nome: faseAtiva.nome,
        status: disparoStatus,
        erro: erroDetalhe
      });
    }

    return NextResponse.json({
      success: true,
      gateway_offline: gatewayOffline,
      disparos: logsDisparos
    }, { status: 200 });

  } catch (error: any) {
    console.error('Erro na execução do Cron:', error);
    return NextResponse.json({ error: error.message, success: false }, { status: 500 });
  }
}

// Função auxiliar para enviar texto via Evolution API
async function enviarMensagemWhatsApp(remoteJid: string, text: string) {
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.EVOLUTION_API_KEY!
    },
    body: JSON.stringify({
      number: remoteJid,
      text: text,
      delay: 1200
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API respondeu com status ${response.status}: ${errorText}`);
  }
}
