import React, { useState } from 'react';
import { Check, Code2, Copy, X } from 'lucide-react';

interface RustCodeViewerModalProps {
  open: boolean;
  onClose: () => void;
}

const RUST_MODULES: { id: string; path: string; summary: string; code: string }[] = [
  {
    id: 'cargo',
    path: 'Cargo.toml',
    summary: 'Rust crate configuration targeting cdylib + rlib with wasm-bindgen, web-sys, serde, and gloo-storage.',
    code: `[package]
name = "rustly-forge-core"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
web-sys = { version = "0.3", features = [
  "CanvasRenderingContext2d",
  "HtmlCanvasElement",
  "Window",
  "Document"
] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
gloo-storage = "0.3"
leptos = { version = "0.6", features = ["csr"] }
console_error_panic_hook = "0.1"`,
  },
  {
    id: 'element',
    path: 'src/model/element.rs',
    summary: 'Type-safe Rust scene graph structs, stroke/fill enums, and spatial bounding-box calculations.',
    code: `use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum StrokeStyle {
    Solid,
    Dashed,
    Dotted,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum FillStyle {
    None,
    Solid,
    Hachure,
    CrossHatch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhiteboardElement {
    pub id: String,
    pub kind: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub stroke_color: String,
    pub stroke_width: f64,
    pub stroke_style: StrokeStyle,
    pub fill_style: FillStyle,
    pub sloppiness: u8,
    pub seed: u64,
}

impl WhiteboardElement {
    pub fn contains_point(&self, px: f64, py: f64, tolerance: f64) -> bool {
        px >= self.x - tolerance
            && px <= self.x + self.width + tolerance
            && py >= self.y - tolerance
            && py <= self.y + self.height + tolerance
    }
}`,
  },
  {
    id: 'sketch',
    path: 'src/canvas/sketch.rs',
    summary: 'Deterministic PRNG and procedural quadratic-curve jitter generator for hand-drawn strokes.',
    code: `pub struct Mulberry32(u32);

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self(seed)
    }

    pub fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6D2B79F5);
        let mut t = (self.0 ^ (self.0 >> 15)).wrapping_mul(1 | self.0);
        t = (t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t))) ^ t;
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

pub fn sketchy_segment(
    x1: f64, y1: f64, x2: f64, y2: f64, sloppiness: u8, seed: u32
) -> ((f64, f64), (f64, f64), (f64, f64)) {
    let mut rng = Mulberry32::new(seed);
    let len = ((x2 - x1).powi(2) + (y2 - y1).powi(2)).sqrt();
    let roughness = match sloppiness { 0 => 0.35, 1 => 1.25, _ => 2.6 };
    let max_offset = (len * 0.035).min(4.5) * roughness;
    let cp_x = (x1 + x2) * 0.5 + (rng.next_f64() - 0.5) * 2.0 * max_offset;
    let cp_y = (y1 + y2) * 0.5 + (rng.next_f64() - 0.5) * 2.0 * max_offset;
    ((x1, y1), (cp_x, cp_y), (x2, y2))
}`,
  },
  {
    id: 'engine',
    path: 'src/canvas/engine.rs',
    summary: 'Direct Rust bindings to CanvasRenderingContext2d via web-sys for camera viewport transforms and rendering.',
    code: `use wasm_bindgen::prelude::*;
use web_sys::CanvasRenderingContext2d;

#[wasm_bindgen]
pub struct ViewportCamera {
    pub x: f64,
    pub y: f64,
    pub zoom: f64,
}

#[wasm_bindgen]
impl ViewportCamera {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64, zoom: f64) -> Self {
        Self { x, y, zoom }
    }

    pub fn apply_transform(&self, ctx: &CanvasRenderingContext2d) -> Result<(), JsValue> {
        ctx.translate(self.x, self.y)?;
        ctx.scale(self.zoom, self.zoom)?;
        Ok(())
    }
}`,
  },
  {
    id: 'local',
    path: 'src/storage/local.rs',
    summary: 'Local-first scene persistence via gloo-storage and Serde JSON serialization.',
    code: `use gloo_storage::{LocalStorage, Storage};
use crate::model::element::WhiteboardElement;

const SCENE_KEY: &str = "rustly-forge-scene-v1";

pub fn save_scene(elements: &[WhiteboardElement]) -> Result<(), String> {
    LocalStorage::set(SCENE_KEY, elements).map_err(|e| e.to_string())
}

pub fn load_scene() -> Vec<WhiteboardElement> {
    LocalStorage::get(SCENE_KEY).unwrap_or_default()
}`,
  },
  {
    id: 'lib',
    path: 'src/lib.rs',
    summary: 'WASM entry point installing console_error_panic_hook and exporting Leptos CSR mounting hooks.',
    code: `use wasm_bindgen::prelude::*;

pub mod app;
pub mod canvas;
pub mod model;
pub mod storage;

#[wasm_bindgen(start)]
pub fn init_wasm_core() {
    console_error_panic_hook::set_once();
}`,
  },
];

export const RustCodeViewerModal: React.FC<RustCodeViewerModalProps> = ({ open, onClose }) => {
  const [selectedId, setSelectedId] = useState(RUST_MODULES[0].id);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const active = RUST_MODULES.find((m) => m.id === selectedId) || RUST_MODULES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rust and WASM Architecture Inspector"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div className="rf-panel w-full max-w-4xl rounded-2xl overflow-hidden flex flex-col max-h-[82vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rf-border)]">
          <div className="flex items-center gap-2.5">
            <Code2 className="w-4 h-4 text-[var(--rf-accent)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--rf-text)]">
                Rust & WebAssembly Core Architecture
              </h2>
              <p className="text-xs text-[var(--rf-text-muted)]">
                Inspect the Rust scene graph, procedural sketch engine, and Serde persistence modules
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close Rust Code Viewer"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rf-text-muted)] hover:bg-[var(--rf-surface-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-[var(--rf-border)] p-2.5 space-y-1 overflow-y-auto rf-scrollbar">
            {RUST_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedId(mod.id)}
                className={`w-full text-left px-3 py-2 rounded-lg font-mono-tabular text-xs transition-colors ${
                  mod.id === active.id
                    ? 'bg-[var(--rf-accent)] text-[var(--rf-accent-fg)] font-semibold'
                    : 'text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)]'
                }`}
              >
                {mod.path}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--rf-border)] bg-[var(--rf-surface-elevated)]">
              <p className="text-xs text-[var(--rf-text-muted)] truncate pr-4">{active.summary}</p>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--rf-border)] text-xs text-[var(--rf-text)] hover:bg-[var(--rf-surface-hover)] shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="flex-1 p-4 overflow-auto rf-scrollbar font-mono-tabular text-xs leading-relaxed text-[var(--rf-text)] bg-[var(--rf-canvas-bg)]">
              <code>{active.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
