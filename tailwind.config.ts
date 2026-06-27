import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ── KelolaKos elderly-friendly redesign palette (use these) ──
        kk: {
          white: '#FFFFFF',
          navy: '#0C2C47', // all text, headings, active nav, icons
          green: '#2E5749', // income, success, "Lunas"
          orange: '#BF512C', // PRIMARY buttons, "Belum Bayar", expense
          yellow: '#DA9B2B', // "DP" (navy text on top)
          mauve: '#D6C9C5', // borders, "Batal" — background only
          mint: '#ABCBCA', // highlight bg, info — background only
          ink: '#3B5063', // ONLY gray; secondary text (AAA on white)
          paper: '#FAF8F7',
          'mauve-soft': '#EFE9E7',
          'mint-soft': '#E4EFEE',
          'yellow-soft': '#FBF1D8', // DP (uang muka) — background only
          'orange-soft': '#FBEFE9',
          'orange-shadow': '#8F3C20',
          'green-shadow': '#1F3D32',
        },

        // ── Legacy tokens (kept so not-yet-reskinned views keep working) ──
        bg: '#FAFAF9',
        sf: '#FFFFFF',
        sf2: '#F5F5F4',
        sf3: '#EFEFEC',
        bd: '#E7E5E4',
        bds: '#D6D3D1',
        tx: '#0C0A09',
        tx2: '#44403C',
        tx3: '#78716C',
        tx4: '#A8A29E',
        inv: '#FAFAF9',
        ac: '#0C0A09',
        ach: '#292524',
        gr: '#15803D',
        grb: '#DCFCE7',
        am: '#B45309',
        amb: '#FEF3C7',
        rd: '#B91C1C',
        rdb: '#FEE2E2',
        bl: '#1D4ED8',
        blb: '#DBEAFE',
        vi: '#6D28D9',
        vib: '#EDE9FE',
      },
      fontFamily: {
        // KelolaKos redesign fonts
        heading: ['Lato', 'system-ui', 'sans-serif'], // 700 / 900
        body: ['"Josefin Sans"', 'system-ui', 'sans-serif'], // 400–600
        // Legacy
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      fontSize: {
        // KelolaKos scale — never use below 'caption' (16px) for important text
        caption: ['16px', '1.4'],
        body: ['19px', '1.55'],
        button: ['19px', '1.1'],
        subhead: ['23px', '1.1'],
        page: ['32px', '1.05'],
        number: ['34px', '1.05'],
        hero: ['46px', '1.0'],
      },
      borderRadius: {
        // KelolaKos
        'kk-card': '18px',
        'kk-btn': '14px',
        'kk-pill': '12px',
        // Legacy
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        // KelolaKos "pressable" button bases
        'kk-orange': '0 4px 0 #8F3C20',
        'kk-green': '0 4px 0 #1F3D32',
        // Legacy
        xs: '0 1px 2px rgba(12,10,9,.05)',
        sm: '0 1px 3px rgba(12,10,9,.06), 0 1px 2px rgba(12,10,9,.04)',
        lg: '0 20px 40px rgba(12,10,9,.12), 0 8px 16px rgba(12,10,9,.06)',
      },
      minHeight: {
        'kk-touch': '48px', // every interactive element
        'kk-btn': '56px', // primary button
        'kk-btn-lg': '64px',
      },
      maxWidth: {
        'kk-content': '840px',
        'kk-sheet': '640px',
      },
      keyframes: {
        kkSlideUp: {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        kkPopIn: {
          from: { transform: 'scale(.94)' },
          to: { transform: 'scale(1)' },
        },
        kkFadeIn: {
          from: { transform: 'translateY(8px)' },
          to: { transform: 'translateY(0)' },
        },
      },
      animation: {
        kkSlideUp: 'kkSlideUp .26s cubic-bezier(.2,.8,.2,1)',
        kkPopIn: 'kkPopIn .22s cubic-bezier(.2,.8,.2,1)',
        kkFadeIn: 'kkFadeIn .2s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
