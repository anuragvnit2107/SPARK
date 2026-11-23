import { MathStep, MatrixClassification, MatrixClassTag, MatrixOperationResult } from './types';

const EPS = 1e-10;

export function roundClean(v: number, digits = 6): number {
  if (!Number.isFinite(v)) return v;
  const f = Math.pow(10, digits);
  const r = Math.round(v * f) / f;
  return Math.abs(r) < 1e-12 ? 0 : r;
}

export function formatNum(v: number, digits = 4): string {
  const c = roundClean(v, digits);
  if (!Number.isFinite(c)) return String(c);
  if (Math.abs(c - Math.round(c)) < 1e-9) return String(Math.round(c));
  return Number(c.toFixed(digits)).toString();
}

export function formatMatrixText(M: number[][], digits = 4): string {
  return M.map((row) => `[ ${row.map((v) => formatNum(v, digits)).join('  ')} ]`).join('\n');
}

export function formatMatrixLatex(M: number[][], digits = 4): string {
  const rows = M.map((row) => row.map((v) => formatNum(v, digits)).join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}

export function cloneMatrix(M: number[][]): number[][] {
  return M.map((row) => [...row]);
}

function parseMatrixCellToken(token: string): number {
  const s = token.trim();
  if (!s) return NaN;
  const fracMatch = s.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (fracMatch) {
    const den = Number(fracMatch[2]);
    return den === 0 ? NaN : Number(fracMatch[1]) / den;
  }
  return Number(s);
}

/**
 * Parses `[[1,2,3],[4,5,6]]`, `A = [[1,2],[3,4]]`, or TSV/CSV spreadsheet grid text.
 */
export function parseMatrixInput(raw: string): {
  ok: boolean;
  name?: string;
  matrix?: number[][];
  error?: string;
} {
  let trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Matrix input is empty.' };

  let name: string | undefined;
  const assignMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]+)$/);
  if (assignMatch) {
    name = assignMatch[1];
    trimmed = assignMatch[2].trim();
  }

  // Case 1: JSON / Python-style nested bracket [[1,2],[3,4]] or 1D [1,2,3]
  if (trimmed.startsWith('[')) {
    try {
      // Remove trailing commas before closing brackets and quote bare fractions like 1/2 if present
      const normalizedJson = trimmed
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/([\[,]\s*)([+-]?\d+(?:\.\d+)?\s*\/\s*[+-]?\d+(?:\.\d+)?)(\s*[,\]])/g, '$1"$2"$3');
      const parsed = JSON.parse(normalizedJson);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return { ok: false, error: 'Matrix cannot be empty.' };
        if (!Array.isArray(parsed[0])) {
          const row = parsed.map((n) => (typeof n === 'string' ? parseMatrixCellToken(n) : Number(n)));
          if (row.some((n) => !Number.isFinite(n))) {
            return { ok: false, error: 'Matrix contains non-numeric entries.' };
          }
          return { ok: true, name, matrix: [row] };
        }
        const cols = parsed[0].length;
        if (cols === 0) return { ok: false, error: 'Matrix rows cannot be empty.' };
        const matrix: number[][] = [];
        for (const r of parsed) {
          if (!Array.isArray(r) || r.length !== cols) {
            return { ok: false, error: 'Inconsistent row lengths in matrix.' };
          }
          const nums = r.map((n) => (typeof n === 'string' ? parseMatrixCellToken(n) : Number(n)));
          if (nums.some((n) => !Number.isFinite(n))) {
            return { ok: false, error: 'Matrix contains non-numeric entries.' };
          }
          matrix.push(nums);
        }
        return { ok: true, name, matrix };
      }
    } catch {
      return { ok: false, error: 'Malformed matrix bracket syntax.' };
    }
  }

  // Case 2: Spreadsheet TSV/CSV or space-separated lines
  const lines = trimmed
    .split(/\r?\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { ok: false, error: 'Empty matrix data.' };

  const matrix: number[][] = [];
  let expectedCols = -1;
  for (const line of lines) {
    const clean = line.replace(/^\[|\]$/g, '').trim();
    const rawParts = clean.includes('\t')
      ? clean.split('\t')
      : clean.includes(',')
      ? clean.split(',')
      : clean.split(/\s+/);
    const nonEmpty = rawParts.map((p) => p.trim()).filter(Boolean);
    const nums = nonEmpty.map((p) => parseMatrixCellToken(p));
    if (nums.length === 0 || nums.some((n) => !Number.isFinite(n))) {
      return { ok: false, error: `Invalid numeric row: "${line}"` };
    }
    if (expectedCols === -1) expectedCols = nums.length;
    else if (nums.length !== expectedCols) {
      return { ok: false, error: 'All matrix rows must have the same number of columns.' };
    }
    matrix.push(nums);
  }
  return { ok: true, name, matrix };
}

export function classifyMatrix(M: number[][]): MatrixClassification {
  const rows = M.length;
  const cols = M[0]?.length || 0;
  const tags: MatrixClassTag[] = [];
  const isSquare = rows === cols && rows > 0;

  if (rows === 1 && cols >= 1) {
    tags.push('1D Array');
    tags.push('Row Matrix');
  } else if (cols === 1 && rows > 1) {
    tags.push('1D Array');
    tags.push('Column Matrix');
  }
  if (isSquare) tags.push('Square');
  else tags.push('Rectangular');

  const isZero = M.every((r) => r.every((v) => Math.abs(v) < EPS));
  if (isZero) tags.push('Zero Matrix');

  let det: number | undefined;
  let isInvertible: boolean | undefined;

  if (isSquare) {
    let isIdentity = true;
    let isDiag = true;
    let isSym = true;
    let isUpper = true;
    let isLower = true;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const v = M[i][j];
        if (i === j) {
          if (Math.abs(v - 1) > EPS) isIdentity = false;
        } else {
          if (Math.abs(v) > EPS) {
            isIdentity = false;
            isDiag = false;
          }
        }
        if (Math.abs(v - M[j][i]) > EPS) isSym = false;
        if (i > j && Math.abs(v) > EPS) isUpper = false;
        if (i < j && Math.abs(v) > EPS) isLower = false;
      }
    }

    if (isIdentity) tags.push('Identity Matrix');
    if (isDiag && !isIdentity && !isZero) tags.push('Diagonal');
    if (isSym) tags.push('Symmetric');
    if (isUpper && !isDiag && !isIdentity) tags.push('Upper Triangular');
    if (isLower && !isDiag && !isIdentity) tags.push('Lower Triangular');

    const detRes = matrixDeterminant(M);
    if (detRes.ok && typeof detRes.scalar === 'number') {
      det = detRes.scalar;
      isInvertible = Math.abs(det) > EPS;
    }
  }

  return { rows, cols, tags, isSquare, isInvertible, determinant: det };
}

export function matrixAdd(A: number[][], B: number[][]): MatrixOperationResult {
  if (A.length !== B.length || A[0].length !== B[0].length) {
    return {
      ok: false,
      operation: 'Addition (A + B)',
      textResult: '',
      error: `Dimension mismatch: A is ${A.length}×${A[0].length} while B is ${B.length}×${B[0].length}.`,
    };
  }
  const res = A.map((row, i) => row.map((v, j) => roundClean(v + B[i][j], 8)));
  return {
    ok: true,
    operation: 'Addition (A + B)',
    matrix: res,
    textResult: formatMatrixText(res),
    latexResult: formatMatrixLatex(res),
  };
}

export function matrixSubtract(A: number[][], B: number[][]): MatrixOperationResult {
  if (A.length !== B.length || A[0].length !== B[0].length) {
    return {
      ok: false,
      operation: 'Subtraction (A - B)',
      textResult: '',
      error: `Dimension mismatch: A is ${A.length}×${A[0].length} while B is ${B.length}×${B[0].length}.`,
    };
  }
  const res = A.map((row, i) => row.map((v, j) => roundClean(v - B[i][j], 8)));
  return {
    ok: true,
    operation: 'Subtraction (A - B)',
    matrix: res,
    textResult: formatMatrixText(res),
    latexResult: formatMatrixLatex(res),
  };
}

export function matrixScalarMultiply(A: number[][], k: number): MatrixOperationResult {
  if (!Number.isFinite(k)) {
    return { ok: false, operation: 'Scalar Multiply', textResult: '', error: 'Scalar must be finite.' };
  }
  const res = A.map((row) => row.map((v) => roundClean(v * k, 8)));
  return {
    ok: true,
    operation: `Scalar Multiply (${formatNum(k)}·A)`,
    matrix: res,
    textResult: formatMatrixText(res),
    latexResult: formatMatrixLatex(res),
  };
}

export function matrixMultiply(A: number[][], B: number[][]): MatrixOperationResult {
  const m = A.length;
  const n = A[0].length;
  const n2 = B.length;
  const p = B[0].length;
  if (n !== n2) {
    return {
      ok: false,
      operation: 'Multiplication (A × B)',
      textResult: '',
      error: `Inner dimensions mismatch: A is ${m}×${n} and B is ${n2}×${p}.`,
    };
  }
  const res: number[][] = Array.from({ length: m }, () => Array(p).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += A[i][k] * B[k][j];
      res[i][j] = roundClean(sum, 8);
    }
  }
  return {
    ok: true,
    operation: 'Multiplication (A × B)',
    matrix: res,
    textResult: formatMatrixText(res),
    latexResult: formatMatrixLatex(res),
  };
}

export function matrixDivide(A: number[][], B: number[][]): MatrixOperationResult {
  if (B.length !== B[0].length) {
    return {
      ok: false,
      operation: 'Matrix Division (A · B⁻¹)',
      textResult: '',
      error: `Right-hand matrix B must be square to define A · B⁻¹, got ${B.length}×${B[0].length}.`,
    };
  }
  const invB = matrixInverse(B);
  if (!invB.ok || !invB.matrix) {
    return {
      ok: false,
      operation: 'Matrix Division (A · B⁻¹)',
      textResult: '',
      error: invB.error || 'B is singular; matrix division A · B⁻¹ is undefined.',
    };
  }
  const mul = matrixMultiply(A, invB.matrix);
  return {
    ...mul,
    operation: 'Matrix Division (A · B⁻¹)',
  };
}

export function matrixTranspose(A: number[][]): MatrixOperationResult {
  const rows = A.length;
  const cols = A[0].length;
  const res: number[][] = Array.from({ length: cols }, (_, j) =>
    Array.from({ length: rows }, (_, i) => A[i][j])
  );
  return {
    ok: true,
    operation: 'Transpose (Aᵀ)',
    matrix: res,
    textResult: formatMatrixText(res),
    latexResult: formatMatrixLatex(res),
  };
}

export function matrixTrace(A: number[][]): MatrixOperationResult {
  if (A.length !== A[0].length) {
    return {
      ok: false,
      operation: 'Trace',
      textResult: '',
      error: `Trace requires a square matrix, got ${A.length}×${A[0].length}.`,
    };
  }
  let tr = 0;
  for (let i = 0; i < A.length; i++) tr += A[i][i];
  const val = roundClean(tr, 8);
  return {
    ok: true,
    operation: 'Trace tr(A)',
    scalar: val,
    textResult: `tr(A) = ${formatNum(val)}`,
    latexResult: `\\operatorname{tr}(A) = ${formatNum(val)}`,
  };
}

export function matrixDeterminant(A: number[][]): MatrixOperationResult {
  const n = A.length;
  if (n !== A[0].length) {
    return {
      ok: false,
      operation: 'Determinant',
      textResult: '',
      error: `Determinant requires a square matrix, got ${n}×${A[0].length}.`,
    };
  }
  const M = cloneMatrix(A);
  let det = 1;
  let swaps = 0;
  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < EPS) {
      return {
        ok: true,
        operation: 'Determinant det(A)',
        scalar: 0,
        textResult: 'det(A) = 0',
        latexResult: '\\det(A) = 0',
      };
    }
    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
      swaps++;
    }
    const pivot = M[col][col];
    det *= pivot;
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      for (let c = col; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }
  if (swaps % 2 === 1) det = -det;
  det = roundClean(det, 8);
  return {
    ok: true,
    operation: 'Determinant det(A)',
    scalar: det,
    textResult: `det(A) = ${formatNum(det)}`,
    latexResult: `\\det(A) = ${formatNum(det)}`,
  };
}

export function matrixCofactorAndAdjoint(A: number[][]): {
  ok: boolean;
  cofactor?: number[][];
  adjoint?: number[][];
  error?: string;
} {
  const n = A.length;
  if (n !== A[0].length) {
    return { ok: false, error: `Cofactor/Adjoint require a square matrix, got ${n}×${A[0].length}.` };
  }
  if (n === 1) {
    return { ok: true, cofactor: [[1]], adjoint: [[1]] };
  }
  const cofactor: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const minor: number[][] = [];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const row: number[] = [];
        for (let c = 0; c < n; c++) {
          if (c !== j) row.push(A[r][c]);
        }
        minor.push(row);
      }
      const detMinor = matrixDeterminant(minor).scalar ?? 0;
      cofactor[i][j] = roundClean(((i + j) % 2 === 0 ? 1 : -1) * detMinor, 8);
    }
  }
  const adjoint = matrixTranspose(cofactor).matrix!;
  return { ok: true, cofactor, adjoint };
}

export function matrixCofactor(A: number[][]): MatrixOperationResult {
  const res = matrixCofactorAndAdjoint(A);
  if (!res.ok || !res.cofactor) {
    return { ok: false, operation: 'Cofactor Matrix', textResult: '', error: res.error };
  }
  return {
    ok: true,
    operation: 'Cofactor Matrix C',
    matrix: res.cofactor,
    textResult: formatMatrixText(res.cofactor),
    latexResult: formatMatrixLatex(res.cofactor),
  };
}

export function matrixAdjoint(A: number[][]): MatrixOperationResult {
  const res = matrixCofactorAndAdjoint(A);
  if (!res.ok || !res.adjoint) {
    return { ok: false, operation: 'Adjoint (Adjugate)', textResult: '', error: res.error };
  }
  return {
    ok: true,
    operation: 'Adjoint adj(A) = Cᵀ',
    matrix: res.adjoint,
    textResult: formatMatrixText(res.adjoint),
    latexResult: formatMatrixLatex(res.adjoint),
  };
}

export function matrixInverse(A: number[][]): MatrixOperationResult {
  const n = A.length;
  if (n !== A[0].length) {
    return {
      ok: false,
      operation: 'Inverse (A⁻¹)',
      textResult: '',
      error: `Inverse requires a square matrix, got ${n}×${A[0].length}.`,
    };
  }
  const aug = A.map((row, i) => [
    ...row,
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);
  const steps: MathStep[] = [];

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        pivotRow = r;
      }
    }
    if (maxVal < EPS) {
      return {
        ok: false,
        operation: 'Inverse (A⁻¹)',
        textResult: '',
        error: 'Matrix is singular (det = 0); inverse does not exist.',
      };
    }
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
      steps.push({ title: `Swap R${col + 1} ↔ R${pivotRow + 1}`, detail: 'Pivot selection' });
    }
    const pivot = aug[col][col];
    if (Math.abs(pivot - 1) > EPS) {
      for (let c = 0; c < 2 * n; c++) aug[col][c] /= pivot;
      steps.push({
        title: `Scale R${col + 1} ← R${col + 1} / ${formatNum(pivot)}`,
        detail: 'Normalize pivot to 1',
      });
    }
    for (let r = 0; r < n; r++) {
      if (r === col || Math.abs(aug[r][col]) < EPS) continue;
      const factor = aug[r][col];
      for (let c = 0; c < 2 * n; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
      steps.push({
        title: `R${r + 1} ← R${r + 1} - (${formatNum(factor)})·R${col + 1}`,
        detail: `Eliminate entry (${r + 1}, ${col + 1})`,
      });
    }
  }

  const inv = aug.map((row) => row.slice(n).map((v) => roundClean(v, 8)));
  return {
    ok: true,
    operation: 'Inverse (A⁻¹)',
    matrix: inv,
    steps,
    textResult: formatMatrixText(inv),
    latexResult: formatMatrixLatex(inv),
  };
}

export function matrixGaussianElimination(
  A: number[][],
  reduced = false
): MatrixOperationResult {
  const m = A.length;
  const n = A[0].length;
  const M = cloneMatrix(A);
  const steps: MathStep[] = [
    { title: 'Initial Matrix', detail: `${m}×${n}`, matrixSnapshot: cloneMatrix(M) },
  ];

  let pivotRow = 0;
  let rank = 0;
  const pivotCols: Array<{ r: number; c: number }> = [];

  for (let col = 0; col < n && pivotRow < m; col++) {
    let bestRow = pivotRow;
    let maxVal = Math.abs(M[pivotRow][col]);
    for (let r = pivotRow + 1; r < m; r++) {
      if (Math.abs(M[r][col]) > maxVal) {
        maxVal = Math.abs(M[r][col]);
        bestRow = r;
      }
    }
    if (maxVal < EPS) continue;

    if (bestRow !== pivotRow) {
      [M[pivotRow], M[bestRow]] = [M[bestRow], M[pivotRow]];
      steps.push({
        title: `R${pivotRow + 1} ↔ R${bestRow + 1}`,
        detail: `Move largest pivot in column ${col + 1}`,
        matrixSnapshot: cloneMatrix(M),
      });
    }

    if (reduced && Math.abs(M[pivotRow][col] - 1) > EPS) {
      const p = M[pivotRow][col];
      for (let c = col; c < n; c++) M[pivotRow][c] /= p;
      steps.push({
        title: `R${pivotRow + 1} ← R${pivotRow + 1} / ${formatNum(p)}`,
        detail: 'Scale pivot to 1',
        matrixSnapshot: cloneMatrix(M),
      });
    }

    for (let r = pivotRow + 1; r < m; r++) {
      if (Math.abs(M[r][col]) < EPS) continue;
      const factor = M[r][col] / M[pivotRow][col];
      for (let c = col; c < n; c++) M[r][c] -= factor * M[pivotRow][c];
      M[r][col] = 0;
      steps.push({
        title: `R${r + 1} ← R${r + 1} - (${formatNum(factor)})·R${pivotRow + 1}`,
        detail: `Clear below pivot (${pivotRow + 1}, ${col + 1})`,
        matrixSnapshot: cloneMatrix(M),
      });
    }

    pivotCols.push({ r: pivotRow, c: col });
    pivotRow++;
    rank++;
  }

  if (reduced) {
    for (let idx = pivotCols.length - 1; idx >= 0; idx--) {
      const { r: pr, c: pc } = pivotCols[idx];
      for (let r = 0; r < pr; r++) {
        if (Math.abs(M[r][pc]) < EPS) continue;
        const factor = M[r][pc];
        for (let c = pc; c < n; c++) M[r][c] -= factor * M[pr][c];
        M[r][pc] = 0;
        steps.push({
          title: `R${r + 1} ← R${r + 1} - (${formatNum(factor)})·R${pr + 1}`,
          detail: `Back-eliminate above pivot (${pr + 1}, ${pc + 1})`,
          matrixSnapshot: cloneMatrix(M),
        });
      }
    }
  }

  const clean = M.map((row) => row.map((v) => roundClean(v, 8)));
  return {
    ok: true,
    operation: reduced ? 'Gauss-Jordan Elimination (RREF)' : 'Gaussian Elimination (REF)',
    scalar: rank,
    matrix: clean,
    steps,
    textResult: formatMatrixText(clean),
    latexResult: formatMatrixLatex(clean),
  };
}

export function matrixRank(A: number[][]): MatrixOperationResult {
  const rref = matrixGaussianElimination(A, true);
  const rank = rref.scalar ?? 0;
  return {
    ok: true,
    operation: 'Matrix Rank',
    scalar: rank,
    textResult: `rank(A) = ${rank}`,
    latexResult: `\\operatorname{rank}(A) = ${rank}`,
  };
}

export function matrixLU(A: number[][]): MatrixOperationResult {
  const n = A.length;
  if (n !== A[0].length) {
    return {
      ok: false,
      operation: 'LU Decomposition',
      textResult: '',
      error: `LU decomposition requires a square matrix, got ${n}×${A[0].length}.`,
    };
  }
  const U = cloneMatrix(A);
  const L: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const P: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let k = 0; k < n; k++) {
    let pivotRow = k;
    let maxVal = Math.abs(U[k][k]);
    for (let r = k + 1; r < n; r++) {
      if (Math.abs(U[r][k]) > maxVal) {
        maxVal = Math.abs(U[r][k]);
        pivotRow = r;
      }
    }
    if (pivotRow !== k) {
      [U[k], U[pivotRow]] = [U[pivotRow], U[k]];
      [P[k], P[pivotRow]] = [P[pivotRow], P[k]];
      for (let j = 0; j < k; j++) {
        [L[k][j], L[pivotRow][j]] = [L[pivotRow][j], L[k][j]];
      }
    }
    if (Math.abs(U[k][k]) < EPS) continue;
    for (let i = k + 1; i < n; i++) {
      L[i][k] = roundClean(U[i][k] / U[k][k], 8);
      for (let j = k; j < n; j++) {
        U[i][j] = roundClean(U[i][j] - L[i][k] * U[k][j], 8);
      }
    }
  }

  return {
    ok: true,
    operation: 'LU Decomposition (PA = LU)',
    matrices: [
      { label: 'P', data: P },
      { label: 'L', data: L },
      { label: 'U', data: U },
    ],
    textResult: `L =\n${formatMatrixText(L)}\n\nU =\n${formatMatrixText(U)}\n\nP =\n${formatMatrixText(P)}`,
    latexResult: `L = ${formatMatrixLatex(L)}, \\quad U = ${formatMatrixLatex(U)}`,
  };
}

export function matrixQR(A: number[][]): MatrixOperationResult {
  const m = A.length;
  const n = A[0].length;
  // Modified Gram-Schmidt for full-column-rank / Householder fallback
  const R: number[][] = cloneMatrix(A);
  let Q: number[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => (i === j ? 1 : 0))
  );

  const steps = Math.min(m, n);
  for (let k = 0; k < steps; k++) {
    let normX = 0;
    for (let i = k; i < m; i++) normX += R[i][k] * R[i][k];
    normX = Math.sqrt(normX);
    if (normX < EPS) continue;

    const alpha = R[k][k] >= 0 ? -normX : normX;
    const v = new Array(m - k).fill(0);
    v[0] = R[k][k] - alpha;
    for (let i = k + 1; i < m; i++) v[i - k] = R[i][k];
    let vNormSq = 0;
    for (const val of v) vNormSq += val * val;
    if (vNormSq < EPS) continue;

    // Apply H = I - 2 v v^T / (v^T v) to R[k:, k:]
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i - k] * R[i][j];
      const scale = (2 * dot) / vNormSq;
      for (let i = k; i < m; i++) R[i][j] -= scale * v[i - k];
    }

    // Apply H to Q[:, k:]
    for (let i = 0; i < m; i++) {
      let dot = 0;
      for (let j = k; j < m; j++) dot += Q[i][j] * v[j - k];
      const scale = (2 * dot) / vNormSq;
      for (let j = k; j < m; j++) Q[i][j] -= scale * v[j - k];
    }
  }

  // Normalize sign so diagonal of R >= 0
  for (let k = 0; k < Math.min(m, n); k++) {
    if (R[k][k] < -EPS) {
      for (let j = k; j < n; j++) R[k][j] = -R[k][j];
      for (let i = 0; i < m; i++) Q[i][k] = -Q[i][k];
    }
  }

  const Qclean = Q.map((r) => r.map((v) => roundClean(v, 6)));
  const Rclean = R.map((r) => r.map((v) => roundClean(v, 6)));

  return {
    ok: true,
    operation: 'QR Decomposition (Householder)',
    matrices: [
      { label: 'Q', data: Qclean },
      { label: 'R', data: Rclean },
    ],
    textResult: `Q =\n${formatMatrixText(Qclean)}\n\nR =\n${formatMatrixText(Rclean)}`,
    latexResult: `Q = ${formatMatrixLatex(Qclean)}, \\quad R = ${formatMatrixLatex(Rclean)}`,
  };
}

/**
 * Symmetric Jacobi eigendecomposition (returns real eigenvalues + orthonormal columns V).
 */
function jacobiSymmetricEigen(S: number[][]): { values: number[]; vectors: number[][] } {
  const n = S.length;
  const A = cloneMatrix(S);
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  for (let iter = 0; iter < 80 * n * n; iter++) {
    let p = 0;
    let q = 1;
    let maxOff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[i][j]) > maxOff) {
          maxOff = Math.abs(A[i][j]);
          p = i;
          q = j;
        }
      }
    }
    if (maxOff < 1e-11 || n < 2) break;

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];
    const tau = (aqq - app) / (2 * apq);
    const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const arp = A[r][p];
      const arq = A[r][q];
      A[r][p] = A[p][r] = c * arp - s * arq;
      A[r][q] = A[q][r] = s * arp + c * arq;
    }

    for (let r = 0; r < n; r++) {
      const vrp = V[r][p];
      const vrq = V[r][q];
      V[r][p] = c * vrp - s * vrq;
      V[r][q] = s * vrp + c * vrq;
    }
  }

  const values = A.map((row, i) => row[i]);
  return { values, vectors: V };
}

export function matrixSVD(A: number[][]): MatrixOperationResult {
  const m = A.length;
  const n = A[0].length;
  const AT = matrixTranspose(A).matrix!;
  const ATA = matrixMultiply(AT, A).matrix!;
  const { values, vectors: Vraw } = jacobiSymmetricEigen(ATA);

  const indexed = values
    .map((v, idx) => ({ sigma: Math.sqrt(Math.max(0, v)), idx }))
    .sort((a, b) => b.sigma - a.sigma);

  const V: number[][] = Array.from({ length: n }, (_, i) =>
    indexed.map((item) => roundClean(Vraw[i][item.idx], 6))
  );
  const VT = matrixTranspose(V).matrix!;

  const Sigma: number[][] = Array.from({ length: m }, () => Array(n).fill(0));
  const U: number[][] = Array.from({ length: m }, () => Array(m).fill(0));
  const rank = Math.min(m, n);

  let filledCols = 0;
  for (let k = 0; k < rank; k++) {
    const s = roundClean(indexed[k].sigma, 6);
    Sigma[k][k] = s;
    if (s > 1e-7) {
      // u_k = A * v_k / s
      for (let i = 0; i < m; i++) {
        let dot = 0;
        for (let j = 0; j < n; j++) dot += A[i][j] * V[j][k];
        U[i][k] = dot / s;
      }
      filledCols++;
    }
  }

  // Complete U to an orthonormal m x m basis via Gram-Schmidt
  for (let k = filledCols; k < m; k++) {
    let vec: number[] = Array.from({ length: m }, (_, i) => (i === k ? 1 : 0));
    for (let pass = 0; pass < 2; pass++) {
      for (let prev = 0; prev < k; prev++) {
        let dot = 0;
        for (let i = 0; i < m; i++) dot += vec[i] * U[i][prev];
        for (let i = 0; i < m; i++) vec[i] -= dot * U[i][prev];
      }
    }
    let norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
    if (norm < 1e-8) {
      // Try standard basis vectors
      for (let e = 0; e < m && norm < 1e-8; e++) {
        vec = Array.from({ length: m }, (_, i) => (i === e ? 1 : 0));
        for (let prev = 0; prev < k; prev++) {
          let dot = 0;
          for (let i = 0; i < m; i++) dot += vec[i] * U[i][prev];
          for (let i = 0; i < m; i++) vec[i] -= dot * U[i][prev];
        }
        norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0));
      }
    }
    if (norm > 1e-8) {
      for (let i = 0; i < m; i++) U[i][k] = vec[i] / norm;
    }
  }

  const Uclean = U.map((r) => r.map((v) => roundClean(v, 6)));
  const Sclean = Sigma.map((r) => r.map((v) => roundClean(v, 6)));
  const VTclean = VT.map((r) => r.map((v) => roundClean(v, 6)));

  return {
    ok: true,
    operation: 'Singular Value Decomposition (A = UΣVᵀ)',
    matrices: [
      { label: 'U', data: Uclean },
      { label: 'Σ', data: Sclean },
      { label: 'Vᵀ', data: VTclean },
    ],
    textResult: `U =\n${formatMatrixText(Uclean)}\n\nΣ =\n${formatMatrixText(Sclean)}\n\nVᵀ =\n${formatMatrixText(VTclean)}`,
    latexResult: `U = ${formatMatrixLatex(Uclean)}, \\quad \\Sigma = ${formatMatrixLatex(Sclean)}, \\quad V^T = ${formatMatrixLatex(VTclean)}`,
  };
}

/**
 * Faddeev-LeVerrier algorithm to compute exact characteristic polynomial
 * p(λ) = det(λI - A) = λⁿ + c_{n-1} λ^{n-1} + ... + c₀.
 */
export function matrixCharacteristicPolynomial(A: number[][]): MatrixOperationResult {
  const n = A.length;
  if (n !== A[0].length) {
    return {
      ok: false,
      operation: 'Characteristic Polynomial',
      textResult: '',
      error: `Requires a square matrix, got ${n}×${A[0].length}.`,
    };
  }
  const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  const coeffs: number[] = [1]; // leading coefficient for λ^n
  let M = cloneMatrix(I);

  for (let k = 1; k <= n; k++) {
    const AM = matrixMultiply(A, M).matrix!;
    const tr = matrixTrace(AM).scalar!;
    const ck = roundClean(-tr / k, 6);
    coeffs.push(ck);
    if (k < n) {
      M = AM.map((row, i) => row.map((v, j) => v + (i === j ? ck : 0)));
    }
  }

  const terms: string[] = [];
  for (let idx = 0; idx < coeffs.length; idx++) {
    const pow = n - idx;
    const c = coeffs[idx];
    if (Math.abs(c) < 1e-8) continue;
    const sign = terms.length === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + ';
    const absC = Math.abs(c);
    const numStr = pow > 0 && Math.abs(absC - 1) < 1e-8 ? '' : formatNum(absC, 4);
    const varStr = pow === 0 ? '' : pow === 1 ? 'λ' : `λ^${pow}`;
    terms.push(`${sign}${numStr}${varStr}`);
  }
  const poly = terms.join('') || '0';

  return {
    ok: true,
    operation: 'Characteristic Polynomial det(λI - A)',
    polynomial: poly,
    vector: coeffs,
    textResult: `p(λ) = ${poly}`,
    latexResult: `p(\\lambda) = ${poly.replace(/λ/g, '\\lambda')}`,
  };
}

/**
 * Computes real and complex eigenvalues + eigenvectors for real square matrices.
 * Uses symmetric Jacobi when A = Aᵀ, exact quadratic formula for 2×2, and shifted QR
 * iteration with inverse power / nullspace eigenvector extraction for general n×n.
 */
export function matrixEigen(A: number[][]): MatrixOperationResult {
  const n = A.length;
  if (n !== A[0].length) {
    return {
      ok: false,
      operation: 'Eigenvalues & Eigenvectors',
      textResult: '',
      error: `Eigenanalysis requires a square matrix, got ${n}×${A[0].length}.`,
    };
  }

  // 1. Check symmetry -> exact orthogonal Jacobi eigendecomposition
  let isSym = true;
  for (let i = 0; i < n && isSym; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > 1e-9) {
        isSym = false;
        break;
      }
    }
  }

  if (isSym) {
    const { values, vectors } = jacobiSymmetricEigen(A);
    const pairs = values
      .map((val, idx) => ({
        val: roundClean(val, 6),
        vec: vectors.map((row) => roundClean(row[idx], 6)),
      }))
      .sort((a, b) => b.val - a.val);

    const eigenvalues = pairs.map((p) => ({ real: p.val, imag: 0 }));
    const eigenvectors = pairs.map((p) => p.vec);
    const lines = pairs.map(
      (p, i) => `λ${i + 1} = ${formatNum(p.val)}  |  v${i + 1} = [${p.vec.map((x) => formatNum(x)).join(', ')}]ᵀ`
    );

    return {
      ok: true,
      operation: 'Eigenvalues & Eigenvectors (Symmetric Jacobi)',
      eigenvalues,
      eigenvectors,
      textResult: lines.join('\n'),
      latexResult: pairs
        .map(
          (p, i) =>
            `\\lambda_{${i + 1}} = ${formatNum(p.val)}, \\; v_{${i + 1}} = \\begin{bmatrix}${p.vec.map((x) => formatNum(x)).join(' \\\\ ')}\\end{bmatrix}`
        )
        .join('; \\quad '),
    };
  }

  // 2. Exact 2x2 formula (handles complex conjugate eigenvalues cleanly)
  if (n === 2) {
    const tr = A[0][0] + A[1][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const disc = tr * tr - 4 * det;
    if (disc >= -1e-11) {
      const s = Math.sqrt(Math.max(0, disc));
      const l1 = roundClean((tr + s) / 2, 6);
      const l2 = roundClean((tr - s) / 2, 6);
      const vecFor = (lam: number): number[] => {
        const a = A[0][0] - lam;
        const b = A[0][1];
        const c = A[1][0];
        const d = A[1][1] - lam;
        let vx = 1;
        let vy = 0;
        if (Math.abs(b) > EPS || Math.abs(a) > EPS) {
          if (Math.abs(b) >= Math.abs(a)) {
            vx = b;
            vy = -a;
          } else {
            vx = -b;
            vy = a;
          }
        } else if (Math.abs(d) > EPS || Math.abs(c) > EPS) {
          vx = d;
          vy = -c;
        }
        const norm = Math.hypot(vx, vy) || 1;
        return [roundClean(vx / norm, 6), roundClean(vy / norm, 6)];
      };
      const v1 = vecFor(l1);
      const v2 = vecFor(l2);
      return {
        ok: true,
        operation: 'Eigenvalues & Eigenvectors',
        eigenvalues: [
          { real: l1, imag: 0 },
          { real: l2, imag: 0 },
        ],
        eigenvectors: [v1, v2],
        textResult: `λ₁ = ${formatNum(l1)} | v₁ = [${v1.map((x) => formatNum(x)).join(', ')}]ᵀ\nλ₂ = ${formatNum(l2)} | v₂ = [${v2.map((x) => formatNum(x)).join(', ')}]ᵀ`,
      };
    } else {
      const re = roundClean(tr / 2, 6);
      const im = roundClean(Math.sqrt(-disc) / 2, 6);
      return {
        ok: true,
        operation: 'Eigenvalues (Complex Conjugate Pair)',
        eigenvalues: [
          { real: re, imag: im },
          { real: re, imag: -im },
        ],
        textResult: `λ₁ = ${formatNum(re)} + ${formatNum(im)}i\nλ₂ = ${formatNum(re)} - ${formatNum(im)}i`,
        latexResult: `\\lambda_{1,2} = ${formatNum(re)} \\pm ${formatNum(im)}i`,
      };
    }
  }

  // 3. General n x n via QR iteration
  let Ak = cloneMatrix(A);
  for (let iter = 0; iter < 120; iter++) {
    const qr = matrixQR(Ak);
    if (!qr.matrices) break;
    const Q = qr.matrices[0].data;
    const R = qr.matrices[1].data;
    Ak = matrixMultiply(R, Q).matrix!;
  }

  const eigenvalues: { real: number; imag: number }[] = [];
  const eigenvectors: number[][] = [];
  let i = 0;
  while (i < n) {
    if (i + 1 < n && Math.abs(Ak[i + 1][i]) > 1e-4) {
      // 2x2 Schur block -> complex conjugate pair
      const tr = Ak[i][i] + Ak[i + 1][i + 1];
      const det = Ak[i][i] * Ak[i + 1][i + 1] - Ak[i][i + 1] * Ak[i + 1][i];
      const disc = tr * tr - 4 * det;
      if (disc < 0) {
        const re = roundClean(tr / 2, 5);
        const im = roundClean(Math.sqrt(-disc) / 2, 5);
        eigenvalues.push({ real: re, imag: im }, { real: re, imag: -im });
        i += 2;
        continue;
      }
    }
    const lam = roundClean(Ak[i][i], 5);
    eigenvalues.push({ real: lam, imag: 0 });
    eigenvectors.push(extractNullspaceVector(A, lam));
    i += 1;
  }

  const textLines = eigenvalues.map((ev, idx) => {
    const lamStr =
      Math.abs(ev.imag) < 1e-6
        ? formatNum(ev.real)
        : `${formatNum(ev.real)} ${ev.imag >= 0 ? '+' : '-'} ${formatNum(Math.abs(ev.imag))}i`;
    const vecStr = eigenvectors[idx]
      ? `  |  v${idx + 1} = [${eigenvectors[idx].map((x) => formatNum(x)).join(', ')}]ᵀ`
      : '';
    return `λ${idx + 1} = ${lamStr}${vecStr}`;
  });

  return {
    ok: true,
    operation: 'Eigenvalues & Eigenvectors (QR Algorithm)',
    eigenvalues,
    eigenvectors: eigenvectors.length > 0 ? eigenvectors : undefined,
    textResult: textLines.join('\n'),
  };
}

function extractNullspaceVector(A: number[][], lambda: number): number[] {
  const n = A.length;
  const shifted = A.map((row, i) => row.map((v, j) => (i === j ? v - lambda : v)));
  const rref = matrixGaussianElimination(shifted, true).matrix || shifted;
  const x = new Array(n).fill(0);
  // Find first non-pivot column as free variable = 1
  const pivotCols = new Set<number>();
  for (let r = 0; r < n; r++) {
    const pc = rref[r].findIndex((v) => Math.abs(v) > 1e-4);
    if (pc !== -1) pivotCols.add(pc);
  }
  const freeCol = Array.from({ length: n }, (_, c) => c).find((c) => !pivotCols.has(c)) ?? n - 1;
  x[freeCol] = 1;
  for (let r = 0; r < n; r++) {
    const pc = rref[r].findIndex((v) => Math.abs(v) > 1e-4);
    if (pc !== -1 && pc !== freeCol) {
      x[pc] = -rref[r][freeCol];
    }
  }
  const norm = Math.hypot(...x) || 1;
  return x.map((v) => roundClean(v / norm, 6));
}

export function solveLinearSystem(A: number[][], b: number[]): MatrixOperationResult {
  const m = A.length;
  const n = A[0].length;
  if (b.length !== m) {
    return {
      ok: false,
      operation: 'Solve Ax = b',
      textResult: '',
      error: `Vector b length (${b.length}) must match number of rows in A (${m}).`,
    };
  }

  const aug = A.map((row, i) => [...row, b[i]]);
  const rrefRes = matrixGaussianElimination(aug, true);
  const R = rrefRes.matrix!;

  // Check inconsistency: row [0 ... 0 | nonZero]
  for (let r = 0; r < m; r++) {
    const allZeroCoeff = R[r].slice(0, n).every((v) => Math.abs(v) < 1e-6);
    if (allZeroCoeff && Math.abs(R[r][n]) > 1e-6) {
      return {
        ok: false,
        operation: 'Solve Ax = b',
        matrix: R,
        steps: rrefRes.steps,
        textResult: 'Inconsistent system: No solution exists.',
        error: 'System is inconsistent (0 = nonzero row in RREF).',
      };
    }
  }

  // Count pivot columns in coefficient block
  const pivotColForRow: number[] = [];
  for (let r = 0; r < m; r++) {
    const pc = R[r].slice(0, n).findIndex((v) => Math.abs(v) > 1e-6);
    if (pc !== -1) pivotColForRow.push(pc);
  }

  if (pivotColForRow.length < n) {
    return {
      ok: true,
      operation: 'Solve Ax = b (Underdetermined)',
      matrix: R,
      steps: rrefRes.steps,
      textResult: `Infinitely many solutions (rank = ${pivotColForRow.length} < ${n} variables).\nRREF [A | b]:\n${formatMatrixText(R)}`,
    };
  }

  const sol = new Array(n).fill(0);
  for (let r = 0; r < pivotColForRow.length; r++) {
    sol[pivotColForRow[r]] = roundClean(R[r][n], 8);
  }

  return {
    ok: true,
    operation: 'Solve Ax = b',
    vector: sol,
    steps: rrefRes.steps,
    textResult: sol.map((v, i) => `x${i + 1} = ${formatNum(v)}`).join('\n'),
    latexResult: `\\mathbf{x} = \\begin{bmatrix} ${sol.map((v) => formatNum(v)).join(' \\\\ ')} \\end{bmatrix}`,
  };
}
