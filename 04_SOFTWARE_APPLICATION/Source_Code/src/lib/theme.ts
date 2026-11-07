// SINGLE SOURCE OF TRUTH for all branding
// Update this file when branding assets are confirmed with the client.
// Consistent with Silid OS study hub aesthetics.
export const theme = {
  colors: {
    primary: '#1f5d46',
    primaryDark: '#143f31',
    primaryLight: '#e8f4f0',
    surface: '#fffdf7',
    background: '#f5f4f0',
    border: '#ded7c8',
    ink: '#2f2a24',
    muted: '#756d62',
    danger: '#8f2d2d',
    dangerBg: '#fff0ea',
    dangerBorder: '#e9c0b7',
    amber: '#9a6b20',
    amberBg: '#fff8e5',
    success: '#176542',
    successBg: '#e8f4f0',
  },
  fonts: {
    display: '"Bodoni Moda", "Bodoni 72", Didot, Georgia, serif',
    ui: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  logo: {
    text: 'SILID',
    location: 'MALOLOS',
    placeholder: true, // TBD: replace with actual SVG/asset upon client delivery
  },
  branding: {
    hubName: 'Silid Malolos',
    tagline: 'Quiet focus & study hub',
    emailHeaderColor: '#1f5d46',
  },
} as const;

export type Theme = typeof theme;
