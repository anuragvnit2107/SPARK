import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { type CodeLanguage, type CodeRunResult, runJavaSubset } from './src/codeRunner.ts';
import runCodeHandler from './api/run.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

interface RoomRecord {
  latestScene: EncryptedPayload | null;
  version: number;
  clients: Map<WebSocket, string>; // ws -> peerId
  updatedAt: number;
}

const rooms = new Map<string, RoomRecord>();

function getOrCreateRoom(roomId: string): RoomRecord {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      latestScene: null,
      version: 0,
      clients: new Map(),
      updatedAt: Date.now(),
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(
  room: RoomRecord,
  sender: WebSocket | null,
  message: Record<string, unknown>
) {
  const encoded = JSON.stringify(message);
  for (const [client] of room.clients.entries()) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, activeRooms: rooms.size });
  });

  app.all('/api/run', async (req, res) => {
    await runCodeHandler(req, res);
  });

  const runExec = (
    cmd: string,
    args: string[],
    cwd: string,
    timeoutMs = 5000
  ): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> =>
    new Promise((resolve) => {
      execFile(cmd, args, { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 }, (err, stdout, stderr) => {
        if (!err) {
          resolve({ exitCode: 0, stdout: String(stdout || ''), stderr: String(stderr || ''), timedOut: false });
          return;
        }
        const execErr = err as { code?: number | string; killed?: boolean; signal?: string };
        const timedOut = Boolean(execErr.killed || execErr.signal === 'SIGTERM');
        const code = typeof execErr.code === 'number' ? execErr.code : 1;
        resolve({
          exitCode: code,
          stdout: String(stdout || ''),
          stderr: timedOut
            ? 'Execution timed out after 5s'
            : String(stderr || err.message || 'Execution failed'),
          timedOut,
        });
      });
    });

  app.post('/api/code/run', async (req, res) => {
    const started = Date.now();
    const { code, language, mode } = (req.body || {}) as {
      code?: unknown;
      language?: unknown;
      mode?: unknown;
    };

    const validLangs: CodeLanguage[] = ['python', 'cpp', 'node', 'js', 'java'];
    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ ok: false, error: 'Code cannot be empty' });
      return;
    }
    if (code.length > 50000) {
      res.status(400).json({ ok: false, error: 'Code exceeds 50KB limit' });
      return;
    }
    if (typeof language !== 'string' || !validLangs.includes(language as CodeLanguage)) {
      res.status(400).json({ ok: false, error: 'Unsupported language' });
      return;
    }
    const execMode: 'compile' | 'run' = mode === 'compile' ? 'compile' : 'run';
    const lang = language as CodeLanguage;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-code-'));
    try {
      let result: CodeRunResult;

      if (lang === 'python') {
        const filePath = path.join(tmpDir, 'main.py');
        fs.writeFileSync(filePath, code, 'utf8');
        const comp = await runExec('python3', ['-m', 'py_compile', 'main.py'], tmpDir);
        if (comp.exitCode !== 0) {
          result = {
            ok: false,
            language: lang,
            mode: execMode,
            compiled: false,
            compileMessage: comp.stderr.trim() || 'Python syntax error',
            stdout: comp.stdout,
            stderr: comp.stderr,
            exitCode: comp.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: 'Python 3',
          };
        } else if (execMode === 'compile') {
          result = {
            ok: true,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: 'Python bytecode compiled cleanly (0 syntax errors)',
            stdout: '',
            stderr: '',
            exitCode: 0,
            durationMs: Date.now() - started,
            runtimeLabel: 'Python 3 (py_compile)',
          };
        } else {
          const runRes = await runExec('python3', ['-u', 'main.py'], tmpDir);
          result = {
            ok: runRes.exitCode === 0,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: 'Compiled & executed via Python 3',
            stdout: runRes.stdout,
            stderr: runRes.stderr,
            exitCode: runRes.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: 'Python 3',
          };
        }
      } else if (lang === 'cpp') {
        const cppPath = path.join(tmpDir, 'main.cpp');
        const outPath = path.join(tmpDir, 'main.out');
        fs.writeFileSync(cppPath, code, 'utf8');
        const comp = await runExec(
          'g++',
          ['-std=c++17', '-O2', '-Wall', cppPath, '-o', outPath],
          tmpDir
        );
        if (comp.exitCode !== 0) {
          result = {
            ok: false,
            language: lang,
            mode: execMode,
            compiled: false,
            compileMessage: comp.stderr.trim() || 'C++ compilation failed',
            stdout: comp.stdout,
            stderr: comp.stderr,
            exitCode: comp.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: 'g++ (C++17)',
          };
        } else if (execMode === 'compile') {
          result = {
            ok: true,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: comp.stderr.trim()
              ? `Compiled with warnings:\n${comp.stderr.trim()}`
              : 'g++ compiled binary cleanly (0 errors)',
            stdout: '',
            stderr: comp.stderr,
            exitCode: 0,
            durationMs: Date.now() - started,
            runtimeLabel: 'g++ (C++17)',
          };
        } else {
          const runRes = await runExec(outPath, [], tmpDir);
          result = {
            ok: runRes.exitCode === 0,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: 'Compiled with g++ (C++17) & executed binary',
            stdout: runRes.stdout,
            stderr: runRes.stderr,
            exitCode: runRes.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: 'g++ (C++17)',
          };
        }
      } else if (lang === 'node' || lang === 'js') {
        const usesEsm = /^\s*(import\s+|export\s+)/m.test(code) && !/\brequire\s*\(/.test(code);
        const fileName = usesEsm ? 'main.mjs' : 'main.cjs';
        const jsPath = path.join(tmpDir, fileName);
        fs.writeFileSync(jsPath, code, 'utf8');
        const comp = await runExec('node', ['--check', jsPath], tmpDir);
        const rtLabel = lang === 'node' ? 'Node.js' : 'JavaScript (V8)';
        if (comp.exitCode !== 0) {
          result = {
            ok: false,
            language: lang,
            mode: execMode,
            compiled: false,
            compileMessage: comp.stderr.trim() || 'Syntax check failed',
            stdout: comp.stdout,
            stderr: comp.stderr,
            exitCode: comp.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: rtLabel,
          };
        } else if (execMode === 'compile') {
          result = {
            ok: true,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: `${rtLabel} syntax check passed (0 errors)`,
            stdout: '',
            stderr: '',
            exitCode: 0,
            durationMs: Date.now() - started,
            runtimeLabel: rtLabel,
          };
        } else {
          const runRes = await runExec('node', [jsPath], tmpDir);
          result = {
            ok: runRes.exitCode === 0,
            language: lang,
            mode: execMode,
            compiled: true,
            compileMessage: `Syntax verified & executed via ${rtLabel}`,
            stdout: runRes.stdout,
            stderr: runRes.stderr,
            exitCode: runRes.exitCode,
            durationMs: Date.now() - started,
            runtimeLabel: rtLabel,
          };
        }
      } else {
        // Java: prefer real javac + java if installed, otherwise use Java Subset VM
        const classMatch = code.match(/\bpublic\s+class\s+([A-Za-z_]\w*)/);
        const className = classMatch ? classMatch[1] : 'Main';
        const javaPath = path.join(tmpDir, `${className}.java`);
        fs.writeFileSync(javaPath, code, 'utf8');
        const javacCheck = await runExec('which', ['javac'], tmpDir);
        if (javacCheck.exitCode === 0) {
          const comp = await runExec('javac', [javaPath], tmpDir);
          if (comp.exitCode !== 0) {
            result = {
              ok: false,
              language: lang,
              mode: execMode,
              compiled: false,
              compileMessage: comp.stderr.trim() || 'javac compilation failed',
              stdout: comp.stdout,
              stderr: comp.stderr,
              exitCode: comp.exitCode,
              durationMs: Date.now() - started,
              runtimeLabel: 'JDK javac',
            };
          } else if (execMode === 'compile') {
            result = {
              ok: true,
              language: lang,
              mode: execMode,
              compiled: true,
              compileMessage: `Compiled ${className}.class with javac (0 errors)`,
              stdout: '',
              stderr: '',
              exitCode: 0,
              durationMs: Date.now() - started,
              runtimeLabel: 'JDK javac',
            };
          } else {
            const runRes = await runExec('java', ['-cp', tmpDir, className], tmpDir);
            result = {
              ok: runRes.exitCode === 0,
              language: lang,
              mode: execMode,
              compiled: true,
              compileMessage: `Compiled & executed ${className} via JVM`,
              stdout: runRes.stdout,
              stderr: runRes.stderr,
              exitCode: runRes.exitCode,
              durationMs: Date.now() - started,
              runtimeLabel: 'JVM',
            };
          }
        } else {
          result = runJavaSubset(code, execMode);
        }
      }

      res.json(result);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  const server = http.createServer(app);

  // WebSocket server mounted on /ws for end-to-end encrypted room relay.
  // The server never receives or stores plaintext scene data or encryption keys.
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let joinedRoomId: string | null = null;
    let joinedPeerId: string | null = null;

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString()) as {
          type: string;
          roomId?: string;
          peerId?: string;
          envelope?: EncryptedPayload;
          version?: number;
        };

        if (msg.type === 'join' && msg.roomId && msg.peerId) {
          // Leave previous room if any
          if (joinedRoomId) {
            const prev = rooms.get(joinedRoomId);
            if (prev) {
              prev.clients.delete(ws);
              if (joinedPeerId) {
                broadcastToRoom(prev, ws, { type: 'peer:left', peerId: joinedPeerId });
              }
            }
          }

          joinedRoomId = msg.roomId;
          joinedPeerId = msg.peerId;
          const room = getOrCreateRoom(joinedRoomId);
          room.clients.set(ws, joinedPeerId);

          // Send latest encrypted scene snapshot if available
          ws.send(
            JSON.stringify({
              type: 'room:init',
              roomId: joinedRoomId,
              peerCount: room.clients.size,
              version: room.version,
              envelope: room.latestScene,
            })
          );

          broadcastToRoom(room, ws, {
            type: 'peer:joined',
            peerId: joinedPeerId,
            peerCount: room.clients.size,
          });
          return;
        }

        if (!joinedRoomId) return;
        const room = rooms.get(joinedRoomId);
        if (!room) return;

        if (msg.type === 'scene:update' && msg.envelope) {
          const nextVersion = typeof msg.version === 'number' ? msg.version : room.version + 1;
          room.latestScene = msg.envelope;
          room.version = Math.max(room.version, nextVersion);
          room.updatedAt = Date.now();

          broadcastToRoom(room, ws, {
            type: 'scene:update',
            peerId: joinedPeerId,
            version: room.version,
            envelope: msg.envelope,
          });
        } else if (msg.type === 'cursor:update' && msg.envelope) {
          broadcastToRoom(room, ws, {
            type: 'cursor:update',
            peerId: joinedPeerId,
            envelope: msg.envelope,
          });
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      if (joinedRoomId) {
        const room = rooms.get(joinedRoomId);
        if (room) {
          room.clients.delete(ws);
          if (joinedPeerId) {
            broadcastToRoom(room, null, {
              type: 'peer:left',
              peerId: joinedPeerId,
              peerCount: room.clients.size,
            });
          }
          // Clean up empty rooms after keeping encrypted snapshot briefly or immediately if no scene
          if (room.clients.size === 0 && !room.latestScene) {
            rooms.delete(joinedRoomId);
          }
        }
      }
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Spark server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
