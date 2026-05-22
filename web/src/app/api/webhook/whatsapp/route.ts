import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase com Service Role para ignorar RLS no Webhook
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Log para depuração (pode ser removido depois)
    console.log('Webhook recebido:', JSON.stringify(body, null, 2));

    // Evolution API payload webhook event: "messages.upsert"
    if (!body.data || !body.data.message) {
      return NextResponse.json({ message: 'Payload ignorado' }, { status: 200 });
    }

    const messageData = body.data;
    const remoteJid = messageData.key.remoteJid; 
    const isFromMe = messageData.key.fromMe;
    
    // Pega o texto da mensagem
    const textMessage = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '';

    // Ignora mensagens enviadas pelo próprio bot ou mensagens vazias
    if (isFromMe || !textMessage) {
      return NextResponse.json({ message: 'Ignorado' }, { status: 200 });
    }

    // Extrair apenas o número de telefone
    const phone = remoteJid.split('@')[0].replace(/\D/g, '');

    // 1. Validar resposta SIM ou NÃO
    const respostaUpper = textMessage.trim().toUpperCase();
    if (respostaUpper !== 'SIM' && respostaUpper !== 'NÃO' && respostaUpper !== 'NAO') {
      await enviarMensagemWhatsApp(remoteJid, 'Resposta inválida. Por favor, responda apenas com SIM ou NÃO.');
      return NextResponse.json({ message: 'Resposta inválida' }, { status: 200 });
    }

    const respostaFinal = (respostaUpper === 'NAO') ? 'NÃO' : respostaUpper;

    // 2. Identificar Usuário pelo telefone (Tabela: usuarios)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nome')
      .ilike('telefone', `%${phone.slice(-8)}%`) // Busca pelos últimos 8 dígitos
      .single();

    let usuarioId: string | null = null;
    let usuarioNome = 'Mestre';
    let obra = null;

    if (usuario) {
      usuarioId = usuario.id;
      usuarioNome = usuario.nome;

      // 3. Buscar Obra e Fase Ativa vinculada ao mestre_obras_id
      const { data: obraRes } = await supabase
        .from('obras')
        .select(`
          id, 
          nome,
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
        .eq('mestre_obras_id', usuario.id)
        .eq('status', 'ativa')
        .filter('fases.status', 'neq', 'concluida')
        .order('ordem', { referencedTable: 'fases', ascending: true })
        .limit(1)
        .single();
      
      if (obraRes) {
        obra = obraRes;
      }
    }

    // Fallback: Se não encontrou obra via usuario, busca pelo manager_phone diretamente na tabela obras
    if (!obra) {
      const { data: obraRes } = await supabase
        .from('obras')
        .select(`
          id, 
          nome,
          manager_name,
          manager_phone,
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
        .ilike('manager_phone', `%${phone.slice(-8)}%`)
        .eq('status', 'ativa')
        .filter('fases.status', 'neq', 'concluida')
        .order('ordem', { referencedTable: 'fases', ascending: true })
        .limit(1)
        .single();

      if (!obraRes) {
        console.log('Obra não encontrada para o telefone:', phone);
        return NextResponse.json({ error: 'Mestre ou Obra não encontrada' }, { status: 200 });
      }

      obra = obraRes;
      usuarioNome = obra.manager_name || 'Mestre';
    }

    if (!obra.fases || obra.fases.length === 0) {
      return NextResponse.json({ message: 'Nenhuma fase pendente' }, { status: 200 });
    }

    const faseAtual = (obra.fases as any)[0];
    
    // 4. Identificar Pergunta Pendente
    const { data: respostasExistentes } = await supabase
      .from('respostas')
      .select('pergunta_id')
      .eq('fase_id', faseAtual.id);

    const respondidasIds = respostasExistentes?.map(r => r.pergunta_id) || [];
    const perguntasOrdenadas = faseAtual.perguntas.sort((a: any, b: any) => a.ordem - b.ordem);
    const perguntaPendente = perguntasOrdenadas.find((p: any) => !respondidasIds.includes(p.id));

    if (!perguntaPendente) {
      return NextResponse.json({ message: 'Fase concluída' }, { status: 200 });
    }

    // 5. Salvar Resposta
    const { error: insertError } = await supabase
      .from('respostas')
      .insert({
        obra_id: obra.id,
        fase_id: faseAtual.id,
        pergunta_id: perguntaPendente.id,
        resposta: respostaFinal,
        usuario_responsavel: usuarioId
      });

    if (insertError) throw insertError;

    // 6. Verificar se há próxima pergunta ou se finalizou a fase
    const proximaPergunta = perguntasOrdenadas.find((p: any) => p.id !== perguntaPendente.id && !respondidasIds.includes(p.id));

    if (proximaPergunta) {
      await enviarMensagemWhatsApp(remoteJid, `Anotado!\n\nPróxima pergunta da fase *${faseAtual.nome}*:\n\n👉 *${proximaPergunta.texto_pergunta}*\n\nResponda apenas com *SIM* ou *NÃO*.`);
    } else {
      // Fase concluída! Vamos buscar a próxima fase pendente da obra em ordem crescente
      const proximasFases = ((obra.fases as any[]) || []).sort((a, b) => a.ordem - b.ordem);
      const proximaFase = proximasFases.find((f: any) => f.ordem > faseAtual.ordem);

      if (proximaFase && proximaFase.perguntas && proximaFase.perguntas.length > 0) {
        // Achar a primeira pergunta da próxima fase
        const perguntasProxima = proximaFase.perguntas.sort((a: any, b: any) => a.ordem - b.ordem);
        const primeiraPerguntaProxima = perguntasProxima[0];

        await enviarMensagemWhatsApp(
          remoteJid,
          `Excelente! Você concluiu a fase *${faseAtual.nome}* da obra *${obra.nome}*.\n\nVamos iniciar a próxima fase *${proximaFase.nome}*!\n\nPergunta 1:\n👉 *${primeiraPerguntaProxima.texto_pergunta}*\n\nResponda apenas com *SIM* ou *NÃO*.`
        );
      } else {
        await enviarMensagemWhatsApp(
          remoteJid,
          `Perfeito, ${usuarioNome}! Você concluiu todas as fases e perguntas de acompanhamento da obra *${obra.nome}*. Excelente trabalho! 🎉`
        );
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro no Webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function enviarMensagemWhatsApp(remoteJid: string, text: string) {
  try {
    const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: remoteJid,
        text: text,
        delay: 1000
      })
    });
  } catch (err: any) {
    console.warn(`[Aviso] Falha ao enviar resposta de confirmação no WhatsApp (Evolution API offline):`, err.message);
  }
}
