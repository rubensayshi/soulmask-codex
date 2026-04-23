import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { itemPath } from '../lib/graph'

const FEATURED: { id: string; label: string; blurb: string }[] = [
  { id: 'Daoju_Item_TieDing',  label: 'Iron Ingot',      blurb: 'Smelted from iron ore and carbon powder in the Blast Furnace.' },
  { id: 'BP_GongJu_FuZi_4',    label: 'Iron Axe',        blurb: 'A top-tier gathering tool. Follow the chain from iron ore + hardwood + leather.' },
  { id: 'DaoJu_Item_PiGe_3',   label: 'Premium Leather', blurb: 'A multi-step tanning chain from raw hide to finished leather.' },
  { id: 'Daoju_Item_GangDing', label: 'Steel Ingot',     blurb: 'Iron ingots refined with coal — prerequisite for steel weapons and armor.' },
]

export default function Home() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)
  if (status === 'loading' || !graph) return <div className="p-8 text-text-dim">Loading…</div>

  const byId = new Map(graph.items.map(i => [i.id, i]))
  const available = FEATURED.filter(f => byId.has(f.id))

  return (
    <div className="p-10 max-w-2xl">
      <h1 className="font-display text-[32px] text-text mb-2 tracking-[.04em] font-semibold">Soulmask · Recipe Codex</h1>
      <p className="text-text-mute mb-8 text-[13px]">
        Browse {graph.items.length.toLocaleString()} items and {graph.recipes.length.toLocaleString()} crafting recipes.
        Click any ingredient to trace its chain.
      </p>

      <div className="flex items-center gap-3.5 mb-4">
        <svg viewBox="0 0 14 14" className="w-[14px] h-[14px]" fill="none" stroke="#8aa074" strokeWidth="1" strokeLinecap="square">
          <path d="M7 1 L13 7 L7 13 L1 7 Z" />
          <path d="M7 4 L10 7 L7 10 L4 7 Z" fill="#8aa074" stroke="none" opacity=".6" />
        </svg>
        <span className="font-display text-[16px] font-semibold text-text tracking-[.04em]">Featured Chains</span>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #5a6e48 0%, transparent 100%)' }} />
      </div>

      <div className="grid gap-2">
        {available.map(f => {
          const item = byId.get(f.id)!
          return (
          <Link
            key={f.id}
            to={itemPath(item)}
            className="relative block p-4 bg-panel border border-hair-strong hover:border-green-dim transition-colors"
          >
            {/* green hairline top accent */}
            <div className="pointer-events-none absolute -top-px -left-px -right-px h-px opacity-60"
                 style={{ background: 'linear-gradient(90deg, transparent, #5a6e48 30%, #5a6e48 70%, transparent)' }} />
            <div className="font-display text-[18px] text-text mb-1 tracking-[.02em] font-semibold">{f.label}</div>
            <div className="text-[12px] text-text-mute">{f.blurb}</div>
          </Link>
        )})}
        {available.length === 0 && (
          <p className="text-text-dim text-xs italic">
            Featured items aren't in the database yet — use the sidebar search to find something.
          </p>
        )}
      </div>
    </div>
  )
}
