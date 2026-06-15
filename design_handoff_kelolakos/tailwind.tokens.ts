// ============================================================
// KelolaKos · Tailwind theme tokens
// Merge into tailwind.config.ts -> theme.extend
// Keeps the codebase's existing setup; only adds the approved scale.
// ============================================================
//
// import type { Config } from 'tailwindcss'
//
// const config: Config = {
//   content: [...],
//   theme: { extend: kkTheme },   // <- spread this object
//   plugins: [],
// }

export const kkTheme = {
  colors: {
    kk: {
      white: '#FFFFFF',
      navy: '#0C2C47',     // all text, headings, active nav, icons
      green: '#2E5749',    // income, success, "Lunas"
      orange: '#BF512C',   // PRIMARY buttons, "Belum Bayar", expense
      yellow: '#DA9B2B',   // "DP" (navy text on top)
      mauve: '#D6C9C5',    // borders, "Batal" — background only
      mint: '#ABCBCA',     // highlight bg, info — background only
      ink: '#3B5063',      // ONLY gray; secondary text (AAA on white)
      paper: '#FAF8F7',
      'mauve-soft': '#EFE9E7',
      'mint-soft': '#E4EFEE',
      'orange-soft': '#FBEFE9',
    },
  },
  fontFamily: {
    heading: ['Lato', 'system-ui', 'sans-serif'],   // 700 / 900
    body: ['Josefin Sans', 'system-ui', 'sans-serif'], // 400–600
  },
  fontSize: {
    // name: [size, lineHeight]  — never use below 'caption' (16px) for important text
    caption: ['16px', '1.4'],
    body: ['19px', '1.55'],
    button: ['19px', '1.1'],
    subhead: ['23px', '1.1'],
    page: ['32px', '1.05'],
    number: ['34px', '1.05'],
    hero: ['46px', '1.0'],
  },
  borderRadius: {
    'kk-card': '18px',
    'kk-btn': '14px',
    'kk-pill': '12px',
  },
  boxShadow: {
    'kk-orange': '0 4px 0 #8F3C20', // primary button "pressable" base
    'kk-green': '0 4px 0 #1F3D32',  // success button
  },
  minHeight: {
    'kk-touch': '48px',  // every interactive element
    'kk-btn': '56px',    // primary button
    'kk-btn-lg': '64px',
  },
}

// Google Fonts (next/font/google or <link>):
//   Lato: weights 400, 700, 900
//   Josefin Sans: weights 400, 500, 600, 700
