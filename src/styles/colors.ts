/**
 * Single source of truth for all design token values.
 *
 * The Vite `generate-colors-css` plugin reads this file and:
 *   • writes src/styles/colors.css on dev-server start / build
 *   • emits dist/colors.css in the production bundle
 *
 * Edit here. Never edit colors.css directly.
 */

// ── Palette ───────────────────────────────────────────────────────────────────
export const palette = {
  "primary-100": "#e3ebf2",
  "primary-400": "#88a9c3",
  "primary-500": "#6da7cc",
  "primary-600": "#5a7a8f",
  "primary-700": "#345e7d",
  "primary-900": "#2b4257",
} as const;

// ── Status ────────────────────────────────────────────────────────────────────
export const status = {
  failure: "#c43b49", // cool red/berry — slight blueish cast to match palette
  success: "#4c9161", // muted teal-green — harmonious with blue palette
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const shadows = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.08)",
  md: "0 2px 6px rgba(0, 0, 0, 0.12)",
  thumb: "0 1px 3px rgba(0, 0, 0, 0.20)",
} as const;

// ── Utility ───────────────────────────────────────────────────────────────────
export const utility = {
  white: "#ffffff",
  "bg-body": "#fcfdfe", // popup background
  "bg-page": "#f5f7fa", // full-page background (auth.html)
} as const;

// ── Google brand (dictated by Google guidelines) ──────────────────────────────
export const google = {
  text: "#3c4043",
  border: "#dadce0",
  hover: "#f8f9fa",
} as const;

// ── Runtime alias for background.ts (no DOM — cannot read CSS variables) ──────
export const COLORS = {
  failure: status.failure,
  success: status.success,
} as const;
