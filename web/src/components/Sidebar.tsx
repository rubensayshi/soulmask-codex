import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import Icon from './Icon'
import { search as searchApi, type SearchHit } from '../lib/api'
import type { Item } from '../lib/types'
import { noRecipe } from '../lib/graph'

export default function Sidebar() {
  const { id: currentId } = useParams<{ id: string }>()
  const visits = useStore(s => s.recentVisits)
  const graph  = useStore(s => s.graph)

  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])

  useEffect(() => {
    if (!query.trim()) { setHits([]); return }
    const handle = setTimeout(() => {
      searchApi(query.trim()).then(setHits).catch(() => setHits([]))
    }, 150)
    return () => clearTimeout(handle)
  }, [query])

  if (!graph) return <aside className="w-[264px] flex-shrink-0 border-r border-hair bg-bg-2" />
  const byId = new Map(graph.items.map(i => [i.id, i]))
  const showingSearch = query.trim().length > 0

  const rows: Array<{ id: string; item: Item | undefined; name: string; sub: string | null; raw: boolean }> = showingSearch
    ? hits.map(hit => {
        const it = byId.get(hit.id)
        return {
          id: hit.id,
          item: it ?? { id: hit.id, n: hit.name_en, nz: hit.name_zh, cat: hit.category, role: 'final' },
          name: hit.name_en ?? hit.name_zh ?? hit.id,
          sub: hit.category ?? null,
          raw: it ? noRecipe(it) : false,
        }
      })
    : visits.map(id => {
        const it = byId.get(id)
        return {
          id,
          item: it,
          name: it?.n ?? it?.nz ?? id,
          sub: it?.cat ?? null,
          raw: it ? noRecipe(it) : false,
        }
      })

  return (
    <aside className="relative w-[264px] flex-shrink-0 border-r border-hair bg-bg-2 flex flex-col">
      <div className="relative p-3.5 border-b border-line-soft">
        <svg
          className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none w-[13px] h-[13px] text-text-dim"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11 L14.5 14.5" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search blueprints or materials…"
          className="w-full bg-bg border border-hair px-3 pl-8 py-2 text-xs text-text outline-none focus:border-green-dim placeholder:text-text-dim placeholder:italic"
        />
      </div>

      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <span className="text-[9px] tracking-widest2 uppercase text-text-dim font-semibold">
          {showingSearch ? 'Results' : 'Recent'}
        </span>
        <div className="flex-1 h-px bg-hair" />
        <span className="text-[10px] text-text-faint tabular-nums">{rows.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-3">
        {rows.length === 0 ? (
          <div className="px-4 py-2 text-[11px] text-text-dim italic">
            {showingSearch ? 'No matches.' : 'Nothing yet. Search or click an item to begin.'}
          </div>
        ) : (
          rows.map(row => {
            const active = row.id === currentId
            return (
              <Link
                key={row.id}
                to={`/item/${row.id}`}
                onClick={() => showingSearch && setQuery('')}
                className={`group flex items-center gap-2.5 px-4 py-1.5 cursor-pointer border-l-2 transition-colors ${
                  active
                    ? 'border-green'
                    : 'border-transparent hover:bg-[rgba(138,160,116,.05)]'
                }`}
                style={active ? { background: 'linear-gradient(90deg, rgba(138,160,116,.12) 0%, transparent 100%)' } : undefined}
              >
                <Icon item={row.item} size={28} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[12.5px] leading-tight truncate ${active ? 'text-green-hi' : row.raw ? 'text-text-mute' : 'text-text'}`}>
                    {row.name}
                  </div>
                  {row.sub && <div className="text-[10px] text-text-dim tracking-[.04em] mt-px">{row.sub}</div>}
                </div>
                <span className={`w-1.5 h-1.5 flex-shrink-0 ${row.raw ? 'bg-rust opacity-55' : 'bg-green opacity-70'}`} />
              </Link>
            )
          })
        )}
      </div>

      {/* right hairline glow */}
      <div className="pointer-events-none absolute top-0 bottom-0 -right-px w-px"
           style={{ background: 'linear-gradient(180deg, transparent, #4a5040 15%, #4a5040 85%, transparent)' }} />
    </aside>
  )
}
