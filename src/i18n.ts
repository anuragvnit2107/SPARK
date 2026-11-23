import { Locale } from './types';

export interface Translations {
  appName: string;
  tools: {
    select: string;
    hand: string;
    rectangle: string;
    diamond: string;
    ellipse: string;
    triangle: string;
    arrow: string;
    line: string;
    wire: string;
    freedraw: string;
    laser: string;
    text: string;
    image: string;
    frame: string;
    webpage: string;
    math: string;
    eraser: string;
  };
  actions: {
    menu: string;
    undo: string;
    redo: string;
    circuits: string;
    mathEngine: string;
    collaborate: string;
    export: string;
    present: string;
    themes: string;
    fonts: string;
    rustCore: string;
    commands: string;
    zenMode: string;
    exitZen: string;
    gridToggle: string;
    shapeSnapToggle: string;
    clearCanvas: string;
    loadDemo: string;
    importFile: string;
    language: string;
  };
  inspector: {
    stroke: string;
    fill: string;
    fillStyle: string;
    strokeWidth: string;
    strokeStyle: string;
    sloppiness: string;
    font: string;
    opacity: string;
    triangleType: string;
    label: string;
    value: string;
    icPins: string;
    layer: string;
    bringForward: string;
    sendBackward: string;
    duplicate: string;
    delete: string;
  };
}

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ja', label: '日本語' },
];

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    appName: 'Spark',
    tools: {
      select: 'Select',
      hand: 'Pan',
      rectangle: 'Rectangle',
      diamond: 'Diamond',
      ellipse: 'Ellipse',
      triangle: 'Triangle',
      arrow: 'Arrow',
      line: 'Line',
      wire: 'Wire',
      freedraw: 'Pencil',
      laser: 'Laser',
      text: 'Text',
      image: 'Image',
      frame: 'Frame',
      webpage: 'Webpage',
      math: 'Math',
      eraser: 'Eraser',
    },
    actions: {
      menu: 'Menu',
      undo: 'Undo',
      redo: 'Redo',
      circuits: 'Circuits',
      mathEngine: 'Math',
      collaborate: 'Collaborate',
      export: 'Export',
      present: 'Present',
      themes: 'Themes',
      fonts: 'Typography',
      rustCore: 'Rust Core',
      commands: 'Command Palette',
      zenMode: 'Zen Mode',
      exitZen: 'Exit Zen',
      gridToggle: 'Show Grid',
      shapeSnapToggle: 'Shape Recognition',
      clearCanvas: 'Clear Canvas',
      loadDemo: 'Load Demo Circuit',
      importFile: 'Open .excalidraw / .json',
      language: 'Language',
    },
    inspector: {
      stroke: 'Stroke',
      fill: 'Background',
      fillStyle: 'Fill Style',
      strokeWidth: 'Stroke Width',
      strokeStyle: 'Stroke Style',
      sloppiness: 'Sloppiness',
      font: 'Typography',
      opacity: 'Opacity',
      triangleType: 'Triangle',
      label: 'Label',
      value: 'Value',
      icPins: 'IC Pins',
      layer: 'Layer',
      bringForward: 'Forward',
      sendBackward: 'Backward',
      duplicate: 'Duplicate',
      delete: 'Delete',
    },
  },
  es: {
    appName: 'Spark',
    tools: {
      select: 'Seleccionar',
      hand: 'Mover',
      rectangle: 'Rectángulo',
      diamond: 'Rombo',
      ellipse: 'Elipse',
      triangle: 'Triángulo',
      arrow: 'Flecha',
      line: 'Línea',
      wire: 'Cable',
      freedraw: 'Lápiz',
      laser: 'Láser',
      text: 'Texto',
      image: 'Imagen',
      frame: 'Marco',
      webpage: 'Página Web',
      math: 'Matemáticas',
      eraser: 'Borrador',
    },
    actions: {
      menu: 'Menú',
      undo: 'Deshacer',
      redo: 'Rehacer',
      circuits: 'Circuitos',
      mathEngine: 'Mates',
      collaborate: 'Colaborar',
      export: 'Exportar',
      present: 'Presentar',
      themes: 'Temas',
      fonts: 'Tipografía',
      rustCore: 'Núcleo Rust',
      commands: 'Paleta de Comandos',
      zenMode: 'Modo Zen',
      exitZen: 'Salir de Zen',
      gridToggle: 'Mostrar Cuadrícula',
      shapeSnapToggle: 'Reconocer Formas',
      clearCanvas: 'Limpiar Lienzo',
      loadDemo: 'Cargar Circuito Demo',
      importFile: 'Abrir .excalidraw / .json',
      language: 'Idioma',
    },
    inspector: {
      stroke: 'Trazo',
      fill: 'Fondo',
      fillStyle: 'Relleno',
      strokeWidth: 'Grosor',
      strokeStyle: 'Estilo',
      sloppiness: 'Boceto',
      font: 'Fuente',
      opacity: 'Opacidad',
      triangleType: 'Triángulo',
      label: 'Etiqueta',
      value: 'Valor',
      icPins: 'Pines IC',
      layer: 'Capa',
      bringForward: 'Adelante',
      sendBackward: 'Atrás',
      duplicate: 'Duplicar',
      delete: 'Eliminar',
    },
  },
  fr: {
    appName: 'Spark',
    tools: {
      select: 'Sélection',
      hand: 'Main',
      rectangle: 'Rectangle',
      diamond: 'Losange',
      ellipse: 'Ellipse',
      triangle: 'Triangle',
      arrow: 'Flèche',
      line: 'Ligne',
      wire: 'Fil',
      freedraw: 'Crayon',
      laser: 'Laser',
      text: 'Texte',
      image: 'Image',
      frame: 'Cadre',
      webpage: 'Page Web',
      math: 'Maths',
      eraser: 'Gomme',
    },
    actions: {
      menu: 'Menu',
      undo: 'Annuler',
      redo: 'Rétablir',
      circuits: 'Circuits',
      mathEngine: 'Maths',
      collaborate: 'Collaborer',
      export: 'Exporter',
      present: 'Présenter',
      themes: 'Thèmes',
      fonts: 'Typographie',
      rustCore: 'Cœur Rust',
      commands: 'Palette de Commandes',
      zenMode: 'Mode Zen',
      exitZen: 'Quitter Zen',
      gridToggle: 'Afficher la Grille',
      shapeSnapToggle: 'Reconnaissance',
      clearCanvas: 'Effacer',
      loadDemo: 'Charger Circuit Démo',
      importFile: 'Ouvrir .excalidraw / .json',
      language: 'Langue',
    },
    inspector: {
      stroke: 'Trait',
      fill: 'Fond',
      fillStyle: 'Remplissage',
      strokeWidth: 'Épaisseur',
      strokeStyle: 'Style',
      sloppiness: 'Esquisse',
      font: 'Police',
      opacity: 'Opacité',
      triangleType: 'Triangle',
      label: 'Étiquette',
      value: 'Valeur',
      icPins: 'Broches IC',
      layer: 'Calque',
      bringForward: 'Avancer',
      sendBackward: 'Reculer',
      duplicate: 'Dupliquer',
      delete: 'Supprimer',
    },
  },
  de: {
    appName: 'Spark',
    tools: {
      select: 'Auswahl',
      hand: 'Verschieben',
      rectangle: 'Rechteck',
      diamond: 'Raute',
      ellipse: 'Ellipse',
      triangle: 'Dreieck',
      arrow: 'Pfeil',
      line: 'Linie',
      wire: 'Leitung',
      freedraw: 'Stift',
      laser: 'Laser',
      text: 'Text',
      image: 'Bild',
      frame: 'Rahmen',
      webpage: 'Webseite',
      math: 'Mathe',
      eraser: 'Radierer',
    },
    actions: {
      menu: 'Menü',
      undo: 'Rückgängig',
      redo: 'Wiederholen',
      circuits: 'Schaltkreise',
      mathEngine: 'Mathe',
      collaborate: 'Zusammenarbeit',
      export: 'Exportieren',
      present: 'Präsentieren',
      themes: 'Themen',
      fonts: 'Typografie',
      rustCore: 'Rust-Kern',
      commands: 'Befehlspalette',
      zenMode: 'Zen-Modus',
      exitZen: 'Zen beenden',
      gridToggle: 'Raster anzeigen',
      shapeSnapToggle: 'Formerkennung',
      clearCanvas: 'Leinwand leeren',
      loadDemo: 'Demo-Schaltung laden',
      importFile: '.excalidraw / .json öffnen',
      language: 'Sprache',
    },
    inspector: {
      stroke: 'Kontur',
      fill: 'Füllung',
      fillStyle: 'Füllstil',
      strokeWidth: 'Strichstärke',
      strokeStyle: 'Strichstil',
      sloppiness: 'Skizzenstil',
      font: 'Schriftart',
      opacity: 'Deckkraft',
      triangleType: 'Dreieck',
      label: 'Beschriftung',
      value: 'Wert',
      icPins: 'IC-Pins',
      layer: 'Ebene',
      bringForward: 'Vorne',
      sendBackward: 'Hinten',
      duplicate: 'Duplizieren',
      delete: 'Löschen',
    },
  },
  ja: {
    appName: 'Spark',
    tools: {
      select: '選択',
      hand: 'パン',
      rectangle: '長方形',
      diamond: 'ひし形',
      ellipse: '楕円',
      triangle: '三角形',
      arrow: '矢印',
      line: '線',
      wire: '配線',
      freedraw: '鉛筆',
      laser: 'レーザー',
      text: 'テキスト',
      image: '画像',
      frame: 'フレーム',
      webpage: 'Webページ',
      math: '数式',
      eraser: '消しゴム',
    },
    actions: {
      menu: 'メニュー',
      undo: '元に戻す',
      redo: 'やり直す',
      circuits: '回路部品',
      mathEngine: '数学',
      collaborate: '共同編集',
      export: 'エクスポート',
      present: 'プレゼン',
      themes: 'テーマ',
      fonts: 'タイポグラフィ',
      rustCore: 'Rustコア',
      commands: 'コマンド',
      zenMode: 'Zenモード',
      exitZen: 'Zen終了',
      gridToggle: 'グリッド表示',
      shapeSnapToggle: '図形認識',
      clearCanvas: 'クリア',
      loadDemo: 'デモ回路読込',
      importFile: '.excalidraw / .json 開く',
      language: '言語',
    },
    inspector: {
      stroke: '線色',
      fill: '背景色',
      fillStyle: '塗りつぶし',
      strokeWidth: '線の太さ',
      strokeStyle: '線の種類',
      sloppiness: '手書き感',
      font: 'フォント',
      opacity: '透明度',
      triangleType: '三角形',
      label: 'ラベル',
      value: '値',
      icPins: 'ICピン数',
      layer: '順序',
      bringForward: '前面へ',
      sendBackward: '背面へ',
      duplicate: '複製',
      delete: '削除',
    },
  },
};
