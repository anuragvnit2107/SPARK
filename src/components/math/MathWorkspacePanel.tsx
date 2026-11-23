import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  Grid,
  History,
  Layers,
  Plus,
  Redo2,
  RotateCcw,
  Sigma,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { WhiteboardElement } from '../../types';
import { ForgeTheme } from '../../themes';
import { AngleUnit, MathHistoryEntry, MathInputMode, MathStep } from '../../math/types';
import { MathFormula } from '../../math/MathematicalRenderer';
import { analyzeEquation } from '../../math/EquationAnalyzer';
import {
  applyVisualTemplateAtSelection,
  createMathExprModel,
  findMatchingBracketPair,
  getAutocompleteSuggestions,
  handleSmartBracketKey,
  MATH_VISUAL_TEMPLATES,
  MathTemplateItem,
  processNaturalMathInput,
} from '../../math/MathInputEngine';
import {
  canonicalToLatex,
  convertTrailingGreekKeyword,
  normalizeUnicodeToCanonical,
} from '../../math/SymbolConverter';
import {
  evaluateExpressionValue,
  expandExpression,
  factorExpression,
  simplifyExpression,
  solveEquation,
  solveInequality1D,
  solveSimultaneousEquations,
} from '../../math/AlgebraEngine';
import { analyzeTrigExpression } from '../../math/TrigonometryEngine';
import {
  differentiateImplicit,
  differentiateSymbolic,
  evaluateLimit,
  integrateDefinite,
  integrateIndefinite,
} from '../../math/CalculusEngine';
import { suggestIdentities } from '../../math/IdentitySuggestionEngine';
import { analyzeConicEquation } from '../../math/ConicSectionEngine';
import {
  classifyMatrix,
  formatMatrixText,
  formatNum,
  matrixAdd,
  matrixAdjoint,
  matrixCharacteristicPolynomial,
  matrixCofactor,
  matrixDeterminant,
  matrixDivide,
  matrixEigen,
  matrixGaussianElimination,
  matrixInverse,
  matrixLU,
  matrixMultiply,
  matrixQR,
  matrixRank,
  matrixScalarMultiply,
  matrixSubtract,
  matrixSVD,
  matrixTrace,
  matrixTranspose,
  parseMatrixInput,
  solveLinearSystem,
} from '../../math/MatrixEngine';
import {
  findRootBisection,
  findRootNewtonRaphson,
  solveODEBoundaryValueShooting,
  solveODEFirstOrderRK4,
  solveODESecondOrderRK4,
} from '../../math/NumericalMethodsEngine';
import {
  analyzeComplex,
  computeDFT,
  computeFourierSeries,
  computeLaplaceTransform,
  computeStatistics,
  computeZTransform,
  numericalDoubleIntegral,
  vectorCalculusAtPoint,
  vectorOperations,
} from '../../math/EngineeringMathEngine';
import {
  appendMathHistory,
  clearMathHistory,
  deleteMathHistoryEntry,
  loadMathHistory,
} from '../../math/MathHistoryManager';
import {
  downloadCsvFile,
  downloadGraph2DSvg,
  downloadLatexFile,
  downloadMathJsonDocument,
  exportGraph2DToCsv,
  exportMathReportToPdf,
  exportMatrixToCsv,
} from '../../math/MathExportManager';
import {
  createDefaultGraph2DConfig,
  createDefaultGraph3DConfig,
  maybeParseMatrixElementData,
} from '../../math/MathCanvasIntegration';

export type MathStudioTab = 'equation' | 'matrix' | 'engineering' | 'history';

interface MathWorkspacePanelProps {
  open: boolean;
  activeTab: MathStudioTab;
  onChangeTab: (tab: MathStudioTab) => void;
  selectedElements: WhiteboardElement[];
  theme: ForgeTheme;
  onStampEquation: (
    raw: string,
    result?: { text: string; latex?: string; operation?: string }
  ) => void;
  onStampMatrix: (matrix: number[][], name: string) => void;
  onStampGraph2D: (config: import('../../math/types').Graph2DConfig) => void;
  onStampGraph3D: (config: import('../../math/types').Graph3DConfig) => void;
  onUpdateElement: (id: string, patch: Partial<WhiteboardElement>) => void;
  onShowToast: (msg: string) => void;
  onClose: () => void;
}

export const MathWorkspacePanel: React.FC<MathWorkspacePanelProps> = ({
  open,
  activeTab,
  onChangeTab,
  selectedElements,
  theme,
  onStampEquation,
  onStampMatrix,
  onStampGraph2D,
  onStampGraph3D,
  onUpdateElement,
  onShowToast,
  onClose,
}) => {
  const selectedFirst = selectedElements[0];

  // Unified Expression Model & Undo/Redo
  const [inputMode, setInputMode] = useState<MathInputMode>('keyboard');
  const [exprInput, setExprInput] = useState('sin(x)^2 + cos(x)^2');
  const [exprHistory, setExprHistory] = useState<string[]>(['sin(x)^2 + cos(x)^2']);
  const [exprHistIdx, setExprHistIdx] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [templateCat, setTemplateCat] = useState<MathTemplateItem['category']>('Structures');
  const exprInputRef = useRef<HTMLInputElement | null>(null);

  // Calculus / Solver params
  const [calcVar, setCalcVar] = useState('x');
  const [diffOrder, setDiffOrder] = useState(1);
  const [intFrom, setIntFrom] = useState('0');
  const [intTo, setIntTo] = useState('3.14159');
  const [limTarget, setLimTarget] = useState('0');
  const [limDir, setLimDir] = useState<'both' | 'left' | 'right'>('both');
  const [angleUnit, setAngleUnit] = useState<AngleUnit>('rad');

  // Pre-plot graph bounds
  const [prePlotBounds, setPrePlotBounds] = useState({
    xMin: '-10',
    xMax: '10',
    yMin: '-10',
    yMax: '10',
  });

  // Symbolic Output
  const [resultTitle, setResultTitle] = useState('');
  const [resultText, setResultText] = useState('');
  const [resultLatex, setResultLatex] = useState('');
  const [resultError, setResultError] = useState('');
  const [resultSteps, setResultSteps] = useState<MathStep[]>([]);
  const [showSteps, setShowSteps] = useState(true);

  // Matrix Studio State
  const [matA, setMatA] = useState<number[][]>([
    [2, 1, 0],
    [1, 3, 1],
    [0, 1, 2],
  ]);
  const [matB, setMatB] = useState<number[][]>([
    [1, 0, 2],
    [0, 1, 1],
    [1, 0, 1],
  ]);
  const [scalarK, setScalarK] = useState('2');
  const [vecBText, setVecBText] = useState('1, 2, 3');
  const [matPasteText, setMatPasteText] = useState('');
  const [matOutText, setMatOutText] = useState('');
  const [matOutLatex, setMatOutLatex] = useState('');
  const [matOutSteps, setMatOutSteps] = useState<MathStep[]>([]);
  const [matOutError, setMatOutError] = useState('');

  // Engineering & ODE State
  const [odeKind, setOdeKind] = useState<'1st' | '2nd' | 'bvp'>('1st');
  const [odeExpr, setOdeExpr] = useState('-2*x*y');
  const [odeX0, setOdeX0] = useState('0');
  const [odeY0, setOdeY0] = useState('1');
  const [odeYp0, setOdeYp0] = useState('0');
  const [odeXEnd, setOdeXEnd] = useState('2');
  const [odeYb, setOdeYb] = useState('0');
  const [engSubTab, setEngSubTab] = useState<'ode' | 'transform' | 'vector' | 'stats'>('ode');
  const [transformExpr, setTransformExpr] = useState('exp(-2*t)*sin(3*t)');
  const [dftSamples, setDftSamples] = useState('1, 0, -1, 0');
  const [vecAText, setVecAText] = useState('1, 2, 3');
  const [vecBEngText, setVecBEngText] = useState('4, -1, 2');
  const [fieldXExpr, setFieldXExpr] = useState('x^2*y');
  const [fieldYExpr, setFieldYExpr] = useState('y*z');
  const [fieldZExpr, setFieldZExpr] = useState('x*z');
  const [statsXText, setStatsXText] = useState('1, 2, 3, 4, 5, 6');
  const [statsYText, setStatsYText] = useState('2.1, 3.9, 6.2, 7.8, 10.1, 12.2');
  const [engOut, setEngOut] = useState('');

  // History State
  const [historyList, setHistoryList] = useState<MathHistoryEntry[]>(() => loadMathHistory());
  const [historySearch, setHistorySearch] = useState('');

  // Sync from selected canvas element
  useEffect(() => {
    if (!selectedFirst) return;
    if (selectedFirst.type === 'math-equation' && selectedFirst.mathRaw) {
      setExprInput(selectedFirst.mathRaw);
      setResultText(selectedFirst.mathResult || '');
      setResultLatex(selectedFirst.mathResultLatex || '');
      setResultTitle(selectedFirst.mathOperation || '');
    } else if (selectedFirst.type === 'math-matrix' && selectedFirst.matrixData) {
      setMatA(selectedFirst.matrixData);
    }
  }, [selectedFirst?.id]);

  const model = useMemo(() => createMathExprModel(exprInput, cursorPos), [exprInput, cursorPos]);
  const analysis = useMemo(() => analyzeEquation(exprInput), [exprInput]);
  const identities = useMemo(() => suggestIdentities(exprInput), [exprInput]);
  const conicInfo = useMemo(() => analyzeConicEquation(exprInput), [exprInput]);
  const trigInfo = useMemo(() => analyzeTrigExpression(exprInput), [exprInput]);
  const autocomplete = useMemo(
    () => getAutocompleteSuggestions(exprInput, cursorPos),
    [exprInput, cursorPos]
  );
  const bracketPair = useMemo(
    () => findMatchingBracketPair(exprInput, cursorPos),
    [exprInput, cursorPos]
  );

  const pushExprChange = (nextVal: string, nextCur?: number) => {
    setExprInput(nextVal);
    if (typeof nextCur === 'number') setCursorPos(nextCur);
    const trimmedHist = exprHistory.slice(0, exprHistIdx + 1);
    if (trimmedHist[trimmedHist.length - 1] !== nextVal) {
      const updated = [...trimmedHist, nextVal].slice(-40);
      setExprHistory(updated);
      setExprHistIdx(updated.length - 1);
    }
  };

  const handleExprUndo = () => {
    if (exprHistIdx <= 0) return;
    const prevIdx = exprHistIdx - 1;
    setExprHistIdx(prevIdx);
    setExprInput(exprHistory[prevIdx]);
  };

  const handleExprRedo = () => {
    if (exprHistIdx >= exprHistory.length - 1) return;
    const nextIdx = exprHistIdx + 1;
    setExprHistIdx(nextIdx);
    setExprInput(exprHistory[nextIdx]);
  };

  const recordHistory = (operation: string, resText: string, resLatex?: string) => {
    const updated = appendMathHistory({
      inputRaw: exprInput,
      canonical: model.canonical,
      latex: model.latex,
      operation,
      resultText: resText,
      resultLatex: resLatex,
      linkedElementId: selectedFirst?.id,
    });
    setHistoryList(updated);
  };

  const applyResultToSelectedEquation = (
    op: string,
    text: string,
    latex?: string,
    exprOverride?: string
  ) => {
    const activeRaw = exprOverride ?? exprInput;
    const activeModel = exprOverride !== undefined ? createMathExprModel(activeRaw, cursorPos) : model;
    setResultTitle(op);
    setResultText(text);
    setResultLatex(latex || '');
    setResultError('');
    appendMathHistory({
      inputRaw: activeRaw,
      canonical: activeModel.canonical,
      latex: activeModel.latex,
      operation: op,
      resultText: text,
      resultLatex: latex,
      linkedElementId: selectedFirst?.id,
    });
    setHistoryList(loadMathHistory());
    if (selectedFirst?.type === 'math-equation') {
      onUpdateElement(selectedFirst.id, {
        mathRaw: activeRaw,
        mathLatex: activeModel.latex,
        mathOperation: op,
        mathResult: text,
        mathResultLatex: latex,
      });
    }
  };

  const runSymbolicOp = (
    kind:
      | 'eval'
      | 'simplify'
      | 'expand'
      | 'factor'
      | 'solve'
      | 'ineq'
      | 'diff'
      | 'implicit'
      | 'indef'
      | 'def'
      | 'limit',
    exprOverride?: string
  ) => {
    let activeExpr = exprOverride ?? exprInput;
    const trailing = convertTrailingGreekKeyword(activeExpr);
    if (trailing.changed) {
      activeExpr = trailing.nextValue;
      if (exprOverride === undefined) {
        pushExprChange(trailing.nextValue, trailing.nextValue.length);
      }
    }
    setResultError('');
    setResultSteps([]);

    // Check if user pasted a matrix literal like matrix = [[1,2],[3,4]]
    const parsedMat = maybeParseMatrixElementData(activeExpr);
    if (parsedMat && (kind === 'simplify' || kind === 'eval')) {
      setMatA(parsedMat.matrix);
      onChangeTab('matrix');
      onShowToast(
        `Matrix ${parsedMat.name} (${parsedMat.matrix.length}×${parsedMat.matrix[0].length}) loaded into Matrix Engine`
      );
      return;
    }

    if (kind === 'eval') {
      const r = evaluateExpressionValue(activeExpr, angleUnit, calcVar);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Evaluation failed');
    } else if (kind === 'simplify') {
      const r = simplifyExpression(activeExpr, angleUnit);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Failed to simplify');
    } else if (kind === 'expand') {
      const r = expandExpression(activeExpr, angleUnit);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Failed to expand');
    } else if (kind === 'factor') {
      const r = factorExpression(activeExpr, angleUnit);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Failed to factorize');
    } else if (kind === 'solve') {
      const semiEqs = activeExpr.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
      const commaParts = activeExpr.split(',').map((s) => s.trim()).filter(Boolean);
      const eqs =
        semiEqs.length > 1
          ? semiEqs
          : commaParts.length > 1 && commaParts.every((p) => p.includes('='))
          ? commaParts
          : [];
      if (eqs.length > 1) {
        const sys = solveSimultaneousEquations(eqs);
        if (sys.ok) applyResultToSelectedEquation(sys.operation, sys.resultText, sys.resultLatex, activeExpr);
        else setResultError(sys.error || 'System solve failed');
        return;
      }
      const r = solveEquation(activeExpr, calcVar, angleUnit);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Solve failed');
    } else if (kind === 'ineq') {
      const r = solveInequality1D(activeExpr, calcVar);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultText, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Inequality solve failed');
    } else if (kind === 'diff') {
      const targetExpr = activeExpr.replace(/^(?:y|[a-zA-Z]\w*\([^)]+\))\s*=\s*/i, '');
      const r = differentiateSymbolic(targetExpr, calcVar, diffOrder);
      if (r.ok) {
        setResultSteps(r.steps || []);
        applyResultToSelectedEquation(r.operation, r.resultCanonical, r.resultLatex, activeExpr);
      } else setResultError(r.error || 'Differentiation failed');
    } else if (kind === 'implicit') {
      const r = differentiateImplicit(activeExpr, 'x', 'y');
      if (r.ok) {
        setResultSteps(r.steps || []);
        applyResultToSelectedEquation(r.operation, r.resultCanonical, r.resultLatex, activeExpr);
      } else setResultError(r.error || 'Implicit differentiation failed');
    } else if (kind === 'indef') {
      const targetExpr = activeExpr.replace(/^(?:y|[a-zA-Z]\w*\([^)]+\))\s*=\s*/i, '');
      const r = integrateIndefinite(targetExpr, calcVar);
      if (r.ok) applyResultToSelectedEquation(r.operation, r.resultCanonical, r.resultLatex, activeExpr);
      else setResultError(r.error || 'Integration failed');
    } else if (kind === 'def') {
      const targetExpr = activeExpr.replace(/^(?:y|[a-zA-Z]\w*\([^)]+\))\s*=\s*/i, '');
      const a = Number(intFrom);
      const b = Number(intTo);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        setResultError('Integration bounds must be finite numbers.');
        return;
      }
      const r = integrateDefinite(targetExpr, a, b, calcVar);
      if (r.ok) {
        setResultSteps(r.steps || []);
        applyResultToSelectedEquation(r.operation, r.resultCanonical, r.resultLatex, activeExpr);
      } else setResultError(r.error || 'Definite integration failed');
    } else if (kind === 'limit') {
      const targetExpr = activeExpr.replace(/^(?:y|[a-zA-Z]\w*\([^)]+\))\s*=\s*/i, '');
      const r = evaluateLimit(targetExpr, calcVar, limTarget, limDir);
      if (r.ok) {
        setResultSteps(r.steps || []);
        applyResultToSelectedEquation(r.operation, r.resultCanonical, r.resultLatex, activeExpr);
      } else setResultError(r.error || 'Limit failed');
    }
  };

  const runMatrixOp = (
    op:
      | 'add'
      | 'sub'
      | 'mul'
      | 'div'
      | 'scalar'
      | 'trans'
      | 'inv'
      | 'det'
      | 'rank'
      | 'trace'
      | 'cof'
      | 'adj'
      | 'poly'
      | 'eigen'
      | 'ref'
      | 'rref'
      | 'lu'
      | 'qr'
      | 'svd'
      | 'solve'
  ) => {
    setMatOutError('');
    setMatOutSteps([]);
    const bVec = vecBText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    const res =
      op === 'add'
        ? matrixAdd(matA, matB)
        : op === 'sub'
        ? matrixSubtract(matA, matB)
        : op === 'mul'
        ? matrixMultiply(matA, matB)
        : op === 'div'
        ? matrixDivide(matA, matB)
        : op === 'scalar'
        ? matrixScalarMultiply(matA, Number(scalarK))
        : op === 'trans'
        ? matrixTranspose(matA)
        : op === 'inv'
        ? matrixInverse(matA)
        : op === 'det'
        ? matrixDeterminant(matA)
        : op === 'rank'
        ? matrixRank(matA)
        : op === 'trace'
        ? matrixTrace(matA)
        : op === 'cof'
        ? matrixCofactor(matA)
        : op === 'adj'
        ? matrixAdjoint(matA)
        : op === 'poly'
        ? matrixCharacteristicPolynomial(matA)
        : op === 'eigen'
        ? matrixEigen(matA)
        : op === 'ref'
        ? matrixGaussianElimination(matA, false)
        : op === 'rref'
        ? matrixGaussianElimination(matA, true)
        : op === 'lu'
        ? matrixLU(matA)
        : op === 'qr'
        ? matrixQR(matA)
        : op === 'svd'
        ? matrixSVD(matA)
        : solveLinearSystem(matA, bVec);

    if (!res.ok) {
      setMatOutError(res.error || 'Matrix operation failed');
      setMatOutText('');
      setMatOutLatex('');
      return;
    }
    setMatOutText(res.textResult);
    setMatOutLatex(res.latexResult || '');
    setMatOutSteps(res.steps || []);
    appendMathHistory({
      inputRaw: `A (${matA.length}×${matA[0].length})`,
      canonical: formatMatrixText(matA),
      latex: '',
      operation: res.operation,
      resultText: res.textResult,
      resultLatex: res.latexResult,
    });
    setHistoryList(loadMathHistory());
  };

  const matAInfo = useMemo(() => classifyMatrix(matA), [matA]);

  if (!open) return null;

  return (
    <aside
      data-testid="math-workspace-panel"
      aria-label="Smart Mathematics Engine"
      className="rf-panel w-[390px] max-w-[94vw] max-h-[calc(100vh-172px)] md:max-h-[calc(100vh-88px)] flex flex-col rounded-2xl overflow-hidden text-xs"
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[var(--rf-border)] flex items-center justify-between bg-[var(--rf-surface-elevated)]">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[var(--rf-accent)]" />
          <span className="font-semibold text-sm text-[var(--rf-text)]">
            Smart Mathematics Engine
          </span>
        </div>
        <button
          type="button"
          aria-label="Close Math Studio"
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface)]">
        {(
          [
            { id: 'equation', label: 'Equation', icon: <Sigma className="w-3.5 h-3.5" /> },
            { id: 'matrix', label: 'Matrix', icon: <Grid className="w-3.5 h-3.5" /> },
            { id: 'engineering', label: 'ODE/Eng', icon: <Activity className="w-3.5 h-3.5" /> },
            { id: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" /> },
          ] as { id: MathStudioTab; label: string; icon: React.ReactNode }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                : 'text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)] hover:text-[var(--rf-text)]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto rf-scrollbar p-3.5 space-y-3">
        {activeTab === 'equation' && (
          <>
            {/* Input Mode, RAD/DEG & History Controls */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-[var(--rf-surface-elevated)] p-0.5 rounded-lg border border-[var(--rf-border)]">
                <button
                  type="button"
                  onClick={() => setInputMode('keyboard')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                    inputMode === 'keyboard'
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'text-[var(--rf-text-muted)]'
                  }`}
                >
                  Natural Keyboard
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('visual')}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium ${
                    inputMode === 'visual'
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'text-[var(--rf-text-muted)]'
                  }`}
                >
                  Visual Palette
                </button>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center bg-[var(--rf-surface-elevated)] p-0.5 rounded-md border border-[var(--rf-border)]">
                  {(['rad', 'deg'] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      data-testid={`math-angle-${unit}`}
                      onClick={() => setAngleUnit(unit)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-semibold uppercase ${
                        angleUnit === unit
                          ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                          : 'text-[var(--rf-text-muted)]'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  title="Undo expression"
                  disabled={exprHistIdx <= 0}
                  onClick={handleExprUndo}
                  className="p-1.5 rounded-md border border-[var(--rf-border)] text-[var(--rf-text)] disabled:opacity-35"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Redo expression"
                  disabled={exprHistIdx >= exprHistory.length - 1}
                  onClick={handleExprRedo}
                  className="p-1.5 rounded-md border border-[var(--rf-border)] text-[var(--rf-text)] disabled:opacity-35"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Main Equation Input */}
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  ref={exprInputRef}
                  type="text"
                  data-testid="math-expression-input"
                  value={exprInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const cur = e.target.selectionStart ?? raw.length;
                    const processed = processNaturalMathInput(raw, cur);
                    let nextVal = processed.model.display;
                    let nextCur = processed.nextCursor;
                    // On bulk paste / programmatic fill, convert all delimited Greek keywords immediately
                    if (Math.abs(raw.length - exprInput.length) > 1) {
                      const greek = convertTrailingGreekKeyword(nextVal);
                      if (greek.changed) {
                        nextVal = greek.nextValue;
                        nextCur = nextVal.length;
                      }
                    }
                    pushExprChange(nextVal, nextCur);
                    requestAnimationFrame(() => {
                      if (exprInputRef.current) {
                        exprInputRef.current.setSelectionRange(nextCur, nextCur);
                      }
                    });
                  }}
                  onBlur={() => {
                    const trailing = convertTrailingGreekKeyword(exprInput);
                    if (trailing.changed) {
                      pushExprChange(trailing.nextValue, trailing.nextValue.length);
                    }
                  }}
                  onKeyDown={(e) => {
                    const el = e.currentTarget;
                    const start = el.selectionStart ?? exprInput.length;
                    const end = el.selectionEnd ?? exprInput.length;
                    setCursorPos(start);

                    const smart = handleSmartBracketKey(exprInput, start, end, e.key);
                    if (smart.handled) {
                      e.preventDefault();
                      pushExprChange(smart.nextValue, smart.nextCursor);
                      requestAnimationFrame(() => {
                        el.setSelectionRange(smart.nextCursor, smart.nextCursor);
                      });
                      return;
                    }

                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const trailing = convertTrailingGreekKeyword(exprInput);
                      if (trailing.changed) {
                        pushExprChange(trailing.nextValue, trailing.nextValue.length);
                      }
                      runSymbolicOp('eval', trailing.nextValue);
                      return;
                    }

                    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
                      e.preventDefault();
                      if (e.shiftKey) handleExprRedo();
                      else handleExprUndo();
                    }
                  }}
                  onClick={(e) => setCursorPos(e.currentTarget.selectionStart ?? 0)}
                  onKeyUp={(e) => setCursorPos(e.currentTarget.selectionStart ?? 0)}
                  placeholder="Type e.g. 2x+5=15, sin(30), 1/2+1/3, theta+alpha, [[1,2],[3,4]]"
                  className={`flex-1 min-w-0 px-3 py-2 rounded-xl bg-[var(--rf-surface-elevated)] border font-mono-tabular text-xs text-[var(--rf-text)] outline-none ${
                    !analysis.valid && exprInput.trim()
                      ? 'border-rose-500'
                      : 'border-[var(--rf-border)] focus:border-[var(--rf-accent)]'
                  }`}
                />
                <button
                  type="button"
                  data-testid="math-evaluate-btn"
                  onClick={() => {
                    const trailing = convertTrailingGreekKeyword(exprInput);
                    if (trailing.changed) pushExprChange(trailing.nextValue, trailing.nextValue.length);
                    runSymbolicOp('eval', trailing.nextValue);
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold text-xs shrink-0 hover:opacity-90"
                >
                  Evaluate
                </button>
              </div>

              {/* Bracket Match + Autocomplete Hints */}
              {(autocomplete.length > 0 || bracketPair) && (
                <div className="flex items-center gap-1 flex-wrap text-[10px]">
                  {bracketPair && (
                    <span className="font-mono-tabular text-[var(--rf-text-muted)]">
                      Match [{bracketPair[0]}..{bracketPair[1]}]
                    </span>
                  )}
                  {autocomplete.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        const before = exprInput.slice(0, cursorPos).replace(/([a-zA-Z_][a-zA-Z0-9_]*)$/, sug);
                        const after = exprInput.slice(cursorPos);
                        const nextVal = before + after;
                        pushExprChange(nextVal, before.length);
                        exprInputRef.current?.focus();
                      }}
                      className="px-1.5 py-0.5 rounded bg-[var(--rf-accent-soft)] text-[var(--rf-accent)] font-mono-tabular hover:opacity-80"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {/* Rendered KaTeX Preview Box */}
              <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] min-h-[44px] flex items-center justify-between gap-2 overflow-x-auto rf-scrollbar">
                <div className="text-sm text-[var(--rf-text)]">
                  {exprInput.trim() ? (
                    <MathFormula expression={exprInput} latex={model.latex} />
                  ) : (
                    <span className="text-[var(--rf-text-muted)] text-xs">Preview renders here</span>
                  )}
                </div>
                <span className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] shrink-0 uppercase">
                  {analysis.category || analysis.kind}
                </span>
              </div>

              {/* Matrix Quick Banner */}
              {analysis.kind === 'matrix' && analysis.valid && (() => {
                const parsedM = maybeParseMatrixElementData(exprInput);
                if (!parsedM) return null;
                return (
                  <div
                    data-testid="math-matrix-detected-banner"
                    className="p-2 rounded-xl border border-[var(--rf-accent)]/40 bg-[var(--rf-accent-soft)] flex items-center justify-between gap-1.5 flex-wrap text-[10px]"
                  >
                    <span className="font-semibold text-[var(--rf-accent)]">
                      Matrix {parsedM.name} ({parsedM.matrix.length}×{parsedM.matrix[0]?.length || 0}) detected
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMatA(parsedM.matrix);
                          onChangeTab('matrix');
                        }}
                        className="px-1.5 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-medium hover:border-[var(--rf-accent)]"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = matrixDeterminant(parsedM.matrix);
                          if (d.ok) applyResultToSelectedEquation(d.operation, d.textResult, d.latexResult);
                          else setResultError(d.error || 'Determinant requires square matrix');
                        }}
                        className="px-1.5 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-medium hover:border-[var(--rf-accent)]"
                      >
                        det
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const inv = matrixInverse(parsedM.matrix);
                          if (inv.ok) applyResultToSelectedEquation(inv.operation, inv.textResult, inv.latexResult);
                          else setResultError(inv.error || 'Matrix is singular');
                        }}
                        className="px-1.5 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-medium hover:border-[var(--rf-accent)]"
                      >
                        inv
                      </button>
                      <button
                        type="button"
                        onClick={() => onStampMatrix(parsedM.matrix, parsedM.name)}
                        className="px-1.5 py-0.5 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold"
                      >
                        Stamp
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Bare Expression in x Prompt -> Plot y = f(x) */}
              {analysis.isBareExpressionInX && analysis.valid && (
                <div
                  data-testid="math-bare-x-prompt"
                  className="px-2.5 py-1.5 rounded-xl border border-[var(--rf-accent)]/35 bg-[var(--rf-accent-soft)] flex items-center justify-between gap-2 text-[10px]"
                >
                  <span className="text-[var(--rf-text)] truncate">
                    Interpret as function <strong className="font-mono-tabular">y = {exprInput}</strong>?
                  </span>
                  <button
                    type="button"
                    data-testid="math-bare-x-plot-btn"
                    onClick={() => {
                      const xMin = Number(prePlotBounds.xMin);
                      const xMax = Number(prePlotBounds.xMax);
                      const yMin = Number(prePlotBounds.yMin);
                      const yMax = Number(prePlotBounds.yMax);
                      if (
                        !Number.isFinite(xMin) ||
                        !Number.isFinite(xMax) ||
                        !Number.isFinite(yMin) ||
                        !Number.isFinite(yMax) ||
                        xMax <= xMin ||
                        yMax <= yMin
                      ) {
                        onShowToast('Invalid X/Y bounds: ensure xMin < xMax and yMin < yMax');
                        return;
                      }
                      const cfg = createDefaultGraph2DConfig([
                        {
                          expression: `y = ${exprInput}`,
                          sourceElementId: selectedFirst?.type === 'math-equation' ? selectedFirst.id : undefined,
                        },
                      ]);
                      cfg.angleUnit = angleUnit;
                      cfg.bounds = { xMin, xMax, yMin, yMax };
                      onStampGraph2D(cfg);
                    }}
                    className="px-2 py-0.5 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold shrink-0"
                  >
                    Plot y = f(x)
                  </button>
                </div>
              )}

              {/* Validation / Domain / Singularity Info */}
              {!analysis.valid && analysis.error && (
                <div className="px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px]">
                  {analysis.error}
                </div>
              )}
              {(analysis.domainRestrictions.length > 0 || analysis.singularities.length > 0) && (
                <div className="px-2.5 py-1.5 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface)] text-[10px] font-mono-tabular text-[var(--rf-text-muted)] space-y-0.5">
                  {analysis.domainRestrictions.length > 0 && (
                    <div>Domain: {analysis.domainRestrictions.join('; ')}</div>
                  )}
                  {analysis.singularities.length > 0 && (
                    <div>Singularities: {analysis.singularities.join('; ')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Visual Equation Editor Palette */}
            {inputMode === 'visual' && (
              <div className="rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] p-2 space-y-2">
                <div className="flex items-center gap-1 overflow-x-auto rf-scrollbar pb-1">
                  {(
                    ['Structures', 'Calculus', 'Matrices', 'Greek', 'Trig & Log', 'Operators'] as MathTemplateItem['category'][]
                  ).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCat(cat)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap ${
                        templateCat === cat
                          ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                          : 'text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {MATH_VISUAL_TEMPLATES.filter((t) => t.category === templateCat).map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      title={tpl.label}
                      onClick={() => {
                        const el = exprInputRef.current;
                        const s = el?.selectionStart ?? exprInput.length;
                        const e = el?.selectionEnd ?? exprInput.length;
                        const applied = applyVisualTemplateAtSelection(exprInput, s, e, tpl.snippet);
                        pushExprChange(applied.nextValue, applied.nextCursor);
                        requestAnimationFrame(() => {
                          el?.focus();
                          el?.setSelectionRange(applied.nextCursor, applied.nextCursor);
                        });
                      }}
                      className="py-1.5 px-1 rounded-lg border border-[var(--rf-border)] hover:border-[var(--rf-accent)] hover:bg-[var(--rf-surface-hover)] text-[11px] font-mono-tabular text-[var(--rf-text)] text-center truncate"
                    >
                      {tpl.preview}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Context-Aware Identity Suggestions */}
            {identities.length > 0 && (
              <div className="rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] p-2.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--rf-accent)]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Identity Suggestions</span>
                </div>
                {identities.map((idSug) => (
                  <div
                    key={idSug.id}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-[11px] text-[var(--rf-text)]">
                        {idSug.title}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)] truncate">
                        {idSug.description} → {idSug.afterCanonical}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        pushExprChange(idSug.afterCanonical);
                        applyResultToSelectedEquation(
                          `Identity: ${idSug.title}`,
                          idSug.afterCanonical,
                          idSug.afterLatex
                        );
                      }}
                      className="px-2 py-1 rounded-md bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-[10px] font-semibold shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Algebra & Calculus Operations */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => runSymbolicOp('simplify')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Simplify
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('expand')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Expand
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('factor')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Factorize
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('solve')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Solve ({calcVar})
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('diff')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  d^{diffOrder}/d{calcVar}^{diffOrder}
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('implicit')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Implicit dy/dx
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('indef')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  ∫ Indefinite
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('def')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  ∫ Definite
                </button>
                <button
                  type="button"
                  onClick={() => runSymbolicOp('limit')}
                  className="py-1.5 px-2 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium text-[11px]"
                >
                  Limit
                </button>
              </div>

              {/* Compact Parameters Row (Var, Order, Bounds, Limit point) */}
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                <label className="block">
                  <span className="text-[var(--rf-text-muted)]">Var</span>
                  <input
                    type="text"
                    value={calcVar}
                    onChange={(e) => setCalcVar(e.target.value || 'x')}
                    className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--rf-text-muted)]">dⁿ order</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={diffOrder}
                    onChange={(e) => setDiffOrder(Math.max(1, Number(e.target.value)))}
                    className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--rf-text-muted)]">∫ From</span>
                  <input
                    type="text"
                    value={intFrom}
                    onChange={(e) => setIntFrom(e.target.value)}
                    className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--rf-text-muted)]">∫ To</span>
                  <input
                    type="text"
                    value={intTo}
                    onChange={(e) => setIntTo(e.target.value)}
                    className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--rf-text-muted)]">lim→</span>
                  <input
                    type="text"
                    value={limTarget}
                    onChange={(e) => setLimTarget(e.target.value)}
                    className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </label>
              </div>
              {analysis.kind === 'inequality' && (
                <button
                  type="button"
                  onClick={() => runSymbolicOp('ineq')}
                  className="w-full py-1.5 rounded-lg border border-[var(--rf-accent)]/40 bg-[var(--rf-accent-soft)] text-[var(--rf-accent)] font-semibold"
                >
                  Solve Inequality Intervals
                </button>
              )}
            </div>

            {/* Result & Step-by-Step Display */}
            {resultError && (
              <div className="p-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px]">
                {resultError}
              </div>
            )}
            {resultText && (
              <div
                data-testid="math-symbolic-result"
                className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-2"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--rf-accent)]">
                  <span>{resultTitle || 'Result'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(resultLatex || resultText);
                      onShowToast('Copied result');
                    }}
                    className="flex items-center gap-1 text-[var(--rf-text-muted)] hover:text-[var(--rf-text)]"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="text-sm text-[var(--rf-text)] overflow-x-auto rf-scrollbar">
                  {resultLatex ? <MathFormula latex={resultLatex} /> : <span className="font-mono-tabular">{resultText}</span>}
                </div>
                <div className="font-mono-tabular text-[11px] text-[var(--rf-text-muted)] break-all">
                  {resultText}
                </div>
                {resultSteps.length > 0 && (
                  <div className="pt-1.5 border-t border-[var(--rf-border)] space-y-1">
                    <button
                      type="button"
                      onClick={() => setShowSteps((s) => !s)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-[var(--rf-text-muted)]"
                    >
                      {showSteps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>Steps ({resultSteps.length})</span>
                    </button>
                    {showSteps &&
                      resultSteps.map((st, idx) => (
                        <div key={idx} className="text-[10px] pl-2 border-l border-[var(--rf-border)]">
                          <div className="font-semibold text-[var(--rf-text)]">{st.title}</div>
                          <div className="font-mono-tabular text-[var(--rf-text-muted)]">{st.detail}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Conic & Trig Automatic Diagnostics */}
            {conicInfo.isConic && (
              <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1 text-[11px]">
                <div className="font-semibold text-[var(--rf-accent)] uppercase text-[10px]">
                  Conic Section: {conicInfo.type}
                </div>
                <div className="font-mono-tabular text-[10px] text-[var(--rf-text)]">
                  {conicInfo.standardForm}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono-tabular text-[var(--rf-text-muted)]">
                  {conicInfo.center && <div>Centre: ({conicInfo.center.x}, {conicInfo.center.y})</div>}
                  {typeof conicInfo.radius === 'number' && <div>Radius: {conicInfo.radius}</div>}
                  {typeof conicInfo.eccentricity === 'number' && <div>Eccentricity e: {conicInfo.eccentricity}</div>}
                  {conicInfo.latusRectum && <div>Latus Rectum: {conicInfo.latusRectum}</div>}
                  {conicInfo.foci && (
                    <div className="col-span-2">
                      Foci: {conicInfo.foci.map((f) => `(${f.x}, ${f.y})`).join(', ')}
                    </div>
                  )}
                  {conicInfo.asymptotes && (
                    <div className="col-span-2">Asymptotes: {conicInfo.asymptotes.join(' | ')}</div>
                  )}
                </div>
              </div>
            )}

            {trigInfo && (
              <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1 text-[10px] font-mono-tabular">
                <div className="font-semibold text-[var(--rf-accent)] uppercase">
                  Trigonometric Properties ({trigInfo.functionName})
                </div>
                <div className="grid grid-cols-2 gap-1 text-[var(--rf-text-muted)]">
                  {trigInfo.amplitude !== undefined && <div>Amplitude: {trigInfo.amplitude}</div>}
                  {trigInfo.period !== undefined && <div>Period: {trigInfo.period.toFixed(4)}</div>}
                  <div>Phase shift: {trigInfo.phaseShift?.toFixed(3) ?? 0}</div>
                  <div>Vertical shift: {trigInfo.verticalShift ?? 0}</div>
                  {trigInfo.asymptotesDescription && (
                    <div className="col-span-2">Asymptotes: {trigInfo.asymptotesDescription}</div>
                  )}
                </div>
              </div>
            )}

            {/* Pre-plot X/Y Bounds & Canvas Stamp / Plot Triggers */}
            <div className="space-y-1.5 pt-1">
              <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-tabular">
                {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
                  <label key={k}>
                    <span className="text-[var(--rf-text-muted)]">{k}</span>
                    <input
                      type="number"
                      value={prePlotBounds[k]}
                      onChange={(e) =>
                        setPrePlotBounds((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                      className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)]"
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="math-stamp-equation"
                  onClick={() => {
                    const trailing = convertTrailingGreekKeyword(exprInput);
                    const exprToStamp = trailing.changed ? trailing.nextValue : exprInput;
                    if (trailing.changed) pushExprChange(exprToStamp, exprToStamp.length);
                    onStampEquation(
                      exprToStamp,
                      resultText ? { text: resultText, latex: resultLatex, operation: resultTitle } : undefined
                    );
                  }}
                  className="py-2 px-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold text-[11px] flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Equation</span>
                </button>
                <button
                  type="button"
                  data-testid="math-plot-2d"
                  onClick={() => {
                    const xMin = Number(prePlotBounds.xMin);
                    const xMax = Number(prePlotBounds.xMax);
                    const yMin = Number(prePlotBounds.yMin);
                    const yMax = Number(prePlotBounds.yMax);
                    if (
                      !Number.isFinite(xMin) ||
                      !Number.isFinite(xMax) ||
                      !Number.isFinite(yMin) ||
                      !Number.isFinite(yMax) ||
                      xMax <= xMin ||
                      yMax <= yMin
                    ) {
                      onShowToast('Invalid X/Y bounds: ensure xMin < xMax and yMin < yMax');
                      return;
                    }
                    const trailing = convertTrailingGreekKeyword(exprInput);
                    const exprToPlot = trailing.changed ? trailing.nextValue : exprInput;
                    if (trailing.changed) pushExprChange(exprToPlot, exprToPlot.length);
                    const cfg = createDefaultGraph2DConfig([
                      {
                        expression: exprToPlot,
                        sourceElementId: selectedFirst?.type === 'math-equation' ? selectedFirst.id : undefined,
                      },
                    ]);
                    cfg.angleUnit = angleUnit;
                    cfg.bounds = { xMin, xMax, yMin, yMax };
                    onStampGraph2D(cfg);
                  }}
                  className="py-2 px-2 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-semibold text-[11px] flex items-center justify-center gap-1"
                >
                  <Activity className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                  <span>Plot 2D</span>
                </button>
                <button
                  type="button"
                  data-testid="math-plot-3d"
                  onClick={() => {
                    const trailing = convertTrailingGreekKeyword(exprInput);
                    const exprToPlot = trailing.changed ? trailing.nextValue : exprInput;
                    if (trailing.changed) pushExprChange(exprToPlot, exprToPlot.length);
                    const useExpr = analysis.plottable3D
                      ? exprToPlot.replace(/^z\s*=\s*/i, '')
                      : undefined;
                    const cfg = createDefaultGraph3DConfig(
                      useExpr,
                      selectedFirst?.type === 'math-equation' ? selectedFirst.id : undefined
                    );
                    onStampGraph3D(cfg);
                  }}
                  className="py-2 px-2 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-semibold text-[11px] flex items-center justify-center gap-1"
                >
                  <Box className="w-3.5 h-3.5 text-[var(--rf-accent)]" />
                  <span>Plot 3D</span>
                </button>
              </div>
            </div>

            {/* Selected 2D Graph Multi-Equation & Limits Editor */}
            {selectedFirst?.type === 'math-graph-2d' && selectedFirst.graph2DConfig && (
              <div className="p-2.5 rounded-xl border border-[var(--rf-accent)]/40 bg-[var(--rf-surface-elevated)] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[11px] text-[var(--rf-text)]">
                    Selected 2D Graph Settings
                  </span>
                  <div className="flex items-center gap-1">
                    {(['rad', 'deg'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => {
                          setAngleUnit(u);
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: { ...selectedFirst.graph2DConfig!, angleUnit: u },
                          });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono-tabular ${
                          selectedFirst.graph2DConfig!.angleUnit === u
                            ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                            : 'border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equations List */}
                <div className="space-y-1.5">
                  {selectedFirst.graph2DConfig.equations.map((eq, idx) => (
                    <div key={eq.id} className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={eq.color}
                        onChange={(e) => {
                          const nextEqs = selectedFirst.graph2DConfig!.equations.map((item, i) =>
                            i === idx ? { ...item, color: e.target.value } : item
                          );
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: { ...selectedFirst.graph2DConfig!, equations: nextEqs },
                          });
                        }}
                        className="w-5 h-5 rounded border border-[var(--rf-border)] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={eq.expression}
                        onChange={(e) => {
                          const nextEqs = selectedFirst.graph2DConfig!.equations.map((item, i) =>
                            i === idx
                              ? { ...item, expression: e.target.value, label: e.target.value }
                              : item
                          );
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: { ...selectedFirst.graph2DConfig!, equations: nextEqs },
                          });
                        }}
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[11px]"
                      />
                      <select
                        value={eq.lineStyle}
                        onChange={(e) => {
                          const nextEqs = selectedFirst.graph2DConfig!.equations.map((item, i) =>
                            i === idx
                              ? { ...item, lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' }
                              : item
                          );
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: { ...selectedFirst.graph2DConfig!, equations: nextEqs },
                          });
                        }}
                        className="px-1 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] text-[10px]"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dash</option>
                        <option value="dotted">Dot</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const nextEqs = selectedFirst.graph2DConfig!.equations.filter((_, i) => i !== idx);
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: { ...selectedFirst.graph2DConfig!, equations: nextEqs },
                          });
                        }}
                        className="p-1 text-rose-400 hover:bg-rose-500/15 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const colors = ['#38bdf8', '#10b981', '#f59e0b', '#f472b6', '#a78bfa'];
                      const curEqs = selectedFirst.graph2DConfig!.equations;
                      const nextEqs = [
                        ...curEqs,
                        {
                          id: `geq_${Date.now()}`,
                          expression: exprInput || 'cos(x)',
                          label: exprInput || 'cos(x)',
                          color: colors[curEqs.length % colors.length],
                          thickness: 2.2,
                          lineStyle: 'solid' as const,
                          visible: true,
                        },
                      ];
                      onUpdateElement(selectedFirst.id, {
                        graph2DConfig: { ...selectedFirst.graph2DConfig!, equations: nextEqs },
                      });
                    }}
                    className="w-full py-1 rounded border border-dashed border-[var(--rf-border)] text-[10px] font-semibold text-[var(--rf-accent)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    + Add Current Expression to Graph
                  </button>
                </div>

                {/* Bounds Limits */}
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-tabular">
                  {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
                    <label key={k}>
                      <span className="text-[var(--rf-text-muted)]">{k}</span>
                      <input
                        type="number"
                        value={selectedFirst.graph2DConfig!.bounds[k]}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (!Number.isFinite(val)) return;
                          onUpdateElement(selectedFirst.id, {
                            graph2DConfig: {
                              ...selectedFirst.graph2DConfig!,
                              bounds: { ...selectedFirst.graph2DConfig!.bounds, [k]: val },
                            },
                          });
                        }}
                        className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'matrix' && (
          <>
            {/* Matrix A Editor */}
            <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-[var(--rf-text)]">
                  Matrix A ({matAInfo.rows}×{matAInfo.cols})
                </div>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setMatA((m) => [...m, Array(m[0].length).fill(0)])}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    +Row
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatA((m) => (m.length > 1 ? m.slice(0, -1) : m))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    -Row
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatA((m) => m.map((r) => [...r, 0]))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    +Col
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatA((m) => (m[0].length > 1 ? m.map((r) => r.slice(0, -1)) : m))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    -Col
                  </button>
                </div>
              </div>

              {/* Spreadsheet Grid */}
              <div className="overflow-x-auto rf-scrollbar">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${matA[0].length}, minmax(42px, 1fr))` }}
                >
                  {matA.map((row, r) =>
                    row.map((val, c) => (
                      <input
                        key={`a-${r}-${c}`}
                        type="number"
                        step="any"
                        value={val}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setMatA((prev) =>
                            prev.map((rw, ri) =>
                              ri === r ? rw.map((cell, ci) => (ci === c ? (Number.isFinite(v) ? v : 0) : cell)) : rw
                            )
                          );
                        }}
                        className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-center text-[11px]"
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)]">
                Type: {matAInfo.tags.join(' · ')}
              </div>

              {/* Paste CSV/TSV/Bracket Input */}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={matPasteText}
                  onChange={(e) => setMatPasteText(e.target.value)}
                  placeholder="Paste [[1,2],[3,4]] or CSV/TSV"
                  className="flex-1 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const p = parseMatrixInput(matPasteText);
                    if (p.ok && p.matrix) {
                      setMatA(p.matrix);
                      setMatOutError('');
                    } else {
                      setMatOutError(p.error || 'Invalid matrix paste');
                    }
                  }}
                  className="px-2 py-1 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-[10px] font-semibold"
                >
                  Load A
                </button>
              </div>
            </div>

            {/* Matrix B (Compact) */}
            <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold">Matrix B ({matB.length}×{matB[0].length})</span>
                <div className="flex items-center gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setMatB((m) => [...m, Array(m[0].length).fill(0)])}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    +R
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatB((m) => (m.length > 1 ? m.slice(0, -1) : m))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    -R
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatB((m) => m.map((r) => [...r, 0]))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    +C
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatB((m) => (m[0].length > 1 ? m.map((r) => r.slice(0, -1)) : m))}
                    className="px-1.5 py-0.5 rounded border border-[var(--rf-border)] hover:bg-[var(--rf-surface-hover)]"
                  >
                    -C
                  </button>
                </div>
              </div>
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${matB[0].length}, minmax(38px, 1fr))` }}
              >
                {matB.map((row, r) =>
                  row.map((val, c) => (
                    <input
                      key={`b-${r}-${c}`}
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMatB((prev) =>
                          prev.map((rw, ri) =>
                            ri === r ? rw.map((cell, ci) => (ci === c ? (Number.isFinite(v) ? v : 0) : cell)) : rw
                          )
                        );
                      }}
                      className="w-full px-1 py-0.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-center text-[10px]"
                    />
                  ))
                )}
              </div>
            </div>

            {/* Scalar k & Vector b inputs */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <label className="block">
                <span className="text-[var(--rf-text-muted)]">Scalar k</span>
                <input
                  type="text"
                  value={scalarK}
                  onChange={(e) => setScalarK(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                />
              </label>
              <label className="block">
                <span className="text-[var(--rf-text-muted)]">RHS Vector b (Ax=b)</span>
                <input
                  type="text"
                  value={vecBText}
                  onChange={(e) => setVecBText(e.target.value)}
                  className="w-full px-2 py-1 rounded bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] font-mono-tabular"
                />
              </label>
            </div>

            {/* 21 Matrix Operations */}
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(
                [
                  ['add', 'A + B'],
                  ['sub', 'A - B'],
                  ['mul', 'A × B'],
                  ['div', 'A · B⁻¹'],
                  ['scalar', 'k · A'],
                  ['trans', 'Aᵀ'],
                  ['inv', 'A⁻¹'],
                  ['det', 'det(A)'],
                  ['rank', 'rank'],
                  ['trace', 'trace'],
                  ['cof', 'Cofactor'],
                  ['adj', 'Adjoint'],
                  ['poly', 'Char Poly'],
                  ['eigen', 'Eigen'],
                  ['ref', 'Gauss REF'],
                  ['rref', 'RREF'],
                  ['lu', 'LU'],
                  ['qr', 'QR'],
                  ['svd', 'SVD'],
                  ['solve', 'Solve Ax=b'],
                ] as const
              ).map(([opId, label]) => (
                <button
                  key={opId}
                  type="button"
                  onClick={() => runMatrixOp(opId)}
                  className="py-1.5 px-1 rounded-lg border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] hover:border-[var(--rf-accent)] font-medium truncate"
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="math-stamp-matrix"
              onClick={() => onStampMatrix(matA, 'A')}
              className="w-full py-2 rounded-xl bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold text-[11px] flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Stamp Matrix A on Canvas</span>
            </button>

            {matOutError && (
              <div className="p-2 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[11px]">
                {matOutError}
              </div>
            )}
            {matOutText && (
              <div
                data-testid="math-matrix-result"
                className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1.5"
              >
                <pre className="font-mono-tabular text-[11px] text-[var(--rf-text)] whitespace-pre-wrap overflow-x-auto">
                  {matOutText}
                </pre>
                {matOutSteps.length > 0 && (
                  <div className="pt-1.5 border-t border-[var(--rf-border)] space-y-1 max-h-36 overflow-y-auto rf-scrollbar">
                    {matOutSteps.map((s, idx) => (
                      <div key={idx} className="text-[10px] font-mono-tabular text-[var(--rf-text-muted)]">
                        {idx + 1}. {s.title}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'engineering' && (
          <>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(
                [
                  ['ode', 'ODEs'],
                  ['transform', 'Transforms'],
                  ['vector', 'Vec/Calc'],
                  ['stats', 'Stats/Root'],
                ] as const
              ).map(([id, lbl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEngSubTab(id)}
                  className={`py-1.5 rounded-lg font-semibold ${
                    engSubTab === id
                      ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)]'
                      : 'border border-[var(--rf-border)] text-[var(--rf-text-muted)]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {engSubTab === 'ode' && (
              <div className="space-y-2 p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
                <div className="flex gap-1 text-[10px]">
                  {(
                    [
                      ['1st', "y' = f(x,y) IVP"],
                      ['2nd', "y'' = f(x,y,yp) IVP"],
                      ['bvp', 'BVP Shooting'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setOdeKind(k)}
                      className={`flex-1 py-1 rounded border ${
                        odeKind === k
                          ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] border-transparent'
                          : 'border-[var(--rf-border)]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={odeExpr}
                  onChange={(e) => setOdeExpr(e.target.value)}
                  placeholder="RHS e.g. -2*x*y or -y"
                  className="w-full px-2.5 py-1.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-xs"
                />
                <div className="grid grid-cols-4 gap-1 text-[10px] font-mono-tabular">
                  <label>
                    x₀
                    <input
                      type="number"
                      value={odeX0}
                      onChange={(e) => setOdeX0(e.target.value)}
                      className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                    />
                  </label>
                  <label>
                    y(x₀)
                    <input
                      type="number"
                      value={odeY0}
                      onChange={(e) => setOdeY0(e.target.value)}
                      className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                    />
                  </label>
                  <label>
                    x_end
                    <input
                      type="number"
                      value={odeXEnd}
                      onChange={(e) => setOdeXEnd(e.target.value)}
                      className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                    />
                  </label>
                  <label>
                    {odeKind === 'bvp' ? 'y(b)' : "y'(x₀)"}
                    <input
                      type="number"
                      value={odeKind === 'bvp' ? odeYb : odeYp0}
                      onChange={(e) =>
                        odeKind === 'bvp' ? setOdeYb(e.target.value) : setOdeYp0(e.target.value)
                      }
                      className="w-full px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const res =
                      odeKind === '1st'
                        ? solveODEFirstOrderRK4(odeExpr, Number(odeX0), Number(odeY0), Number(odeXEnd))
                        : odeKind === '2nd'
                        ? solveODESecondOrderRK4(
                            odeExpr,
                            Number(odeX0),
                            Number(odeY0),
                            Number(odeYp0),
                            Number(odeXEnd)
                          )
                        : solveODEBoundaryValueShooting(
                            odeExpr,
                            Number(odeX0),
                            Number(odeY0),
                            Number(odeXEnd),
                            Number(odeYb)
                          );
                    setEngOut(res.ok ? `${res.method}\n${res.summary}` : res.error || 'ODE Failed');
                  }}
                  className="w-full py-1.5 rounded-lg bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold"
                >
                  Solve ODE (RK4)
                </button>
              </div>
            )}

            {engSubTab === 'transform' && (
              <div className="space-y-2 p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
                <input
                  type="text"
                  value={transformExpr}
                  onChange={(e) => setTransformExpr(e.target.value)}
                  placeholder="f(t) or F(s) or f(x) or a^n"
                  className="w-full px-2.5 py-1.5 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-xs"
                />
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      const r = computeLaplaceTransform(transformExpr, false);
                      setEngOut(r.ok ? `${r.transform}: ${r.resultText}` : r.error || 'Failed');
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                  >
                    Laplace ℒ(f)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = computeLaplaceTransform(transformExpr, true);
                      setEngOut(r.ok ? `${r.transform}: ${r.resultText}` : r.error || 'Failed');
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                  >
                    Inv Laplace ℒ⁻¹
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = computeFourierSeries(transformExpr, Math.PI, 4);
                      setEngOut(r.ok ? r.resultText : r.error || 'Failed');
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                  >
                    Fourier Series
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = computeZTransform(transformExpr, false);
                      setEngOut(r.ok ? r.resultText : r.error || 'Failed');
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                  >
                    Z-Transform
                  </button>
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={dftSamples}
                    onChange={(e) => setDftSamples(e.target.value)}
                    placeholder="Discrete sequence: 1, 0, -1, 0"
                    className="flex-1 px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular text-[10px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nums = dftSamples.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
                      const r = computeDFT(nums);
                      setEngOut(r.ok ? r.resultText : r.error || 'DFT failed');
                    }}
                    className="px-2 py-1 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] text-[10px] font-semibold"
                  >
                    DFT
                  </button>
                </div>
              </div>
            )}

            {engSubTab === 'vector' && (
              <div className="space-y-2 p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[10px]">
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="text"
                    value={vecAText}
                    onChange={(e) => setVecAText(e.target.value)}
                    placeholder="Vector A: 1, 2, 3"
                    className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                  <input
                    type="text"
                    value={vecBEngText}
                    onChange={(e) => setVecBEngText(e.target.value)}
                    placeholder="Vector B: 4, -1, 2"
                    className="px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const a = vecAText.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
                    const b = vecBEngText.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
                    const v = vectorOperations(a, b);
                    const c = analyzeComplex(a[0] ?? 0, a[1] ?? 0);
                    setEngOut(
                      `a·b = ${formatNum(v.dot)} | |a| = ${formatNum(v.normA)} | ∠ = ${formatNum(v.angleDeg, 2)}°` +
                        (v.cross ? `\na×b = [${v.cross.map((n) => formatNum(n)).join(', ')}]` : '') +
                        `\nComplex (a0+a1·i): ${c.formattedRect} = ${c.formattedPolar}`
                    );
                  }}
                  className="w-full py-1.5 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold"
                >
                  Compute Vector & Complex
                </button>

                <div className="border-t border-[var(--rf-border)] pt-1.5 space-y-1">
                  <div className="text-[var(--rf-text-muted)]">Vector Field F = (Fx, Fy, Fz) at (1, 1, 1)</div>
                  <div className="grid grid-cols-3 gap-1">
                    <input value={fieldXExpr} onChange={(e) => setFieldXExpr(e.target.value)} className="px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular" />
                    <input value={fieldYExpr} onChange={(e) => setFieldYExpr(e.target.value)} className="px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular" />
                    <input value={fieldZExpr} onChange={(e) => setFieldZExpr(e.target.value)} className="px-1.5 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const vc = vectorCalculusAtPoint(
                          { fx: fieldXExpr, fy: fieldYExpr, fz: fieldZExpr, scalar: fieldXExpr },
                          { x: 1, y: 1, z: 1 }
                        );
                        setEngOut(
                          `div(F) at (1,1,1) = ${formatNum(vc.divergence ?? 0)}\ncurl(F) = [${vc.curl?.map((n) => formatNum(n)).join(', ')}]\ngrad(Fx) = [${vc.gradient?.map((n) => formatNum(n)).join(', ')}]`
                        );
                      }}
                      className="py-1 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                    >
                      Grad / Div / Curl
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const v = numericalDoubleIntegral(fieldXExpr, 0, 1, 0, 1);
                        setEngOut(`∬_[0,1]×[0,1] (${fieldXExpr}) dA ≈ ${formatNum(v, 6)}`);
                      }}
                      className="py-1 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                    >
                      ∬ Surface [0,1]²
                    </button>
                  </div>
                </div>
              </div>
            )}

            {engSubTab === 'stats' && (
              <div className="space-y-2 p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] text-[10px]">
                <label className="block">
                  X Data (CSV)
                  <input value={statsXText} onChange={(e) => setStatsXText(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular" />
                </label>
                <label className="block">
                  Y Data (CSV, optional regression)
                  <input value={statsYText} onChange={(e) => setStatsYText(e.target.value)} className="w-full px-2 py-1 rounded bg-[var(--rf-surface)] border border-[var(--rf-border)] font-mono-tabular" />
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const xs = statsXText.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
                      const ys = statsYText.split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
                      const st = computeStatistics(xs, ys.length === xs.length ? ys : undefined);
                      setEngOut(
                        `n=${st.count} | mean=${formatNum(st.mean)} | median=${formatNum(st.median)} | std=${formatNum(st.stdDevSample)}` +
                          (st.linearRegression
                            ? `\nFit: y = ${formatNum(st.linearRegression.slope)}x + ${formatNum(st.linearRegression.intercept)} (R²=${formatNum(st.linearRegression.rSquared)})`
                            : '')
                      );
                    }}
                    className="py-1.5 rounded bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold"
                  >
                    Stats & Fit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = findRootBisection(exprInput.replace(/=.*/, ''), -5, 5, calcVar);
                      setEngOut(
                        r.ok
                          ? `Bisection root: ${calcVar} = ${formatNum(r.root!, 6)} (${r.iterations} iters)`
                          : r.error || 'Bisection failed'
                      );
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)]"
                  >
                    Bisection Root
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const r = findRootNewtonRaphson(exprInput.replace(/=.*/, ''), 1, calcVar);
                      setEngOut(
                        r.ok
                          ? `Newton root: ${calcVar} = ${formatNum(r.root!, 6)} (${r.iterations} iters)`
                          : r.error || 'Newton failed'
                      );
                    }}
                    className="py-1.5 rounded border border-[var(--rf-border)]"
                  >
                    Newton Root
                  </button>
                </div>
              </div>
            )}

            {engOut && (
              <pre className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] font-mono-tabular text-[11px] text-[var(--rf-text)] whitespace-pre-wrap">
                {engOut}
              </pre>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filter calculation history..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--rf-surface-elevated)] border border-[var(--rf-border)] text-xs"
              />
              <button
                type="button"
                onClick={() => setHistoryList(clearMathHistory())}
                className="px-2 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 text-[10px] font-semibold"
              >
                Clear
              </button>
            </div>

            {/* Export Suite */}
            <div className="p-2.5 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1.5">
              <div className="font-semibold text-[11px] text-[var(--rf-text)]">
                Export Mathematics & Graphs
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    downloadLatexFile([
                      { label: 'Spark Expression', raw: exprInput, result: resultText },
                    ]);
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  LaTeX (.tex)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportMathReportToPdf({
                      expressions: [
                        { input: exprInput, operation: resultTitle, result: resultText },
                        ...historyList.slice(0, 12).map((h) => ({
                          input: h.inputRaw,
                          operation: h.operation,
                          result: h.resultText,
                        })),
                      ],
                      matrices: [{ label: 'A', data: matA }],
                    });
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  PDF Report
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadMathJsonDocument({
                      equations: [exprInput],
                      matrices: [matA, matB],
                      history: historyList,
                      graph2D: selectedFirst?.graph2DConfig,
                    });
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  Math JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const g = selectedFirst?.graph2DConfig || createDefaultGraph2DConfig([{ expression: exprInput }]);
                    downloadGraph2DSvg(g, theme.mode === 'dark');
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  Graph SVG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const g = selectedFirst?.graph2DConfig;
                    const csv = g ? exportGraph2DToCsv(g) : exportMatrixToCsv(matA);
                    downloadCsvFile(csv);
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  Data CSV
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(canonicalToLatex(exprInput));
                    onShowToast('Copied LaTeX to clipboard');
                  }}
                  className="py-1.5 px-1.5 rounded border border-[var(--rf-border)] hover:border-[var(--rf-accent)]"
                >
                  Copy LaTeX
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {historyList
                .filter(
                  (h) =>
                    !historySearch.trim() ||
                    h.inputRaw.toLowerCase().includes(historySearch.toLowerCase()) ||
                    h.operation.toLowerCase().includes(historySearch.toLowerCase())
                )
                .map((h) => (
                  <div
                    key={h.id}
                    className="p-2 rounded-xl border border-[var(--rf-border)] bg-[var(--rf-surface-elevated)] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] text-[var(--rf-text-muted)]">
                      <span className="font-semibold text-[var(--rf-accent)]">{h.operation}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setExprInput(h.inputRaw);
                            setResultTitle(h.operation);
                            setResultText(h.resultText);
                            setResultLatex(h.resultLatex || '');
                            onChangeTab('equation');
                          }}
                          className="text-[var(--rf-accent)] hover:underline"
                        >
                          Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryList(deleteMathHistoryEntry(h.id))}
                          className="text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="font-mono-tabular text-[11px] text-[var(--rf-text)] truncate">
                      {h.inputRaw}
                    </div>
                    <div className="font-mono-tabular text-[11px] text-[var(--rf-text-muted)] truncate">
                      = {h.resultText}
                    </div>
                  </div>
                ))}
              {historyList.length === 0 && (
                <div className="py-8 text-center text-xs text-[var(--rf-text-muted)]">
                  Calculations will be recorded here automatically.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
