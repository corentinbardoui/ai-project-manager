/**
 * Design Tokens — AI Project Manager
 *
 * Single source of truth for colors, typography, radii and shadows.
 * - Tailwind classes: use the semantic aliases defined in tailwind.config.ts
 *   e.g. `bg-brand-500`, `text-accent-400`, `bg-surface-elevated`
 * - JS/inline styles: import directly from this file
 *
 * To swap the whole palette: update `palette.brand`, `palette.accent`
 * and the matching entries in tailwind.config.ts.
 */

// ─── Raw palette ──────────────────────────────────────────────────────────────

export const palette = {
  /** Primary brand — fuchsia/magenta */
  brand: {
    200: "#f5d0fe",
    300: "#f0abfc",
    400: "#e879f9",
    500: "#d946ef",
    600: "#c026d3",
    700: "#a21caf",
  },

  /** Secondary accent — orange */
  accent: {
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#f97316",
    600: "#ea580c",
  },

  /** App surfaces — deep purple-black */
  surface: {
    /** Page background */
    base:     "#0E0A1F",
    /** Panels, sidebars */
    elevated: "#160D2E",
    /** Cards, popovers */
    card:     "#1D1040",
    /** Modals, overlays */
    overlay:  "#120824",
  },

  /** Semantic status */
  status: {
    success: "#34d399",
    warning: "#f59e0b",
    error:   "#f87171",
    info:    "#60a5fa",
  },
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  family: {
    sans: "var(--font-geist-sans, Inter, system-ui, -apple-system, sans-serif)",
    mono: "var(--font-geist-mono, 'JetBrains Mono', 'Fira Code', monospace)",
  },

  /** [ fontSize, { lineHeight, letterSpacing } ] — mirrors Tailwind scale */
  scale: {
    "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.02em"  }] as const,
    xs:    ["12px", { lineHeight: "16px", letterSpacing: "0em"     }] as const,
    sm:    ["14px", { lineHeight: "20px", letterSpacing: "-0.01em" }] as const,
    base:  ["16px", { lineHeight: "24px", letterSpacing: "-0.01em" }] as const,
    lg:    ["18px", { lineHeight: "28px", letterSpacing: "-0.02em" }] as const,
    xl:    ["20px", { lineHeight: "28px", letterSpacing: "-0.02em" }] as const,
    "2xl": ["24px", { lineHeight: "32px", letterSpacing: "-0.03em" }] as const,
    "3xl": ["30px", { lineHeight: "36px", letterSpacing: "-0.04em" }] as const,
  },

  weight: {
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
} as const;

// ─── Spacing / radius ─────────────────────────────────────────────────────────

export const radius = {
  sm:   "8px",
  md:   "12px",
  lg:   "16px",
  xl:   "20px",
  "2xl":"24px",
  full: "9999px",
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────

export const shadows = {
  sm:      "0 1px 3px rgba(0,0,0,0.45)",
  md:      "0 4px 16px rgba(0,0,0,0.55)",
  lg:      "0 8px 40px rgba(0,0,0,0.65)",
  brand:   "0 4px 24px rgba(217, 70, 239, 0.30)",
  brandLg: "0 8px 48px rgba(217, 70, 239, 0.20)",
  accent:  "0 4px 20px rgba(249, 115, 22, 0.25)",
} as const;

// ─── Animation ────────────────────────────────────────────────────────────────

export const easing = {
  spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
  smooth:  "cubic-bezier(0.4, 0, 0.2, 1)",
  snap:    "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const duration = {
  fast:   "120ms",
  normal: "220ms",
  slow:   "350ms",
} as const;
