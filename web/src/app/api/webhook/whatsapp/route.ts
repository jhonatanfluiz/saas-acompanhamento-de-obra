import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase com Service Role para ignorar RLS no Webhook
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações da Evolution API
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL!;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY!;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE!;

// Máximo de tentativas inválidas antes de bloquear a sessão
const MAX_TENTATIVAS_INVALIDAS = 3;

// ─── Logger Persistente (tabela logs_webhook no Supabase) ─────────────────────

interface LogWebhookPayload {
  evento: string;
  phone?: string;
  obra_id?: string | null;
  fase_id?: string | null;
  pergunta_id?: string | null;
  usuario_id?: string | null;
  payload_entrada?: object;
  texto_recebido?: string;
  resposta_processada?: string;
  status?: string;
  mensagem_enviada?: string;
  erro_detalhe?: string;
  duracao_ms?: number;
}

function logWebhook(data: LogWebhookPayload): void {
  // Fire-and-forget: não bloqueia o fluxo principal
  supabase.from('logs_webhook').insert({
    ...data,
    status: data.status ?? 'ok',
  }).then(({ error }) => {
    if (error) console.warn('[Log] Falha ao salvar log:', error.message);
  });
}

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

// ─── Mensagens Prontas (Templates) ────────────────────────────────────────────

function msgSaudacaoInicial(opts: {
  nome: string;
  obraNome: string;
  faseNome: string;
  numFase: number;
  totalFases: number;
  progressoObra: number;
  textoPergunta: string;
  textoId: string;
  isLegacy: boolean;
  ordemPergunta: number;
}): string {
  const instrucao = opts.isLegacy && opts.ordemPergunta === 2
    ? 'Responda com: *25%*, *50%*, *75%* ou *100%*.'
    : 'Responda com: *SIM*, *NÃO* ou *N/A*';

  return (
    `🏗️ *Acompanhamento Semanal de Obra*\n\n` +
    `${saudacaoHora()}, *${opts.nome}*!\n\n` +
    `Chegou a hora do check semanal da obra *${opts.obraNome}* 📋\n\n` +
    `📌 *Fase atual:* ${opts.faseNome} (${opts.numFase} de ${opts.totalFases})\n` +
    `📊 *Progresso da obra:* ${opts.progressoObra.toFixed(1)}%\n\n` +
    `Vamos começar:\n\n` +
    `👉 *${opts.textoId}${opts.textoPergunta}*\n\n` +
    instrucao
  );
}

function msgRetomada(opts: {
  nome: string;
  obraNome: string;
  faseNome: string;
  respondidas: number;
  totalPerguntas: number;
  textoPergunta: string;
  textoId: string;
  isLegacy: boolean;
  ordemPergunta: number;
}): string {
  const instrucao = opts.isLegacy && opts.ordemPergunta === 2
    ? 'Responda com: *25%*, *50%*, *75%* ou *100%*.'
    : 'Responda com: *SIM*, *NÃO* ou *N/A*';

  return (
    `🔄 *Retomando seu questionário!*\n\n` +
    `${saudacaoHora()}, *${opts.nome}*! Você tem respostas pendentes da obra *${opts.obraNome}*.\n\n` +
    `📌 *Fase:* ${opts.faseNome}\n` +
    `📝 *Progresso nesta fase:* ${opts.respondidas} de ${opts.totalPerguntas} perguntas respondidas\n\n` +
    `Continuando de onde paramos:\n\n` +
    `👉 *${opts.textoId}${opts.textoPergunta}*\n\n` +
    instrucao
  );
}

function msgConfirmacaoProximaPergunta(opts: {
  faseNome: string;
  textoPergunta: string;
  textoId: string;
  isLegacy: boolean;
  ordemPergunta: number;
}): string {
  const instrucao = opts.isLegacy && opts.ordemPergunta === 2
    ? 'Responda com: *25%*, *50%*, *75%* ou *100%*.'
    : 'Responda com: *SIM*, *NÃO* ou *N/A*';

  return (
    `✅ Anotado!\n\n` +
    `👉 *${opts.textoId}${opts.textoPergunta}*\n\n` +
    instrucao
  );
}

function msgAvancaFase(opts: {
  faseConcluida: string;
  proximaFaseNome: string;
  textoPergunta: string;
  textoId: string;
  isLegacy: boolean;
  ordemPergunta: number;
}): string {
  const instrucao = opts.isLegacy && opts.ordemPergunta === 2
    ? 'Responda com: *25%*, *50%*, *75%* ou *100%*.'
    : 'Responda com: *SIM*, *NÃO* ou *N/A*';

  return (
    `✅ Fase *${opts.faseConcluida}* concluída!\n\n` +
    `🔄 Avançando para: *${opts.proximaFaseNome}*\n\n` +
    `👉 *${opts.textoId}${opts.textoPergunta}*\n\n` +
    instrucao
  );
}

function msgPulaPergunta2(opts: {
  faseConcluida: string;
  proximaFaseNome: string | null;
  textoPergunta: string | null;
  textoId: string;
  obraNome: string;
}): string {
  if (opts.proximaFaseNome && opts.textoPergunta) {
    return (
      `Anotado! Como esta etapa não foi executada, avançamos para a próxima fase.\n\n` +
      `🔄 *${opts.proximaFaseNome}*\n\n` +
      `👉 *${opts.textoId}${opts.textoPergunta}*\n\n` +
      `Responda com: *SIM*, *NÃO* ou *N/A*`
    );
  }
  return msgEncerramento({ nome: '', obraNome: opts.obraNome, progresso: 100, fasesConc: 0, totalFases: 0 });
}

function msgEncerramento(opts: {
  nome: string;
  obraNome: string;
  progresso: number;
  fasesConc: number;
  totalFases: number;
}): string {
  return (
    `🎉 *Questionário concluído!*\n\n` +
    `Parabéns${opts.nome ? `, *${opts.nome}*` : ''}! Todas as fases da obra foram registradas.\n\n` +
    `📊 *Resumo da obra ${opts.obraNome}:*\n` +
    `• Progresso total: *${opts.progresso.toFixed(1)}%*\n` +
    (opts.totalFases > 0
      ? `• Fases concluídas: *${opts.fasesConc} de ${opts.totalFases}*\n`
      : '') +
    `• Registrado em: ${formatarDataHoraBRT()}\n\n` +
    `Obrigado pelo acompanhamento! Até a semana que vem 👷‍♂️`
  );
}

function msgRespostaInvalida(opts: {
  textoPergunta: string;
  isPercentual: boolean;
  tentativa: number;
}): string {
  if (opts.isPercentual) {
    return (
      `⚠️ Percentual inválido (tentativa ${opts.tentativa} de ${MAX_TENTATIVAS_INVALIDAS}).\n\n` +
      `Para esta fase, informe o percentual executado:\n` +
      `• *25%* — Início dos trabalhos\n` +
      `• *50%* — Metade concluída\n` +
      `• *75%* — Quase finalizado\n` +
      `• *100%* — Totalmente concluído\n\n` +
      `👉 *${opts.textoPergunta}*`
    );
  }
  return (
    `⚠️ Resposta não reconhecida (tentativa ${opts.tentativa} de ${MAX_TENTATIVAS_INVALIDAS}).\n\n` +
    `Por favor, responda apenas com:\n` +
    `• *SIM* — se foi executado\n` +
    `• *NÃO* — se não foi executado\n` +
    `• *N/A* — se não se aplica\n\n` +
    `👉 *${opts.textoPergunta}*`
  );
}

function msgBloqueio(): string {
  return (
    `🚫 *Questionário pausado.*\n\n` +
    `Detectamos ${MAX_TENTATIVAS_INVALIDAS} respostas inválidas consecutivas.\n\n` +
    `O preenchimento foi suspenso para evitar registros incorretos.\n` +
    `Por favor, entre em contato com o responsável pelo sistema para retomar.\n\n` +
    `_Horário do bloqueio: ${formatarDataHoraBRT()}_`
  );
}

// ─── Função auxiliar para enviar mensagem via Evolution API ───────────────────

async function enviarMensagemWhatsApp(remoteJid: string, text: string): Promise<void> {
  try {
    const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: remoteJid, text, delay: 1200 }),
    });
  } catch (err: any) {
    console.warn(`[Webhook] Falha ao enviar mensagem WhatsApp:`, err.message);
  }
}

// ─── Sessão de Conversa ───────────────────────────────────────────────────────

async function upsertSessao(phone: string, obraId: string, faseId: string, tentativas: number = 0) {
  await supabase.from('sessao_conversa').upsert(
    {
      phone,
      obra_id: obraId,
      fase_id: faseId,
      tentativas_invalidas: tentativas,
      ultima_mensagem_em: new Date().toISOString(),
    },
    { onConflict: 'phone' }
  );
}

async function incrementarTentativasInvalidas(phone: string): Promise<number> {
  const { data } = await supabase
    .from('sessao_conversa')
    .select('tentativas_invalidas')
    .eq('phone', phone)
    .single();

  const novasTentativas = (data?.tentativas_invalidas ?? 0) + 1;

  await supabase
    .from('sessao_conversa')
    .update({ tentativas_invalidas: novasTentativas, ultima_mensagem_em: new Date().toISOString() })
    .eq('phone', phone);

  return novasTentativas;
}

async function resetarTentativas(phone: string) {
  await supabase
    .from('sessao_conversa')
    .update({ tentativas_invalidas: 0, ultima_mensagem_em: new Date().toISOString() })
    .eq('phone', phone);
}

// ─── Handler Principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const inicioRequisicao = Date.now();

  try {
    const body = await req.json();

    // Ignorar eventos sem payload de mensagem
    if (!body.data || !body.data.message) {
      logWebhook({ evento: 'payload_ignorado', status: 'ignorado', payload_entrada: body });
      return NextResponse.json({ message: 'Payload ignorado' }, { status: 200 });
    }

    const messageData = body.data;
    const remoteJid: string = messageData.key.remoteJid;
    const isFromMe: boolean = messageData.key.fromMe;

    // Extrair texto da mensagem (conversation ou extendedTextMessage)
    const textMessage: string =
      messageData.message?.conversation ||
      messageData.message?.extendedTextMessage?.text ||
      '';

    // Ignorar mensagens do próprio bot ou vazias
    if (isFromMe || !textMessage) {
      logWebhook({ evento: 'mensagem_do_bot_ignorada', status: 'ignorado', phone: remoteJid.split('@')[0] });
      return NextResponse.json({ message: 'Ignorado' }, { status: 200 });
    }

    // ── 1. Extrair número de telefone ──────────────────────────────────────────
    const phone = remoteJid.split('@')[0].replace(/\D/g, '');

    // Log de recebimento
    logWebhook({
      evento: 'mensagem_recebida',
      phone,
      texto_recebido: textMessage,
      payload_entrada: body,
      status: 'ok',
    });

    // ── 2. Identificar Usuário pelo telefone ───────────────────────────────────
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('id, nome')
      .ilike('telefone', `%${phone.slice(-8)}%`)
      .single();

    let usuarioId: string | null = null;
    let usuarioNome = 'Mestre';
    let obra: any = null;

    if (usuario) {
      usuarioId = usuario.id;
      usuarioNome = usuario.nome;

      const { data: obraRes } = await supabase
        .from('obras')
        .select(`
          id, nome, progresso_total,
          fases (
            id, nome, ordem, status,
            perguntas (
              id, texto_pergunta, ordem, peso, identificador_unico
            )
          )
        `)
        .eq('mestre_obras_id', usuario.id)
        .eq('status', 'ativa')
        .filter('fases.status', 'neq', 'concluida')
        .order('ordem', { referencedTable: 'fases', ascending: true })
        .limit(1)
        .single();

      if (obraRes) obra = obraRes;
    }

    // Fallback: busca pelo manager_phone
    if (!obra) {
      const { data: obraRes } = await supabase
        .from('obras')
        .select(`
          id, nome, progresso_total, manager_name, manager_phone,
          fases (
            id, nome, ordem, status,
            perguntas (
              id, texto_pergunta, ordem, peso, identificador_unico
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
        console.log('[Webhook] Obra não encontrada para o telefone:', phone);
        logWebhook({
          evento: 'usuario_nao_encontrado',
          phone,
          texto_recebido: textMessage,
          status: 'ignorado',
          erro_detalhe: 'Telefone não vinculado a nenhuma obra ativa',
          duracao_ms: Date.now() - inicioRequisicao,
        });
        return NextResponse.json({ error: 'Mestre ou Obra não encontrada' }, { status: 200 });
      }

      obra = obraRes;
      usuarioNome = obra.manager_name || 'Mestre';
    }

    // ── 3. Verificar se há fases pendentes ────────────────────────────────────
    if (!obra.fases || obra.fases.length === 0) {
      await enviarMensagemWhatsApp(
        remoteJid,
        msgEncerramento({
          nome: usuarioNome,
          obraNome: obra.nome,
          progresso: obra.progresso_total ?? 100,
          fasesConc: 0,
          totalFases: 0,
        })
      );
      return NextResponse.json({ message: 'Obra concluída' }, { status: 200 });
    }

    const faseAtual = (obra.fases as any[])[0];

    // ── 4. Buscar Respostas Existentes (estado da sessão atual) ───────────────
    const { data: respostasExistentes } = await supabase
      .from('respostas')
      .select('pergunta_id')
      .eq('fase_id', faseAtual.id);

    const respondidasIds = respostasExistentes?.map((r) => r.pergunta_id) || [];
    const perguntasOrdenadas = (faseAtual.perguntas as any[]).sort(
      (a, b) => a.ordem - b.ordem
    );
    const perguntaPendente = perguntasOrdenadas.find(
      (p) => !respondidasIds.includes(p.id)
    );

    if (!perguntaPendente) {
      return NextResponse.json({ message: 'Fase já concluída' }, { status: 200 });
    }

    // ── 5. Verificar sessão para controle de tentativas inválidas ─────────────
    const { data: sessaoAtual } = await supabase
      .from('sessao_conversa')
      .select('tentativas_invalidas')
      .eq('phone', phone)
      .single();

    const tentativasAtuais = sessaoAtual?.tentativas_invalidas ?? 0;

    // Se já está bloqueado (>= MAX e resposta inválida anterior), avisa novamente
    if (tentativasAtuais >= MAX_TENTATIVAS_INVALIDAS) {
      const msgBloquear = msgBloqueio();
      await enviarMensagemWhatsApp(remoteJid, msgBloquear);
      logWebhook({
        evento: 'sessao_bloqueada',
        phone,
        obra_id: obra?.id,
        fase_id: faseAtual?.id,
        usuario_id: usuarioId,
        texto_recebido: textMessage,
        status: 'bloqueado',
        mensagem_enviada: msgBloquear,
        erro_detalhe: `${tentativasAtuais} tentativas inválidas acumuladas`,
        duracao_ms: Date.now() - inicioRequisicao,
      });
      return NextResponse.json({ message: 'Sessão bloqueada por tentativas inválidas' }, { status: 200 });
    }

    // ── 6. Contexto para detectar primeiro disparo (retomada) ─────────────────
    const isPrimeiraPergunta = respondidasIds.length === 0;
    const p2 = perguntasOrdenadas.find((p: any) => p.ordem === 2);
    const isLegacy =
      perguntasOrdenadas.length === 2 &&
      p2 &&
      (/percentual/i.test(p2.texto_pergunta) || /porcentagem/i.test(p2.texto_pergunta));
    const ordemPergunta = perguntaPendente.ordem;
    const textoId = perguntaPendente.identificador_unico
      ? `[${perguntaPendente.identificador_unico}] `
      : '';

    // ── 7. Verificar se a mensagem recebida é uma SAUDAÇÃO/RETOMADA ───────────
    // Se o usuário manda qualquer coisa antes de começar (ex: "oi", "retomar")
    // e ainda não respondeu nada nesta fase → enviar saudação/retomada
    const respostaTrim = textMessage.trim();
    const regexRespostaSimNaoNa = /^(SIM|NÃO|NAO|N\/A|NA)$/i;
    const regexRespostaPercentual = /^(25%?|50%?|75%?|100%?)$/i;

    const ehRespostaValidaParaContexto =
      (!isLegacy || ordemPergunta === 1)
        ? regexRespostaSimNaoNa.test(respostaTrim)
        : regexRespostaPercentual.test(respostaTrim);

    // ── 7a. Se for primeiro contato ou retomada (mensagem não é resposta válida) ──
    if (!ehRespostaValidaParaContexto && isPrimeiraPergunta) {
      // Buscar total de fases para informar progresso
      const { data: todasFases } = await supabase
        .from('fases')
        .select('id, ordem')
        .eq('obra_id', obra.id);
      const totalFases = todasFases?.length ?? 1;
      const numFaseAtual = faseAtual.ordem;

      await upsertSessao(phone, obra.id, faseAtual.id, 0);
      await enviarMensagemWhatsApp(
        remoteJid,
        msgSaudacaoInicial({
          nome: usuarioNome,
          obraNome: obra.nome,
          faseNome: faseAtual.nome,
          numFase: numFaseAtual,
          totalFases,
          progressoObra: obra.progresso_total ?? 0,
          textoPergunta: perguntaPendente.texto_pergunta,
          textoId,
          isLegacy,
          ordemPergunta,
        })
      );
      return NextResponse.json({ message: 'Saudação enviada' }, { status: 200 });
    }

    // ── 7b. Se tem respostas parciais e a mensagem não é válida → retomada ────
    if (!ehRespostaValidaParaContexto && !isPrimeiraPergunta) {
      await upsertSessao(phone, obra.id, faseAtual.id, 0);
      await enviarMensagemWhatsApp(
        remoteJid,
        msgRetomada({
          nome: usuarioNome,
          obraNome: obra.nome,
          faseNome: faseAtual.nome,
          respondidas: respondidasIds.length,
          totalPerguntas: perguntasOrdenadas.length,
          textoPergunta: perguntaPendente.texto_pergunta,
          textoId,
          isLegacy,
          ordemPergunta,
        })
      );
      return NextResponse.json({ message: 'Mensagem de retomada enviada' }, { status: 200 });
    }

    // ── 8. Validar Resposta ───────────────────────────────────────────────────
    let respostaFinal = '';
    const isPercentual = isLegacy && ordemPergunta === 2;

    if (!isPercentual) {
      if (!regexRespostaSimNaoNa.test(respostaTrim)) {
        const novasTentativas = await incrementarTentativasInvalidas(phone);
        let msgInvalida: string;
        if (novasTentativas >= MAX_TENTATIVAS_INVALIDAS) {
          msgInvalida = msgBloqueio();
          await enviarMensagemWhatsApp(remoteJid, msgInvalida);
        } else {
          msgInvalida = msgRespostaInvalida({
            textoPergunta: perguntaPendente.texto_pergunta,
            isPercentual: false,
            tentativa: novasTentativas,
          });
          await enviarMensagemWhatsApp(remoteJid, msgInvalida);
        }
        logWebhook({
          evento: 'resposta_invalida',
          phone,
          obra_id: obra?.id,
          fase_id: faseAtual?.id,
          pergunta_id: perguntaPendente?.id,
          usuario_id: usuarioId,
          texto_recebido: textMessage,
          status: novasTentativas >= MAX_TENTATIVAS_INVALIDAS ? 'bloqueado' : 'invalido',
          mensagem_enviada: msgInvalida,
          erro_detalhe: `Resposta SIM/NÃO/N/A inválida. Tentativa ${novasTentativas}/${MAX_TENTATIVAS_INVALIDAS}`,
          duracao_ms: Date.now() - inicioRequisicao,
        });
        return NextResponse.json({ message: 'Resposta inválida' }, { status: 200 });
      }

      const upper = respostaTrim.toUpperCase();
      if (upper === 'NAO') respostaFinal = 'NÃO';
      else if (upper === 'NA' || upper === 'N/A') respostaFinal = 'N/A';
      else respostaFinal = 'SIM';
    } else {
      // Pergunta 2 do modelo clássico — percentual
      if (!regexRespostaPercentual.test(respostaTrim)) {
        const novasTentativas = await incrementarTentativasInvalidas(phone);
        let msgInvalidaPerc: string;
        if (novasTentativas >= MAX_TENTATIVAS_INVALIDAS) {
          msgInvalidaPerc = msgBloqueio();
          await enviarMensagemWhatsApp(remoteJid, msgInvalidaPerc);
        } else {
          msgInvalidaPerc = msgRespostaInvalida({
            textoPergunta: perguntaPendente.texto_pergunta,
            isPercentual: true,
            tentativa: novasTentativas,
          });
          await enviarMensagemWhatsApp(remoteJid, msgInvalidaPerc);
        }
        logWebhook({
          evento: 'resposta_invalida',
          phone,
          obra_id: obra?.id,
          fase_id: faseAtual?.id,
          pergunta_id: perguntaPendente?.id,
          usuario_id: usuarioId,
          texto_recebido: textMessage,
          status: novasTentativas >= MAX_TENTATIVAS_INVALIDAS ? 'bloqueado' : 'invalido',
          mensagem_enviada: msgInvalidaPerc,
          erro_detalhe: `Resposta percentual inválida. Tentativa ${novasTentativas}/${MAX_TENTATIVAS_INVALIDAS}`,
          duracao_ms: Date.now() - inicioRequisicao,
        });
        return NextResponse.json({ message: 'Resposta inválida' }, { status: 200 });
      }

      const match = respostaTrim.match(/\d+/);
      respostaFinal = match ? `${match[0]}%` : '100%';
    }

    // ── 9. Resposta válida: resetar tentativas e salvar ───────────────────────
    await resetarTentativas(phone);

    const { error: insertError } = await supabase.from('respostas').insert({
      obra_id: obra.id,
      fase_id: faseAtual.id,
      pergunta_id: perguntaPendente.id,
      resposta: respostaFinal,
      usuario_responsavel: usuarioId,
      data_resposta: new Date().toISOString(),
    });

    if (insertError) {
      logWebhook({
        evento: 'erro_salvar_resposta',
        phone,
        obra_id: obra?.id,
        fase_id: faseAtual?.id,
        pergunta_id: perguntaPendente?.id,
        usuario_id: usuarioId,
        texto_recebido: textMessage,
        resposta_processada: respostaFinal,
        status: 'erro',
        erro_detalhe: insertError.message,
        duracao_ms: Date.now() - inicioRequisicao,
      });
      throw insertError;
    }

    // Log de resposta salva com sucesso
    logWebhook({
      evento: 'resposta_salva',
      phone,
      obra_id: obra.id,
      fase_id: faseAtual.id,
      pergunta_id: perguntaPendente.id,
      usuario_id: usuarioId,
      texto_recebido: textMessage,
      resposta_processada: respostaFinal,
      status: 'ok',
    });

    // ── 10. Fluxo pós-resposta ─────────────────────────────────────────────────
    // No modelo clássico (Legacy): pular pergunta 2 se P1 for NÃO/N/A
    const pularPergunta2 =
      isLegacy && ordemPergunta === 1 && (respostaFinal === 'NÃO' || respostaFinal === 'N/A');

    const fasesOrdenadas = ((obra.fases as any[]) || []).sort((a, b) => a.ordem - b.ordem);

    if (pularPergunta2) {
      // Avançar direto para a próxima fase
      const proximaFase = fasesOrdenadas.find((f: any) => f.ordem > faseAtual.ordem);
      if (proximaFase && proximaFase.perguntas?.length > 0) {
        const pp = proximaFase.perguntas.sort((a: any, b: any) => a.ordem - b.ordem)[0];
        const tid = pp.identificador_unico ? `[${pp.identificador_unico}] ` : '';
        await upsertSessao(phone, obra.id, proximaFase.id, 0);
        await enviarMensagemWhatsApp(
          remoteJid,
          msgPulaPergunta2({
            faseConcluida: faseAtual.nome,
            proximaFaseNome: proximaFase.nome,
            textoPergunta: pp.texto_pergunta,
            textoId: tid,
            obraNome: obra.nome,
          })
        );
      } else {
        // Obra concluída
        const { data: obraFinal } = await supabase
          .from('obras')
          .select('progresso_total')
          .eq('id', obra.id)
          .single();

        const { data: todasFases } = await supabase
          .from('fases')
          .select('id, status')
          .eq('obra_id', obra.id);

        const fasesConc = todasFases?.filter((f) => f.status === 'concluida').length ?? 0;

        await enviarMensagemWhatsApp(
          remoteJid,
          msgEncerramento({
            nome: usuarioNome,
            obraNome: obra.nome,
            progresso: obraFinal?.progresso_total ?? 100,
            fasesConc,
            totalFases: todasFases?.length ?? 0,
          })
        );
      }
    } else {
      // Verificar se há próxima pergunta na mesma fase
      const proximaPergunta = perguntasOrdenadas.find(
        (p: any) => p.id !== perguntaPendente.id && !respondidasIds.includes(p.id)
      );

      if (proximaPergunta) {
        const isProxPercentual = isLegacy && proximaPergunta.ordem === 2;
        const tidProx = proximaPergunta.identificador_unico
          ? `[${proximaPergunta.identificador_unico}] `
          : '';
        await upsertSessao(phone, obra.id, faseAtual.id, 0);
        await enviarMensagemWhatsApp(
          remoteJid,
          msgConfirmacaoProximaPergunta({
            faseNome: faseAtual.nome,
            textoPergunta: proximaPergunta.texto_pergunta,
            textoId: tidProx,
            isLegacy,
            ordemPergunta: proximaPergunta.ordem,
          })
        );
      } else {
        // Fase concluída — avançar para próxima fase
        const proximaFase = fasesOrdenadas.find((f: any) => f.ordem > faseAtual.ordem);

        if (proximaFase && proximaFase.perguntas?.length > 0) {
          const ppProxFase = proximaFase.perguntas.sort(
            (a: any, b: any) => a.ordem - b.ordem
          )[0];
          const tidProxFase = ppProxFase.identificador_unico
            ? `[${ppProxFase.identificador_unico}] `
            : '';
          await upsertSessao(phone, obra.id, proximaFase.id, 0);
          await enviarMensagemWhatsApp(
            remoteJid,
            msgAvancaFase({
              faseConcluida: faseAtual.nome,
              proximaFaseNome: proximaFase.nome,
              textoPergunta: ppProxFase.texto_pergunta,
              textoId: tidProxFase,
              isLegacy,
              ordemPergunta: ppProxFase.ordem,
            })
          );
        } else {
          // Obra toda concluída
          const { data: obraFinal } = await supabase
            .from('obras')
            .select('progresso_total')
            .eq('id', obra.id)
            .single();

          const { data: todasFases } = await supabase
            .from('fases')
            .select('id, status')
            .eq('obra_id', obra.id);

          const fasesConc = todasFases?.filter((f) => f.status === 'concluida').length ?? 0;

          await enviarMensagemWhatsApp(
            remoteJid,
            msgEncerramento({
              nome: usuarioNome,
              obraNome: obra.nome,
              progresso: obraFinal?.progresso_total ?? 100,
              fasesConc,
              totalFases: todasFases?.length ?? 0,
            })
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Webhook] Erro:', error);
    logWebhook({
      evento: 'erro_inesperado',
      status: 'erro',
      erro_detalhe: error?.message ?? String(error),
      duracao_ms: Date.now() - inicioRequisicao,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
