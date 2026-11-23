export type MathInputMode = 'keyboard' | 'visual';
export type AngleUnit = 'rad' | 'deg';

export type EquationKind =
  | 'explicit-2d'
  | 'implicit-2d'
  | 'parametric-2d'
  | 'polar'
  | 'explicit-3d'
  | 'implicit-3d'
  | 'parametric-3d'
  | 'matrix'
  | 'ode'
  | 'inequality'
  | 'algebraic-equation'
  | 'expression';

export interface MathExprModel {
  /** Canonical mathjs/nerdamer-compatible ASCII expression */
  canonical: string;
  /** Display-friendly mathematical string (may contain Unicode math symbols) */
  display: string;
  /** LaTeX representation for KaTeX rendering */
  latex: string;
  /** Optional cursor selection state */
  cursor?: number;
}

export interface EquationAnalysis {
  raw: string;
  canonical: string;
  latex: string;
  kind: EquationKind;
  category?: string;
  isBareExpressionInX?: boolean;
  variables: string[];
  parameters: string[];
  plottable2D: boolean;
  plottable3D: boolean;
  isConicCandidate: boolean;
  valid: boolean;
  error?: string;
  domainRestrictions: string[];
  singularities: string[];
  missingParameters: string[];
}

export type MatrixClassTag =
  | '1D Array'
  | 'Row Matrix'
  | 'Column Matrix'
  | 'Square'
  | 'Rectangular'
  | 'Zero Matrix'
  | 'Identity Matrix'
  | 'Diagonal'
  | 'Symmetric'
  | 'Upper Triangular'
  | 'Lower Triangular';

export interface MatrixClassification {
  rows: number;
  cols: number;
  tags: MatrixClassTag[];
  isSquare: boolean;
  isInvertible?: boolean;
  determinant?: number;
}

export interface MathStep {
  title: string;
  detail: string;
  latex?: string;
  matrixSnapshot?: number[][];
}

export interface MatrixOperationResult {
  ok: boolean;
  operation: string;
  scalar?: number;
  vector?: number[];
  matrix?: number[][];
  matrices?: { label: string; data: number[][] }[];
  polynomial?: string;
  eigenvalues?: { real: number; imag: number }[];
  eigenvectors?: number[][];
  steps?: MathStep[];
  textResult: string;
  latexResult?: string;
  error?: string;
}

export interface IdentitySuggestion {
  id: string;
  category:
    | 'algebraic'
    | 'trigonometric'
    | 'logarithmic'
    | 'exponential'
    | 'hyperbolic'
    | 'complex'
    | 'calculus'
    | 'vector-matrix';
  title: string;
  description: string;
  beforeCanonical: string;
  afterCanonical: string;
  afterLatex: string;
  verified: boolean;
}

export interface ConicAnalysis {
  isConic: boolean;
  type:
    | 'circle'
    | 'ellipse'
    | 'parabola'
    | 'hyperbola'
    | 'rectangular-hyperbola'
    | 'degenerate'
    | 'none';
  coefficients: { A: number; B: number; C: number; D: number; E: number; F: number };
  center?: { x: number; y: number };
  radius?: number;
  foci?: { x: number; y: number }[];
  vertices?: { x: number; y: number }[];
  coVertices?: { x: number; y: number }[];
  directrices?: string[];
  asymptotes?: string[];
  eccentricity?: number;
  semiMajor?: number;
  semiMinor?: number;
  latusRectum?: number;
  rotationRad?: number;
  standardForm: string;
}

export interface TrigAnalysis {
  functionName: string;
  amplitude?: number;
  period?: number;
  frequency?: number;
  phaseShift?: number;
  verticalShift?: number;
  asymptotesDescription?: string;
  domainDescription: string;
}

export interface Graph2DEquation {
  id: string;
  sourceElementId?: string;
  expression: string;
  /** Optional parametric second expression when mode === 'parametric' */
  expressionY?: string;
  label?: string;
  color: string;
  thickness: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
  domainMin?: number;
  domainMax?: number;
  parameterMin?: number;
  parameterMax?: number;
  samples?: number;
}

export interface Graph2DBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Graph2DConfig {
  equations: Graph2DEquation[];
  bounds: Graph2DBounds;
  angleUnit: AngleUnit;
  equalAspect: boolean;
  showGrid: boolean;
  showMinorGrid: boolean;
  showAxes: boolean;
  showLegend: boolean;
  showIntersections: boolean;
  showConicFeatures: boolean;
  parameters: Record<string, number>;
}

export type Graph3DSurfaceKind = 'explicit' | 'parametric' | 'geometric';
export type Graph3DGeometricPreset =
  | 'plane'
  | 'sphere'
  | 'ellipsoid'
  | 'cylinder'
  | 'cone'
  | 'paraboloid'
  | 'hyperboloid'
  | 'saddle';

export interface Graph3DConfig {
  kind: Graph3DSurfaceKind;
  expression: string; // z = f(x, y) or preset expression
  parametricX?: string;
  parametricY?: string;
  parametricZ?: string;
  geometricPreset?: Graph3DGeometricPreset;
  constants: Record<string, number>; // a, b, c, d sliders
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  resolution: number;
  renderMode: 'surface' | 'wireframe' | 'surface-mesh';
  colormap: 'viridis' | 'coolwarm' | 'emerald';
  showAxes: boolean;
  showGrid: boolean;
  showContour2D: boolean;
  presetExpressions?: string[];
  sourceElementId?: string;
}

export interface CalculusResult {
  ok: boolean;
  operation: string;
  resultCanonical: string;
  resultLatex: string;
  numericValue?: number;
  steps?: MathStep[];
  error?: string;
}

export interface MathHistoryEntry {
  id: string;
  timestamp: number;
  inputRaw: string;
  canonical: string;
  latex: string;
  operation: string;
  resultText: string;
  resultLatex?: string;
  linkedElementId?: string;
}
