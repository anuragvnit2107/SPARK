import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler, {
  COMPILER_ID_MAP,
  mapLanguageToCompiler,
  type ServerlessRequest,
  type ServerlessResponse,
} from '../../api/run';

function createMockReqRes(options: {
  method?: string;
  body?: unknown;
}): {
  req: ServerlessRequest;
  res: ServerlessResponse;
  getResult: () => { statusCode: number; payload: Record<string, unknown> };
} {
  const req = Readable.from([]) as unknown as ServerlessRequest;
  req.method = options.method || 'POST';
  req.body = options.body;

  let statusCode = 200;
  let bodyText = '';
  const headers: Record<string, string> = {};

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      bodyText = JSON.stringify(payload);
      return res;
    },
    end(chunk?: unknown) {
      if (chunk) bodyText = String(chunk);
    },
  } as unknown as ServerlessResponse;

  return {
    req,
    res,
    getResult: () => ({
      statusCode,
      payload: bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {},
    }),
  };
}

test('mapLanguageToCompiler maps all supported languages to exact OnlineCompiler.io IDs', () => {
  assert.equal(mapLanguageToCompiler('python'), 'python-3.14');
  assert.equal(mapLanguageToCompiler('cpp'), 'g++-15');
  assert.equal(mapLanguageToCompiler('node'), 'nodejs-24');
  assert.equal(mapLanguageToCompiler('js'), 'nodejs-24');
  assert.equal(mapLanguageToCompiler('java'), 'openjdk-25');
  assert.equal(COMPILER_ID_MAP['python'], 'python-3.14');
  assert.equal(mapLanguageToCompiler('unknown'), null);
});

test('/api/run returns 500 JSON error when ONLINECOMPILER_API_KEY is missing', async () => {
  const prevKey = process.env.ONLINECOMPILER_API_KEY;
  delete process.env.ONLINECOMPILER_API_KEY;
  try {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      body: { language: 'python', code: 'print(1)', input: '' },
    });
    await handler(req, res);
    const { statusCode, payload } = getResult();
    assert.equal(statusCode, 500);
    assert.match(String(payload.error), /ONLINECOMPILER_API_KEY/);
  } finally {
    if (prevKey !== undefined) process.env.ONLINECOMPILER_API_KEY = prevKey;
  }
});

test('/api/run forwards raw API key and compiler ID to OnlineCompiler.io and returns output JSON', async () => {
  const prevKey = process.env.ONLINECOMPILER_API_KEY;
  const origFetch = globalThis.fetch;
  process.env.ONLINECOMPILER_API_KEY = 'raw-test-key-123';

  let capturedUrl = '';
  let capturedAuth = '';
  let capturedBody: Record<string, unknown> = {};

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    const hdrs = init?.headers as Record<string, string>;
    capturedAuth = hdrs['Authorization'];
    capturedBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        output: 'hello world\n',
        error: '',
        status: 'success',
        exit_code: 0,
        time: '0.03',
        memory: '12MB',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const { req, res, getResult } = createMockReqRes({
      method: 'POST',
      body: { language: 'js', code: 'console.log("hello world")', input: 'abc' },
    });
    await handler(req, res);
    const { statusCode, payload } = getResult();

    assert.equal(statusCode, 200);
    assert.equal(capturedUrl, 'https://api.onlinecompiler.io/api/run-code-sync/');
    assert.equal(capturedAuth, 'raw-test-key-123');
    assert.equal(capturedBody.compiler, 'nodejs-24');
    assert.equal(capturedBody.code, 'console.log("hello world")');
    assert.equal(capturedBody.input, 'abc');
    assert.equal(payload.output, 'hello world\n');
    assert.equal(payload.exit_code, 0);
    assert.equal(payload.time, '0.03');
  } finally {
    globalThis.fetch = origFetch;
    if (prevKey !== undefined) process.env.ONLINECOMPILER_API_KEY = prevKey;
    else delete process.env.ONLINECOMPILER_API_KEY;
  }
});
