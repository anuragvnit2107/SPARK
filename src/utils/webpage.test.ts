import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWebpageDocument,
  extractWebpageSummary,
  WEBPAGE_TEMPLATES,
} from '../webpageTemplates';

test('buildWebpageDocument assembles HTML, CSS, JS, auto-polish baseline, and escapes closing script tags', () => {
  const doc = buildWebpageDocument({
    title: 'Demo Site',
    htmlCode: '<main><h1>Hello World</h1><p>Interactive webpage preview</p></main>',
    cssCode: 'h1 { color: #10b981; }',
    jsCode: 'const tag = "</script>"; console.log(tag);',
    autoPolish: true,
  });

  assert.ok(doc.includes('<!DOCTYPE html>'));
  assert.ok(doc.includes('<title>Demo Site</title>'));
  assert.ok(doc.includes('box-sizing: border-box'));
  assert.ok(doc.includes('h1 { color: #10b981; }'));
  assert.ok(doc.includes('<main><h1>Hello World</h1>'));
  assert.ok(!doc.includes('</script>"; console.log'));
  assert.ok(doc.includes('<\\/script>'));
});

test('extractWebpageSummary extracts heading and fallback preview text cleanly', () => {
  const tpl = WEBPAGE_TEMPLATES[0];
  const summary = extractWebpageSummary(tpl.html);
  assert.ok(summary.heading.length > 0);
  assert.ok(summary.snippet.length > 0);

  const blankSummary = extractWebpageSummary('');
  assert.equal(blankSummary.heading, 'Untitled Webpage');
});
