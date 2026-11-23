import { jsPDF } from 'jspdf';
import { exportGraph2DToSvg, evaluate2DEquation } from './Graph2DEngine';
import { Graph2DConfig, MathHistoryEntry } from './types';
import { canonicalToLatex } from './SymbolConverter';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportMathLatexDocument(
  equations: Array<{ label?: string; raw: string; result?: string }>,
  title = 'Spark Mathematics Document'
): string {
  const lines: string[] = [
    '\\documentclass{article}',
    '\\usepackage{amsmath, amssymb}',
    `\\title{${title}}`,
    '\\begin{document}',
    '\\maketitle',
  ];
  for (const eq of equations) {
    if (eq.label) lines.push(`\\section*{${eq.label}}`);
    lines.push('\\[');
    lines.push(canonicalToLatex(eq.raw));
    lines.push('\\]');
    if (eq.result) {
      lines.push('\\[');
      lines.push(`= ${canonicalToLatex(eq.result)}`);
      lines.push('\\]');
    }
  }
  lines.push('\\end{document}');
  return lines.join('\n');
}

export function downloadLatexFile(
  equations: Array<{ label?: string; raw: string; result?: string }>,
  filename = 'spark-math.tex'
): void {
  const content = exportMathLatexDocument(equations);
  triggerDownload(new Blob([content], { type: 'text/plain;charset=utf-8' }), filename);
}

export function exportGraph2DToCsv(config: Graph2DConfig): string {
  const visible = config.equations.filter((e) => e.visible && e.expression.trim());
  if (visible.length === 0) return 'x,y\n';
  const rows: string[] = ['equation,segment,x,y'];
  for (const eq of visible) {
    const evalCurve = evaluate2DEquation(eq, config.bounds, config.angleUnit, config.parameters, 360);
    evalCurve.segments.forEach((seg, sIdx) => {
      seg.points.forEach((pt) => {
        rows.push(`"${eq.expression.replace(/"/g, '""')}",${sIdx},${pt.x.toFixed(6)},${pt.y.toFixed(6)}`);
      });
    });
  }
  return rows.join('\n');
}

export function exportMatrixToCsv(matrix: number[][]): string {
  return matrix.map((row) => row.join(',')).join('\n');
}

export function downloadCsvFile(csvText: string, filename = 'spark-math-data.csv'): void {
  triggerDownload(new Blob([csvText], { type: 'text/csv;charset=utf-8' }), filename);
}

export function downloadGraph2DSvg(config: Graph2DConfig, dark = false, filename = 'spark-graph.svg'): void {
  const svg = exportGraph2DToSvg(config, 760, 500, dark);
  triggerDownload(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export function downloadMathJsonDocument(
  payload: {
    equations: string[];
    matrices: number[][][];
    history: MathHistoryEntry[];
    graph2D?: Graph2DConfig;
  },
  filename = 'spark-math-workspace.json'
): void {
  const json = JSON.stringify({ app: 'Spark Smart Mathematics Engine', exportedAt: new Date().toISOString(), ...payload }, null, 2);
  triggerDownload(new Blob([json], { type: 'application/json;charset=utf-8' }), filename);
}

export function exportMathReportToPdf(options: {
  title?: string;
  expressions: Array<{ input: string; operation?: string; result?: string }>;
  matrices?: Array<{ label: string; data: number[][] }>;
  canvasPngDataUrl?: string;
  filename?: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  let y = 48;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(options.title || 'Spark Smart Mathematics Report', 40, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, y);
  y += 24;

  for (const item of options.expressions) {
    if (y > 760) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(item.input, 40, y);
    y += 15;
    if (item.result) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      const label = item.operation ? `${item.operation}: ${item.result}` : item.result;
      const wrapped = doc.splitTextToSize(label, 510);
      doc.text(wrapped, 52, y);
      y += wrapped.length * 13 + 8;
    }
  }

  if (options.matrices) {
    for (const mat of options.matrices) {
      if (y > 720) {
        doc.addPage();
        y = 48;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Matrix ${mat.label} (${mat.data.length}x${mat.data[0]?.length || 0})`, 40, y);
      y += 15;
      doc.setFont('courier', 'normal');
      doc.setFontSize(9.5);
      for (const row of mat.data) {
        doc.text(`[ ${row.map((n) => Number(n.toFixed(4))).join('   ')} ]`, 52, y);
        y += 13;
      }
      y += 10;
    }
  }

  if (options.canvasPngDataUrl && options.canvasPngDataUrl.startsWith('data:image/png')) {
    if (y > 460) {
      doc.addPage();
      y = 48;
    }
    doc.addImage(options.canvasPngDataUrl, 'PNG', 40, y, 510, 290);
  }

  doc.save(options.filename || 'spark-math-report.pdf');
}
