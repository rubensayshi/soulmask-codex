import { Link, useLocation } from 'react-router-dom'
import markSvg from '../assets/mark.svg'

const TABS = [
  { to: '/', label: 'Codex', match: (p: string) => p === '/' },
  { to: '/item/Daoju_Item_TieDing', label: 'Recipes', match: (p: string) => p.startsWith('/item/') },
  { to: '/awareness-xp', label: 'Awareness XP', match: (p: string) => p === '/awareness-xp' },
]

export default function TopNav() {
  const { pathname } = useLocation()

  return (
    <div className="relative flex items-center h-[72px] px-8 flex-shrink-0 border-b border-hair"
         style={{ background: 'linear-gradient(180deg, #242822 0%, #1c1f1b 100%)' }}>
      <div className="pointer-events-none absolute left-0 right-0 -bottom-px h-px opacity-50"
           style={{ background: 'linear-gradient(90deg, transparent 0%, #5a6e48 20%, #5a6e48 80%, transparent 100%)' }} />

      <Link to="/" className="flex items-center gap-3 pr-7 mr-3 h-full border-r border-hair">
        <img src={markSvg} alt="Soulmask Codex" className="w-[36px] h-[36px]" />
        <div className="flex flex-col gap-1">
          <div className="font-heading text-[14px] font-bold text-text tracking-[.2em]">
            SOULMASK <span className="text-green" style={{ fontWeight: 800 }}>CODEX</span>
          </div>
          <div className="font-display italic text-[12px] font-medium text-gold tracking-[.14em]">
            Atlas of the Crafted World
          </div>
        </div>
      </Link>

      <div className="flex items-stretch h-full ml-4">
        {TABS.map(tab => {
          const active = tab.match(pathname)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`relative px-[22px] flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest2 bg-transparent transition-colors ${active ? 'text-green' : 'text-text-mute hover:text-text'}`}
            >
              {tab.label}
              {active && (
                <span className="absolute left-[18%] right-[18%] bottom-0 h-[2px] bg-green"
                      style={{ boxShadow: '0 0 8px rgba(138,160,116,.4)' }} />
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
