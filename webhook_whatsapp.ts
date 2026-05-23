import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Usar service_role para ignorar RLS no webhook
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Evolution API payload webhook event: "messages.upsert"
    if (!body.data || !body.data.message) {
      return NextResponse.json({ message: 'Payload ignorado' }, { status: 200 });
    }

    const messageData = body.data;
    const remoteJid = messageData.key.remoteJid; // Ex: 5511999999999@s.whatsapp.net
    const isFromMe = messageData.key.fromMe;
    
    // Pega o texto da mensagem (depende se é extendedTextMessage ou conversation)
    const textMessage = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || '';

    // Ignora mensagens enviadas pelo próprio bot ou mensagens vazias
    if (isFromMe || !textMessage) {
      return NextResponse.json({ message: 'Ignorado' }, { status: 200 });
    }

    // Extrair apenas o número de telefone (limpar sufixo e non-digits)
    const phone = remoteJid.split('@')[0].replace(/\D/g, '');

    // 2. Identificar o Mestre de Obras pelo telefone
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('id, nome')
      .like('telefone', `%${phone.substring(2)}%`) // Pega os ultimos digitos para contornar codigo de país se precisar
      .single();

    if (userError || !usuario) {
      console.log('Usuário não encontrado para o telefone:', phone);
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 200 }); 
    }

    // 3. Buscar Obra Ativa vinculada a este usuário que tem perguntas pendentes
    const { data: obraFase, error: obraError } = await supabase
      .from('obras')
      .select(`
        id, 
        nome,
        fases!inner (
          id,
          nome,
          ordem,
          status,
          perguntas!inner (
            id,
            texto_pergunta,
            ordem
          )
        )
      `)
      .eq('mestre_obras_id', usuario.id)
      .eq('status', 'ativa')
      .neq('fases.status', 'concluida')
      .order('ordem', { referencedTable: 'fases', ascending: true })
      .limit(1)
      .single();

    if (obraError || !obraFase) {
      return NextResponse.json({ message: 'Nenhuma obra ou fase ativa encontrada.' }, { status: 200 });
    }

    const faseAtual = obraFase.fases[0];
    
    // Precisamos descobrir qual das 2 perguntas ele está respondendo.
    // Verifica quais respostas já existem para esta fase
    const { data: respostasExistentes } = await supabase
      .from('respostas')
      .select('pergunta_id, resposta')
      .eq('fase_id', faseAtual.id);

    const respondidasIds = respostasExistentes?.map(r => r.pergunta_id) || [];
    
    // Pega a próxima pergunta que não foi respondida
    const perguntaPendente = faseAtual.perguntas
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .find((p: any) => !respondidasIds.includes(p.id));

    if (!perguntaPendente) {
      await enviarMensagemWhatsApp(remoteJid, 'Todas as perguntas desta fase já foram respondidas. Obrigado!');
      return NextResponse.json({ message: 'Fase já respondida' }, { status: 200 });
    }

    // 5. Validar Resposta Contextualmente
    const ordemPergunta = perguntaPendente.ordem;
    const respostaTrim = textMessage.trim();
    let respostaFinal = '';

    if (ordemPergunta === 1) {
      const regexValida = /^(SIM|NÃO|NAO|N\/A|NA)$/i;
      if (!regexValida.test(respostaTrim)) {
        await enviarMensagemWhatsApp(remoteJid, 'Resposta inválida. Para esta pergunta, por favor responda apenas com *SIM*, *NÃO* ou *N/A*.');
        return NextResponse.json({ message: 'Resposta inválida' }, { status: 200 });
      }

      const respostaUpper = respostaTrim.toUpperCase();
      if (respostaUpper === 'NAO') {
        respostaFinal = 'NÃO';
      } else if (respostaUpper === 'NA' || respostaUpper === 'N/A') {
        respostaFinal = 'N/A';
      } else {
        respostaFinal = 'SIM';
      }
    } else {
      // Pergunta 2: Percentual
      const regexValida = /^(25%|50%|75%|100%|25|50|75|100)$/i;
      if (!regexValida.test(respostaTrim)) {
        await enviarMensagemWhatsApp(remoteJid, 'Resposta inválida. Para esta pergunta, responda com o percentual executado: *25%*, *50%*, *75%* ou *100%*.');
        return NextResponse.json({ message: 'Resposta inválida' }, { status: 200 });
      }

      const match = respostaTrim.match(/\d+/);
      if (match) {
        respostaFinal = `${match[0]}%`;
      } else {
        respostaFinal = '100%';
      }
    }

    // 4. Salvar a resposta
    const { error: insertError } = await supabase
      .from('respostas')
      .insert({
        obra_id: obraFase.id,
        fase_id: faseAtual.id,
        pergunta_id: perguntaPendente.id,
        resposta: respostaFinal,
        usuario_responsavel: usuario.id
      });

    if (insertError) {
      throw insertError;
    }

    // 5. Verificar se temos alertas críticos (Mais de 2 'NÃO')
    const { count: countNao } = await supabase
      .from('respostas')
      .select('id', { count: 'exact' })
      .eq('obra_id', obraFase.id)
      .eq('resposta', 'NÃO');

    if (countNao && countNao >= 3) {
      await supabase.from('alertas').insert({
        obra_id: obraFase.id,
        fase_id: faseAtual.id,
        tipo: 'critico',
        mensagem: `CRÍTICO: O mestre de obras reportou ${countNao} respostas NÃO. Atenção imediata necessária na obra ${obraFase.nome}.`
      });
    }

    // 6. Enviar confirmação ou a próxima pergunta com desvio condicional
    const pularPergunta2 = (ordemPergunta === 1 && (respostaFinal === 'NÃO' || respostaFinal === 'N/A'));

    if (pularPergunta2) {
      // Pula a Pergunta 2 e busca a próxima fase
      const proximasFases = ((obraFase.fases as any[]) || []).sort((a, b) => a.ordem - b.ordem);
      const proximaFase = proximasFases.find((f: any) => f.ordem > faseAtual.ordem);

      if (proximaFase && proximaFase.perguntas && proximaFase.perguntas.length > 0) {
        const perguntasProxima = proximaFase.perguntas.sort((a: any, b: any) => a.ordem - b.ordem);
        const primeiraPerguntaProxima = perguntasProxima[0];

        await enviarMensagemWhatsApp(
          remoteJid,
          `Anotado! Como esta etapa não foi executada, vamos para a próxima fase *${proximaFase.nome}*.\n\nPergunta 1:\n👉 *${primeiraPerguntaProxima.texto_pergunta}*\n\nResponda com *SIM*, *NÃO* ou *N/A*.`
        );
      } else {
        await enviarMensagemWhatsApp(
          remoteJid,
          `Anotado! Você concluiu todas as fases e perguntas de acompanhamento da obra *${obraFase.nome}*. Excelente trabalho! 🎉`
        );
      }
    } else {
      const temProximaPergunta = faseAtual.perguntas.find((p: any) => p.id !== perguntaPendente.id && !respondidasIds.includes(p.id));
      
      if (temProximaPergunta) {
        await enviarMensagemWhatsApp(remoteJid, `Anotado!\n\nPróxima pergunta da fase *${faseAtual.nome}*:\n\n👉 *${temProximaPergunta.texto_pergunta}*\n\nResponda com *25%*, *50%*, *75%* ou *100%*.`);
      } else {
        // Buscar próxima fase
        const proximasFases = ((obraFase.fases as any[]) || []).sort((a, b) => a.ordem - b.ordem);
        const proximaFase = proximasFases.find((f: any) => f.ordem > faseAtual.ordem);

        if (proximaFase && proximaFase.perguntas && proximaFase.perguntas.length > 0) {
          const perguntasProxima = proximaFase.perguntas.sort((a: any, b: any) => a.ordem - b.ordem);
          const primeiraPerguntaProxima = perguntasProxima[0];

          await enviarMensagemWhatsApp(
            remoteJid,
            `Excelente! Você concluiu a fase *${faseAtual.nome}* da obra *${obraFase.nome}*.\n\nVamos iniciar a próxima fase *${proximaFase.nome}*!\n\nPergunta 1:\n👉 *${primeiraPerguntaProxima.texto_pergunta}*\n\nResponda com *SIM*, *NÃO* ou *N/A*.`
          );
        } else {
          await enviarMensagemWhatsApp(remoteJid, `Perfeito, ${usuario.nome}. Respostas da semana registradas com sucesso. Bom trabalho na obra ${obraFase.nome}!`);
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Erro no webhook do WhatsApp:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Função auxiliar para disparar msg via Evolution API
async function enviarMensagemWhatsApp(remoteJid: string, text: string) {
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
      delay: 1200 // Pequeno delay humano
    })
  });
}
