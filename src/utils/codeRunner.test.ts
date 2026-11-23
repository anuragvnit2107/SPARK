import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCodeLanguage, runJavaSubset } from '../codeRunner';

test('detectCodeLanguage identifies python, cpp, node, js, and java and ignores plain text', () => {
  assert.equal(
    detectCodeLanguage('def add(a, b):\n    return a + b\nprint(add(19, 23))'),
    'python'
  );
  assert.equal(
    detectCodeLanguage('#include <iostream>\nusing namespace std;\nint main() { cout << 42; return 0; }'),
    'cpp'
  );
  assert.equal(
    detectCodeLanguage("const os = require('os');\nconsole.log(process.version);"),
    'node'
  );
  assert.equal(
    detectCodeLanguage('const sum = (a, b) => a + b;\nconsole.log(sum(4, 5));'),
    'js'
  );
  assert.equal(
    detectCodeLanguage('public class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}'),
    'java'
  );

  // Ordinary annotations / circuit labels must NOT be flagged as code
  assert.equal(detectCodeLanguage('R1 = 100 Ohm'), null);
  assert.equal(detectCodeLanguage('Series RC Filter'), null);
  assert.equal(detectCodeLanguage('Vout'), null);
  assert.equal(detectCodeLanguage(''), null);
});

test('runJavaSubset compiles valid Java code and catches syntax errors', () => {
  const validJava = `
public class Main {
  public static void main(String[] args) {
    int total = 0;
    for (int i = 1; i <= 5; i++) {
      total += i;
    }
    System.out.println("Sum=" + total);
  }
}
`;
  const compileOk = runJavaSubset(validJava, 'compile');
  assert.equal(compileOk.ok, true);
  assert.equal(compileOk.compiled, true);

  const runOk = runJavaSubset(validJava, 'run');
  assert.equal(runOk.ok, true);
  assert.equal(runOk.stdout.trim(), 'Sum=15');

  const brokenJava = `
public class Main {
  public static void main(String[] args) {
    System.out.println("unclosed";
  }
}
`;
  const compileFail = runJavaSubset(brokenJava, 'compile');
  assert.equal(compileFail.ok, false);
  assert.equal(compileFail.compiled, false);
  assert.ok(compileFail.stderr.length > 0);
});
