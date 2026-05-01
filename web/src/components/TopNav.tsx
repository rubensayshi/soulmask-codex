import { useMemo, useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import markSvg from '../assets/mark-compact.svg'
import { useStore } from '../store'
import { resolveItem, itemPath } from '../lib/graph'
import { search as searchApi, type SearchHit } from '../lib/api'

const DEFAULT_ITEM_ID = 'Daoju_Item_TieDing'

export default function TopNav() {
  const { pathname } = useLocation()
  const graph = useStore(s => s.graph)
  const recentVisits = useStore(s => s.recentVisits)

  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])

  const recipesTo = useMemo(() => {
    const targetId = recentVisits[0] ?? DEFAULT_ITEM_ID
    if (graph) {
      const item = resolveItem(graph, targetId)
      if (item) return itemPath(item)
    }
    return `/item/${targetId}`
  }, [graph, recentVisits])

  const tabs = [
    { to: recipesTo, label: 'Recipes', match: (p: string) => p.startsWith('/item/') },
    { to: '/tech-tree', label: 'Tech Tree', match: (p: string) => p.startsWith('/tech-tree') },
    { to: '/traits', label: 'Traits', match: (p: string) => p === '/traits' },
    { to: '/awareness-xp', label: 'Awareness XP', match: (p: string) => p === '/awareness-xp' },
    { to: '/food-almanac', label: 'Food Almanac', match: (p: string) => p === '/food-almanac' },
  ]

  const navIcons = [
    {
      to: recipesTo,
      label: 'Recipes',
      match: (p: string) => p.startsWith('/item/'),
      icon: (
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M4 14V8l4-6 4 6v6" strokeLinejoin="round" />
          <path d="M4 10h8" />
        </svg>
      ),
    },
    {
      to: '/tech-tree',
      label: 'Tech Tree',
      match: (p: string) => p.startsWith('/tech-tree'),
      icon: (
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="3" r="2" />
          <circle cx="4" cy="13" r="2" />
          <circle cx="12" cy="13" r="2" />
          <path d="M8 5v3M6.5 8 4 11M9.5 8 12 11" />
        </svg>
      ),
    },
    {
      to: '/traits',
      label: 'Traits',
      match: (p: string) => p === '/traits',
      icon: (
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M8 2 L14 8 L8 14 L2 8 Z" strokeLinejoin="round" />
          <path d="M8 5 L11 8 L8 11 L5 8 Z" fill="currentColor" opacity=".4" stroke="none" />
        </svg>
      ),
    },
    {
      to: '/awareness-xp',
      label: 'Awareness XP',
      match: (p: string) => p === '/awareness-xp',
      icon: (
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M8 1v5M5 3l3 3 3-3M4 9h8l-1 6H5L4 9Z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      to: '/food-almanac',
      label: 'Food Almanac',
      match: (p: string) => p === '/food-almanac',
      icon: (
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M5 1c-2 3-2 5 0 7M11 1c2 3 2 5 0 7" />
          <path d="M4 8h8v2a4 4 0 01-8 0V8Z" strokeLinejoin="round" />
          <path d="M8 14v1" />
        </svg>
      ),
    },
  ]

  useEffect(() => {
    if (!searchOpen) { setHits([]); setQuery(''); return }
    if (!query.trim()) { setHits([]); return }
    const handle = setTimeout(() => {
      searchApi(query.trim()).then(setHits).catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [query, searchOpen])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
  }, [pathname])

  return (
    <div className="relative flex items-center h-[48px] md:h-[72px] px-3 md:px-8 flex-shrink-0 border-b border-hair"
         style={{ background: 'linear-gradient(180deg, #242822 0%, #1c1f1b 100%)' }}>
      <div className="pointer-events-none absolute left-0 right-0 -bottom-px h-px opacity-50"
           style={{ background: 'linear-gradient(90deg, transparent 0%, #5a6e48 20%, #5a6e48 80%, transparent 100%)' }} />

      <Link to="/" className="flex items-center gap-2 md:gap-3 pr-3 md:pr-7 mr-2 md:mr-3 h-full border-r border-hair">
        <img src={markSvg} alt="Soulmask Codex" className="w-[28px] h-[28px] md:w-[36px] md:h-[36px]" />
        <div className="flex flex-col gap-1">
          <div className="font-heading text-[14px] font-bold text-text tracking-[.2em]">
            <span className="hidden md:inline">SOULMASK </span><span className="text-green" style={{ fontWeight: 800 }}>CODEX</span>
          </div>
          <div className="hidden md:block font-display italic text-[12px] font-medium text-gold tracking-[.14em]">
            Atlas of the Crafted World
          </div>
        </div>
      </Link>

      {/* Mobile icon nav */}
      <div className="flex md:hidden items-stretch h-full">
        {navIcons.map(nav => {
          const active = nav.match(pathname)
          return (
            <Link
              key={nav.label}
              to={nav.to}
              className={`relative flex items-center px-2.5 transition-colors ${active ? 'text-green' : 'text-text-mute'}`}
            >
              {nav.icon}
              {active && (
                <span className="absolute left-2 right-2 bottom-0 h-[2px] bg-green" />
              )}
            </Link>
          )
        })}

        <button
          onClick={() => { setSearchOpen(prev => !prev); setMenuOpen(false) }}
          className={`flex items-center px-2.5 transition-colors ${searchOpen ? 'text-green' : 'text-text-mute'}`}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
          </svg>
        </button>

        <button
          onClick={() => { setMenuOpen(prev => !prev); setSearchOpen(false) }}
          className={`flex items-center px-2.5 transition-colors ${menuOpen ? 'text-green' : 'text-text-mute'}`}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Desktop text tabs */}
      <div className="hidden md:flex items-stretch h-full ml-4">
        {tabs.map(tab => {
          const active = tab.match(pathname)
          return (
            <Link
              key={tab.label}
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

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-hair bg-bg/95 backdrop-blur px-3 py-2">
          <input
            ref={searchInputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false) }}
            placeholder="Search blueprints or materials..."
            className="w-full bg-panel border border-hair px-3 py-2 text-xs text-text outline-none focus:border-green-dim placeholder:text-text-dim"
          />
          {hits.length > 0 && (
            <div className="mt-1 max-h-[60vh] overflow-y-auto">
              {hits.map(hit => (
                <Link
                  key={hit.id}
                  to={`/item/${hit.id}`}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-[12px] text-text hover:bg-green-bg transition-colors"
                >
                  <span className="truncate">{hit.name_en ?? hit.name_zh ?? hit.id}</span>
                  {hit.category && <span className="text-[10px] text-text-dim ml-auto flex-shrink-0">{hit.category}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile hamburger menu */}
      {menuOpen && (
        <div className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-hair bg-bg/95 backdrop-blur">
          {tabs.map(tab => {
            const active = tab.match(pathname)
            return (
              <Link
                key={tab.label}
                to={tab.to}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-3 text-[13px] font-medium border-b border-hair transition-colors ${
                  active ? 'text-green bg-green-bg' : 'text-text-mute hover:text-text hover:bg-panel/50'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
