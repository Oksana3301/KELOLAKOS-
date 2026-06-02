import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(12,10,9,.05)',
        sm: '0 1px 3px rgba(12,10,9,.06), 0 1px 2px rgba(12,10,9,.04)',
        lg: '0 20px 40px rgba(12,10,9,.12), 0 8px 16px rgba(12,10,9,.06)',
      },
    },
  },
  plugins: [],
};

export default config;
