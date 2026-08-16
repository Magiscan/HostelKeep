// Palette used by the newer component modules (Dashboard/*, Card/*, the .web
// screens). src/theme.js holds a SECOND, slightly different palette used by the
// older native screens — see PATCHES.md for the consolidation plan.
//
// FIXED: textMuted, successLight and warningLight were referenced by
// DashboardScreen.web, HistoryScreen.web and Sidebar but never defined here,
// so those styles were resolving to `undefined`.

export const COLORS = {
  primary:       "#2563EB",
  primaryLight:  "#DBEAFE",
  primaryDark:   "#1D4ED8",

  success:       "#22C55E",
  successLight:  "#DCFCE7",   // ← ADDED (HistoryScreen.web)
  warning:       "#F59E0B",
  warningLight:  "#FEF3C7",   // ← ADDED (HistoryScreen.web)
  danger:        "#EF4444",
  dangerLight:   "#FEE2E2",

  background:    "#F8FAFC",
  surface:       "#FFFFFF",

  border:        "#E5E7EB",
  borderFocus:   "#93C5FD",

  text:          "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",   // ← ADDED (DashboardScreen.web, Sidebar)

  white:         "#FFFFFF",
  black:         "#0F172A",

  sidebar:       "#FFFFFF",
  shadow:        "rgba(15,23,42,0.08)",
};