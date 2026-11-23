import type { IncomingMessage, ServerResponse } from 'node:http';

const ONLINECOMPILER_ENDPOINT = 'https://api.onlinecompiler.io/api/run-code-sync/';

export const COMPILER_ID_MAP: Record<string, string> = {
  python: 'python-3.14',
  py: 'python-3.14',
  cpp: 'g++-15',
  'c++': 'g++-15',
  node: 'nodejs-24',
  nodejs: 'nodejs-24',
  js: 'nodejs-24',
  javascript: 'nodejs-24',
  java: 'openjdk-25',
};

export interface ServerlessRequest extends IncomingMessage {
  body?: unknown;
}

export interface ServerlessResponse extends ServerResponse {
  status?: (code: number) => ServerlessResponse;
  json?: (payload: unknown) => unknown;
}

function sendJson(res: ServerlessResponse, statusCode: number, payload: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const nextRes = res.status(statusCode);
    if (typeof nextRes?.json === 'function') {
      nextRes.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function parseRequestBody(req: ServerlessRequest): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return (req.body.trim() ? JSON.parse(req.body) : {}) as Record<string, unknown>;
    }
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (Buffer.isBuffer(req.body)) {
      const text = req.body.toString('utf8').trim();
      return (text ? JSON.parse(text) : {}) as Record<string, unknown>;
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function mapLanguageToCompiler(language: unknown): string | null {
  if (typeof language !== 'string') return null;
  const key = language.trim().toLowerCase();
  return COMPILER_ID_MAP[key] || null;
}

export default async function handler(
  req: ServerlessRequest,
  res: ServerlessResponse
): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ONLINECOMPILER_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 500, {
      error: 'Missing ONLINECOMPILER_API_KEY environment variable on the server.',
    });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await parseRequestBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

  const { language, code, input } = body;
  const compiler = mapLanguageToCompiler(language);
  if (!compiler) {
    sendJson(res, 400, {
      error: `Unsupported language "${String(language ?? '')}". Supported: python, cpp, node, js, java.`,
    });
    return;
  }

  if (typeof code !== 'string' || !code.trim()) {
    sendJson(res, 400, { error: 'Code cannot be empty.' });
    return;
  }

  const stdinInput = typeof input === 'string' ? input : '';

  try {
    const upstream = await fetch(ONLINECOMPILER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        compiler,
        code,
        input: stdinInput,
      }),
    });

    const rawText = await upstream.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
    } catch {
      parsed = null;
    }

    if (!parsed) {
      sendJson(res, upstream.ok ? 502 : upstream.status, {
        error: rawText.trim() || `Compiler service returned non-JSON response (HTTP ${upstream.status}).`,
      });
      return;
    }

    if (!upstream.ok && !('output' in parsed) && !('exit_code' in parsed)) {
      const errMsg =
        typeof parsed.error === 'string'
          ? parsed.error
          : typeof parsed.detail === 'string'
          ? parsed.detail
          : typeof parsed.message === 'string'
          ? parsed.message
          : `Compiler service error (HTTP ${upstream.status}).`;
      sendJson(res, upstream.status, { error: errMsg });
      return;
    }

    sendJson(res, 200, {
      output: typeof parsed.output === 'string' ? parsed.output : '',
      error: typeof parsed.error === 'string' ? parsed.error : '',
      status: parsed.status ?? null,
      exit_code: typeof parsed.exit_code === 'number' ? parsed.exit_code : 0,
      time: parsed.time ?? null,
      memory: parsed.memory ?? null,
    });
  } catch (err) {
    sendJson(res, 502, {
      error: err instanceof Error ? err.message : 'Failed to reach OnlineCompiler.io service.',
    });
  }
}
