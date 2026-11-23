export type ToolType =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'wire'
  | 'freedraw'
  | 'laser'
  | 'text'
  | 'image'
  | 'frame'
  | 'webpage'
  | 'math'
  | 'eraser';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'none' | 'solid' | 'hachure' | 'cross-hatch';
export type FontFamily = 'scribble' | 'casual' | 'heavy' | 'cleansans';
export type Sloppiness = 0 | 1 | 2; // 0: Architect, 1: Artist, 2: Cartoonist
export type TriangleVariant = 'equilateral' | 'right-left' | 'right-right' | 'isosceles';
export type WaveformType = 'sine' | 'triangle' | 'square';

export type CircuitKind =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'dc-source'
  | 'ac-source'
  | 'function-generator'
  | 'switch'
  | 'ground'
  | 'diode'
  | 'opamp'
  | 'voltmeter'
  | 'ammeter'
  | 'oscilloscope'
  | 'gate-and'
  | 'gate-or'
  | 'gate-not'
  | 'gate-nand'
  | 'gate-xor'
  | 'ic-chip';

export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'triangle'
  | 'parallelogram'
  | 'arrow'
  | 'line'
  | 'wire'
  | 'freedraw'
  | 'text'
  | 'image'
  | 'frame'
  | 'webpage'
  | 'circuit'
  | 'math-equation'
  | 'math-matrix'
  | 'math-graph-2d'
  | 'math-graph-3d';

export interface Point {
  x: number;
  y: number;
}

export interface BindingRef {
  elementId: string;
  terminalId?: string;
  anchor: Point; // normalized 0..1 relative to element bounds or terminal offset
}

export interface TerminalPin {
  id: string;
  label: string;
  /** Normalized coordinates (0..1) inside element bounding box */
  nx: number;
  ny: number;
}

export interface WhiteboardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // radians
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  sloppiness: Sloppiness;
  opacity: number; // 0..100
  seed: number;
  fontFamily: FontFamily;
  fontSize: number;
  text?: string;
  points?: Point[]; // relative to (x, y) for line, arrow, freedraw, or custom polygon/parallelogram/triangle
  skewRatio?: number; // -0.5..0.5 horizontal skew for parallelograms
  startArrowhead?: boolean;
  endArrowhead?: boolean;
  wireRouting?: 'straight' | 'curved' | 'orthogonal';
  startBinding?: BindingRef | null;
  endBinding?: BindingRef | null;
  triangleVariant?: TriangleVariant;
  // Circuit & Simulation fields
  circuitKind?: CircuitKind;
  componentValue?: string;
  frequencyHz?: number;
  waveformType?: WaveformType;
  switchClosed?: boolean;
  logicInputA?: string;
  logicInputB?: string;
  icPinCount?: number;
  icPinLabels?: string[];
  // Frame fields
  frameIndex?: number;
  frameTitle?: string;
  // Webpage block fields
  webpageTitle?: string;
  htmlCode?: string;
  cssCode?: string;
  jsCode?: string;
  webpageAutoPolish?: boolean;
  // Math Engine fields
  mathRaw?: string;
  mathLatex?: string;
  mathResult?: string;
  mathResultLatex?: string;
  mathOperation?: string;
  matrixData?: number[][];
  matrixName?: string;
  graph2DConfig?: import('./math/types').Graph2DConfig;
  graph3DConfig?: import('./math/types').Graph3DConfig;
  // Image fields
  imageDataUrl?: string;
  // Sync metadata
  version: number;
  updatedAt: number;
  isDeleted?: boolean;
}

export interface CameraState {
  x: number; // world offset x in screen px
  y: number; // world offset y in screen px
  zoom: number; // 0.1 .. 4.0
}

export type ThemeId = 'emerald-minimal' | 'solarized-light' | 'black-slate' | 'liquid-glass-emerald';

export type CanvasThemeId =
  | 'emerald-minimal'
  | 'orchis'
  | 'whitesur'
  | 'fluent'
  | 'sweet'
  | 'arc-dark'
  | 'graphite'
  | 'layan'
  | 'catppuccin-mocha'
  | 'catppuccin-macchiato'
  | 'catppuccin-frappe'
  | 'catppuccin-latte'
  | 'dracula'
  | 'nord'
  | 'tokyo-night'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'everforest'
  | 'solarized-dark'
  | 'solarized-light'
  | 'one-dark'
  | 'black-slate';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja';

export interface EncryptedEnvelope {
  iv: string; // base64url
  ciphertext: string; // base64url
}

export interface RemoteCursorPayload {
  peerId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  tool: ToolType;
  updatedAt: number;
}

export interface CollabStatus {
  connected: boolean;
  roomId: string | null;
  keyString: string | null;
  peerId: string;
  peerName: string;
  peerColor: string;
  peers: Record<string, RemoteCursorPayload>;
}

export interface ExcalidrawDocument {
  type: 'excalidraw';
  version: number;
  source: string;
  elements: Record<string, unknown>[];
  appState: {
    viewBackgroundColor: string;
    gridSize: number | null;
    rustlyTheme?: ThemeId;
    rustlyCanvasTheme?: CanvasThemeId;
  };
  files: Record<string, { mimeType: string; id: string; dataURL: string }>;
}
