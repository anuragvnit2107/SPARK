import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  Search,
  Plus,
  Layers,
  Grid,
  Compass,
  ExternalLink,
  Trash2,
  FolderKanban,
  Tag,
  Clock,
  Sparkles,
  X,
  Globe,
  Check,
  RotateCcw,
  Bookmark,
  Monitor,
  SlidersHorizontal,
  ChevronRight,
  Upload,
  FileCode
} from 'lucide-react';

// ============================================================================
// CONSTANTS & 7-CLUSTER CONSTELLATION ARCHITECTURE
// ============================================================================

const CATEGORIES = {
  'AI & LLMs': {
    color: '#a855f7', // Purple
    glow: 'rgba(168, 85, 247, 0.35)',
    center: new THREE.Vector3(-18, 9, -8),
    badge: 'AI'
  },
  'Coding & DSA': {
    color: '#38bdf8', // Sky / Cyan
    glow: 'rgba(56, 189, 248, 0.35)',
    center: new THREE.Vector3(18, 10, -7),
    badge: 'DEV'
  },
  'Academics & Exams': {
    color: '#10b981', // Emerald
    glow: 'rgba(16, 185, 129, 0.35)',
    center: new THREE.Vector3(0, 14, -18),
    badge: 'EDU'
  },
  'Career & Jobs': {
    color: '#f59e0b', // Amber
    glow: 'rgba(245, 158, 11, 0.35)',
    center: new THREE.Vector3(-20, -8, 8),
    badge: 'JOB'
  },
  'Workspace & Docs': {
    color: '#6366f1', // Indigo
    glow: 'rgba(99, 102, 241, 0.35)',
    center: new THREE.Vector3(0, -1, 14),
    badge: 'DOC'
  },
  'Media & Entertainment': {
    color: '#f43f5e', // Rose
    glow: 'rgba(244, 63, 94, 0.35)',
    center: new THREE.Vector3(20, -8, 8),
    badge: 'MED'
  },
  'Shopping & Utilities': {
    color: '#14b8a6', // Teal
    glow: 'rgba(20, 184, 166, 0.35)',
    center: new THREE.Vector3(0, -14, -12),
    badge: 'UTL'
  }
};

const INITIAL_BOOKMARKS = [
  // 1. AI & LLMs (14)
  {
    id: 'bm-ai-1',
    title: 'ChatGPT',
    url: 'https://chat.openai.com/',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['llm', 'openai', 'chat', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2310a37f%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2215%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%225%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'OpenAI conversational AI assistant.'
  },
  {
    id: 'bm-ai-2',
    title: 'Google Gemini',
    url: 'https://gemini.google.com/app?hl=en-IN',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['gemini', 'google-ai', 'llm', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e1b4b%22/%3E%3Cpath d=%22M32 10 C35 24 40 29 54 32 C40 35 35 40 32 54 C29 40 24 35 10 32 C24 29 29 24 32 10 Z%22 fill=%22%23818cf8%22/%3E%3C/svg%3E',
    notes: 'Google multimodal Gemini workspace.'
  },
  {
    id: 'bm-ai-3',
    title: 'Kimi AI',
    url: 'https://www.kimi.com/en',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['kimi', 'long-context', 'llm', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2228%22 font-weight=%22bold%22%3EK%3C/text%3E%3C/svg%3E',
    notes: 'Moonshot AI long-context research assistant.'
  },
  {
    id: 'bm-ai-4',
    title: 'DeepSeek Chat',
    url: 'https://chat.deepseek.com/',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['deepseek', 'reasoning', 'llm', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2214%22 fill=%22none%22 stroke=%22%23e0f2fe%22 stroke-width=%224%22/%3E%3Ccircle cx=%2237%22 cy=%2228%22 r=%224%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'DeepSeek reasoning and code generation chat.'
  },
  {
    id: 'bm-ai-5',
    title: 'Claude AI',
    url: 'https://claude.ai/login?from=logout',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['claude', 'anthropic', 'llm', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23d97757%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2213%22 fill=%22none%22 stroke=%22%23fff7ed%22 stroke-width=%224%22/%3E%3C/svg%3E',
    notes: 'Anthropic Claude AI workspace.'
  },
  {
    id: 'bm-ai-6',
    title: 'Google AI Studio',
    url: 'https://aistudio.google.com/prompts/new_chat',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['ai-studio', 'prompts', 'api', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%233b82f6%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%226%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%225%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Rapid prototyping with Gemini models in Google AI Studio.'
  },
  {
    id: 'bm-ai-7',
    title: 'Google AI Studio Library',
    url: 'https://aistudio.google.com/library',
    category: 'AI & LLMs',
    folder: 'Other Bookmarks',
    tags: ['ai-studio', 'library', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f46e5%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%226%22 fill=%22none%22 stroke=%22%23e0e7ff%22 stroke-width=%223.5%22/%3E%3Cpath d=%22M24 32 H40 M32 24 V40%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Saved prompt library and experiments in Google AI Studio.'
  },
  {
    id: 'bm-ai-8',
    title: 'Hugging Face',
    url: 'https://huggingface.co/',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['models', 'datasets', 'open-source', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23fbbf24%22/%3E%3Ccircle cx=%2225%22 cy=%2229%22 r=%223.5%22 fill=%22%231e293b%22/%3E%3Ccircle cx=%2239%22 cy=%2229%22 r=%223.5%22 fill=%22%231e293b%22/%3E%3Cpath d=%22M22 38 Q32 46 42 38%22 fill=%22none%22 stroke=%22%231e293b%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Open-source ML models, datasets, and Spaces.'
  },
  {
    id: 'bm-ai-9',
    title: 'Stitch - Design with AI',
    url: 'https://stitch.withgoogle.com/',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['ui-design', 'google-labs', 'ai-design', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%239333ea%22/%3E%3Crect x=%2217%22 y=%2217%22 width=%2213%22 height=%2213%22 rx=%223%22 fill=%22%23ffffff%22/%3E%3Crect x=%2234%22 y=%2234%22 width=%2213%22 height=%2213%22 rx=%223%22 fill=%22%23f3e8ff%22/%3E%3C/svg%3E',
    notes: 'AI-powered UI and frontend generation tool by Google.'
  },
  {
    id: 'bm-ai-10',
    title: 'Google Labs Flow',
    url: 'https://labs.google/fx/tools/flow',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['google-labs', 'video', 'creative-ai', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230d9488%22/%3E%3Cpath d=%22M18 32 Q25 20 32 32 T46 32%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Google Labs generative creative flow studio.'
  },
  {
    id: 'bm-ai-11',
    title: 'Prism - AI LaTeX Editor',
    url: 'https://prism.openai.com/',
    category: 'AI & LLMs',
    folder: 'Courses',
    tags: ['latex', 'openai', 'writing', 'courses'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%237c3aed%22/%3E%3Cpolygon points=%2232,15 48,45 16,45%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'AI-assisted LaTeX research and document editor.'
  },
  {
    id: 'bm-ai-12',
    title: 'TubeOnAI',
    url: 'https://web.tubeonai.com/search',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['summarizer', 'youtube-ai', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23e11d48%22/%3E%3Cpolygon points=%2226,21 45,32 26,43%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'AI video & podcast summarizer.'
  },
  {
    id: 'bm-ai-13',
    title: 'AI Photo Enhancer',
    url: 'https://www.pica-ai.com/photo-enhancer/',
    category: 'AI & LLMs',
    folder: 'Other Bookmarks',
    tags: ['image-ai', 'upscale', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ec4899%22/%3E%3Crect x=%2217%22 y=%2219%22 width=%2230%22 height=%2226%22 rx=%224%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3Ccircle cx=%2240%22 cy=%2226%22 r=%223%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Pica AI image upscaling and restoration.'
  },
  {
    id: 'bm-ai-14',
    title: 'Gamma AI Presentations',
    url: 'https://gamma.app/',
    category: 'AI & LLMs',
    folder: 'Bookmarks bar',
    tags: ['slides', 'presentations', 'ai', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%236d28d9%22/%3E%3Ctext x=%2232%22 y=%2242%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2228%22 font-weight=%22bold%22%3E%CE%B3%3C/text%3E%3C/svg%3E',
    notes: 'AI presentation deck and webpage generator.'
  },

  // 2. Coding & DSA (23)
  {
    id: 'bm-dev-1',
    title: 'GitHub',
    url: 'https://github.com/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['git', 'repos', 'open-source', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23181717%22/%3E%3Ccircle cx=%2232%22 cy=%2233%22 r=%2215%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2227%22 cy=%2231%22 r=%222.5%22 fill=%22%23181717%22/%3E%3Ccircle cx=%2237%22 cy=%2231%22 r=%222.5%22 fill=%22%23181717%22/%3E%3C/svg%3E',
    notes: 'GitHub repositories and developer profile.'
  },
  {
    id: 'bm-dev-2',
    title: 'GitHub - lstprjct/IDM-Activation-Script',
    url: 'https://github.com/lstprjct/IDM-Activation-Script',
    category: 'Coding & DSA',
    folder: 'Other Bookmarks',
    tags: ['github', 'script', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23181717%22/%3E%3Ccircle cx=%2232%22 cy=%2233%22 r=%2215%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2227%22 cy=%2231%22 r=%222.5%22 fill=%22%23181717%22/%3E%3Ccircle cx=%2237%22 cy=%2231%22 r=%222.5%22 fill=%22%23181717%22/%3E%3C/svg%3E',
    notes: 'IDM Activation & Trial Reset Script repository.'
  },
  {
    id: 'bm-dev-3',
    title: 'Practice | GeeksforGeeks',
    url: 'https://practice.geeksforgeeks.org/explore?page=1&sortBy=submissions',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['dsa', 'gfg', 'algorithms', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232f8d46%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2222%22 font-weight=%22bold%22%3EGfG%3C/text%3E%3C/svg%3E',
    notes: 'GeeksforGeeks DSA coding practice problems sorted by submissions.'
  },
  {
    id: 'bm-dev-4',
    title: "Striver's A2Z DSA Course",
    url: 'https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/',
    category: 'Coding & DSA',
    folder: 'Other Bookmarks',
    tags: ['striver', 'dsa-sheet', 'interviews', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23dc2626%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ETUF%3C/text%3E%3C/svg%3E',
    notes: 'TakeUForward complete A2Z Data Structures & Algorithms roadmap.'
  },
  {
    id: 'bm-dev-5',
    title: '15 Days of Learning SQL | HackerRank',
    url: 'https://www.hackerrank.com/challenges/15-days-of-learning-sql/problem?isFullScreen=true',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['sql', 'hackerrank', 'database', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2300ea64%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23090d16%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EH%3C/text%3E%3C/svg%3E',
    notes: 'Advanced SQL challenge on HackerRank.'
  },
  {
    id: 'bm-dev-6',
    title: 'Learn SQL - Online SQL Terminal',
    url: 'https://www.sql-practice.com/learn/select-statement/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['sql', 'interactive', 'queries', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230369a1%22/%3E%3Cellipse cx=%2232%22 cy=%2222%22 rx=%2214%22 ry=%226%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223%22/%3E%3Cpath d=%22M18 22 V42 A14 6 0 0 0 46 42 V22%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223%22/%3E%3C/svg%3E',
    notes: 'Interactive browser SQL query practice terminal.'
  },
  {
    id: 'bm-dev-7',
    title: 'SQLZoo Tutorial',
    url: 'https://sqlzoo.net/wiki/SQL_Tutorial',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['sql', 'tutorial', 'database', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231d4ed8%22/%3E%3Ctext x=%2232%22 y=%2239%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22monospace%22 font-size=%2219%22 font-weight=%22bold%22%3ESQL%3C/text%3E%3C/svg%3E',
    notes: 'Interactive SQL wiki exercises and joins.'
  },
  {
    id: 'bm-dev-8',
    title: 'W3Schools DSA',
    url: 'https://www.w3schools.com/dsa/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['dsa', 'w3schools', 'reference', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2304aa6d%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2222%22 font-weight=%22bold%22%3EW3%3C/text%3E%3C/svg%3E',
    notes: 'Visual Data Structures & Algorithms reference.'
  },
  {
    id: 'bm-dev-9',
    title: 'C programming exercises: For Loop - w3resource',
    url: 'https://www.w3resource.com/c-programming-exercises/for-loop/index.php',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['c-lang', 'loops', 'exercises', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22monospace%22 font-size=%2224%22 font-weight=%22bold%22%3Ew3r%3C/text%3E%3C/svg%3E',
    notes: 'C programming loop practice problems.'
  },
  {
    id: 'bm-dev-10',
    title: 'freeCodeCamp',
    url: 'https://www.freecodecamp.org/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['web-dev', 'certifications', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230a0a23%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22monospace%22 font-size=%2222%22 font-weight=%22bold%22%3EfCC%3C/text%3E%3C/svg%3E',
    notes: 'Free full-stack web development curriculum.'
  },
  {
    id: 'bm-dev-11',
    title: 'Replit',
    url: 'https://replit.com/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['cloud-ide', 'compiler', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23f26207%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2213%22 height=%228%22 rx=%222%22 fill=%22%23ffffff%22/%3E%3Crect x=%2226%22 y=%2228%22 width=%2218%22 height=%228%22 rx=%222%22 fill=%22%23ffffff%22/%3E%3Crect x=%2218%22 y=%2238%22 width=%2213%22 height=%228%22 rx=%222%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Cloud IDE and instant code sandbox.'
  },
  {
    id: 'bm-dev-12',
    title: 'QuickRef.ME Cheat Sheets',
    url: 'https://quickref.me/index.html',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['cheatsheet', 'syntax', 'reference', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f172a%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%2338bdf8%22 font-family=%22monospace%22 font-size=%2224%22 font-weight=%22bold%22%3EQR%3C/text%3E%3C/svg%3E',
    notes: 'Quick developer syntax cheat sheets for languages & CLI tools.'
  },
  {
    id: 'bm-dev-13',
    title: 'Codedamn - Learn To Code',
    url: 'https://codedamn.com/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['courses', 'practice', 'coding', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%236366f1%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22monospace%22 font-size=%2224%22 font-weight=%22bold%22%3E%7B/%7D%3C/text%3E%3C/svg%3E',
    notes: 'Interactive coding courses and labs.'
  },
  {
    id: 'bm-dev-14',
    title: 'General Tutorials - Dev.java',
    url: 'https://dev.java/learn/',
    category: 'Coding & DSA',
    folder: 'Bookmarks',
    tags: ['java', 'tutorials', 'oop'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ea580c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EJAVA%3C/text%3E%3C/svg%3E',
    notes: 'Official Oracle Java language tutorials.'
  },
  {
    id: 'bm-dev-15',
    title: 'Uiverse.io UI Components',
    url: 'https://uiverse.io/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['css', 'ui-components', 'tailwind', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%237e22ce%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2213%22 fill=%22none%22 stroke=%22%23f3e8ff%22 stroke-width=%223.5%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%225%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Open-source CSS & Tailwind UI elements.'
  },
  {
    id: 'bm-dev-16',
    title: 'Free Public APIs',
    url: 'https://free-apis.github.io/#/browse',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['apis', 'json', 'projects', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22monospace%22 font-size=%2220%22 font-weight=%22bold%22%3EAPI%3C/text%3E%3C/svg%3E',
    notes: 'Directory of free public REST APIs for projects.'
  },
  {
    id: 'bm-dev-17',
    title: 'TpointTech Tutorials',
    url: 'https://www.tpointtech.com/',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['cs-core', 'dbms', 'os', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2315803d%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3ET%3C/text%3E%3C/svg%3E',
    notes: 'Computer science, DBMS, and programming tutorials.'
  },
  {
    id: 'bm-dev-18',
    title: 'Open VSX Registry',
    url: 'https://open-vsx.org/?search=c%20make',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['vscode', 'extensions', 'cmake', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Cpath d=%22M20 22 L44 42 M44 22 L20 42%22 stroke=%22%23ffffff%22 stroke-width=%224.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Open-source VS Code extension registry (CMake search).'
  },
  {
    id: 'bm-dev-19',
    title: 'Kaggle - Arithmetic and Variables',
    url: 'https://www.kaggle.com/code/alexisbcook/arithmetic-and-variables',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['python', 'kaggle', 'data-science', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2320beff%22/%3E%3Ctext x=%2232%22 y=%2242%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2228%22 font-weight=%22bold%22%3Ek%3C/text%3E%3C/svg%3E',
    notes: 'Kaggle Intro to Programming notebook.'
  },
  {
    id: 'bm-dev-20',
    title: 'Google Colab Notebook',
    url: 'https://colab.research.google.com/drive/16RQWfglYKjfOL_Etufhpbek7ua6X2kXX',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['colab', 'python', 'jupyter', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23f9ab00%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%231e293b%22 font-family=%22sans-serif%22 font-size=%2222%22 font-weight=%22bold%22%3ECO%3C/text%3E%3C/svg%3E',
    notes: 'Cloud Python/ML Jupyter notebook in Google Colab.'
  },
  {
    id: 'bm-dev-21',
    title: 'Python for Data Analysis 3E',
    url: 'https://wesmckinney.com/book/accessing-data',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['pandas', 'python', 'book', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23131c4e%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%2338bdf8%22 font-family=%22monospace%22 font-size=%2222%22 font-weight=%22bold%22%3Epd%3C/text%3E%3C/svg%3E',
    notes: 'Wes McKinney book — Chapter 6: Data Loading & Storage.'
  },
  {
    id: 'bm-dev-22',
    title: 'Fundamentals of Data Visualization',
    url: 'https://clauswilke.com/dataviz/aesthetic-mapping.html',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['dataviz', 'charts', 'book', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Crect x=%2218%22 y=%2234%22 width=%227%22 height=%2212%22 rx=%222%22 fill=%22%23ffffff%22/%3E%3Crect x=%2228.5%22 y=%2224%22 width=%227%22 height=%2222%22 rx=%222%22 fill=%22%23bae6fd%22/%3E%3Crect x=%2239%22 y=%2217%22 width=%227%22 height=%2229%22 rx=%222%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Claus Wilke guide to aesthetic mapping in data visualization.'
  },
  {
    id: 'bm-dev-23',
    title: 'Data Science at the Command Line',
    url: 'https://jeroenjanssens.com/dsatcl/chapter-5-scrubbing-data',
    category: 'Coding & DSA',
    folder: 'Bookmarks bar',
    tags: ['cli', 'bash', 'data-cleaning', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23111827%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%234ade80%22 font-family=%22monospace%22 font-size=%2224%22 font-weight=%22bold%22%3E$_%3C/text%3E%3C/svg%3E',
    notes: 'Chapter 5: Scrubbing Data using Unix command-line tools.'
  },

  // 3. Academics & Exams (25)
  {
    id: 'bm-acad-1',
    title: 'VNIT Nagpur',
    url: 'https://vnit.ac.in/',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['vnit', 'college', 'portal', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e3a8a%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23fbbf24%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3EVNIT%3C/text%3E%3C/svg%3E',
    notes: 'Visvesvaraya National Institute of Technology official portal.'
  },
  {
    id: 'bm-acad-2',
    title: 'NPTEL Portal',
    url: 'https://nptel.ac.in/',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['nptel', 'mooc', 'engineering', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b91c1c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2217%22 font-weight=%22bold%22%3ENPTEL%3C/text%3E%3C/svg%3E',
    notes: 'NPTEL online engineering courses and certifications.'
  },
  {
    id: 'bm-acad-3',
    title: 'NPTEL Robotics Course',
    url: 'https://nptel.ac.in/courses/107106090',
    category: 'Academics & Exams',
    folder: 'Other Bookmarks',
    tags: ['robotics', 'nptel', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b91c1c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2217%22 font-weight=%22bold%22%3ENPTEL%3C/text%3E%3C/svg%3E',
    notes: 'NPTEL Course 107106090 — Robotics.'
  },
  {
    id: 'bm-acad-4',
    title: 'NPTEL Probability Course',
    url: 'https://nptel.ac.in/courses/111102798',
    category: 'Academics & Exams',
    folder: 'Other Bookmarks',
    tags: ['probability', 'math', 'nptel', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b91c1c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2217%22 font-weight=%22bold%22%3ENPTEL%3C/text%3E%3C/svg%3E',
    notes: 'NPTEL Course 111102798 — Probability.'
  },
  {
    id: 'bm-acad-5',
    title: 'NPTEL Machine Learning in Hindi',
    url: 'https://nptel.ac.in/courses/106106247',
    category: 'Academics & Exams',
    folder: 'Other Bookmarks',
    tags: ['machine-learning', 'nptel', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b91c1c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2217%22 font-weight=%22bold%22%3ENPTEL%3C/text%3E%3C/svg%3E',
    notes: 'NPTEL Course 106106247 — Machine Learning.'
  },
  {
    id: 'bm-acad-6',
    title: 'SWAYAM Distributed Optimization & ML',
    url: 'https://onlinecourses.nptel.ac.in/e-learning/preview/noc24_cs86',
    category: 'Academics & Exams',
    folder: 'Courses',
    tags: ['swayam', 'optimization', 'ml', 'courses'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23047857%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3ESWAY%3C/text%3E%3C/svg%3E',
    notes: 'SWAYAM NOC24-CS86 Distributed Optimization & Machine Learning.'
  },
  {
    id: 'bm-acad-7',
    title: 'Harvard CS50 Full Course',
    url: 'https://www.youtube.com/watch?v=8mAITcNt710',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['cs50', 'harvard', 'cs', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Harvard CS50 Full Computer Science University Course.'
  },
  {
    id: 'bm-acad-8',
    title: 'Reduction Potential & Pourbaix Diagram',
    url: 'https://www.youtube.com/watch?v=piRIg5P3R-k&list=PLUNF8EwE7zR60ZYIQGsJbUWOgncWPJ-Cl&index=6',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['electrochemistry', 'lecture', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Mod-01 Lec-06 Reduction Potential series & Pourbaix diagram.'
  },
  {
    id: 'bm-acad-9',
    title: 'Functions of Several Variables',
    url: 'https://www.youtube.com/playlist?list=PLbPKXd6I4z1n1Mj29c9nBWXwpnWv-mXKm',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['calculus', 'math', 'playlist', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Engineering mathematics playlist on multivariable functions.'
  },
  {
    id: 'bm-acad-10',
    title: 'Multivariable Calculus Playlist',
    url: 'https://www.youtube.com/playlist?list=PLtKWB-wrvn4nA2h8TFxzWL2zy8O9th_fy',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['calculus', 'gradients', 'math', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Multivariable calculus video lecture series.'
  },
  {
    id: 'bm-acad-11',
    title: 'Probability for Data Science Lectures',
    url: 'https://probability4datascience.com/lecture.html',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['probability', 'statistics', 'data-science', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23059669%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EP4DS%3C/text%3E%3C/svg%3E',
    notes: 'Textbook companion video lectures on probability.'
  },
  {
    id: 'bm-acad-12',
    title: 'GATE EE Practice Papers',
    url: 'https://practicepaper.in/gate-ee/topic-wise-practice-of-gate-ee-previous-year-papers',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['gate', 'ee', 'pyq', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EGATE%3C/text%3E%3C/svg%3E',
    notes: 'Topic-wise GATE Electrical Engineering previous year questions.'
  },
  {
    id: 'bm-acad-13',
    title: 'GATE Network Theory PDF',
    url: 'https://gateflix.in/wp-content/uploads/2020/04/Network-Theory_compressed.pdf',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['gate', 'circuits', 'pdf', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23dc2626%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3EPDF%3C/text%3E%3C/svg%3E',
    notes: 'Compressed Network Theory study notes PDF.'
  },
  {
    id: 'bm-acad-14',
    title: 'ExamGOAL PYQ PDF',
    url: 'https://pdf.questions.examgoal.com/',
    category: 'Academics & Exams',
    folder: 'Bookmarks',
    tags: ['gate', 'jee', 'pyq'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234338ca%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EPYQ%3C/text%3E%3C/svg%3E',
    notes: 'Previous Year Question Papers PDF with Answer Key.'
  },
  {
    id: 'bm-acad-15',
    title: 'CAT 2023 Slot 1 Quant Paper',
    url: 'https://online.2iim.com/CAT-question-paper/CAT-2023-Question-Paper-Slot-1-Quant/',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['cat', 'quant', 'aptitude', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230369a1%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3E2IIM%3C/text%3E%3C/svg%3E',
    notes: '2IIM CAT 2023 Slot 1 Quantitative Aptitude question paper.'
  },
  {
    id: 'bm-acad-16',
    title: 'IndiaBIX Aptitude',
    url: 'https://www.indiabix.com/',
    category: 'Academics & Exams',
    folder: 'Other Bookmarks',
    tags: ['aptitude', 'reasoning', 'placements', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2316a34a%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EBIX%3C/text%3E%3C/svg%3E',
    notes: 'Quantitative aptitude and logical reasoning practice.'
  },
  {
    id: 'bm-acad-17',
    title: 'ALLEN Career Institute Solutions',
    url: 'https://dsat.allen.ac.in/index.php?pageName=paperSolution',
    category: 'Academics & Exams',
    folder: 'Synced Bookmarks',
    tags: ['allen', 'solutions', 'synced-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231d4ed8%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3EALLEN%3C/text%3E%3C/svg%3E',
    notes: 'ALLEN test paper solutions archive.'
  },
  {
    id: 'bm-acad-18',
    title: 'Quizrr Test Series',
    url: 'https://app.quizrr.in/auth',
    category: 'Academics & Exams',
    folder: 'Homey Bookmarks',
    tags: ['quizrr', 'mock-tests', 'homey-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%237c3aed%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EQ%3C/text%3E%3C/svg%3E',
    notes: 'Online mock test and analytics platform.'
  },
  {
    id: 'bm-acad-19',
    title: '6th Semester - Google Drive',
    url: 'https://drive.google.com/drive/folders/1oK9iaAmqnql1ypD7lsiGs_mwR9PY6AlR',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['6th-sem', 'notes', 'drive', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Cpolygon points=%2232,16 48,44 16,44%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: '6th Semester academic materials folder.'
  },
  {
    id: 'bm-acad-20',
    title: 'RES_END_Sem Solution Doc',
    url: 'https://docs.google.com/document/d/1W7pbjYEobi0Wl67UNwaskB1Dhdj_cCJG3LEdPx_Hlkw/edit?tab=t.0',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['exam-solution', 'docs', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234285f4%22/%3E%3Crect x=%2220%22 y=%2216%22 width=%2224%22 height=%2232%22 rx=%223%22 fill=%22%23ffffff%22/%3E%3Cline x1=%2225%22 y1=%2225%22 x2=%2239%22 y2=%2225%22 stroke=%22%234285f4%22 stroke-width=%223%22/%3E%3Cline x1=%2225%22 y1=%2233%22 x2=%2239%22 y2=%2233%22 stroke=%22%234285f4%22 stroke-width=%223%22/%3E%3C/svg%3E',
    notes: 'End-semester exam solution document.'
  },
  {
    id: 'bm-acad-21',
    title: '1-W24 Fee Notice PDF',
    url: 'https://drive.google.com/file/d/19qzl_r7xVUj7OkWS4rALfoRY4Jj4t1m7/view',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['fee-notice', 'vnit', 'pdf', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Cpolygon points=%2232,16 48,44 16,44%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Odd Term Academic Year 2024-25 fee notice.'
  },
  {
    id: 'bm-acad-22',
    title: 'FEE REMISSION 25 Form',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSfzDSSKxBQKCYDWNvQLseLZN79T64dfmQF8_8pvP6EiBohM6Q/viewform',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['form', 'scholarship', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%237248b9%22/%3E%3Crect x=%2220%22 y=%2216%22 width=%2224%22 height=%2232%22 rx=%223%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2226%22 cy=%2226%22 r=%222%22 fill=%22%237248b9%22/%3E%3Cline x1=%2231%22 y1=%2226%22 x2=%2239%22 y2=%2226%22 stroke=%22%237248b9%22 stroke-width=%222.5%22/%3E%3C/svg%3E',
    notes: 'Fee remission application form.'
  },
  {
    id: 'bm-acad-23',
    title: 'IIT Bhilai Form',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSeFyeDPrCQAvUV9H1oH7ZO52ITdnahwOpuKeqXBxPS5DxrQJQ/viewform',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['iit-bhilai', 'form', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%237248b9%22/%3E%3Crect x=%2220%22 y=%2216%22 width=%2224%22 height=%2232%22 rx=%223%22 fill=%22%23ffffff%22/%3E%3Ccircle cx=%2226%22 cy=%2226%22 r=%222%22 fill=%22%237248b9%22/%3E%3Cline x1=%2231%22 y1=%2226%22 x2=%2239%22 y2=%2226%22 stroke=%22%237248b9%22 stroke-width=%222.5%22/%3E%3C/svg%3E',
    notes: 'IIT Bhilai academic/internship registration form.'
  },
  {
    id: 'bm-acad-24',
    title: 'MATLAB Online',
    url: 'https://matlab.mathworks.com/',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['matlab', 'simulation', 'mathworks', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23c2410c%22/%3E%3Cpath d=%22M14 42 L28 20 L36 33 L50 18%22 fill=%22none%22 stroke=%22%23facc15%22 stroke-width=%224.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'MathWorks browser-based MATLAB environment.'
  },
  {
    id: 'bm-acad-25',
    title: 'Enggroom Engineering',
    url: 'https://www.enggroom.com/',
    category: 'Academics & Exams',
    folder: 'Bookmarks bar',
    tags: ['engineering', 'resources', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230d9488%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EEG%3C/text%3E%3C/svg%3E',
    notes: 'Engineering study resources and notes.'
  },

  // 4. Career & Jobs (21)
  {
    id: 'bm-job-1',
    title: 'SuperSet Student Feed',
    url: 'https://app.joinsuperset.com/#/s/feed',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['superset', 'campus-placements', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ESS%3C/text%3E%3C/svg%3E',
    notes: 'Campus placement drives and announcements feed.'
  },
  {
    id: 'bm-job-2',
    title: 'SuperSet Students Portal',
    url: 'https://app.joinsuperset.com/students',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['superset', 'applications', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ESS%3C/text%3E%3C/svg%3E',
    notes: 'SuperSet student placement dashboard.'
  },
  {
    id: 'bm-job-3',
    title: 'SuperSet Account Login',
    url: 'https://www.supersetapp.com/account/user/login',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['superset', 'login', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ESS%3C/text%3E%3C/svg%3E',
    notes: 'SuperSet authentication portal.'
  },
  {
    id: 'bm-job-4',
    title: 'PLACMENTS Spreadsheet',
    url: 'https://docs.google.com/spreadsheets/d/1d8v2fhuAI4qWWR4r00D3QjoZLdSuKR9fWdmmEHPCfcw/edit',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['tracker', 'placements', 'sheets', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%223%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223%22/%3E%3Cline x1=%2218%22 y1=%2228%22 x2=%2246%22 y2=%2228%22 stroke=%22%23ffffff%22 stroke-width=%222.5%22/%3E%3Cline x1=%2232%22 y1=%2218%22 x2=%2232%22 y2=%2246%22 stroke=%22%23ffffff%22 stroke-width=%222.5%22/%3E%3C/svg%3E',
    notes: 'Master placement tracking Google Sheet.'
  },
  {
    id: 'bm-job-5',
    title: 'FreeJobAlert Notifications',
    url: 'https://www.freejobalert.com/',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['govt-jobs', 'alerts', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23d97706%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EJOB%3C/text%3E%3C/svg%3E',
    notes: 'Latest government and PSU recruitment notifications.'
  },
  {
    id: 'bm-job-6',
    title: 'State Government Jobs',
    url: 'https://www.freejobalert.com/state-government-jobs/',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['state-jobs', 'notifications', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23d97706%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3EJOB%3C/text%3E%3C/svg%3E',
    notes: 'State-wise government job alerts.'
  },
  {
    id: 'bm-job-7',
    title: 'CGPSC Advertisement',
    url: 'https://psc.cg.gov.in/Advertisement.php',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['cgpsc', 'psc', 'recruitment', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b45309%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3EPSC%3C/text%3E%3C/svg%3E',
    notes: 'Chhattisgarh Public Service Commission official notifications.'
  },
  {
    id: 'bm-job-8',
    title: 'CGPSC AE Civil Result PDF',
    url: 'https://psc.cg.gov.in/pdf/RESULT/WSOM_SES_2021_AE_Civil_09042024.PDF',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['cgpsc', 'result', 'pdf', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'CGPSC State Engineering Services result PDF.'
  },
  {
    id: 'bm-job-9',
    title: 'CSPTCL Portal',
    url: 'https://cdn.digialm.com/EForms/configuredHtml/1258/102606/CA5JBy9lnHhL3sLrGu/Index.html',
    category: 'Career & Jobs',
    folder: 'Bookmarks',
    tags: ['csptcl', 'psu', 'application'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'CSPTCL recruitment examination portal.'
  },
  {
    id: 'bm-job-10',
    title: 'CEERI Registration Login',
    url: 'https://exam.ceeri.res.in/012026/Registration/login.html',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['csir', 'ceeri', 'research-job', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230369a1%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2218%22 font-weight=%22bold%22%3ECEERI%3C/text%3E%3C/svg%3E',
    notes: 'CSIR-CEERI recruitment registration portal.'
  },
  {
    id: 'bm-job-11',
    title: 'Accio Robotics - Deployment Engineer Intern',
    url: 'https://acciorobotics.zohorecruit.com/jobs/Careers/735673000003271107/Deployment-Engineer-Intern',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['robotics', 'internship', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23f59e0b%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EA%3C/text%3E%3C/svg%3E',
    notes: 'Accio Robotics Deployment Engineer Internship application.'
  },
  {
    id: 'bm-job-12',
    title: 'NVIDIA - Formal Verification Engineer NCG',
    url: 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/India-Gurugram/Formal-Verification-Engineer---New-College-Graduate_JR2017808/apply/applyManually',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['nvidia', 'hardware', 'new-grad', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2376b900%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EN%3C/text%3E%3C/svg%3E',
    notes: 'NVIDIA Gurugram New College Graduate role.'
  },
  {
    id: 'bm-job-13',
    title: 'Rubrik - Infosec Intern',
    url: 'https://www.rubrik.com/company/careers/departments/job.7844920',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['rubrik', 'security', 'internship', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ER%3C/text%3E%3C/svg%3E',
    notes: 'Rubrik Information Security Internship.'
  },
  {
    id: 'bm-job-14',
    title: 'JPMorganChase Programs',
    url: 'https://www.jpmorganchase.com/careers/explore-opportunities/programs',
    category: 'Career & Jobs',
    folder: 'Courses',
    tags: ['jpmc', 'fintech', 'programs', 'courses'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e3a8a%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%224%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3C/svg%3E',
    notes: 'JPMorganChase student & graduate career programs.'
  },
  {
    id: 'bm-job-15',
    title: 'IIT Indore Recruitment PDF',
    url: 'https://www.iiti.ac.in/public/storage/recruitments/June2026/OLYT9aNIR4MYDBGer4wc.pdf',
    category: 'Career & Jobs',
    folder: 'Courses',
    tags: ['iit-indore', 'recruitment', 'courses'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'IIT Indore June 2026 recruitment advertisement.'
  },
  {
    id: 'bm-job-16',
    title: 'Remotive Remote Jobs',
    url: 'https://remotive.com/',
    category: 'Career & Jobs',
    folder: 'INTERSHIPS',
    tags: ['remote', 'tech-jobs', 'interships'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f46e5%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3ERM%3C/text%3E%3C/svg%3E',
    notes: 'Remote jobs in programming, support, and design.'
  },
  {
    id: 'bm-job-17',
    title: 'Jobscan ATS Score Checker',
    url: 'https://app.jobscan.co/match-report/7751627',
    category: 'Career & Jobs',
    folder: 'INTERSHIPS',
    tags: ['resume', 'ats', 'interships'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230d9488%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EJS%3C/text%3E%3C/svg%3E',
    notes: 'Resume keyword optimization & ATS match report.'
  },
  {
    id: 'bm-job-18',
    title: 'SEBI Certifications',
    url: 'https://sice.nism.ac.in/registerStudentDetailSelf',
    category: 'Career & Jobs',
    folder: 'INTERSHIPS',
    tags: ['sebi', 'nism', 'finance', 'interships'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231d4ed8%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2219%22 font-weight=%22bold%22%3ENISM%3C/text%3E%3C/svg%3E',
    notes: 'NISM / SEBI financial certification registration.'
  },
  {
    id: 'bm-job-19',
    title: 'Zoho Internship Application Form',
    url: 'https://forms.zohopublic.com/xonglcom/form/Internshipapplications/formperma/ukehdi3SF7MAwIigEBmJm-l7x62m5yKzQvK5WGKRurE',
    category: 'Career & Jobs',
    folder: 'Other Bookmarks',
    tags: ['internship', 'application', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23e11d48%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EZ%3C/text%3E%3C/svg%3E',
    notes: 'Zoho Forms internship application portal.'
  },
  {
    id: 'bm-job-20',
    title: 'Overleaf - ALL RESUMES ARE HERE',
    url: 'https://www.overleaf.com/project/68a242eef907f6487c278d62',
    category: 'Career & Jobs',
    folder: 'Bookmarks bar',
    tags: ['resume', 'latex', 'overleaf', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f9c2f%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22serif%22 font-size=%2228%22 font-weight=%22bold%22%3EO%3C/text%3E%3C/svg%3E',
    notes: 'Master LaTeX resume templates project on Overleaf.'
  },
  {
    id: 'bm-job-21',
    title: 'Overleaf - Cover Letter Gallery',
    url: 'https://www.overleaf.com/gallery/tagged/cover-letter',
    category: 'Career & Jobs',
    folder: 'Other Bookmarks',
    tags: ['cover-letter', 'latex', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f9c2f%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22serif%22 font-size=%2228%22 font-weight=%22bold%22%3EO%3C/text%3E%3C/svg%3E',
    notes: 'LaTeX cover letter templates on Overleaf.'
  },

  // 5. Workspace & Docs (12)
  {
    id: 'bm-doc-1',
    title: 'Overleaf Home',
    url: 'https://www.overleaf.com/',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['latex', 'editor', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f9c2f%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22serif%22 font-size=%2228%22 font-weight=%22bold%22%3EO%3C/text%3E%3C/svg%3E',
    notes: 'Online collaborative LaTeX editor.'
  },
  {
    id: 'bm-doc-2',
    title: 'Overleaf - THESIS1-5',
    url: 'https://www.overleaf.com/project/69fe49094b30ab91cc57ee40',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['thesis', 'latex', 'overleaf', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234f9c2f%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22serif%22 font-size=%2228%22 font-weight=%22bold%22%3EO%3C/text%3E%3C/svg%3E',
    notes: 'Thesis chapters 1–5 LaTeX manuscript.'
  },
  {
    id: 'bm-doc-3',
    title: 'Google Drive Home',
    url: 'https://drive.google.com/drive/u/0/home',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['drive', 'cloud-storage', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Cpolygon points=%2232,16 48,44 16,44%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Personal Google Drive cloud files.'
  },
  {
    id: 'bm-doc-4',
    title: 'S04 - Google Drive',
    url: 'https://drive.google.com/drive/folders/1Ei1WVRzYPddabskyEaRgN6j_5cFJcLim',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['drive', 'folder', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Cpolygon points=%2232,16 48,44 16,44%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Shared S04 Google Drive folder.'
  },
  {
    id: 'bm-doc-5',
    title: 'Google Drive Shared File',
    url: 'https://drive.google.com/file/d/1Pqnp0Dd6Vxj7pT4ebB-MO4ZpTfEfq8W5/view',
    category: 'Workspace & Docs',
    folder: 'Homey Bookmarks',
    tags: ['drive', 'document', 'homey-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f9d58%22/%3E%3Cpolygon points=%2232,16 48,44 16,44%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Bookmarked PDF/file from Homey Bookmarks.'
  },
  {
    id: 'bm-doc-6',
    title: 'Excel Online - Data of All Graphs',
    url: 'https://onedrive.live.com/edit.aspx?resid=CBA25DF625CFA0C9!s69ef5597e96d4c9c86e35683f87eacba',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['excel', 'onedrive', 'graphs', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230369a1%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EOD%3C/text%3E%3C/svg%3E',
    notes: 'data of all graphs (1) (2).xlsx in Microsoft Excel Online.'
  },
  {
    id: 'bm-doc-7',
    title: 'Quadratic HQ Workspace',
    url: 'https://app.quadratichq.com/teams/ce90d2a9-611b-4d7b-a18d-31a572b49abb/files',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['spreadsheet', 'python-grid', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e293b%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%226%22 fill=%22none%22 stroke=%22%23a855f7%22 stroke-width=%224%22/%3E%3C/svg%3E',
    notes: 'Infinite canvas spreadsheet with Python & SQL support.'
  },
  {
    id: 'bm-doc-8',
    title: 'Excalidraw Whiteboard',
    url: 'https://excalidraw.com/',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['diagrams', 'whiteboard', 'sketch', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%236366f1%22/%3E%3Cpath d=%22M20 42 L42 20 M24 20 H42 V38%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%224%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Hand-drawn style system architecture whiteboard.'
  },
  {
    id: 'bm-doc-9',
    title: 'Adobe Acrobat Online',
    url: 'https://acrobat.adobe.com/?x_api_client_id=bookmark&x_api_client_location=Reader',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['pdf', 'adobe', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Adobe Acrobat online PDF viewer and editor.'
  },
  {
    id: 'bm-doc-10',
    title: 'Gmail',
    url: 'https://accounts.google.com/b/0/AddMailService',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['email', 'google', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Google Mail inbox.'
  },
  {
    id: 'bm-doc-11',
    title: 'Outlook Mail & Calendar',
    url: 'https://outlook.live.com/owa/',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['email', 'microsoft', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230078d4%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EO%3C/text%3E%3C/svg%3E',
    notes: 'Microsoft Outlook personal email and calendar.'
  },
  {
    id: 'bm-doc-12',
    title: 'Blogger Theme Editor',
    url: 'https://www.blogger.com/u/1/blog/themes/3716241569017463735',
    category: 'Workspace & Docs',
    folder: 'Bookmarks bar',
    tags: ['blog', 'theme', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23f57d00%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%228%22 fill=%22%23ffffff%22/%3E%3Crect x=%2223%22 y=%2224%22 width=%2210%22 height=%224%22 rx=%222%22 fill=%22%23f57d00%22/%3E%3Crect x=%2223%22 y=%2234%22 width=%2218%22 height=%224%22 rx=%222%22 fill=%22%23f57d00%22/%3E%3C/svg%3E',
    notes: 'Blogger custom HTML/XML theme configuration.'
  },

  // 6. Media & Entertainment (20)
  {
    id: 'bm-med-1',
    title: 'YouTube',
    url: 'https://www.youtube.com/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['video', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Active Tab',
    isTab: true,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'YouTube video home feed.'
  },
  {
    id: 'bm-med-2',
    title: 'YouTube Music',
    url: 'https://music.youtube.com/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['music', 'streaming', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2214%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3Cpolygon points=%2229,25 40,32 29,39%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'YouTube Music streaming player.'
  },
  {
    id: 'bm-med-3',
    title: 'Spotify Web Player',
    url: 'https://open.spotify.com/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['spotify', 'playlists', 'music', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231db954%22/%3E%3Cpath d=%22M20 25 Q32 21 45 26 M22 33 Q32 30 43 34 M24 41 Q32 39 40 42%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Spotify web music & podcast player.'
  },
  {
    id: 'bm-med-4',
    title: 'Disney+ Hotstar - Mahabharat Ep 1',
    url: 'https://www.hotstar.com/in/tv/mahabharat/435/list/episodes/t-1_2_28',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['hotstar', 'mahabharat', 'series', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230f172a%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%2338bdf8%22 font-family=%22sans-serif%22 font-size=%2222%22 font-weight=%22bold%22%3ED+%3C/text%3E%3C/svg%3E',
    notes: 'Mahabharat TV series episodes on Hotstar.'
  },
  {
    id: 'bm-med-5',
    title: 'Mahabharat All Seasons',
    url: 'https://mwslbd.blogspot.com/2021/07/mahabharat-2013-2014-tv-serial-all.html',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['series', 'archive', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23f57d00%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EB%3C/text%3E%3C/svg%3E',
    notes: 'Mahabharat (2013–2014) full episode index.'
  },
  {
    id: 'bm-med-6',
    title: '1Max Live Sports Stream',
    url: 'https://1max.top/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['wwe', 'sports', 'live', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23e11d48%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3E1M%3C/text%3E%3C/svg%3E',
    notes: 'WWE Raw, SmackDown & PPV live streaming portal.'
  },
  {
    id: 'bm-med-7',
    title: 'WWE Backlash 2026 Live',
    url: 'https://1max.top/watch-wwe-backlash-2026-ppv-live-5-9-26-may-9th-2026-online-full-show-free/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['wwe', 'backlash-2026', 'ppv', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23e11d48%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2220%22 font-weight=%22bold%22%3E1M%3C/text%3E%3C/svg%3E',
    notes: 'WWE Backlash 2026 PPV replay/stream.'
  },
  {
    id: 'bm-med-8',
    title: 'WWE 2K25 Universal Title Match',
    url: 'https://www.youtube.com/watch?v=mum_Yz1fjZo&list=PL-wqt8rtEpP_4vJJXGlQ5EMg2qycqhMyQ&index=141',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['wwe-2k25', 'gaming', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Roman vs Rey vs Cody WWE 2K25 match.'
  },
  {
    id: 'bm-med-9',
    title: 'Training an Unbeatable AI in Trackmania',
    url: 'https://www.youtube.com/watch?v=Dw3BZ6O_8LY',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['reinforcement-learning', 'ai', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Deep reinforcement learning racing AI breakdown.'
  },
  {
    id: 'bm-med-10',
    title: 'Handle 1 Million Requests/Sec',
    url: 'https://www.youtube.com/watch?v=W4EwfEU8CGA',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['system-design', 'scaling', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'High-throughput distributed system architecture video.'
  },
  {
    id: 'bm-med-11',
    title: '10 Cybersecurity Projects',
    url: 'https://www.youtube.com/watch?v=XvHi5aJmGpc',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['cybersecurity', 'projects', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Hands-on cybersecurity portfolio project ideas.'
  },
  {
    id: 'bm-med-12',
    title: 'How Real Hackers Think 2026',
    url: 'https://www.youtube.com/watch?v=9CVEuHT-H2U',
    category: 'Media & Entertainment',
    folder: 'Courses',
    tags: ['ethical-hacking', 'security', 'courses'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Ethical hacking mindset and security breakdown.'
  },
  {
    id: 'bm-med-13',
    title: 'The Only SQL Roadmap You Need',
    url: 'https://www.youtube.com/shorts/grFLGgArdd4',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['sql', 'roadmap', 'shorts', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Quick SQL learning roadmap YouTube Short.'
  },
  {
    id: 'bm-med-14',
    title: 'FAANG LinkedIn & GitHub Guide',
    url: 'https://www.youtube.com/shorts/wwlwD69kbBs?si=1MJQCj7j-meYm6vy',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['linkedin', 'github', 'career', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Optimizing LinkedIn & GitHub profiles for tech roles.'
  },
  {
    id: 'bm-med-15',
    title: '7 Principles For Teenagers',
    url: 'https://www.youtube.com/watch?v=1-izXBhkiHw',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['finance', 'mindset', 'youtube', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Personal finance & wealth building principles.'
  },
  {
    id: 'bm-med-16',
    title: 'Important NTA News',
    url: 'https://www.youtube.com/watch?v=psXoGdPuKbI',
    category: 'Media & Entertainment',
    folder: 'Homey Bookmarks',
    tags: ['nta', 'exam-news', 'homey-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff0000%22/%3E%3Cpolygon points=%2226,20 46,32 26,44%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'NTA exam schedule update.'
  },
  {
    id: 'bm-med-17',
    title: 'NXP Keynote Computex 2024',
    url: 'https://www.nxp.com/company/about-nxp/smarter-world-videos/LARS-REGER-KEYNOTE-COMPUTEX-2024',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['nxp', 'semiconductors', 'keynote', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23eab308%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%230f172a%22 font-family=%22sans-serif%22 font-size=%2219%22 font-weight=%22bold%22%3ENXP%3C/text%3E%3C/svg%3E',
    notes: 'CTO Lars Reger Computex 2024 embedded systems keynote.'
  },
  {
    id: 'bm-med-18',
    title: 'Instagram',
    url: 'https://www.instagram.com/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['social', 'instagram', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23e1306c%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%228%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%227%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22/%3E%3C/svg%3E',
    notes: 'Instagram social feed.'
  },
  {
    id: 'bm-med-19',
    title: 'Pixabay Free Stock Media',
    url: 'https://pixabay.com/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['images', 'stock-photos', 'assets', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2300ab6c%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EP%3C/text%3E%3C/svg%3E',
    notes: 'Royalty-free stock images, vectors, and videos.'
  },
  {
    id: 'bm-med-20',
    title: 'Filmypunjab Streaming',
    url: 'https://111.90.151.26/',
    category: 'Media & Entertainment',
    folder: 'Bookmarks bar',
    tags: ['movies', 'streaming', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Regional movies streaming mirror.'
  },

  // 7. Shopping & Utilities (15)
  {
    id: 'bm-utl-1',
    title: 'Google Search',
    url: 'https://www.google.com/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['search', 'google', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e293b%22/%3E%3Ctext x=%2232%22 y=%2242%22 text-anchor=%22middle%22 fill=%22%234285f4%22 font-family=%22sans-serif%22 font-size=%2228%22 font-weight=%22bold%22%3EG%3C/text%3E%3C/svg%3E',
    notes: 'Google Search homepage.'
  },
  {
    id: 'bm-utl-2',
    title: 'Google Maps',
    url: 'https://maps.google.com/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['navigation', 'maps', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2316a34a%22/%3E%3Ccircle cx=%2232%22 cy=%2228%22 r=%229%22 fill=%22%23ffffff%22/%3E%3Cpath d=%22M23 31 L32 50 L41 31%22 fill=%22%23ea4335%22/%3E%3C/svg%3E',
    notes: 'Google Maps directions and local search.'
  },
  {
    id: 'bm-utl-3',
    title: 'Google Translate',
    url: 'https://translate.google.com/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['translate', 'languages', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%234285f4%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3E%E6%96%87A%3C/text%3E%3C/svg%3E',
    notes: 'Instant multilingual text & document translation.'
  },
  {
    id: 'bm-utl-4',
    title: 'Google News',
    url: 'https://news.google.com/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['news', 'headlines', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%232563eb%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2228%22 height=%2228%22 rx=%224%22 fill=%22%23ffffff%22/%3E%3Cline x1=%2223%22 y1=%2226%22 x2=%2241%22 y2=%2226%22 stroke=%22%232563eb%22 stroke-width=%223%22/%3E%3C/svg%3E',
    notes: 'Curated top headlines and tech news.'
  },
  {
    id: 'bm-utl-5',
    title: 'IRCTC Train Booking',
    url: 'https://www.irctc.co.in/nget/booking/train-list',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['travel', 'trains', 'irctc', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e3a8a%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2216%22 font-weight=%22bold%22%3EIRCTC%3C/text%3E%3C/svg%3E',
    notes: 'Indian Railways ticket reservation portal.'
  },
  {
    id: 'bm-utl-6',
    title: 'Amazon - iPhone 16 256GB Pink',
    url: 'https://www.amazon.in/iPhone-16-256-GB-Control/dp/B0DGJ6CMJK?th=1',
    category: 'Shopping & Utilities',
    folder: 'Shopping list',
    tags: ['amazon', 'iphone-16', 'shopping-list'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23131921%22/%3E%3Ctext x=%2232%22 y=%2239%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3Ea%3C/text%3E%3Cpath d=%22M20 45 Q32 52 45 44%22 fill=%22none%22 stroke=%22%23ff9900%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Apple iPhone 16 256 GB with Camera Control.'
  },
  {
    id: 'bm-utl-7',
    title: 'Amazon - HP Laptop 15 Ryzen 5',
    url: 'https://www.amazon.in/HP-RyzenTM-15-6-inch-Speakers-15s-fc0155AU/dp/B0CY2R1G3G',
    category: 'Shopping & Utilities',
    folder: 'Other Bookmarks',
    tags: ['amazon', 'laptop', 'hp', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23131921%22/%3E%3Ctext x=%2232%22 y=%2239%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3Ea%3C/text%3E%3Cpath d=%22M20 45 Q32 52 45 44%22 fill=%22none%22 stroke=%22%23ff9900%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'HP Laptop 15, AMD Ryzen 5 7520U, 8GB LPDDR5, 512GB SSD.'
  },
  {
    id: 'bm-utl-8',
    title: 'Amazon - Fastrack Analog Watch',
    url: 'https://www.amazon.in/Fastrack-Analog-Black-Unisex-Adult-Watch-68012PP15/dp/B099WS3123',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['amazon', 'watch', 'fastrack', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23131921%22/%3E%3Ctext x=%2232%22 y=%2239%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3Ea%3C/text%3E%3Cpath d=%22M20 45 Q32 52 45 44%22 fill=%22none%22 stroke=%22%23ff9900%22 stroke-width=%223.5%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
    notes: 'Fastrack Fastfit Quartz Analog Black Dial Watch.'
  },
  {
    id: 'bm-utl-9',
    title: 'Telegram DISC Group',
    url: 'https://t.me/joinchat/xoDtXHUbJg4zYzVl',
    category: 'Shopping & Utilities',
    folder: 'Other Bookmarks',
    tags: ['telegram', 'community', 'other-bookmarks'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Telegram DISC discussion channel invite.'
  },
  {
    id: 'bm-utl-10',
    title: 'LIC Branch Locator',
    url: 'https://licindia.in/branch',
    category: 'Shopping & Utilities',
    folder: 'INTERSHIPS',
    tags: ['lic', 'insurance', 'utility', 'interships'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%231e3a8a%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23facc15%22 font-family=%22sans-serif%22 font-size=%2222%22 font-weight=%22bold%22%3ELIC%3C/text%3E%3C/svg%3E',
    notes: 'Official Life Insurance Corporation branch directory.'
  },
  {
    id: 'bm-utl-11',
    title: 'Gloom Dark Mode Edge Addon',
    url: 'https://microsoftedge.microsoft.com/addons/detail/gloom-dark-mode/iihanogagknkjpffdmpabnihohdghekn',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['edge', 'dark-mode', 'extension', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230078d7%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3EED%3C/text%3E%3C/svg%3E',
    notes: 'Microsoft Edge dark mode browser extension.'
  },
  {
    id: 'bm-utl-12',
    title: 'Windows Desktop Themes',
    url: 'https://support.microsoft.com/en-gb/windows/desktop-themes-94880287-6046-1d35-6d2f-35dee759701e',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['windows', 'themes', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%2300a4ef%22/%3E%3Crect x=%2218%22 y=%2218%22 width=%2213%22 height=%2213%22 fill=%22%23ffffff%22/%3E%3Crect x=%2233%22 y=%2218%22 width=%2213%22 height=%2213%22 fill=%22%23ffffff%22/%3E%3Crect x=%2218%22 y=%2233%22 width=%2213%22 height=%2213%22 fill=%22%23ffffff%22/%3E%3Crect x=%2233%22 y=%2233%22 width=%2213%22 height=%2213%22 fill=%22%23ffffff%22/%3E%3C/svg%3E',
    notes: 'Official Microsoft Windows desktop personalization themes.'
  },
  {
    id: 'bm-utl-13',
    title: 'Mirroring App Local Server',
    url: 'http://10.42.0.10:2944/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['lan', 'screen-mirror', 'local', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Local hotspot screen mirroring web server.'
  },
  {
    id: 'bm-utl-14',
    title: 'Library Genesis Mirror',
    url: 'http://93.174.95.27/',
    category: 'Shopping & Utilities',
    folder: 'Bookmarks bar',
    tags: ['ebooks', 'reference', 'mirror', 'bookmarks-bar'],
    lastVisited: 'Saved',
    isTab: false,
    notes: 'Academic textbook & paper search mirror.'
  },
  {
    id: 'bm-utl-15',
    title: 'Firefox Support & Add-ons',
    url: 'https://support.mozilla.org/products/firefox',
    category: 'Shopping & Utilities',
    folder: 'Mozilla Firefox',
    tags: ['firefox', 'browser', 'mozilla-firefox'],
    lastVisited: 'Saved',
    isTab: false,
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23ff7139%22/%3E%3Ccircle cx=%2232%22 cy=%2232%22 r=%2214%22 fill=%22%23ff9400%22/%3E%3Ccircle cx=%2235%22 cy=%2230%22 r=%226%22 fill=%22%233b1d82%22/%3E%3C/svg%3E',
    notes: 'Mozilla Firefox documentation & customization guides.'
  }
];

const SIMULATED_OPEN_TABS = [
  {
    title: 'WebGPU Fundamentals — Compute Shaders',
    url: 'https://webgpufundamentals.org/',
    category: 'Coding & DSA',
    folder: 'Active Session',
    tags: ['webgpu', 'shaders', 'gpu'],
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230284c7%22/%3E%3Cpolygon points=%2232,16 46,42 18,42%22 fill=%22none%22 stroke=%22%23ffffff%22 stroke-width=%223.5%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E',
    notes: 'Captured from Active Browser Window #1'
  },
  {
    title: 'Anthropic Research — Interpretability',
    url: 'https://www.anthropic.com/research',
    category: 'AI & LLMs',
    folder: 'Active Session',
    tags: ['safety', 'mechanistic', 'ai'],
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23d97757%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2226%22 font-weight=%22bold%22%3EA%3C/text%3E%3C/svg%3E',
    notes: 'Captured from Active Browser Window #1'
  },
  {
    title: 'NPTEL Digital Signal Processing',
    url: 'https://nptel.ac.in/courses/',
    category: 'Academics & Exams',
    folder: 'Active Session',
    tags: ['dsp', 'nptel', 'lecture'],
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%23b91c1c%22/%3E%3Ctext x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2217%22 font-weight=%22bold%22%3ENPTEL%3C/text%3E%3C/svg%3E',
    notes: 'Captured from Active Browser Window #1'
  },
  {
    title: 'LinkedIn Jobs — Software Engineering Intern',
    url: 'https://www.linkedin.com/jobs/',
    category: 'Career & Jobs',
    folder: 'Active Session',
    tags: ['jobs', 'internship', 'swe'],
    iconDataUrl: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2216%22 fill=%22%230a66c2%22/%3E%3Ctext x=%2232%22 y=%2241%22 text-anchor=%22middle%22 fill=%22%23ffffff%22 font-family=%22sans-serif%22 font-size=%2224%22 font-weight=%22bold%22%3Ein%3C/text%3E%3C/svg%3E',
    notes: 'Captured from Active Browser Window #1'
  }
];

const STORAGE_KEY = 'aether_bookmarks_v3';

// ============================================================================
// APP / SITE ICON RESOLVER & CACHE
// ============================================================================

const iconImageCache = new Map();

function getFallbackFaviconUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(
        parsed.hostname
      )}`;
    }
  } catch {
    // Non-HTTP(S) URLs fall back directly to monogram badge
  }
  return null;
}

function getBestIconSrc(bookmark) {
  if (bookmark?.iconDataUrl && bookmark.iconDataUrl.trim() !== '') {
    return bookmark.iconDataUrl.trim();
  }
  return getFallbackFaviconUrl(bookmark?.url || '');
}

function loadIconImage(src) {
  if (!src) return Promise.resolve(null);
  if (iconImageCache.has(src)) {
    return iconImageCache.get(src);
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  iconImageCache.set(src, promise);
  return promise;
}

function AppIconBadge({ bookmark, sizeClass = 'w-8 h-8', roundedClass = 'rounded-xl' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const primarySrc = getBestIconSrc(bookmark);
  const fallbackFavicon = getFallbackFaviconUrl(bookmark?.url || '');
  const [activeSrc, setActiveSrc] = useState(primarySrc);

  useEffect(() => {
    setImgFailed(false);
    setActiveSrc(getBestIconSrc(bookmark));
  }, [bookmark?.id, bookmark?.iconDataUrl, bookmark?.url]);

  const catColor = CATEGORIES[bookmark?.category]?.color || '#38bdf8';
  let initial = 'W';
  try {
    const host = new URL(bookmark?.url || '').hostname.replace(/^www\./, '');
    initial = (host || bookmark?.title || 'W').charAt(0).toUpperCase();
  } catch {
    initial = (bookmark?.title || 'W').charAt(0).toUpperCase();
  }

  const handleError = () => {
    if (
      fallbackFavicon &&
      activeSrc !== fallbackFavicon &&
      !activeSrc?.startsWith('https://www.google.com/s2/favicons')
    ) {
      setActiveSrc(fallbackFavicon);
    } else {
      setImgFailed(true);
    }
  };

  if (!activeSrc || imgFailed) {
    return (
      <div
        className={`${sizeClass} ${roundedClass} flex items-center justify-center font-bold text-white text-xs shrink-0 border border-white/15`}
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          boxShadow: `0 0 12px ${catColor}33`
        }}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${roundedClass} bg-slate-950/90 border border-slate-700/70 flex items-center justify-center overflow-hidden shrink-0 shadow-sm`}
    >
      <img
        src={activeSrc}
        alt={bookmark?.title || 'App icon'}
        crossOrigin="anonymous"
        onError={handleError}
        className="w-full h-full object-contain p-1"
      />
    </div>
  );
}

// ============================================================================
// NETSCAPE BOOKMARK HTML PARSER & AUTO-CATEGORIZER
// ============================================================================

function autoCategorizeUrl(url, title, folderPath) {
  const text = `${url} ${title} ${folderPath}`.toLowerCase();

  if (
    /openai|chatgpt|gemini|claude|deepseek|kimi|huggingface|aistudio|stitch\.withgoogle|labs\.google|prism\.openai|tubeonai|pica-ai|gamma\.app|\bai\b|\bllm\b/.test(
      text
    )
  ) {
    return 'AI & LLMs';
  }
  if (
    /github|geeksforgeeks|takeuforward|striver|hackerrank|sql|w3schools|w3resource|freecodecamp|replit|quickref|codedamn|dev\.java|uiverse|free-apis|tpointtech|open-vsx|kaggle|colab|wesmckinney|clauswilke|jeroenjanssens|\bdsa\b|programming/.test(
      text
    )
  ) {
    return 'Coding & DSA';
  }
  if (
    /vnit|nptel|swayam|cs50|gate|examgoal|2iim|indiabix|allen|quizrr|semester|sem|fee|bhilai|matlab|enggroom|probability4datascience|calculus|pourbaix|course/.test(
      text
    )
  ) {
    return 'Academics & Exams';
  }
  if (
    /superset|placment|placement|freejobalert|psc\.cg|digialm|ceeri|zohorecruit|myworkdayjobs|nvidia|rubrik|jpmorgan|recruit|remotive|jobscan|nism|sebi|resume|cover-letter|intern/.test(
      text
    )
  ) {
    return 'Career & Jobs';
  }
  if (
    /overleaf|drive\.google|docs\.google|onedrive|quadratichq|excalidraw|acrobat|addmailservice|gmail|outlook|blogger/.test(
      text
    )
  ) {
    return 'Workspace & Docs';
  }
  if (
    /youtube|spotify|hotstar|mahabharat|1max|wwe|instagram|pixabay|filmypunjab|111\.90\.151\.26|nxp\.com.*video|keynote/.test(
      text
    )
  ) {
    return 'Media & Entertainment';
  }
  return 'Shopping & Utilities';
}

function deriveCleanTitle(rawTitle, url) {
  const cleaned = (rawTitle || '').replace(/\s+/g, ' ').trim();
  if (cleaned && cleaned.length > 1 && !/^https?:\/\//i.test(cleaned)) {
    return cleaned.length > 72 ? cleaned.slice(0, 69) + '...' : cleaned;
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === '93.174.95.27') return 'Library Genesis Mirror';
    if (host === 'overleaf.com') return 'Overleaf LaTeX Editor';
    if (host === 'google.com') return 'Google Search';
    if (host === 'accounts.google.com') return 'Gmail';
    if (host === 'maps.google.com') return 'Google Maps';
    if (host === 'drive.google.com') return 'Google Drive';
    if (host === 'docs.google.com') return 'Google Workspace Doc';
    if (host === 'music.youtube.com') return 'YouTube Music';
    if (host === 'open.spotify.com') return 'Spotify Web Player';
    if (host === 'chat.openai.com') return 'ChatGPT';
    if (host === 'gemini.google.com') return 'Google Gemini';
    if (host === 'kimi.com') return 'Kimi AI';
    if (host === 'chat.deepseek.com') return 'DeepSeek Chat';
    if (host === 'claude.ai') return 'Claude AI';
    if (host === 'aistudio.google.com') return 'Google AI Studio';
    if (host === 'matlab.mathworks.com') return 'MATLAB Online';
    if (host === 'gamma.app') return 'Gamma AI Presentations';
    if (host === 'uiverse.io') return 'Uiverse.io UI Components';
    if (host === 'replit.com') return 'Replit';
    if (host === 'colab.research.google.com') return 'Google Colab Notebook';
    if (host === 'translate.google.com') return 'Google Translate';
    if (host === 'excalidraw.com') return 'Excalidraw Whiteboard';
    return host;
  } catch {
    return cleaned || url;
  }
}

function parseNetscapeBookmarksHTML(htmlContent) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const seenUrls = new Set();
  const results = [];

  function walkList(dlElement, folderStack) {
    if (!dlElement) return;
    const children = Array.from(dlElement.children);

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.tagName === 'DT') {
        const h3 = node.querySelector(':scope > H3');
        const anchor = node.querySelector(':scope > A');
        const nestedDl = node.querySelector(':scope > DL');

        if (h3) {
          const folderName = h3.textContent.trim();
          const nextStack = folderName ? [...folderStack, folderName] : folderStack;
          if (nestedDl) {
            walkList(nestedDl, nextStack);
          } else if (children[i + 1] && children[i + 1].tagName === 'DL') {
            walkList(children[i + 1], nextStack);
          }
        } else if (anchor) {
          const href = anchor.getAttribute('HREF') || anchor.getAttribute('href') || '';
          if (!href || href.startsWith('chrome://') || href.startsWith('javascript:')) continue;

          // Normalize URL for deduplication
          const normalizedKey = href.replace(/\/$/, '').toLowerCase();
          const iconAttr = (
            anchor.getAttribute('ICON') ||
            anchor.getAttribute('icon') ||
            ''
          ).trim();

          if (seenUrls.has(normalizedKey)) {
            const existing = results.find(
              (r) => r.url.replace(/\/$/, '').toLowerCase() === normalizedKey
            );
            if (existing && !existing.iconDataUrl && iconAttr) {
              existing.iconDataUrl = iconAttr;
            }
            continue;
          }
          seenUrls.add(normalizedKey);

          const rawText = anchor.textContent;
          const title = deriveCleanTitle(rawText, href);
          const immediateFolder =
            folderStack[folderStack.length - 1] || 'Bookmarks bar';
          const category = autoCategorizeUrl(href, title, folderStack.join(' '));

          const folderSlug = immediateFolder
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          let hostTag = 'web';
          try {
            hostTag = new URL(href).hostname.replace(/^www\./, '').split('.')[0];
          } catch {
            hostTag = 'link';
          }

          results.push({
            id: `bm-imp-${Date.now()}-${results.length}`,
            title,
            url: href,
            category,
            folder: immediateFolder,
            tags: Array.from(new Set([hostTag, folderSlug].filter(Boolean))),
            lastVisited: 'Imported',
            isTab: false,
            iconDataUrl: iconAttr || null,
            notes: `Imported from folder: ${folderStack.join(' › ') || 'Bookmarks bar'}`
          });
        }
      } else if (node.tagName === 'DL') {
        walkList(node, folderStack);
      }
    }
  }

  const rootDl = doc.querySelector('DL');
  walkList(rootDl, []);
  return results;
}

// ============================================================================
// HIGH-DPI CANVAS TEXTURE GENERATOR FOR 3D GLASSMORPHIC CARDS
// ============================================================================

function renderCardToCanvas(
  canvas,
  bookmark,
  isHighlighted,
  isSelected,
  loadedIconImg
) {
  const width = 512;
  const height = 300;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const catInfo = CATEGORIES[bookmark.category] || CATEGORIES['Coding & DSA'];
  const accentColor = catInfo.color;

  ctx.clearRect(0, 0, width, height);

  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const pad = 12;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;

  if (isSelected || isHighlighted) {
    ctx.save();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = isSelected ? 28 : 18;
    roundRect(pad, pad, cardW, cardH, 24);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();
    ctx.restore();
  }

  const bgGrad = ctx.createLinearGradient(pad, pad, width - pad, height - pad);
  if (isSelected) {
    bgGrad.addColorStop(0, 'rgba(30, 41, 59, 0.96)');
    bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');
  } else {
    bgGrad.addColorStop(0, 'rgba(17, 24, 39, 0.90)');
    bgGrad.addColorStop(1, 'rgba(9, 13, 22, 0.94)');
  }

  roundRect(pad, pad, cardW, cardH, 24);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  const sheenGrad = ctx.createLinearGradient(pad, pad, pad + 240, pad + 160);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.11)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  roundRect(pad, pad, cardW, cardH, 24);
  ctx.fillStyle = sheenGrad;
  ctx.fill();

  ctx.save();
  roundRect(pad, pad, cardW, cardH, 24);
  ctx.clip();
  ctx.fillStyle = accentColor;
  ctx.fillRect(pad, pad, cardW, 7);
  ctx.restore();

  roundRect(pad, pad, cardW, cardH, 24);
  ctx.lineWidth = isSelected ? 4 : isHighlighted ? 3 : 1.75;
  ctx.strokeStyle = isSelected
    ? '#ffffff'
    : isHighlighted
    ? accentColor
    : 'rgba(148, 163, 184, 0.28)';
  ctx.stroke();

  const headerY = 42;
  const iconBoxSize = 38;
  const iconBoxX = 28;
  const iconBoxY = headerY - 7;

  // Rounded-square app/site icon container badge
  roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 11);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.fill();
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  let domainInitial = 'W';
  try {
    const hostname = new URL(bookmark.url).hostname.replace('www.', '');
    domainInitial = (hostname || bookmark.title).charAt(0).toUpperCase();
  } catch {
    domainInitial = bookmark.title.charAt(0).toUpperCase();
  }

  if (loadedIconImg) {
    ctx.save();
    roundRect(iconBoxX + 4, iconBoxY + 4, iconBoxSize - 8, iconBoxSize - 8, 7);
    ctx.clip();
    ctx.drawImage(
      loadedIconImg,
      iconBoxX + 4,
      iconBoxY + 4,
      iconBoxSize - 8,
      iconBoxSize - 8
    );
    ctx.restore();
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      domainInitial,
      iconBoxX + iconBoxSize / 2,
      iconBoxY + iconBoxSize / 2 + 1
    );
  }

  ctx.textAlign = 'left';
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  const catText = bookmark.category.toUpperCase();
  const catTextW = ctx.measureText(catText).width;
  const badgeX = iconBoxX + iconBoxSize + 12;
  roundRect(badgeX, headerY - 2, catTextW + 20, 28, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.fillText(catText, badgeX + 10, headerY + 12);

  if (bookmark.isTab) {
    const tabLabel = '● LIVE TAB';
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    const tabW = ctx.measureText(tabLabel).width;
    const tabX = width - pad - tabW - 30;
    roundRect(tabX, headerY - 2, tabW + 18, 28, 14);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
    ctx.stroke();
    ctx.fillStyle = '#34d399';
    ctx.fillText(tabLabel, tabX + 9, headerY + 12);
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 23px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'top';

  const maxTextWidth = width - 64;
  const words = bookmark.title.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxTextWidth && currentLine) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const displayLines = lines.slice(0, 2);
  if (lines.length > 2) {
    displayLines[1] = displayLines[1].slice(0, Math.max(0, displayLines[1].length - 3)) + '...';
  }

  displayLines.forEach((line, idx) => {
    ctx.fillText(line, 32, 92 + idx * 32);
  });

  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 15px monospace';
  let cleanUrl = bookmark.url.replace(/^https?:\/\/(www\.)?/, '');
  if (cleanUrl.length > 42) cleanUrl = cleanUrl.slice(0, 40) + '...';
  ctx.fillText(cleanUrl, 32, 168);

  ctx.beginPath();
  ctx.moveTo(32, 206);
  ctx.lineTo(width - 32, 206);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  let tagX = 32;
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  const tagsToShow = (bookmark.tags || []).slice(0, 3);
  tagsToShow.forEach((tag) => {
    const label = `#${tag}`;
    const tw = ctx.measureText(label).width;
    if (tagX + tw + 18 < width - 135) {
      roundRect(tagX, 222, tw + 16, 26, 8);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fill();
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(label, tagX + 8, 228);
      tagX += tw + 22;
    }
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = '500 12px Inter, system-ui, sans-serif';
  ctx.fillText(bookmark.folder || bookmark.lastVisited || 'Saved', width - 32, 228);
}

function createBookmarkCardTexture(
  bookmark,
  isHighlighted,
  isDimmed,
  isSelected,
  onTextureUpdated
) {
  const canvas = document.createElement('canvas');
  const cachedEntry = iconImageCache.get(getBestIconSrc(bookmark) || '');
  const resolvedSyncImg =
    cachedEntry && typeof cachedEntry.then !== 'function' ? cachedEntry : null;

  renderCardToCanvas(canvas, bookmark, isHighlighted, isSelected, resolvedSyncImg);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const primarySrc = getBestIconSrc(bookmark);
  const fallbackSrc = getFallbackFaviconUrl(bookmark.url);

  if (primarySrc && !resolvedSyncImg) {
    loadIconImage(primarySrc).then((img) => {
      if (img) {
        renderCardToCanvas(canvas, bookmark, isHighlighted, isSelected, img);
        texture.needsUpdate = true;
        if (onTextureUpdated) onTextureUpdated();
      } else if (fallbackSrc && fallbackSrc !== primarySrc) {
        loadIconImage(fallbackSrc).then((fbImg) => {
          if (fbImg) {
            renderCardToCanvas(canvas, bookmark, isHighlighted, isSelected, fbImg);
            texture.needsUpdate = true;
            if (onTextureUpdated) onTextureUpdated();
          }
        });
      }
    });
  }

  return texture;
}

// ============================================================================
// LAYOUT POSITION CALCULATOR (SCALED FOR ~95 NODES)
// ============================================================================

function computeTargetPositions(bookmarks, layoutMode) {
  const positions = {};

  if (layoutMode === 'constellation') {
    const grouped = {};
    bookmarks.forEach((bm) => {
      if (!grouped[bm.category]) grouped[bm.category] = [];
      grouped[bm.category].push(bm);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      const catInfo = CATEGORIES[cat] || { center: new THREE.Vector3(0, 0, 0) };
      const center = catInfo.center;
      const count = items.length;

      items.forEach((item, idx) => {
        // Generous multi-shell Fibonacci sphere distribution around each cluster core
        const phi = Math.acos(1 - (2 * (idx + 0.5)) / Math.max(count, 1));
        const theta = Math.PI * (1 + Math.sqrt(5)) * idx;
        const shellTier = idx % 3;
        const radius = 5.4 + shellTier * 2.35 + Math.min(count * 0.08, 2.2);

        const x = center.x + radius * Math.sin(phi) * Math.cos(theta) * 1.3;
        const y = center.y + radius * Math.cos(phi) * 1.15;
        const z = center.z + radius * Math.sin(phi) * Math.sin(theta) * 1.25;

        positions[item.id] = new THREE.Vector3(x, y, z);
      });
    });
  } else if (layoutMode === 'helix') {
    const total = bookmarks.length;
    bookmarks.forEach((item, idx) => {
      const angle = idx * 0.52;
      const radius = 14.5;
      const y = (total / 2 - idx) * 0.72;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions[item.id] = new THREE.Vector3(x, y, z);
    });
  } else if (layoutMode === 'matrix') {
    const cols = 6;
    const spacingX = 5.4;
    const spacingY = 3.4;
    const totalRows = Math.ceil(bookmarks.length / cols);

    bookmarks.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const centeredCol = col - (cols - 1) / 2;
      const centeredRow = (totalRows - 1) / 2 - row;

      const x = centeredCol * spacingX;
      const y = centeredRow * spacingY;
      const z = -Math.abs(centeredCol) * 1.25 + 4;
      positions[item.id] = new THREE.Vector3(x, y, z);
    });
  }

  return positions;
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // Persistent Bookmark State (Fresh v2 key so imported HTML bookmarks load immediately)
  const [bookmarks, setBookmarks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read localStorage', e);
    }
    return INITIAL_BOOKMARKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('Could not persist bookmarks', e);
    }
  }, [bookmarks]);

  // UI & 3D Scene States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeFolder, setActiveFolder] = useState('All');
  const [layoutMode, setLayoutMode] = useState('constellation');
  const [selectedBookmarkId, setSelectedBookmarkId] = useState(null);
  const [hoveredBookmark, setHoveredBookmark] = useState(null);
  const [hoverScreenPos, setHoverScreenPos] = useState({ x: 0, y: 0 });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // File Input Ref for Netscape HTML Bookmark Upload
  const fileInputRef = useRef(null);

  // Add Bookmark Form State
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCategory, setNewCategory] = useState('Coding & DSA');
  const [newTags, setNewTags] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newIsTab, setNewIsTab] = useState(false);

  // Staged HTML Import Preview State
  const [stagedHtmlImport, setStagedHtmlImport] = useState(null);

  // Refs for Three.js scene management
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cardMeshesRef = useRef({});
  const clusterBeaconsRef = useRef({});
  const constellationLinesRef = useRef(null);
  const targetPositionsRef = useRef({});
  const bookmarksRef = useRef(bookmarks);
  const layoutModeRef = useRef(layoutMode);
  const selectedIdRef = useRef(selectedBookmarkId);
  const hoveredIdRef = useRef(null);

  // Custom Orbit Camera State (expanded radius for 7 constellations)
  const cameraStateRef = useRef({
    spherical: new THREE.Spherical(46, Math.PI / 2.25, 0.25),
    targetSpherical: new THREE.Spherical(46, Math.PI / 2.25, 0.25),
    lookAt: new THREE.Vector3(0, 0, 0),
    targetLookAt: new THREE.Vector3(0, 0, 0),
    isDragging: false,
    isPanning: false,
    prevMouse: { x: 0, y: 0 },
    dragDistance: 0,
    autoRotate: true
  });

  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);

  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  useEffect(() => {
    selectedIdRef.current = selectedBookmarkId;
  }, [selectedBookmarkId]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Extract unique folders from bookmarks
  const availableFolders = useMemo(() => {
    const counts = {};
    bookmarks.forEach((b) => {
      const f = b.folder || 'Bookmarks bar';
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [bookmarks]);

  // Compute matching bookmarks for search, category & folder filtering
  const matchingIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const set = new Set();
    bookmarks.forEach((bm) => {
      const matchesCat = activeCategory === 'All' || bm.category === activeCategory;
      const matchesFolder = activeFolder === 'All' || (bm.folder || 'Bookmarks bar') === activeFolder;
      const matchesQuery =
        !q ||
        bm.title.toLowerCase().includes(q) ||
        bm.url.toLowerCase().includes(q) ||
        bm.category.toLowerCase().includes(q) ||
        (bm.folder && bm.folder.toLowerCase().includes(q)) ||
        (bm.tags && bm.tags.some((t) => t.toLowerCase().includes(q)));
      if (matchesCat && matchesFolder && matchesQuery) {
        set.add(bm.id);
      }
    });
    return set;
  }, [bookmarks, searchQuery, activeCategory, activeFolder]);

  const selectedBookmark = useMemo(
    () => bookmarks.find((b) => b.id === selectedBookmarkId) || null,
    [bookmarks, selectedBookmarkId]
  );

  // Camera Fly-To Helper
  const flyCameraTo = useCallback((targetVec, distance = 22, theta = null, phi = null) => {
    const cam = cameraStateRef.current;
    cam.targetLookAt.copy(targetVec);
    cam.targetSpherical.radius = distance;
    if (theta !== null) cam.targetSpherical.theta = theta;
    if (phi !== null) cam.targetSpherical.phi = phi;
    cam.autoRotate = false;
  }, []);

  const resetCameraView = useCallback(() => {
    const cam = cameraStateRef.current;
    cam.targetLookAt.set(0, 0, 0);
    cam.targetSpherical.set(46, Math.PI / 2.25, 0.25);
    cam.autoRotate = true;
    setActiveCategory('All');
    setActiveFolder('All');
    setSelectedBookmarkId(null);
  }, []);

  // Handle Category Pill Selection -> Fly 3D Camera to Cluster
  const handleSelectCategory = (cat) => {
    setActiveCategory(cat);
    if (cat === 'All') {
      flyCameraTo(new THREE.Vector3(0, 0, 0), 46, 0.25, Math.PI / 2.25);
      cameraStateRef.current.autoRotate = true;
    } else if (layoutMode === 'constellation' && CATEGORIES[cat]) {
      const center = CATEGORIES[cat].center;
      const angle = Math.atan2(center.x, center.z);
      flyCameraTo(center, 22, angle, Math.PI / 2.2);
    } else {
      const firstInCat = bookmarks.find((b) => b.category === cat);
      if (firstInCat && targetPositionsRef.current[firstInCat.id]) {
        flyCameraTo(targetPositionsRef.current[firstInCat.id], 20);
      }
    }
  };

  // ============================================================================
  // THREE.JS INITIALIZATION & ANIMATION LOOP
  // ============================================================================

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07090f');
    scene.fog = new THREE.FogExp2('#07090f', 0.0085);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth / container.clientHeight,
      0.1,
      320
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight('#ffffff', 0.9);
    scene.add(ambientLight);

    const gridHelper = new THREE.GridHelper(130, 50, '#1e293b', '#0f172a');
    gridHelper.position.y = -22;
    scene.add(gridHelper);

    const starCount = 1800;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color('#38bdf8'),
      new THREE.Color('#a855f7'),
      new THREE.Color('#94a3b8'),
      new THREE.Color('#f43f5e'),
      new THREE.Color('#10b981'),
      new THREE.Color('#f59e0b')
    ];

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 180;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 140;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 180;

      const c = palette[Math.floor(Math.random() * palette.length)];
      starColors[i * 3] = c.r;
      starColors[i * 3 + 1] = c.g;
      starColors[i * 3 + 2] = c.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.32,
      vertexColors: true,
      transparent: true,
      opacity: 0.72
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    Object.entries(CATEGORIES).forEach(([catName, info]) => {
      const group = new THREE.Group();
      group.position.copy(info.center);

      const coreGeo = new THREE.SphereGeometry(0.55, 24, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color: info.color,
        transparent: true,
        opacity: 0.88
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      group.add(coreMesh);

      const ringGeo = new THREE.RingGeometry(1.4, 1.52, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: info.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.38
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2.4;
      group.add(ringMesh);

      scene.add(group);
      clusterBeaconsRef.current[catName] = group;
    });

    const lineGeo = new THREE.BufferGeometry();
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24
    });
    const constellationLines = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(constellationLines);
    constellationLinesRef.current = constellationLines;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-999, -999);

    const onPointerDown = (e) => {
      const cam = cameraStateRef.current;
      cam.isDragging = true;
      cam.isPanning = e.button === 2 || e.shiftKey;
      cam.prevMouse = { x: e.clientX, y: e.clientY };
      cam.dragDistance = 0;
      cam.autoRotate = false;
    };

    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      setHoverScreenPos({ x: e.clientX, y: e.clientY });

      const cam = cameraStateRef.current;
      if (!cam.isDragging) return;

      const dx = e.clientX - cam.prevMouse.x;
      const dy = e.clientY - cam.prevMouse.y;
      cam.dragDistance += Math.hypot(dx, dy);
      cam.prevMouse = { x: e.clientX, y: e.clientY };

      if (cam.isPanning) {
        const panSpeed = cam.targetSpherical.radius * 0.0012;
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        camera.getWorldDirection(up);
        right.crossVectors(up, camera.up).normalize();
        up.crossVectors(right, up).normalize();

        cam.targetLookAt.addScaledVector(right, -dx * panSpeed);
        cam.targetLookAt.addScaledVector(up, dy * panSpeed);
      } else {
        cam.targetSpherical.theta -= dx * 0.0065;
        cam.targetSpherical.phi = Math.max(
          0.25,
          Math.min(Math.PI - 0.25, cam.targetSpherical.phi - dy * 0.0065)
        );
      }
    };

    const onPointerUp = () => {
      const cam = cameraStateRef.current;
      const wasClick = cam.dragDistance < 6;
      cam.isDragging = false;
      cam.isPanning = false;

      if (wasClick && hoveredIdRef.current) {
        const clickedId = hoveredIdRef.current;
        setSelectedBookmarkId(clickedId);
        const mesh = cardMeshesRef.current[clickedId];
        if (mesh) {
          flyCameraTo(mesh.position.clone(), 12.5);
        }
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const cam = cameraStateRef.current;
      cam.autoRotate = false;
      cam.targetSpherical.radius = Math.max(
        7,
        Math.min(95, cam.targetSpherical.radius + e.deltaY * 0.02)
      );
    };

    const onContextMenu = (e) => e.preventDefault();

    const domElem = renderer.domElement;
    domElem.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    domElem.addEventListener('contextmenu', onContextMenu);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let animFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      const cam = cameraStateRef.current;
      if (cam.autoRotate && !cam.isDragging) {
        cam.targetSpherical.theta += 0.001;
      }

      cam.spherical.radius += (cam.targetSpherical.radius - cam.spherical.radius) * 0.08;
      cam.spherical.phi += (cam.targetSpherical.phi - cam.spherical.phi) * 0.08;
      cam.spherical.theta += (cam.targetSpherical.theta - cam.spherical.theta) * 0.08;
      cam.lookAt.lerp(cam.targetLookAt, 0.08);

      const offset = new THREE.Vector3().setFromSpherical(cam.spherical);
      camera.position.copy(cam.lookAt).add(offset);
      camera.lookAt(cam.lookAt);

      starField.rotation.y = elapsed * 0.012;

      const isConstellation = layoutModeRef.current === 'constellation';
      Object.values(clusterBeaconsRef.current).forEach((group, idx) => {
        group.visible = isConstellation;
        if (isConstellation) {
          group.rotation.y = elapsed * 0.5 + idx;
          group.children[1].rotation.z = elapsed * 0.8;
        }
      });

      const meshes = cardMeshesRef.current;
      const targets = targetPositionsRef.current;

      Object.entries(meshes).forEach(([id, mesh], idx) => {
        const target = targets[id];
        if (target) {
          const floatY = Math.sin(elapsed * 1.4 + idx * 0.7) * 0.16;
          const desiredPos = new THREE.Vector3(target.x, target.y + floatY, target.z);
          mesh.position.lerp(desiredPos, 0.075);
        }

        mesh.quaternion.slerp(camera.quaternion, 0.12);

        const isHovered = hoveredIdRef.current === id;
        const isSelected = selectedIdRef.current === id;
        const targetScale = isSelected ? 1.18 : isHovered ? 1.1 : 1.0;
        mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      });

      if (constellationLinesRef.current) {
        const linePositions = [];
        const lineColors = [];
        const currentBookmarks = bookmarksRef.current;

        if (layoutModeRef.current === 'constellation') {
          currentBookmarks.forEach((bm) => {
            const mesh = meshes[bm.id];
            const catInfo = CATEGORIES[bm.category];
            if (mesh && catInfo) {
              const c = new THREE.Color(catInfo.color);
              linePositions.push(mesh.position.x, mesh.position.y, mesh.position.z);
              linePositions.push(catInfo.center.x, catInfo.center.y, catInfo.center.z);
              lineColors.push(c.r, c.g, c.b, c.r * 0.35, c.g * 0.35, c.b * 0.35);
            }
          });
        } else if (layoutModeRef.current === 'helix') {
          for (let i = 0; i < currentBookmarks.length - 1; i++) {
            const m1 = meshes[currentBookmarks[i].id];
            const m2 = meshes[currentBookmarks[i + 1].id];
            if (m1 && m2) {
              const c = new THREE.Color('#38bdf8');
              linePositions.push(m1.position.x, m1.position.y, m1.position.z);
              linePositions.push(m2.position.x, m2.position.y, m2.position.z);
              lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
            }
          }
        }

        const geo = constellationLinesRef.current.geometry;
        geo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        geo.computeBoundingSphere();
      }

      raycaster.setFromCamera(pointer, camera);
      const meshArray = Object.values(meshes);
      const intersects = raycaster.intersectObjects(meshArray, false);

      if (intersects.length > 0 && !cam.isDragging) {
        const hitMesh = intersects[0].object;
        const hitId = hitMesh.userData.bookmarkId;
        if (hoveredIdRef.current !== hitId) {
          hoveredIdRef.current = hitId;
          const found = bookmarksRef.current.find((b) => b.id === hitId);
          setHoveredBookmark(found || null);
          document.body.style.cursor = 'pointer';
        }
      } else if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        setHoveredBookmark(null);
        document.body.style.cursor = 'default';
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animFrameId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElem.removeEventListener('wheel', onWheel);
      domElem.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', handleResize);
      document.body.style.cursor = 'default';
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
      renderer.dispose();
    };
  }, [flyCameraTo]);

  // ============================================================================
  // SYNC BOOKMARKS, FILTERS & LAYOUTS WITH 3D CARD MESHES
  // ============================================================================

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    targetPositionsRef.current = computeTargetPositions(bookmarks, layoutMode);

    const existingMeshes = cardMeshesRef.current;
    const currentIds = new Set(bookmarks.map((b) => b.id));

    Object.keys(existingMeshes).forEach((id) => {
      if (!currentIds.has(id)) {
        const mesh = existingMeshes[id];
        scene.remove(mesh);
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
        mesh.geometry.dispose();
        delete existingMeshes[id];
      }
    });

    const hasActiveFilter =
      searchQuery.trim() !== '' || activeCategory !== 'All' || activeFolder !== 'All';

    bookmarks.forEach((bm) => {
      const isMatch = matchingIds.has(bm.id);
      const isSelected = selectedBookmarkId === bm.id;
      const isHighlighted = hasActiveFilter && isMatch;
      const isDimmed = hasActiveFilter && !isMatch;

      const newTexture = createBookmarkCardTexture(
        bm,
        isHighlighted,
        isDimmed,
        isSelected,
        () => {
          const targetMesh = cardMeshesRef.current[bm.id];
          if (targetMesh && targetMesh.material) {
            targetMesh.material.needsUpdate = true;
          }
        }
      );

      if (!existingMeshes[bm.id]) {
        const geometry = new THREE.PlaneGeometry(4.2, 2.46);
        const material = new THREE.MeshBasicMaterial({
          map: newTexture,
          transparent: true,
          opacity: isDimmed ? 0.16 : 1.0,
          side: THREE.DoubleSide,
          depthWrite: !isDimmed
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { bookmarkId: bm.id };

        const target = targetPositionsRef.current[bm.id] || new THREE.Vector3(0, 0, 0);
        mesh.position.copy(target).add(new THREE.Vector3(0, -4, 0));

        scene.add(mesh);
        existingMeshes[bm.id] = mesh;
      } else {
        const mesh = existingMeshes[bm.id];
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.map = newTexture;
        mesh.material.opacity = isDimmed ? 0.16 : 1.0;
        mesh.material.depthWrite = !isDimmed;
        mesh.material.needsUpdate = true;
      }
    });
  }, [
    bookmarks,
    layoutMode,
    matchingIds,
    searchQuery,
    activeCategory,
    activeFolder,
    selectedBookmarkId
  ]);

  // ============================================================================
  // USER ACTIONS (IMPORT HTML, ADD, CAPTURE TABS, MOVE CATEGORY, DELETE)
  // ============================================================================

  const handleHtmlFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const htmlText = event.target?.result;
        if (typeof htmlText !== 'string') return;

        const parsedBookmarks = parseNetscapeBookmarksHTML(htmlText);
        if (parsedBookmarks.length === 0) {
          showToast('No valid bookmarks found in the selected HTML file.');
          return;
        }

        const existingUrls = new Set(
          bookmarks.map((b) => b.url.replace(/\/$/, '').toLowerCase())
        );
        const freshItems = parsedBookmarks.filter(
          (item) => !existingUrls.has(item.url.replace(/\/$/, '').toLowerCase())
        );

        setStagedHtmlImport({
          fileName: file.name,
          totalParsed: parsedBookmarks.length,
          freshItems,
          duplicateCount: parsedBookmarks.length - freshItems.length
        });
        setIsAddModalOpen(true);
      } catch (err) {
        console.error('Bookmark HTML parse error:', err);
        showToast('Failed to parse HTML file. Ensure it is a Netscape Bookmark export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmStagedHtmlImport = () => {
    if (!stagedHtmlImport) return;
    const { freshItems, duplicateCount, totalParsed } = stagedHtmlImport;

    if (freshItems.length === 0) {
      showToast(`All ${totalParsed} bookmarks are already in your 3D space!`);
    } else {
      setBookmarks((prev) => [...freshItems, ...prev]);
      showToast(
        `Imported ${freshItems.length} new bookmarks (${duplicateCount} duplicates skipped)`
      );
      resetCameraView();
    }
    setStagedHtmlImport(null);
    setIsAddModalOpen(false);
  };

  const handleAddBookmark = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;

    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const parsedTags = newTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const created = {
      id: `bm-${Date.now()}`,
      title: newTitle.trim(),
      url: formattedUrl,
      category: newCategory,
      folder: 'Custom Node',
      tags: parsedTags.length > 0 ? parsedTags : [newCategory.toLowerCase().split(' ')[0]],
      lastVisited: newIsTab ? 'Active Tab' : 'Just saved',
      isTab: newIsTab,
      iconDataUrl: getFallbackFaviconUrl(formattedUrl),
      notes: newNotes.trim() || 'Added to spatial workspace.'
    };

    setBookmarks((prev) => [created, ...prev]);
    setNewTitle('');
    setNewUrl('');
    setNewTags('');
    setNewNotes('');
    setNewIsTab(false);
    setIsAddModalOpen(false);
    setSelectedBookmarkId(created.id);
    showToast(`Added "${created.title}" to ${created.category}`);
  };

  const handleCaptureOpenTabs = () => {
    const timestamp = Date.now();
    const imported = SIMULATED_OPEN_TABS.map((tab, idx) => ({
      ...tab,
      id: `bm-tab-${timestamp}-${idx}`,
      lastVisited: 'Captured just now',
      isTab: true
    }));

    setBookmarks((prev) => [...imported, ...prev]);
    setIsAddModalOpen(false);
    showToast(`Captured ${imported.length} open browser tabs into 3D space`);
  };

  const handleMoveCategory = (id, targetCategory) => {
    setBookmarks((prev) =>
      prev.map((bm) => (bm.id === id ? { ...bm, category: targetCategory } : bm))
    );
    showToast(`Moved node to ${targetCategory}`);
  };

  const handleDeleteBookmark = (id) => {
    const target = bookmarks.find((b) => b.id === id);
    setBookmarks((prev) => prev.filter((bm) => bm.id !== id));
    if (selectedBookmarkId === id) setSelectedBookmarkId(null);
    if (target) showToast(`Removed "${target.title}"`);
  };

  const handleResetDemoData = () => {
    setBookmarks(INITIAL_BOOKMARKS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_BOOKMARKS));
    resetCameraView();
    showToast(`Restored all ${INITIAL_BOOKMARKS.length} bookmarks from bookmarks_11_23_26.html`);
  };

  const activeTabCount = useMemo(
    () => bookmarks.filter((b) => b.isTab).length,
    [bookmarks]
  );

  // ============================================================================
  // RENDER UI & 3D CANVAS OVERLAY
  // ============================================================================

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090f] text-slate-100 font-sans select-none">
      {/* Hidden File Input for Direct Netscape Bookmark HTML Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm"
        onChange={handleHtmlFileUpload}
        className="hidden"
      />

      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Subtle Radial Vignette for Depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 58%, rgba(4, 6, 12, 0.74) 100%)'
        }}
      />

      {/* =====================================================================
          TOP GLASSMORPHIC HUD BAR (Search, Import HTML, Clusters, Layouts)
         ===================================================================== */}
      <header className="relative z-20 flex flex-col gap-2.5 p-4 md:px-6 md:pt-4 pointer-events-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Live Session Pill */}
          <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 px-4 py-2 rounded-2xl shadow-2xl">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-purple-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
                AETHER<span className="text-sky-400 font-normal">SPACE</span>
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/30">
                  3D OS
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-2">
                <span>{bookmarks.length} Nodes</span>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {activeTabCount} Active Tabs
                </span>
              </p>
            </div>
          </div>

          {/* Real-time Search Input + Folder Filter */}
          <div className="pointer-events-auto flex-1 max-w-xl min-w-[260px] flex items-center gap-2">
            <div className="relative flex-1 group">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 group-focus-within:text-sky-400 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 105+ bookmarks, domains, folders, #tags..."
                className="w-full bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 focus:border-sky-400/70 rounded-2xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-slate-400 outline-none shadow-xl transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Folder Hierarchy Selector */}
            <select
              value={activeFolder}
              onChange={(e) => setActiveFolder(e.target.value)}
              className="hidden lg:block bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 focus:border-sky-400/70 rounded-2xl px-3 py-2.5 text-xs text-slate-200 outline-none shadow-xl max-w-[175px] truncate"
              title="Filter by Bookmark Folder"
            >
              <option value="All">All Folders ({bookmarks.length})</option>
              {availableFolders.map(([folderName, count]) => (
                <option key={folderName} value={folderName}>
                  📁 {folderName} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Layout Mode Switcher, Import HTML & Add Action */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* 3D Layout Toggle */}
            <div className="flex items-center bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 p-1 rounded-2xl shadow-xl">
              <button
                onClick={() => setLayoutMode('constellation')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  layoutMode === 'constellation'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Category Constellations"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Constellations</span>
              </button>

              <button
                onClick={() => setLayoutMode('helix')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  layoutMode === 'helix'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="3D Helix Stream"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Helix</span>
              </button>

              <button
                onClick={() => setLayoutMode('matrix')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  layoutMode === 'matrix'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid Matrix Wall"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Matrix</span>
              </button>
            </div>

            {/* Direct Netscape HTML Importer Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-slate-900/85 hover:bg-slate-800 backdrop-blur-xl border border-sky-400/40 text-sky-300 hover:text-white font-semibold text-xs px-3.5 py-2.5 rounded-2xl shadow-lg transition-all active:scale-95"
              title="Upload Chrome/Edge/Firefox Netscape Bookmark HTML file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import HTML</span>
            </button>

            {/* Add / Capture Tabs Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs px-3.5 py-2.5 rounded-2xl shadow-lg shadow-sky-500/25 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Node</span>
            </button>
          </div>
        </div>

        {/* 7-Category Constellation Filter & Camera Fly-To Pills */}
        <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleSelectCategory('All')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-xl border transition-all whitespace-nowrap ${
              activeCategory === 'All'
                ? 'bg-white/15 text-white border-white/40 shadow-lg'
                : 'bg-slate-900/65 text-slate-400 border-slate-700/60 hover:text-white hover:border-slate-500'
            }`}
          >
            All Clusters ({bookmarks.length})
          </button>

          {Object.entries(CATEGORIES).map(([catName, info]) => {
            const count = bookmarks.filter((b) => b.category === catName).length;
            const isActive = activeCategory === catName;
            return (
              <button
                key={catName}
                onClick={() => handleSelectCategory(catName)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-xl border transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-white shadow-lg'
                    : 'bg-slate-900/65 text-slate-300 border-slate-700/60 hover:text-white hover:border-slate-500'
                }`}
                style={
                  isActive
                    ? {
                        backgroundColor: info.glow,
                        borderColor: info.color
                      }
                    : {}
                }
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: info.color, boxShadow: `0 0 8px ${info.color}` }}
                />
                <span>{catName}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}

          {(searchQuery || activeFolder !== 'All') && (
            <span className="ml-1 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/30 px-3 py-1 rounded-full whitespace-nowrap">
              {matchingIds.size} match{matchingIds.size === 1 ? '' : 'es'}
            </span>
          )}
        </div>
      </header>

      {/* =====================================================================
          FLOATING HOVER TOOLTIP FOR 3D RAYCASTED CARDS
         ===================================================================== */}
      {hoveredBookmark && !selectedBookmark && (
        <div
          className="pointer-events-none fixed z-30 transition-transform duration-75"
          style={{
            left: Math.min(window.innerWidth - 290, hoverScreenPos.x + 18),
            top: Math.min(window.innerHeight - 135, hoverScreenPos.y + 18)
          }}
        >
          <div className="w-72 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-xl p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <AppIconBadge
                  bookmark={hoveredBookmark}
                  sizeClass="w-6 h-6"
                  roundedClass="rounded-lg"
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full truncate"
                  style={{
                    color: CATEGORIES[hoveredBookmark.category]?.color || '#38bdf8',
                    backgroundColor: 'rgba(255,255,255,0.06)'
                  }}
                >
                  {hoveredBookmark.category}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                📁 {hoveredBookmark.folder || 'Saved'}
              </span>
            </div>
            <p className="text-xs font-semibold text-white line-clamp-1">{hoveredBookmark.title}</p>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{hoveredBookmark.url}</p>
            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-sky-400">
              <span>Click card to inspect</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          RIGHT DETAIL INSPECTOR DRAWER (When a 3D Card is Clicked)
         ===================================================================== */}
      {selectedBookmark && (
        <aside className="fixed right-4 top-28 bottom-20 w-88 max-w-[calc(100vw-2rem)] z-30 bg-slate-900/85 backdrop-blur-2xl border border-slate-700/70 rounded-3xl p-5 shadow-2xl flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <AppIconBadge
                  bookmark={selectedBookmark}
                  sizeClass="w-8 h-8"
                  roundedClass="rounded-xl"
                />
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
                    Node Inspector
                  </span>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: CATEGORIES[selectedBookmark.category]?.color || '#38bdf8'
                    }}
                  >
                    {selectedBookmark.category}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBookmarkId(null)}
                className="p-1.5 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selectedBookmark.isTab ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Monitor className="w-3.5 h-3.5" />
                  Active Browser Tab
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  <Bookmark className="w-3.5 h-3.5" />
                  {selectedBookmark.folder || 'Saved Bookmark'}
                </span>
              )}
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {selectedBookmark.lastVisited}
              </span>
            </div>

            <h2 className="mt-3 text-lg font-bold text-white leading-snug">
              {selectedBookmark.title}
            </h2>
            <a
              href={selectedBookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 break-all"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{selectedBookmark.url}</span>
            </a>

            <div className="mt-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Context & Folder Origin
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedBookmark.notes || 'Saved in spatial bookmark galaxy.'}
              </p>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                <Tag className="w-3 h-3" />
                Semantic & Folder Tags
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(selectedBookmark.tags || []).map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                <FolderKanban className="w-3 h-3" />
                Move to Constellation
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(CATEGORIES).map(([catName, info]) => {
                  const isCurrent = selectedBookmark.category === catName;
                  return (
                    <button
                      key={catName}
                      onClick={() => handleMoveCategory(selectedBookmark.id, catName)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border text-left transition-all ${
                        isCurrent
                          ? 'bg-slate-800 text-white border-sky-400/60'
                          : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: info.color }}
                      />
                      <span className="truncate">{catName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center gap-2.5">
            <a
              href={selectedBookmark.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs py-3 px-4 rounded-xl shadow-lg shadow-sky-500/20 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Launch Tab</span>
            </a>
            <button
              onClick={() => handleDeleteBookmark(selectedBookmark.id)}
              className="p-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors"
              title="Remove Bookmark"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* =====================================================================
          BOTTOM SPATIAL NAVIGATION CONTROLS & LEGEND
         ===================================================================== */}
      <footer className="fixed bottom-4 left-4 right-4 md:left-6 md:right-6 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/75 backdrop-blur-xl border border-slate-700/60 px-4 py-2 rounded-2xl text-[11px] text-slate-400 shadow-xl">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <strong className="text-slate-200">Drag</strong> Orbit
          </span>
          <span>•</span>
          <span>
            <strong className="text-slate-200">Right-Drag</strong> Pan
          </span>
          <span>•</span>
          <span>
            <strong className="text-slate-200">Scroll</strong> Zoom
          </span>
          <span>•</span>
          <span>
            <strong className="text-slate-200">Click Card</strong> Inspect
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={resetCameraView}
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-xl border border-slate-700/60 text-slate-200 text-xs font-medium px-3.5 py-2 rounded-2xl shadow-xl transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>Reset Camera</span>
          </button>

          <button
            onClick={handleResetDemoData}
            className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-xl border border-slate-700/60 text-slate-400 hover:text-slate-200 text-xs px-3 py-2 rounded-2xl shadow-xl transition-all"
            title="Restore pre-populated bookmarks from bookmarks_11_23_26.html"
          >
            Reset Default ({INITIAL_BOOKMARKS.length})
          </button>
        </div>
      </footer>

      {/* =====================================================================
          TOAST NOTIFICATION BANNER
         ===================================================================== */}
      {toastMessage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xl border border-sky-400/40 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =====================================================================
          ADD BOOKMARK / IMPORT NETSCAPE HTML / CAPTURE TABS MODAL
         ===================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-slate-900/95 border border-slate-700/80 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Add or Import to 3D Galaxy</h2>
                <p className="text-xs text-slate-400">
                  Import a browser Bookmarks HTML file, capture open tabs, or spawn a node
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Netscape Bookmark HTML File Uploader Card */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-500/15 via-sky-500/10 to-indigo-500/15 border border-purple-400/35 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4" />
                  Import Netscape Bookmark HTML
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Upload any Chrome, Edge, or Firefox exported <code>bookmarks.html</code> file to extract icons, auto-categorize &amp; preserve folders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 flex items-center gap-1.5 bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose HTML</span>
              </button>
            </div>

            {/* Staged HTML Import Preview List with Icons */}
            {stagedHtmlImport && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-950/85 border border-purple-400/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">
                      {stagedHtmlImport.fileName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {stagedHtmlImport.freshItems.length} new nodes ready •{' '}
                      {stagedHtmlImport.duplicateCount} duplicates skipped
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={confirmStagedHtmlImport}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition-all"
                  >
                    Import ({stagedHtmlImport.freshItems.length})
                  </button>
                </div>

                {stagedHtmlImport.freshItems.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {stagedHtmlImport.freshItems.slice(0, 20).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800/80 rounded-xl px-2.5 py-1.5"
                      >
                        <AppIconBadge
                          bookmark={item}
                          sizeClass="w-6 h-6"
                          roundedClass="rounded-lg"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-200 truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {item.category} • {item.folder}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* One-Click Batch Tab Session Importer */}
            <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-teal-500/10 border border-sky-400/30 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" />
                  Capture Active Browser Tabs
                </h3>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Snapshot 4 live tabs into your 3D constellations.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCaptureOpenTabs}
                className="shrink-0 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-lg shadow-sky-500/20 transition-all"
              >
                Capture 4 Tabs
              </button>
            </div>

            {/* Manual Bookmark Form */}
            <form onSubmit={handleAddBookmark} className="mt-5 space-y-3.5">
              {/* Live Icon & Node Preview Strip */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                <AppIconBadge
                  bookmark={{
                    title: newTitle || 'New App Node',
                    url: newUrl || 'https://example.com',
                    category: newCategory,
                    iconDataUrl: null
                  }}
                  sizeClass="w-10 h-10"
                  roundedClass="rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {newTitle.trim() || 'Live Node Icon Preview'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {newUrl.trim() || 'Enter a URL to resolve its app/site favicon'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., WebGL Shader Playground"
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">URL</label>
                  <input
                    type="text"
                    required
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://shadertoy.com"
                    className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Constellation Cluster
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                  >
                    {Object.keys(CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="webgl, shaders, inspiration"
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Reference notes for this bookmark..."
                  className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-sky-400 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsTab}
                  onChange={(e) => setNewIsTab(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs text-slate-300">
                  Mark as currently open browser tab
                </span>
              </label>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-sky-500/25"
                >
                  Spawn 3D Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}