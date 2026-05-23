import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa Supabase com Service Role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface LinhaSheet {
  id_resposta: string;
  data_resposta: string;
  construtora: string;
  obra: string;
  fase: string;
  pergunta: string;
  resposta: string;
  responsavel: string;
  progresso_fase: number;
  progresso_obra: number;
}

// ─── Autenticação com Google via Service Account ───────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  // Usa as variáveis de ambiente com as credenciais do Service Account Google
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  // Monta o JWT header e payload
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const payload = btoa(JSON.stringify({
    iss: serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now,
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Assina com a chave privada usando Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);

  const keyData = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(pemToArrayBuffer(privateKey)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyData, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${header}.${payload}.${signatureB64}`;

  // Troca o JWT por um Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    throw new Error(`Falha ao obter token Google: ${await tokenRes.text()}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): string {
  return pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
}

function str2ab(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ─── Append na planilha Google Sheets ─────────────────────────────────────────

async function appendToSheet(accessToken: string, linhas: LinhaSheet[]): Promise<void> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
  const range = 'Respostas!A:J';

  const values = linhas.map((l) => [
    l.id_resposta,
    l.data_resposta,
    l.construtora,
    l.obra,
    l.fase,
    l.pergunta,
    l.resposta,
    l.responsavel,
    `${l.progresso_fase.toFixed(1)}%`,
    `${l.progresso_obra.toFixed(1)}%`,
  ]);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    throw new Error(`Google Sheets API erro: ${await res.text()}`);
  }
}

// ─── Handler POST: Sincronizar uma resposta específica ────────────────────────

/**
 * POST /api/sync/google-sheets
 * Sincroniza respostas com a planilha Google Sheets.
 * 
 * Body (opcional):
 * { obra_id?: string, desde?: string (ISO date) }
 * 
 * Protegido por CRON_SECRET.
 */
export async function POST(req: Request) {
  try {
    // Validação de segurança
    const authHeader = req.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;
    const cronSecret = process.env.CRON_SECRET || 'chave_secreta_padrao_desenvolvimento_123';

    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Verificar se as variáveis de ambiente estão configuradas
    if (!process.env.GOOGLE_SHEETS_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      return NextResponse.json(
        { error: 'Integração Google Sheets não configurada. Defina GOOGLE_SHEETS_ID e GOOGLE_SERVICE_ACCOUNT_EMAIL no .env.local.' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { obra_id, desde } = body as { obra_id?: string; desde?: string };

    // Buscar respostas do Supabase com joins completos
    let query = supabase
      .from('respostas')
      .select(`
        id,
        data_resposta,
        resposta,
        obras (
          nome,
          progresso_total,
          tenants ( name )
        ),
        fases ( nome, progresso ),
        perguntas ( texto_pergunta ),
        usuarios ( nome )
      `)
      .order('data_resposta', { ascending: true });

    if (obra_id) query = query.eq('obra_id', obra_id);
    if (desde) query = query.gte('data_resposta', desde);

    const { data: respostas, error } = await query;

    if (error) throw error;
    if (!respostas || respostas.length === 0) {
      return NextResponse.json({ success: true, sincronizadas: 0 });
    }

    // Mapear para o formato da planilha
    const linhas: LinhaSheet[] = respostas.map((r: any) => ({
      id_resposta: r.id,
      data_resposta: new Date(r.data_resposta).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      construtora: r.obras?.tenants?.name ?? 'N/A',
      obra: r.obras?.nome ?? 'N/A',
      fase: r.fases?.nome ?? 'N/A',
      pergunta: r.perguntas?.texto_pergunta ?? 'N/A',
      resposta: r.resposta,
      responsavel: r.usuarios?.nome ?? 'Não identificado',
      progresso_fase: r.fases?.progresso ?? 0,
      progresso_obra: r.obras?.progresso_total ?? 0,
    }));

    // Obter token Google e fazer append
    const accessToken = await getGoogleAccessToken();
    await appendToSheet(accessToken, linhas);

    return NextResponse.json({
      success: true,
      sincronizadas: linhas.length,
      message: `${linhas.length} resposta(s) sincronizada(s) com o Google Sheets.`,
    });

  } catch (error: any) {
    console.error('[Sync Sheets] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Handler GET: Status da integração ────────────────────────────────────────

export async function GET() {
  const configurado = !!(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  return NextResponse.json({
    configurado,
    spreadsheet_id: process.env.GOOGLE_SHEETS_ID ?? null,
    service_account: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null,
    instrucoes: configurado ? null : {
      passo1: 'Crie um projeto no Google Cloud Console',
      passo2: 'Ative a API Google Sheets',
      passo3: 'Crie uma Service Account e baixe o JSON de credenciais',
      passo4: 'Compartilhe a planilha com o e-mail da Service Account (permissão de Editor)',
      passo5: 'Adicione ao .env.local: GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    },
  });
}
