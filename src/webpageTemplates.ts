export interface WebpageTemplate {
  id: 'modern-landing' | 'product-showcase' | 'portfolio-card' | 'blank-starter';
  name: string;
  title: string;
  html: string;
  css: string;
  js: string;
}

export const WEBPAGE_TEMPLATES: WebpageTemplate[] = [
  {
    id: 'modern-landing',
    name: 'Landing Hero',
    title: 'aurora-studio.html',
    html: `<main class="page">
  <nav class="nav">
    <span class="brand">Aurora Studio</span>
    <div class="links">
      <a href="#features">Features</a>
      <a href="#metrics">Metrics</a>
    </div>
  </nav>

  <section class="hero">
    <p class="eyebrow">Design &amp; Engineering Kit</p>
    <h1>Craft sharp interfaces directly on your canvas.</h1>
    <p class="subtitle">
      Edit HTML, CSS, and JavaScript live with automatic typography, balanced spacing,
      and responsive grid layout.
    </p>
    <div class="actions">
      <button id="launch-btn" class="btn-primary">Launch Preview</button>
      <span id="click-readout" class="readout">0 interactions</span>
    </div>
  </section>

  <section id="features" class="grid">
    <article class="card">
      <h3>Responsive Grid</h3>
      <p>Adapts seamlessly between desktop and 390px mobile viewports.</p>
    </article>
    <article class="card">
      <h3>Live DOM Script</h3>
      <p>Bind click handlers, form states, or animations in real time.</p>
    </article>
    <article class="card">
      <h3>Single-File Export</h3>
      <p>Download your finished webpage as a standalone HTML5 bundle.</p>
    </article>
  </section>
</main>`,
    css: `.page {
  max-width: 880px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.brand {
  font-weight: 800;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
  color: #064e3b;
}

.links {
  display: flex;
  gap: 1.25rem;
  font-size: 0.9rem;
}

.links a {
  color: #475569;
  text-decoration: none;
  font-weight: 500;
}

.hero {
  padding: 3rem 0 2.25rem;
}

.eyebrow {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #059669;
  margin-bottom: 0.75rem;
}

.hero h1 {
  font-size: clamp(1.9rem, 4vw, 2.75rem);
  line-height: 1.12;
  letter-spacing: -0.03em;
  color: #0f172a;
  margin-bottom: 1rem;
  max-width: 18ch;
}

.subtitle {
  font-size: 1.02rem;
  line-height: 1.6;
  color: #475569;
  max-width: 54ch;
  margin-bottom: 1.75rem;
}

.actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-primary {
  background: #059669;
  color: #ffffff;
  border: none;
  padding: 0.75rem 1.35rem;
  border-radius: 0.65rem;
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}

.btn-primary:hover {
  background: #047857;
  transform: translateY(-1px);
}

.readout {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85rem;
  color: #334155;
  background: #f1f5f9;
  padding: 0.45rem 0.75rem;
  border-radius: 0.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.85rem;
  padding: 1.25rem;
}

.card h3 {
  font-size: 0.98rem;
  color: #0f172a;
  margin-bottom: 0.4rem;
}

.card p {
  font-size: 0.88rem;
  line-height: 1.55;
  color: #64748b;
}`,
    js: `const btn = document.getElementById('launch-btn');
const readout = document.getElementById('click-readout');
let count = 0;

if (btn && readout) {
  btn.addEventListener('click', () => {
    count += 1;
    readout.textContent = count === 1 ? '1 interaction' : count + ' interactions';
    btn.textContent = 'Active (' + count + ')';
  });
}`,
  },
  {
    id: 'product-showcase',
    name: 'Product Card',
    title: 'product-pricing.html',
    html: `<section class="pricing-wrap">
  <header class="pricing-head">
    <h1>Simple Workstation Plans</h1>
    <button id="billing-toggle" class="toggle-btn">Switch to Annual (Save 20%)</button>
  </header>

  <div class="tier-grid">
    <div class="tier">
      <h2>Starter</h2>
      <p class="price"><span data-monthly="$14" data-annual="$11">$14</span> <small>/ month</small></p>
      <ul>
        <li>Unlimited vector &amp; circuit boards</li>
        <li>SVG &amp; PNG high-DPI export</li>
        <li>Local browser autosave</li>
      </ul>
      <button class="select-plan">Choose Starter</button>
    </div>

    <div class="tier featured">
      <h2>Engineering Pro</h2>
      <p class="price"><span data-monthly="$29" data-annual="$23">$29</span> <small>/ month</small></p>
      <ul>
        <li>Real-time RLC &amp; CRO Workbench</li>
        <li>End-to-end encrypted live rooms</li>
        <li>HTML / CSS / JS Webpage Studio</li>
      </ul>
      <button class="select-plan accent">Choose Pro</button>
    </div>
  </div>
  <p id="plan-status" class="status"></p>
</section>`,
    css: `.pricing-wrap {
  max-width: 780px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem;
}

.pricing-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.pricing-head h1 {
  font-size: 1.65rem;
  letter-spacing: -0.02em;
  color: #0f172a;
}

.toggle-btn {
  padding: 0.55rem 0.95rem;
  border-radius: 0.55rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.tier {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.9rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.tier.featured {
  border-color: #059669;
  box-shadow: 0 12px 30px -12px rgba(5, 150, 105, 0.25);
}

.price {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
}

.price small {
  font-size: 0.85rem;
  font-weight: 500;
  color: #64748b;
}

.tier ul {
  padding-left: 1.15rem;
  color: #475569;
  font-size: 0.9rem;
  line-height: 1.75;
}

.select-plan {
  margin-top: auto;
  padding: 0.7rem 1rem;
  border-radius: 0.6rem;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  font-weight: 600;
  cursor: pointer;
}

.select-plan.accent {
  background: #059669;
  border-color: #059669;
  color: #ffffff;
}

.status {
  margin-top: 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #059669;
}`,
    js: `let annual = false;
const toggleBtn = document.getElementById('billing-toggle');
const statusEl = document.getElementById('plan-status');

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    annual = !annual;
    document.querySelectorAll('[data-monthly]').forEach((el) => {
      el.textContent = annual ? el.getAttribute('data-annual') : el.getAttribute('data-monthly');
    });
    toggleBtn.textContent = annual ? 'Switch to Monthly' : 'Switch to Annual (Save 20%)';
  });
}

document.querySelectorAll('.select-plan').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (statusEl) {
      statusEl.textContent = 'Selected: ' + btn.textContent.replace('Choose ', '');
    }
  });
});`,
  },
  {
    id: 'portfolio-card',
    name: 'Dark Editorial',
    title: 'portfolio.html',
    html: `<div class="shell">
  <header class="top">
    <div>
      <span class="role">Frontend &amp; Systems Engineer</span>
      <h1>Maya Lin — Selected Works</h1>
    </div>
    <button id="theme-btn" class="ghost-btn">Highlight Active</button>
  </header>

  <section class="projects">
    <div class="proj" data-year="2026">
      <h2>Signal Workbench</h2>
      <p>Modified nodal analysis engine with live CRT oscilloscope plotting.</p>
    </div>
    <div class="proj" data-year="2025">
      <h2>Slate Design System</h2>
      <p>High-contrast component tokens crafted for precision technical tools.</p>
    </div>
  </section>
</div>`,
    css: `body {
  background: #0b1120;
  color: #e2e8f0;
}

.shell {
  max-width: 780px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
}

.top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding-bottom: 1.5rem;
  margin-bottom: 1.75rem;
}

.role {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: #38bdf8;
  margin-bottom: 0.4rem;
}

h1 {
  font-size: 1.85rem;
  letter-spacing: -0.03em;
  color: #f8fafc;
}

.ghost-btn {
  background: #1e293b;
  color: #f8fafc;
  border: 1px solid #334155;
  padding: 0.55rem 1rem;
  border-radius: 0.55rem;
  font-weight: 600;
  cursor: pointer;
}

.projects {
  display: grid;
  gap: 1rem;
}

.proj {
  background: #111827;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.85rem;
  padding: 1.25rem;
  transition: border-color 0.2s ease;
}

.proj.active {
  border-color: #38bdf8;
}

.proj h2 {
  font-size: 1.05rem;
  color: #f8fafc;
  margin-bottom: 0.35rem;
}

.proj p {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.55;
}`,
    js: `const themeBtn = document.getElementById('theme-btn');
const items = Array.from(document.querySelectorAll('.proj'));
let idx = 0;

if (themeBtn && items.length > 0) {
  items[0].classList.add('active');
  themeBtn.addEventListener('click', () => {
    items.forEach((el) => el.classList.remove('active'));
    idx = (idx + 1) % items.length;
    items[idx].classList.add('active');
  });
}`,
  },
  {
    id: 'blank-starter',
    name: 'Blank Canvas',
    title: 'index.html',
    html: `<section class="container">
  <h1>Hello Webpage</h1>
  <p>Write your custom HTML, CSS, and JavaScript on the left to see it rendered here.</p>
  <button id="hello-btn">Click Me</button>
</section>`,
    css: `.container {
  max-width: 640px;
  margin: 3rem auto;
  padding: 2rem;
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 0.65rem;
  color: #0f172a;
}

p {
  color: #475569;
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

button {
  background: #0f172a;
  color: #ffffff;
  border: none;
  padding: 0.65rem 1.2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
}`,
    js: `const btn = document.getElementById('hello-btn');
if (btn) {
  btn.addEventListener('click', () => {
    btn.textContent = 'Clicked!';
  });
}`,
  },
];

const AUTO_POLISH_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html {
  font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
body {
  background: #f8fafc;
  color: #0f172a;
  min-height: 100vh;
}
img, svg {
  max-width: 100%;
  display: block;
}
button, input, select, textarea {
  font: inherit;
}
`;

export function buildWebpageDocument(params: {
  title?: string;
  htmlCode?: string;
  cssCode?: string;
  jsCode?: string;
  autoPolish?: boolean;
}): string {
  const safeTitle = (params.title || 'Webpage Preview')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const html = params.htmlCode ?? '';
  const css = params.cssCode ?? '';
  const js = params.jsCode ?? '';
  const autoPolish = params.autoPolish !== false;

  // Escape </script> inside user JS so it never prematurely closes the script tag
  const safeJs = js.replace(/<\/script/gi, '<\\/script');
  const safeCss = css.replace(/<\/style/gi, '<\\/style');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
${autoPolish ? AUTO_POLISH_CSS : ''}
${safeCss}
  </style>
</head>
<body>
${html}
<script>
try {
${safeJs}
} catch (err) {
  var box = document.createElement('pre');
  box.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;padding:10px 12px;border-radius:8px;font:12px/1.4 monospace;z-index:9999;white-space:pre-wrap;';
  box.textContent = 'JS Error: ' + (err && err.message ? err.message : String(err));
  document.body.appendChild(box);
}
</script>
</body>
</html>`;
}

export function extractWebpageSummary(html?: string): { heading: string; snippet: string } {
  const src = html || '';
  const hMatch = src.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  const pMatch = src.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();

  const heading = hMatch ? stripTags(hMatch[1]) : stripTags(src).slice(0, 42) || 'Untitled Webpage';
  const snippet = pMatch
    ? stripTags(pMatch[1])
    : stripTags(src.replace(/<h[1-3][\s\S]*?<\/h[1-3]>/i, '')).slice(0, 90);
  return {
    heading: heading.slice(0, 48),
    snippet: snippet.slice(0, 110),
  };
}
