import { NextRequest, NextResponse } from 'next/server';
import { requireFinanceRead } from '@/lib/api-auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_SYSTEM_CONTEXT_LENGTH = 8000;
const MAX_MODEL_LENGTH = 100;
const ALLOWED_MODELS = new Set([
  'google/gemini-2.0-flash-001',
  'arcee-ai/trinity-large-preview:free',
  'stepfun/step-3.5-flash:free',
  'openai/gpt-oss-120b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'arcee-ai/trinity-mini:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'upstage/solar-pro-3:free',
  'openai/gpt-4o-mini',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'z-ai/glm-4.5-air',
  'mistralai/mistral-small-3.1-24b-instruct',
]);

interface ChatRequest {
  model: string;
  keyIdx?: number;   // 0 = OPENROUTER_API_KEY, 1–11 = OPENROUTER_API_KEY_N
  systemContext: string;
  messages: ChatMessage[];
}

function clampText(input: unknown, maxLength: number): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return '';
  return value.slice(0, maxLength);
}

function isValidMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== 'object') return false;
  const candidate = message as Partial<ChatMessage>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string'
  );
}

// ─── Select the API key for the requested model ───────────────────────────────
function pickApiKey(keyIdx = 0): string {
  if (keyIdx >= 1 && keyIdx <= 11) {
    const k = process.env[`OPENROUTER_API_KEY_${keyIdx}`];
    if (k) return k;
  }
  // keyIdx 0 or missing numbered key → use the Free Models Router key
  return process.env.OPENROUTER_API_KEY ?? '';
}

// ─── POST /api/fluktuasi/chat ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireFinanceRead(req);
  if ('error' in auth) return auth.error;

  const clientIp = getClientIp(req);
  const ipRateLimit = await checkRateLimit(`fluktuasi-chat:uid:${auth.user.uid}:ip:${clientIp}`, 25, 60_000);
  if (!ipRateLimit.allowed) {
    return NextResponse.json(
      { error: 'Terlalu banyak request chat. Coba lagi sebentar.' },
      { status: 429, headers: { 'Retry-After': String(ipRateLimit.retryAfterSec) } }
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 });
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const keyIdx = Number.isInteger(body.keyIdx) ? Number(body.keyIdx) : 0;
  const systemContext = clampText(body.systemContext, MAX_SYSTEM_CONTEXT_LENGTH) || 'Kamu adalah analis keuangan senior perusahaan Indonesia.';
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!model || model.length > MAX_MODEL_LENGTH || !ALLOWED_MODELS.has(model)) {
    return NextResponse.json({ error: 'Model tidak didukung' }, { status: 400 });
  }

  if (!Number.isInteger(keyIdx) || keyIdx < 0 || keyIdx > 11) {
    return NextResponse.json({ error: 'keyIdx tidak valid' }, { status: 400 });
  }

  const apiKey = pickApiKey(keyIdx);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Tidak ada OPENROUTER_API_KEY yang dikonfigurasi di .env.local' },
      { status: 500 },
    );
  }

  if (!messages.length || messages.length > MAX_MESSAGES) {
    return NextResponse.json({ error: 'messages tidak boleh kosong' }, { status: 400 });
  }

  if (!messages.every(isValidMessage)) {
    return NextResponse.json({ error: 'Format messages tidak valid' }, { status: 400 });
  }

  // Build messages array with system context as the first message
  const orMessages = [
    { role: 'system', content: systemContext },
    ...messages.map((message) => ({
      role: message.role,
      content: clampText(message.content, MAX_MESSAGE_LENGTH) || '',
    })),
  ];

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://sig-activa.vercel.app',
        'X-Title': 'SIG Activa Fluktuasi Chat',
      },
      body: JSON.stringify({
        model,
        messages: orMessages,
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('OpenRouter chat error:', orRes.status, errText.slice(0, 500));
      // Return a friendlier message for rate-limit errors
      if (orRes.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit tercapai. Coba lagi dalam beberapa detik, atau ganti model.' },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: `OpenRouter error ${orRes.status}: ${errText.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = await orRes.json();
    const reply: string = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('Chat route error:', err);
    return NextResponse.json({ error: 'Gagal menghubungi OpenRouter' }, { status: 500 });
  }
}
