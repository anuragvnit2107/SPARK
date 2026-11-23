import { CanvasThemeId, ThemeId } from './types';

export interface ForgeTheme {
  id: ThemeId;
  canvasThemeId?: CanvasThemeId;
  name: string;
  mode: 'dark' | 'light';
  canvasBg: string;
  gridColor: string;
  surfaceBg: string;
  surfaceElevated: string;
  surfaceHover: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  accentFg: string;
  accentSoft: string;
  defaultInk: string;
  swatches: string[];
  fillSwatches: string[];
  glass?: boolean;
  backdropGradient?: string;
  panelHighlight?: string;
  panelShadow?: string;
}

export interface CanvasTheme {
  id: CanvasThemeId;
  name: string;
  category: 'Desktop & Glass' | 'Catppuccin' | 'Developer Palettes';
  mode: 'dark' | 'light';
  canvasBg: string;
  gridColor: string;
  defaultInk: string;
  swatches: string[];
  fillSwatches: string[];
  badgeColor: string;
}

export const FORGE_THEMES: Record<ThemeId, ForgeTheme> = {
  'emerald-minimal': {
    id: 'emerald-minimal',
    name: 'Emerald Minimal',
    mode: 'light',
    canvasBg: '#f6faf8',
    gridColor: 'rgba(16, 185, 129, 0.1)',
    surfaceBg: 'rgba(255, 255, 255, 0.94)',
    surfaceElevated: '#ffffff',
    surfaceHover: '#ecfdf5',
    borderColor: 'rgba(6, 95, 70, 0.14)',
    textColor: '#064e3b',
    mutedColor: '#4b6b61',
    accentColor: '#059669',
    accentFg: '#ffffff',
    accentSoft: 'rgba(5, 150, 105, 0.12)',
    defaultInk: '#064e3b',
    swatches: ['#064e3b', '#059669', '#0284c7', '#d97706', '#dc2626', '#475569'],
    fillSwatches: ['transparent', '#ecfdf5', '#d1fae5', '#e0f2fe', '#fef3c7', '#fee2e2'],
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    mode: 'light',
    canvasBg: '#fdf6e3',
    gridColor: 'rgba(101, 123, 131, 0.12)',
    surfaceBg: 'rgba(238, 232, 213, 0.94)',
    surfaceElevated: '#f5efdc',
    surfaceHover: '#e6dec5',
    borderColor: 'rgba(101, 123, 131, 0.22)',
    textColor: '#073642',
    mutedColor: '#586e75',
    accentColor: '#268bd2',
    accentFg: '#ffffff',
    accentSoft: 'rgba(38, 139, 210, 0.14)',
    defaultInk: '#073642',
    swatches: ['#073642', '#268bd2', '#2aa198', '#859900', '#cb4b16', '#d33682'],
    fillSwatches: ['transparent', '#eee8d5', '#d6e7f2', '#d7ece9', '#eae6c8', '#f4ded4'],
  },
  'black-slate': {
    id: 'black-slate',
    name: 'Black Slate',
    mode: 'dark',
    canvasBg: '#0B0F19',
    gridColor: 'rgba(148, 163, 184, 0.08)',
    surfaceBg: 'rgba(22, 27, 38, 0.94)',
    surfaceElevated: '#232A3B',
    surfaceHover: '#2B3448',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    textColor: '#F1F5F9',
    mutedColor: '#94A3B8',
    accentColor: '#38BDF8',
    accentFg: '#0B0F19',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
    defaultInk: '#E2E8F0',
    swatches: ['#E2E8F0', '#38BDF8', '#2DD4BF', '#818CF8', '#FBBF24', '#F87171'],
    fillSwatches: ['transparent', '#161B26', '#1E293B', '#0F293A', '#132E2B', '#2E1E2B'],
  },
  'liquid-glass-emerald': {
    id: 'liquid-glass-emerald',
    name: 'Liquid Glass Emerald',
    mode: 'dark',
    glass: true,
    canvasBg: '#05130F',
    gridColor: 'rgba(167, 243, 208, 0.1)',
    surfaceBg: 'rgba(9, 32, 25, 0.56)',
    surfaceElevated: 'rgba(14, 46, 36, 0.72)',
    surfaceHover: 'rgba(16, 185, 129, 0.18)',
    borderColor: 'rgba(167, 243, 208, 0.22)',
    panelHighlight: 'inset 0 1px 0 rgba(167, 243, 208, 0.26)',
    panelShadow: '0 16px 40px -12px rgba(2, 16, 11, 0.68)',
    textColor: '#ECFDF5',
    mutedColor: '#A7F3D0',
    accentColor: '#10B981',
    accentFg: '#032016',
    accentSoft: 'rgba(16, 185, 129, 0.22)',
    defaultInk: '#D1FAE5',
    swatches: ['#D1FAE5', '#10B981', '#2DD4BF', '#38BDF8', '#FBBF24', '#FB7185'],
    fillSwatches: ['transparent', '#0A2920', '#0E3A2D', '#0D3B3E', '#2D2E14', '#3A1925'],
  },
};

export const THEME_LIST: ForgeTheme[] = Object.values(FORGE_THEMES);

export const CANVAS_THEMES: Record<CanvasThemeId, CanvasTheme> = {
  'emerald-minimal': {
    id: 'emerald-minimal',
    name: 'Emerald Minimal',
    category: 'Desktop & Glass',
    mode: 'light',
    canvasBg: '#f6faf8',
    gridColor: 'rgba(16, 185, 129, 0.1)',
    defaultInk: '#064e3b',
    badgeColor: '#059669',
    swatches: ['#064e3b', '#059669', '#0284c7', '#d97706', '#dc2626', '#475569'],
    fillSwatches: ['transparent', '#ecfdf5', '#d1fae5', '#e0f2fe', '#fef3c7', '#fee2e2'],
  },
  orchis: {
    id: 'orchis',
    name: 'Orchis',
    category: 'Desktop & Glass',
    mode: 'light',
    canvasBg: '#F4F7F6',
    gridColor: 'rgba(0, 137, 123, 0.09)',
    defaultInk: '#1E293B',
    badgeColor: '#00897B',
    swatches: ['#1E293B', '#00897B', '#2196F3', '#FB8C00', '#E53935', '#7E57C2'],
    fillSwatches: ['transparent', '#E0F2F1', '#E3F2FD', '#FFF3E0', '#FFEBEE', '#EDE7F6'],
  },
  whitesur: {
    id: 'whitesur',
    name: 'WhiteSur / MacTahoe',
    category: 'Desktop & Glass',
    mode: 'light',
    canvasBg: '#F5F6FA',
    gridColor: 'rgba(15, 23, 42, 0.06)',
    defaultInk: '#1D1D1F',
    badgeColor: '#007AFF',
    swatches: ['#1D1D1F', '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE'],
    fillSwatches: ['transparent', '#E8F2FF', '#E9F9EE', '#FFF4E5', '#FFEBE9', '#F5EAFA'],
  },
  fluent: {
    id: 'fluent',
    name: 'Fluent',
    category: 'Desktop & Glass',
    mode: 'light',
    canvasBg: '#F3F3F3',
    gridColor: 'rgba(0, 103, 192, 0.08)',
    defaultInk: '#1A1A1A',
    badgeColor: '#0067C0',
    swatches: ['#1A1A1A', '#0067C0', '#107C10', '#D83B01', '#C50F1F', '#8764B8'],
    fillSwatches: ['transparent', '#E6F2FB', '#E8F5E9', '#FDECE6', '#FCE8E9', '#F1ECF9'],
  },
  sweet: {
    id: 'sweet',
    name: 'Sweet',
    category: 'Desktop & Glass',
    mode: 'dark',
    canvasBg: '#161925',
    gridColor: 'rgba(197, 14, 210, 0.11)',
    defaultInk: '#F0F4FF',
    badgeColor: '#C50ED2',
    swatches: ['#F0F4FF', '#00E5FF', '#C50ED2', '#10B981', '#FFB86C', '#FF3366'],
    fillSwatches: ['transparent', '#1E2436', '#162F3B', '#2E1636', '#143129', '#381625'],
  },
  'arc-dark': {
    id: 'arc-dark',
    name: 'Arc Dark',
    category: 'Desktop & Glass',
    mode: 'dark',
    canvasBg: '#2F343F',
    gridColor: 'rgba(211, 218, 227, 0.08)',
    defaultInk: '#D3DAE3',
    badgeColor: '#5294E2',
    swatches: ['#D3DAE3', '#5294E2', '#2ECC71', '#F39C12', '#F0544C', '#9B59B6'],
    fillSwatches: ['transparent', '#383C4A', '#26384C', '#243C31', '#423523', '#42282B'],
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    category: 'Desktop & Glass',
    mode: 'dark',
    canvasBg: '#1C1C1E',
    gridColor: 'rgba(255, 255, 255, 0.07)',
    defaultInk: '#E5E5EA',
    badgeColor: '#8E8E93',
    swatches: ['#E5E5EA', '#A1A1AA', '#34D399', '#60A5FA', '#FBBF24', '#F87171'],
    fillSwatches: ['transparent', '#2C2C2E', '#3A3A3C', '#1D332B', '#1F2C3D', '#3A2326'],
  },
  layan: {
    id: 'layan',
    name: 'Layan',
    category: 'Desktop & Glass',
    mode: 'dark',
    canvasBg: '#21212B',
    gridColor: 'rgba(136, 138, 255, 0.1)',
    defaultInk: '#ECEFF4',
    badgeColor: '#5657F5',
    swatches: ['#ECEFF4', '#5657F5', '#2DD4BF', '#38BDF8', '#FBBF24', '#FB7185'],
    fillSwatches: ['transparent', '#2B2B3A', '#24254A', '#1A3432', '#1C3042', '#3B202A'],
  },
  'catppuccin-mocha': {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'Catppuccin',
    mode: 'dark',
    canvasBg: '#1E1E2E',
    gridColor: 'rgba(180, 190, 254, 0.08)',
    defaultInk: '#CDD6F4',
    badgeColor: '#CBA6F7',
    swatches: ['#CDD6F4', '#CBA6F7', '#89B4FA', '#A6E3A1', '#FAB387', '#F38BA8'],
    fillSwatches: ['transparent', '#313244', '#2A2742', '#223144', '#23382D', '#3E2531'],
  },
  'catppuccin-macchiato': {
    id: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    category: 'Catppuccin',
    mode: 'dark',
    canvasBg: '#24273A',
    gridColor: 'rgba(183, 189, 248, 0.08)',
    defaultInk: '#CAD3F5',
    badgeColor: '#8AADF4',
    swatches: ['#CAD3F5', '#8AADF4', '#C6A0F6', '#A6DA95', '#F5A97F', '#ED8796'],
    fillSwatches: ['transparent', '#363A4F', '#29324A', '#352B4A', '#263A2D', '#422831'],
  },
  'catppuccin-frappe': {
    id: 'catppuccin-frappe',
    name: 'Catppuccin Frappé',
    category: 'Catppuccin',
    mode: 'dark',
    canvasBg: '#303446',
    gridColor: 'rgba(186, 187, 241, 0.09)',
    defaultInk: '#C6D0F5',
    badgeColor: '#CA9EE6',
    swatches: ['#C6D0F5', '#CA9EE6', '#8CAAEE', '#A6D189', '#EF9F76', '#E78284'],
    fillSwatches: ['transparent', '#414559', '#39324D', '#2D3A50', '#2E3E31', '#472E33'],
  },
  'catppuccin-latte': {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Catppuccin',
    mode: 'light',
    canvasBg: '#EFF1F5',
    gridColor: 'rgba(76, 79, 105, 0.08)',
    defaultInk: '#4C4F69',
    badgeColor: '#1E66F5',
    swatches: ['#4C4F69', '#1E66F5', '#40A02B', '#FE640B', '#D20F39', '#8839EF'],
    fillSwatches: ['transparent', '#E6E9EF', '#DDE7FB', '#E1F2DE', '#FDE9DC', '#F9DCE3'],
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#282A36',
    gridColor: 'rgba(98, 114, 164, 0.16)',
    defaultInk: '#F8F8F2',
    badgeColor: '#BD93F9',
    swatches: ['#F8F8F2', '#BD93F9', '#50FA7B', '#8BE9FD', '#FFB86C', '#FF5555'],
    fillSwatches: ['transparent', '#44475A', '#362F4D', '#1F3A2B', '#1F3942', '#44262A'],
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#2E3440',
    gridColor: 'rgba(136, 192, 208, 0.1)',
    defaultInk: '#ECEFF4',
    badgeColor: '#88C0D0',
    swatches: ['#ECEFF4', '#88C0D0', '#81A1C1', '#A3BE8C', '#EBCB8B', '#BF616A'],
    fillSwatches: ['transparent', '#3B4252', '#2C3F47', '#303F35', '#433D2E', '#422B30'],
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#1A1B26',
    gridColor: 'rgba(122, 162, 247, 0.1)',
    defaultInk: '#C0CAF5',
    badgeColor: '#7AA2F7',
    swatches: ['#C0CAF5', '#7AA2F7', '#9ECE6A', '#BB9AF7', '#E0AF68', '#F7768E'],
    fillSwatches: ['transparent', '#24283B', '#202E4A', '#233627', '#302642', '#3F222C'],
  },
  'gruvbox-dark': {
    id: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#282828',
    gridColor: 'rgba(235, 219, 178, 0.08)',
    defaultInk: '#EBDBB2',
    badgeColor: '#FE8019',
    swatches: ['#EBDBB2', '#FE8019', '#B8BB26', '#83A598', '#FABD2F', '#FB4934'],
    fillSwatches: ['transparent', '#3C3836', '#462E1B', '#333B1D', '#293836', '#46221E'],
  },
  'gruvbox-light': {
    id: 'gruvbox-light',
    name: 'Gruvbox Light',
    category: 'Developer Palettes',
    mode: 'light',
    canvasBg: '#FBF1C7',
    gridColor: 'rgba(60, 56, 54, 0.09)',
    defaultInk: '#3C3836',
    badgeColor: '#D65D0E',
    swatches: ['#3C3836', '#D65D0E', '#79740E', '#076678', '#B57614', '#9D0006'],
    fillSwatches: ['transparent', '#EBDBB2', '#F7DFC9', '#E6E9CA', '#D6E8EA', '#F4D5D6'],
  },
  everforest: {
    id: 'everforest',
    name: 'Everforest',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#2D353B',
    gridColor: 'rgba(167, 192, 128, 0.1)',
    defaultInk: '#D3C6AA',
    badgeColor: '#A7C080',
    swatches: ['#D3C6AA', '#A7C080', '#83C092', '#7FBBB3', '#DBBC7F', '#E67E80'],
    fillSwatches: ['transparent', '#3A454C', '#344232', '#2B4039', '#423C2B', '#442D30'],
  },
  'solarized-dark': {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#002B36',
    gridColor: 'rgba(147, 161, 161, 0.11)',
    defaultInk: '#EEE8D5',
    badgeColor: '#2AA198',
    swatches: ['#EEE8D5', '#2AA198', '#268BD2', '#859900', '#B58900', '#DC322F'],
    fillSwatches: ['transparent', '#073642', '#0B3E44', '#0B3852', '#263812', '#3F1D22'],
  },
  'solarized-light': {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'Developer Palettes',
    mode: 'light',
    canvasBg: '#FDF6E3',
    gridColor: 'rgba(101, 123, 131, 0.12)',
    defaultInk: '#073642',
    badgeColor: '#268BD2',
    swatches: ['#073642', '#268BD2', '#2AA198', '#859900', '#CB4B16', '#D33682'],
    fillSwatches: ['transparent', '#EEE8D5', '#D6E7F2', '#D7ECE9', '#EAE6C8', '#F4DED4'],
  },
  'one-dark': {
    id: 'one-dark',
    name: 'One Dark',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#282C34',
    gridColor: 'rgba(171, 178, 191, 0.08)',
    defaultInk: '#ABB2BF',
    badgeColor: '#61AFEF',
    swatches: ['#ABB2BF', '#61AFEF', '#98C379', '#C678DD', '#E5C07B', '#E06C75'],
    fillSwatches: ['transparent', '#323842', '#233647', '#293827', '#38273E', '#3E2528'],
  },
  'black-slate': {
    id: 'black-slate',
    name: 'Black Slate',
    category: 'Developer Palettes',
    mode: 'dark',
    canvasBg: '#0B0F19',
    gridColor: 'rgba(148, 163, 184, 0.08)',
    defaultInk: '#E2E8F0',
    badgeColor: '#38BDF8',
    swatches: ['#E2E8F0', '#38BDF8', '#2DD4BF', '#818CF8', '#FBBF24', '#F87171'],
    fillSwatches: ['transparent', '#161B26', '#1E293B', '#0F293A', '#132E2B', '#2E1E2B'],
  },
};

export const CANVAS_THEME_LIST: CanvasTheme[] = Object.values(CANVAS_THEMES);

/**
 * Combines a UI Chrome theme (e.g. Liquid Glass Emerald for top bar & sidebars)
 * with an independent Canvas Theme (e.g. Nord, Dracula, Orchis, Catppuccin, Emerald Minimal)
 * while preserving the canvas surface unchanged.
 */
export function resolveWorkspaceTheme(
  uiThemeId: ThemeId,
  canvasThemeId: CanvasThemeId
): ForgeTheme {
  const uiBase = FORGE_THEMES[uiThemeId] || FORGE_THEMES['liquid-glass-emerald'];
  const canvas = CANVAS_THEMES[canvasThemeId] || CANVAS_THEMES['emerald-minimal'];
  const isLightCanvas = canvas.mode === 'light';

  if (uiThemeId === 'liquid-glass-emerald') {
    return {
      ...uiBase,
      canvasThemeId: canvas.id,
      name: `${uiBase.name} · ${canvas.name}`,
      mode: canvas.mode,
      canvasBg: canvas.canvasBg,
      gridColor: canvas.gridColor,
      backdropGradient: undefined, // Keep canvas surface completely unchanged
      defaultInk: canvas.defaultInk,
      swatches: canvas.swatches,
      fillSwatches: canvas.fillSwatches,
      glass: true,
      surfaceBg: isLightCanvas ? 'rgba(232, 252, 243, 0.72)' : 'rgba(6, 32, 24, 0.64)',
      surfaceElevated: isLightCanvas ? 'rgba(244, 253, 249, 0.88)' : 'rgba(11, 44, 34, 0.82)',
      surfaceHover: isLightCanvas ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.2)',
      borderColor: isLightCanvas ? 'rgba(5, 150, 105, 0.24)' : 'rgba(110, 231, 183, 0.24)',
      textColor: isLightCanvas ? '#064e3b' : '#ECFDF5',
      mutedColor: isLightCanvas ? '#276749' : '#A7F3D0',
      accentColor: isLightCanvas ? '#059669' : '#10B981',
      accentFg: isLightCanvas ? '#ffffff' : '#032016',
      accentSoft: isLightCanvas ? 'rgba(5, 150, 105, 0.14)' : 'rgba(16, 185, 129, 0.22)',
      panelHighlight: isLightCanvas
        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.78)'
        : 'inset 0 1px 0 rgba(167, 243, 208, 0.24)',
      panelShadow: isLightCanvas
        ? '0 14px 36px -12px rgba(6, 78, 59, 0.18)'
        : '0 16px 40px -12px rgba(2, 16, 11, 0.64)',
    };
  }

  return {
    ...uiBase,
    canvasThemeId: canvas.id,
    name: `${uiBase.name} · ${canvas.name}`,
    mode: canvas.mode,
    canvasBg: canvas.canvasBg,
    gridColor: canvas.gridColor,
    backdropGradient: undefined,
    defaultInk: canvas.defaultInk,
    swatches: canvas.swatches,
    fillSwatches: canvas.fillSwatches,
  };
}

export function applyThemeToDocument(theme: ForgeTheme): void {
  const root = document.documentElement;
  if (theme.mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.setProperty('--rf-canvas-bg', theme.canvasBg);
  root.style.setProperty('--rf-canvas-gradient', theme.backdropGradient || 'none');
  root.style.setProperty('--rf-grid', theme.gridColor);
  root.style.setProperty('--rf-surface', theme.surfaceBg);
  root.style.setProperty('--rf-surface-elevated', theme.surfaceElevated);
  root.style.setProperty('--rf-surface-hover', theme.surfaceHover);
  root.style.setProperty('--rf-border', theme.borderColor);
  root.style.setProperty('--rf-text', theme.textColor);
  root.style.setProperty('--rf-text-muted', theme.mutedColor);
  root.style.setProperty('--rf-accent', theme.accentColor);
  root.style.setProperty('--rf-accent-fg', theme.accentFg);
  root.style.setProperty('--rf-accent-soft', theme.accentSoft);
  root.style.setProperty('--rf-ink-default', theme.defaultInk);
  root.style.setProperty(
    '--rf-blur',
    theme.glass ? 'blur(22px) saturate(185%)' : 'blur(14px)'
  );
  root.style.setProperty(
    '--rf-panel-highlight',
    theme.panelHighlight || 'inset 0 1px 0 rgba(255, 255, 255, 0.04)'
  );
  root.style.setProperty(
    '--rf-panel-shadow',
    theme.panelShadow || '0 10px 30px -10px rgba(0, 0, 0, 0.16)'
  );
}

export interface GlassBackgroundSwatch {
  id: string;
  label: string;
  value: string;
  previewHex: string;
}

export interface GlassBackgroundCollection {
  id: 'dark' | 'grey' | 'premium';
  label: string;
  swatches: GlassBackgroundSwatch[];
}

/**
 * Translucent glass-morphism background presets organized into Dark, Grey, and Premium collections.
 * Preserves canvas grid visibility and depth beneath filled shapes.
 */
export const GLASS_BACKGROUND_COLLECTIONS: GlassBackgroundCollection[] = [
  {
    id: 'dark',
    label: 'Dark Glass',
    swatches: [
      { id: 'deep-charcoal', label: 'Deep Charcoal', value: 'rgba(17, 24, 39, 0.30)', previewHex: '#111827' },
      { id: 'graphite-black', label: 'Graphite Black', value: 'rgba(24, 24, 27, 0.32)', previewHex: '#18181b' },
      { id: 'midnight-blue', label: 'Midnight Blue', value: 'rgba(15, 23, 42, 0.30)', previewHex: '#0f172a' },
      { id: 'dark-slate', label: 'Dark Slate', value: 'rgba(30, 41, 59, 0.28)', previewHex: '#1e293b' },
      { id: 'deep-navy', label: 'Deep Navy', value: 'rgba(23, 37, 84, 0.28)', previewHex: '#172554' },
    ],
  },
  {
    id: 'grey',
    label: 'Grey Glass',
    swatches: [
      { id: 'ash-grey', label: 'Ash Grey', value: 'rgba(100, 116, 139, 0.26)', previewHex: '#64748b' },
      { id: 'cool-grey', label: 'Cool Grey', value: 'rgba(107, 114, 128, 0.26)', previewHex: '#6b7280' },
      { id: 'smoke-grey', label: 'Smoke Grey', value: 'rgba(71, 85, 105, 0.28)', previewHex: '#475569' },
      { id: 'silver-grey', label: 'Silver Grey', value: 'rgba(148, 163, 184, 0.25)', previewHex: '#94a3b8' },
      { id: 'warm-grey', label: 'Warm Grey', value: 'rgba(120, 113, 108, 0.26)', previewHex: '#78716c' },
    ],
  },
  {
    id: 'premium',
    label: 'Premium Glass',
    swatches: [
      { id: 'muted-emerald', label: 'Muted Emerald', value: 'rgba(16, 185, 129, 0.24)', previewHex: '#10b981' },
      { id: 'dark-teal', label: 'Dark Teal', value: 'rgba(13, 148, 136, 0.25)', previewHex: '#0d9488' },
      { id: 'dusty-blue', label: 'Dusty Blue', value: 'rgba(59, 130, 246, 0.24)', previewHex: '#3b82f6' },
      { id: 'soft-lavender', label: 'Soft Lavender', value: 'rgba(139, 92, 246, 0.24)', previewHex: '#8b5cf6' },
      { id: 'warm-sand', label: 'Warm Sand', value: 'rgba(217, 119, 6, 0.22)', previewHex: '#d97706' },
    ],
  },
];

export function hexToGlassRgba(hex: string, alpha = 0.28): string {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
