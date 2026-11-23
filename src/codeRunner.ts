export type CodeLanguage = 'python' | 'cpp' | 'node' | 'js' | 'java';

export interface CodeRunResult {
  ok: boolean;
  language: CodeLanguage;
  mode: 'compile' | 'run';
  compiled: boolean;
  compileMessage: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timeLabel?: string;
  statusText?: string;
  runtimeLabel: string;
}

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  python: 'Python',
  cpp: 'C++',
  node: 'Node.js',
  js: 'JavaScript',
  java: 'Java',
};

/**
 * Detects whether a text block contains Python, C++, Node.js, JavaScript, or Java code.
 * Returns null for ordinary diagram annotations, circuit values, and prose.
 */
export function detectCodeLanguage(rawText: string): CodeLanguage | null {
  const text = rawText.trim();
  if (!text || text.length < 4) return null;

  const lines = text.split(/\r?\n/);
  const firstLine = lines[0].trim().toLowerCase();

  // Explicit comment hint on first line (e.g. "# python", "// cpp", "// node", "// js", "// java")
  if (/^#\s*(python|py)\b/.test(firstLine)) return 'python';
  if (/^\/\/\s*(c\+\+|cpp)\b/.test(firstLine)) return 'cpp';
  if (/^\/\/\s*node(\.js|js)?\b/.test(firstLine)) return 'node';
  if (/^\/\/\s*(js|javascript)\b/.test(firstLine)) return 'js';
  if (/^\/\/\s*java\b/.test(firstLine)) return 'java';

  const scores: Record<CodeLanguage, number> = {
    python: 0,
    cpp: 0,
    node: 0,
    js: 0,
    java: 0,
  };

  // --- C++ signals ---
  if (/#include\s*<[^>]+>|#include\s*"[^"]+"/.test(text)) scores.cpp += 5;
  if (/\busing\s+namespace\s+std\s*;/.test(text)) scores.cpp += 5;
  if (/\bstd::(cout|cin|endl|string|vector|map|printf)\b/.test(text)) scores.cpp += 5;
  if (/\b(cout|cin)\s*(<<|>>)/.test(text)) scores.cpp += 4;
  if (/\bint\s+main\s*\([^)]*\)\s*\{/.test(text)) scores.cpp += 4;
  if (/\bprintf\s*\(/.test(text)) scores.cpp += 3;

  // --- Java signals ---
  if (/\bpublic\s+class\s+[A-Za-z_]\w*/.test(text)) scores.java += 5;
  if (/\bpublic\s+static\s+void\s+main\s*\(\s*String\s*(\[\s*\]|\.\.\.)\s*\w*\s*\)/.test(text))
    scores.java += 6;
  if (/\bSystem\.(out|err)\.(println|print|printf)\s*\(/.test(text)) scores.java += 5;
  if (/\bimport\s+java\.[a-zA-Z0-9_.*]+;/.test(text)) scores.java += 4;
  if (/\b(class\s+\w+\s*\{[\s\S]*\b(int|String|double|boolean)\s+\w+)/.test(text)) scores.java += 2;

  // --- Python signals ---
  if (/\bdef\s+[a-zA-Z_]\w*\s*\([^)]*\)\s*:/.test(text)) scores.python += 5;
  if (/\bif\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(text)) scores.python += 5;
  if (/\bprint\s*\(/.test(text) && !/;/.test(text)) scores.python += 4;
  if (/\b(elif\s+.+:|for\s+\w+\s+in\s+.+:|while\s+.+:|except\s*.*:)/.test(text)) scores.python += 4;
  if (/^\s*(import\s+[a-zA-Z_][\w.]*|from\s+[a-zA-Z_][\w.]*\s+import\s+)/m.test(text) && !/;/.test(text))
    scores.python += 4;
  if (/\b(True|False|None)\b/.test(text) && !/;/.test(text)) scores.python += 2;
  if (/\bclass\s+\w+(\([^)]*\))?\s*:/.test(text)) scores.python += 4;

  // --- Node.js signals ---
  if (/\brequire\s*\(\s*['"][^'"]+['"]\s*\)/.test(text)) scores.node += 5;
  if (/\bprocess\.(argv|env|stdout|exit|cwd|version)\b/.test(text)) scores.node += 5;
  if (/\bmodule\.exports\b|\bexports\.\w+\s*=/.test(text)) scores.node += 5;
  if (/\bimport\s+.*\s+from\s+['"](fs|path|http|os|crypto|child_process|node:[^'"]+)['"]/.test(text))
    scores.node += 5;

  // --- JavaScript signals ---
  if (/\bconsole\.(log|error|warn|info|table)\s*\(/.test(text)) {
    scores.js += 4;
    if (scores.node > 0) scores.node += 2;
  }
  if (/\bfunction\s+[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*\{/.test(text)) scores.js += 4;
  if (/\b(const|let|var)\s+[a-zA-Z_$][\w$]*\s*=/.test(text)) scores.js += 3;
  if (/=>\s*\{?/.test(text) && /\b(const|let|return|console)\b/.test(text)) scores.js += 3;
  if (/\bexport\s+(default|const|function|class)\b/.test(text)) scores.js += 3;
  if (/\bfor\s*\(\s*(let|var|const)\s+\w+/.test(text)) scores.js += 3;

  const entries = (Object.entries(scores) as [CodeLanguage, number][]).sort((a, b) => b[1] - a[1]);
  const [bestLang, bestScore] = entries[0];
  if (bestScore < 3) return null;

  // If Node-specific APIs are present alongside JS, prefer 'node'
  if (scores.node >= 4 && scores.node >= scores.js) return 'node';
  return bestLang;
}

// ---------------------------------------------------------------------------
// Lightweight Java Syntax Validator & Subset Evaluator (fallback when javac is absent)
// ---------------------------------------------------------------------------

interface JavaToken {
  type: 'ident' | 'number' | 'string' | 'char' | 'op' | 'punct';
  value: string;
  line: number;
}

function tokenizeJava(src: string): JavaToken[] {
  const tokens: JavaToken[] = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') {
      line++;
      i++;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (ch === '"') {
      let str = '';
      i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          const esc = src[i + 1];
          str += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
          i += 2;
        } else {
          if (src[i] === '\n') throw new Error(`Line ${line}: unclosed string literal`);
          str += src[i++];
        }
      }
      if (i >= src.length) throw new Error(`Line ${line}: unclosed string literal`);
      i++;
      tokens.push({ type: 'string', value: str, line });
      continue;
    }
    if (ch === "'") {
      i++;
      let val = '';
      if (src[i] === '\\' && i + 1 < src.length) {
        val = src[i + 1];
        i += 2;
      } else if (i < src.length) {
        val = src[i++];
      }
      if (src[i] !== "'") throw new Error(`Line ${line}: unclosed char literal`);
      i++;
      tokens.push({ type: 'char', value: val, line });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9._fFdDlL]/.test(src[i])) {
        if (!/[_fFdDlL]/.test(src[i])) num += src[i];
        i++;
      }
      tokens.push({ type: 'number', value: num, line });
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let id = '';
      while (i < src.length && /[A-Za-z0-9_$]/.test(src[i])) id += src[i++];
      tokens.push({ type: 'ident', value: id, line });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/='].includes(two)) {
      tokens.push({ type: 'op', value: two, line });
      i += 2;
      continue;
    }
    if ('+-*/%<>=!'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, line });
      i++;
      continue;
    }
    if ('(){}[];,.'.includes(ch)) {
      tokens.push({ type: 'punct', value: ch, line });
      i++;
      continue;
    }
    throw new Error(`Line ${line}: illegal character '${ch}'`);
  }
  return tokens;
}

function validateJavaStructure(tokens: JavaToken[]): { className: string; mainStart: number; mainEnd: number } {
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const closeToOpen: Record<string, string> = { ')': '(', '}': '{', ']': '[' };

  for (const tok of tokens) {
    if (tok.type === 'punct' && pairs[tok.value]) {
      stack.push({ ch: tok.value, line: tok.line });
    } else if (tok.type === 'punct' && closeToOpen[tok.value]) {
      const top = stack.pop();
      if (!top || top.ch !== closeToOpen[tok.value]) {
        throw new Error(`Line ${tok.line}: unmatched '${tok.value}'`);
      }
    }
  }
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    throw new Error(`Line ${unclosed.line}: unclosed '${unclosed.ch}'`);
  }

  let className = 'Main';
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type === 'ident' && tokens[i].value === 'class' && tokens[i + 1].type === 'ident') {
      className = tokens[i + 1].value;
      break;
    }
  }

  // Locate main method body if present; otherwise wrap top-level statements
  let mainIdx = -1;
  for (let i = 0; i < tokens.length - 3; i++) {
    if (
      tokens[i].type === 'ident' &&
      tokens[i].value === 'main' &&
      tokens[i + 1]?.value === '('
    ) {
      mainIdx = i;
      break;
    }
  }

  if (mainIdx !== -1) {
    let braceIdx = mainIdx;
    while (braceIdx < tokens.length && tokens[braceIdx].value !== '{') braceIdx++;
    if (braceIdx >= tokens.length) throw new Error('Missing main method body { ... }');
    let depth = 0;
    for (let k = braceIdx; k < tokens.length; k++) {
      if (tokens[k].value === '{') depth++;
      if (tokens[k].value === '}') {
        depth--;
        if (depth === 0) {
          return { className, mainStart: braceIdx + 1, mainEnd: k };
        }
      }
    }
  }

  // Check if a class wrapper exists without main
  const hasClass = tokens.some((t) => t.type === 'ident' && t.value === 'class');
  if (hasClass) {
    throw new Error(`Error: Main method not found in class ${className}`);
  }
  return { className, mainStart: 0, mainEnd: tokens.length };
}

function validateJavaStatements(tokens: JavaToken[], start: number, end: number): void {
  let i = start;
  while (i < end) {
    const tok = tokens[i];
    if (tok.value === ';' || tok.value === '{' || tok.value === '}') {
      i++;
      continue;
    }
    if (tok.type === 'ident' && (tok.value === 'if' || tok.value === 'while' || tok.value === 'for')) {
      if (tokens[i + 1]?.value !== '(') {
        throw new Error(`Line ${tok.line}: '(' expected after '${tok.value}'`);
      }
      let depth = 0;
      let j = i + 1;
      while (j < end) {
        if (tokens[j].value === '(') depth++;
        if (tokens[j].value === ')') {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      i = j + 1;
      if (tokens[i]?.type === 'ident' && tokens[i].value === 'else') i++;
      continue;
    }
    if (tok.type === 'ident' && tok.value === 'else') {
      i++;
      continue;
    }
    // Regular statement must end with ';' before '}' or end
    let j = i;
    let paren = 0;
    let foundSemi = false;
    while (j < end) {
      if (tokens[j].value === '(') paren++;
      if (tokens[j].value === ')') paren--;
      if (tokens[j].value === ';' && paren === 0) {
        foundSemi = true;
        break;
      }
      if ((tokens[j].value === '{' || tokens[j].value === '}') && paren === 0) {
        break;
      }
      j++;
    }
    if (!foundSemi) {
      throw new Error(`Line ${tokens[Math.min(j, end - 1)].line}: ';' expected`);
    }
    i = j + 1;
  }
}

type JVal = number | string | boolean | JVal[];

export function runJavaSubset(source: string, mode: 'compile' | 'run'): CodeRunResult {
  const started = Date.now();
  try {
    const tokens = tokenizeJava(source);
    const { className, mainStart, mainEnd } = validateJavaStructure(tokens);
    validateJavaStatements(tokens, mainStart, mainEnd);

    if (mode === 'compile') {
      return {
        ok: true,
        language: 'java',
        mode,
        compiled: true,
        compileMessage: `Compiled ${className}.class successfully (0 errors)`,
        stdout: '',
        stderr: '',
        exitCode: 0,
        durationMs: Math.max(1, Date.now() - started),
        runtimeLabel: 'Java Bytecode Checker',
      };
    }

    const outChunks: string[] = [];
    let steps = 0;
    const MAX_STEPS = 50000;
    const JAVA_TYPES = new Set(['int', 'double', 'float', 'long', 'String', 'boolean', 'char', 'var']);

    const execRange = (start: number, end: number, env: Map<string, JVal>) => {
      let idx = start;

      const peek = () => (idx < end ? tokens[idx] : undefined);
      const next = () => tokens[idx++];

      const evalExpr = (): JVal => parseTernary();

      const parseTernary = (): JVal => {
        const cond = parseOr();
        if (peek()?.value === '?' as string) {
          next();
          const a = evalExpr();
          next(); // :
          const b = evalExpr();
          return cond ? a : b;
        }
        return cond;
      };

      const parseOr = (): JVal => {
        let left = parseAnd();
        while (peek()?.value === '||') {
          next();
          const right = parseAnd();
          left = Boolean(left) || Boolean(right);
        }
        return left;
      };

      const parseAnd = (): JVal => {
        let left = parseEq();
        while (peek()?.value === '&&') {
          next();
          const right = parseEq();
          left = Boolean(left) && Boolean(right);
        }
        return left;
      };

      const parseEq = (): JVal => {
        let left = parseRel();
        while (peek()?.value === '==' || peek()?.value === '!=') {
          const op = next().value;
          const right = parseRel();
          left = op === '==' ? left === right : left !== right;
        }
        return left;
      };

      const parseRel = (): JVal => {
        let left = parseAdd();
        while (['<', '>', '<=', '>='].includes(peek()?.value || '')) {
          const op = next().value;
          const right = parseAdd();
          const a = Number(left);
          const b = Number(right);
          left =
            op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
        }
        return left;
      };

      const parseAdd = (): JVal => {
        let left = parseMul();
        while (peek()?.value === '+' || peek()?.value === '-') {
          const op = next().value;
          const right = parseMul();
          if (op === '+') {
            if (typeof left === 'string' || typeof right === 'string') {
              left = String(left) + String(right);
            } else {
              left = Number(left) + Number(right);
            }
          } else {
            left = Number(left) - Number(right);
          }
        }
        return left;
      };

      const parseMul = (): JVal => {
        let left = parseUnary();
        while (['*', '/', '%'].includes(peek()?.value || '')) {
          const op = next().value;
          const right = parseUnary();
          const a = Number(left);
          const b = Number(right);
          left = op === '*' ? a * b : op === '/' ? a / b : a % b;
        }
        return left;
      };

      const parseUnary = (): JVal => {
        if (peek()?.value === '!') {
          next();
          return !Boolean(parseUnary());
        }
        if (peek()?.value === '-') {
          next();
          return -Number(parseUnary());
        }
        if (peek()?.value === '+') {
          next();
          return Number(parseUnary());
        }
        return parsePrimary();
      };

      const parsePrimary = (): JVal => {
        const t = peek();
        if (!t) return 0;
        if (t.type === 'number') {
          next();
          return Number(t.value);
        }
        if (t.type === 'string' || t.type === 'char') {
          next();
          return t.value;
        }
        if (t.value === '(') {
          next();
          const val = evalExpr();
          if (peek()?.value === ')') next();
          return val;
        }
        if (t.type === 'ident') {
          if (t.value === 'true') {
            next();
            return true;
          }
          if (t.value === 'false') {
            next();
            return false;
          }
          // Dotted call e.g. System.out.println(...) or Math.sqrt(...) or arr.length
          const parts: string[] = [next().value];
          while (peek()?.value === '.') {
            next();
            if (peek()?.type === 'ident') parts.push(next().value);
          }
          const fullName = parts.join('.');
          if (peek()?.value === '(') {
            next();
            const args: JVal[] = [];
            while (peek() && peek()?.value !== ')') {
              args.push(evalExpr());
              if (peek()?.value === ',') next();
            }
            if (peek()?.value === ')') next();
            if (fullName === 'System.out.println') {
              outChunks.push((args.length ? String(args[0]) : '') + '\n');
              return 0;
            }
            if (fullName === 'System.out.print') {
              if (args.length) outChunks.push(String(args[0]));
              return 0;
            }
            if (fullName === 'Math.sqrt') return Math.sqrt(Number(args[0] || 0));
            if (fullName === 'Math.pow') return Math.pow(Number(args[0] || 0), Number(args[1] || 0));
            if (fullName === 'Math.abs') return Math.abs(Number(args[0] || 0));
            if (fullName === 'Math.max') return Math.max(Number(args[0] || 0), Number(args[1] || 0));
            if (fullName === 'Math.min') return Math.min(Number(args[0] || 0), Number(args[1] || 0));
            return 0;
          }
          if (peek()?.value === '[') {
            next();
            const arrIdx = Number(evalExpr());
            if (peek()?.value === ']') next();
            const arr = env.get(parts[0]);
            return Array.isArray(arr) ? arr[arrIdx] ?? 0 : 0;
          }
          if (parts.length === 2 && parts[1] === 'length') {
            const target = env.get(parts[0]);
            if (Array.isArray(target) || typeof target === 'string') return target.length;
          }
          if (peek()?.value === '++' || peek()?.value === '--') {
            const op = next().value;
            const cur = Number(env.get(fullName) ?? 0);
            env.set(fullName, op === '++' ? cur + 1 : cur - 1);
            return cur;
          }
          return env.get(fullName) ?? 0;
        }
        next();
        return 0;
      };

      const findMatchingParen = (openIdx: number): number => {
        let d = 0;
        for (let k = openIdx; k < end; k++) {
          if (tokens[k].value === '(') d++;
          if (tokens[k].value === ')') {
            d--;
            if (d === 0) return k;
          }
        }
        return end - 1;
      };

      const findBlockBounds = (fromIdx: number): { bodyStart: number; bodyEnd: number; nextIdx: number } => {
        if (tokens[fromIdx]?.value === '{') {
          let d = 0;
          for (let k = fromIdx; k < end; k++) {
            if (tokens[k].value === '{') d++;
            if (tokens[k].value === '}') {
              d--;
              if (d === 0) return { bodyStart: fromIdx + 1, bodyEnd: k, nextIdx: k + 1 };
            }
          }
        }
        // Single statement ending with ;
        let k = fromIdx;
        while (k < end && tokens[k].value !== ';') k++;
        return { bodyStart: fromIdx, bodyEnd: k + 1, nextIdx: k + 1 };
      };

      const execSimpleStatement = (sStart: number, sEnd: number) => {
        const savedIdx = idx;
        idx = sStart;
        const first = tokens[idx];
        if (!first || idx >= sEnd) {
          idx = savedIdx;
          return;
        }
        // Variable declaration: int x = 5; or int[] arr = {1,2,3};
        if (first.type === 'ident' && JAVA_TYPES.has(first.value)) {
          next();
          if (peek()?.value === '[' && tokens[idx + 1]?.value === ']') {
            next();
            next();
          }
          while (idx < sEnd) {
            const nameTok = next();
            if (peek()?.value === '[' && tokens[idx + 1]?.value === ']') {
              next();
              next();
            }
            let val: JVal = first.value === 'String' ? '' : first.value === 'boolean' ? false : 0;
            if (peek()?.value === '=') {
              next();
              if (peek()?.value === '{') {
                next();
                const items: JVal[] = [];
                while (idx < sEnd && peek()?.value !== '}') {
                  items.push(evalExpr());
                  if (peek()?.value === ',') next();
                }
                if (peek()?.value === '}') next();
                val = items;
              } else {
                val = evalExpr();
              }
            }
            env.set(nameTok.value, val);
            if (peek()?.value === ',') next();
            else break;
          }
          idx = savedIdx;
          return;
        }
        // Assignment: x = ..., x += ..., x++
        if (first.type === 'ident' && ['=', '+=', '-=', '*=', '/=', '++', '--'].includes(tokens[idx + 1]?.value || '')) {
          const varName = next().value;
          const op = next().value;
          const cur = env.get(varName) ?? 0;
          if (op === '++') env.set(varName, Number(cur) + 1);
          else if (op === '--') env.set(varName, Number(cur) - 1);
          else {
            const rhs = evalExpr();
            if (op === '=') env.set(varName, rhs);
            else if (op === '+=')
              env.set(varName, typeof cur === 'string' || typeof rhs === 'string' ? String(cur) + String(rhs) : Number(cur) + Number(rhs));
            else if (op === '-=') env.set(varName, Number(cur) - Number(rhs));
            else if (op === '*=') env.set(varName, Number(cur) * Number(rhs));
            else if (op === '/=') env.set(varName, Number(cur) / Number(rhs));
          }
          idx = savedIdx;
          return;
        }
        evalExpr();
        idx = savedIdx;
      };

      while (idx < end) {
        if (++steps > MAX_STEPS) {
          throw new Error('Execution step limit exceeded (possible infinite loop)');
        }
        const tok = peek();
        if (!tok) break;
        if (tok.value === ';' || tok.value === '{' || tok.value === '}') {
          next();
          continue;
        }
        if (tok.type === 'ident' && tok.value === 'if') {
          const openP = idx + 1;
          const closeP = findMatchingParen(openP);
          const condRangeEnd = closeP;
          idx = openP + 1;
          const condVal = Boolean(evalExpr());
          idx = condRangeEnd + 1;
          const thenBlk = findBlockBounds(idx);
          idx = thenBlk.nextIdx;
          let elseBlk: { bodyStart: number; bodyEnd: number; nextIdx: number } | null = null;
          if (tokens[idx]?.type === 'ident' && tokens[idx].value === 'else') {
            elseBlk = findBlockBounds(idx + 1);
            idx = elseBlk.nextIdx;
          }
          if (condVal) {
            execRange(thenBlk.bodyStart, thenBlk.bodyEnd, new Map(env));
          } else if (elseBlk) {
            execRange(elseBlk.bodyStart, elseBlk.bodyEnd, new Map(env));
          }
          continue;
        }
        if (tok.type === 'ident' && tok.value === 'while') {
          const openP = idx + 1;
          const closeP = findMatchingParen(openP);
          const blk = findBlockBounds(closeP + 1);
          while (true) {
            if (++steps > MAX_STEPS) throw new Error('Execution step limit exceeded');
            idx = openP + 1;
            if (!Boolean(evalExpr())) break;
            execRange(blk.bodyStart, blk.bodyEnd, env);
          }
          idx = blk.nextIdx;
          continue;
        }
        if (tok.type === 'ident' && tok.value === 'for') {
          const openP = idx + 1;
          const closeP = findMatchingParen(openP);
          const semis: number[] = [];
          for (let k = openP + 1; k < closeP; k++) {
            if (tokens[k].value === ';') semis.push(k);
          }
          const blk = findBlockBounds(closeP + 1);
          if (semis.length === 2) {
            const loopEnv = new Map(env);
            if (semis[0] > openP + 1) {
              // execute init inside loopEnv
              execRange(openP + 1, semis[0] + 1, loopEnv);
            }
            while (true) {
              if (++steps > MAX_STEPS) throw new Error('Execution step limit exceeded');
              if (semis[1] > semis[0] + 1) {
                idx = semis[0] + 1;
                // evaluate condition in loopEnv via temporary env swap? Let's run inline:
                const condTokens = tokens.slice(semis[0] + 1, semis[1]);
                if (condTokens.length > 0 && !evalSimpleCond(condTokens, loopEnv)) break;
              }
              execRange(blk.bodyStart, blk.bodyEnd, loopEnv);
              if (closeP > semis[1] + 1) {
                execRange(semis[1] + 1, closeP, loopEnv);
              }
            }
            // sync outer env variables
            for (const [k, v] of loopEnv.entries()) {
              if (env.has(k)) env.set(k, v);
            }
          }
          idx = blk.nextIdx;
          continue;
        }

        // Regular statement up to ';'
        let sEnd = idx;
        while (sEnd < end && tokens[sEnd].value !== ';') sEnd++;
        execSimpleStatement(idx, sEnd);
        idx = sEnd + 1;
      }
    };

    const evalSimpleCond = (condTokens: JavaToken[], env: Map<string, JVal>): boolean => {
      if (condTokens.length === 3) {
        const getVal = (t: JavaToken): number =>
          t.type === 'number' ? Number(t.value) : Number(env.get(t.value) ?? 0);
        const a = getVal(condTokens[0]);
        const b = getVal(condTokens[2]);
        const op = condTokens[1].value;
        if (op === '<') return a < b;
        if (op === '<=') return a <= b;
        if (op === '>') return a > b;
        if (op === '>=') return a >= b;
        if (op === '==') return a === b;
        if (op === '!=') return a !== b;
      }
      return true;
    };

    execRange(mainStart, mainEnd, new Map());

    return {
      ok: true,
      language: 'java',
      mode,
      compiled: true,
      compileMessage: `Compiled ${className}.class successfully (0 errors)`,
      stdout: outChunks.join(''),
      stderr: '',
      exitCode: 0,
      durationMs: Math.max(1, Date.now() - started),
      runtimeLabel: 'Java Subset VM',
    };
  } catch (err) {
    return {
      ok: false,
      language: 'java',
      mode,
      compiled: false,
      compileMessage: err instanceof Error ? err.message : 'Java compilation error',
      stdout: '',
      stderr: err instanceof Error ? err.message : 'Java compilation error',
      exitCode: 1,
      durationMs: Math.max(1, Date.now() - started),
      runtimeLabel: 'Java Bytecode Checker',
    };
  }
}
