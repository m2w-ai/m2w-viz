import type { SpectacleThemeOverrides } from 'spectacle'

// Spectacle uses styled-components under the hood; we override its theme just
// enough to get the right canvas size + dark backdrop. The actual slide content
// is rendered with plain Tailwind JSX inside each <Slide>, so we don't lean on
// Spectacle's typography scale.
export const DECK_THEME: SpectacleThemeOverrides = {
  size: {
    width: 1920,
    height: 1080,
    maxCodePaneHeight: 200,
  },
  colors: {
    primary: '#fafafa',
    secondary: '#c4b5fd',
    tertiary: '#0a0a0a',
    quaternary: '#a78bfa',
    quinary: '#f472b6',
  },
  fonts: {
    header: '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    text: '"Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    monospace: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
}

export const DECK_TEMPLATE_PROPS = {
  backgroundColor: '#050505',
}
