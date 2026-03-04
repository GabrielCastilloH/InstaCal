/**
 * Design token values for non-DOM contexts (e.g. background service worker).
 * These hex values MUST stay in sync with the CSS custom properties in colors.css.
 *
 *   --color-failure  →  COLORS.failure
 *   --color-success  →  COLORS.success
 */
export const COLORS = {
    failure: '#b33a5e', // --color-failure: cool red/berry with slight blueish cast
    success: '#3d8a6e', // --color-success: muted teal-green
} as const;
