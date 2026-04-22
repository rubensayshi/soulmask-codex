import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:            '#080808',
        surface:       '#0d0d0d',
        panel:         '#111111',
        card:          '#171712',
        'card-hover':  '#1f1f18',
        border:        '#272518',
        'border-lit':  '#3e3c28',
        gold:          '#b89840',
        'gold-dim':    '#6a5820',
        'gold-glow':   'rgba(184,152,64,.12)',
        text:          '#c8c0a0',
        'text-muted':  '#706858',
        'text-dim':    '#3e3828',
        raw:           '#6aaa44',
        'raw-bg':      '#0b160a',
        'raw-border':  '#1e3818',
        jade:          '#44a08a',
        'jade-bg':     '#091410',
        'jade-border': '#1a3828',
        or:            '#9080cc',
        'or-bg':       '#0e0c1c',
        'or-border':   '#302858',
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        sans:    ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        wider2:  '.12em',
        widest2: '.16em',
      },
    },
  },
  plugins: [],
}
export default config
