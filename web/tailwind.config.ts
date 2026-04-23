import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Cool-dark core — sampled from Knowledge & Technology panel
        bg:              '#161815',
        'bg-2':          '#1c1f1b',
        panel:           '#242822',
        'panel-2':       '#2c312a',
        'panel-lift':    '#363c33',
        tile:            '#2a2e27',
        'tile-hi':       '#363b32',
        hair:            '#373c32',
        'hair-strong':   '#4a5040',
        'line-soft':     '#242821',

        // Text — cool cream
        text:            '#d8dcc8',
        'text-mute':     '#99a08a',
        'text-dim':      '#6b7163',
        'text-faint':    '#474c40',

        // Primary accent — game green
        green:           '#8aa074',
        'green-hi':      '#a4ba8c',
        'green-dim':     '#5a6e48',
        'green-soft':    '#2e372a',

        // Secondary olive
        olive:           '#6e7252',
        'olive-dim':     '#4a4e38',

        // Gold — reduced to minor tier/badge accent
        gold:            '#b8a060',
        'gold-dim':      '#7a6830',

        // Used-in (warm desaturated rust)
        rust:            '#a67a52',
        'rust-dim':      '#6e4d2e',

        // OR group — cool teal
        teal:            '#6ea09a',
        'teal-dim':      '#3f5b58',
      },
      backgroundColor: {
        'green-bg':      'rgba(138,160,116,.08)',
        'green-glow':    'rgba(138,160,116,.18)',
        'gold-glow':     'rgba(184,160,96,.08)',
        'rust-bg':       'rgba(166,122,82,.06)',
        'teal-bg':       'rgba(110,160,154,.08)',
      },
      fontFamily: {
        heading: ['Cinzel', 'serif'],
        display: ['"Cormorant Garamond"', 'serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        wider2:  '.12em',
        widest2: '.22em',
      },
    },
  },
  plugins: [],
}
export default config
