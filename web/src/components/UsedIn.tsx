import { useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Graph, Item, Recipe } from '../lib/types'
import { buildUsedInIndex, qtyNeeded, indexItems } from '../lib/graph'
import Diamond from './Diamond'

interface Props { graph: Graph; rootId: string; filterIds: string[] }

export default function UsedIn({ graph, rootId, filterIds }: Props) {
  const usedInIdx = useMemo(() => buildUsedInIndex(graph), [graph])
  const byId = useMemo(() => indexItems(graph), [graph])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    })
  }, [rootId, filterIds])

  if (filterIds.length === 0) return null

  return (
    <div ref={ref} className="flow-container flow-vert overflow-auto pb-5 mb-5 p-5 border border-hair"
         style={{ background: 'linear-gradient(180deg, #181a16 0%, #161815 100%)' }}>
      <div className="flex flex-row gap-6 justify-center"
           style={{ minWidth: 'fit-content' }}>
        {filterIds.map(id => (
          <UsedInFlowNode key={id} graph={graph} byId={byId} usedInIdx={usedInIdx}
                          id={id} sourceId={rootId} depth={0} />
        ))}
      </div>
    </div>
  )
}

function UsedInFlowNode({ graph, byId, usedInIdx, id, sourceId, depth }: {
  graph: Graph; byId: Map<string, Item>; usedInIdx: Map<string, string[]>;
  id: string; sourceId: string; depth: number
}) {
  const item = byId.get(id)
  const nav = useNavigate()
  const upstream = usedInIdx.get(id) ?? []
  const recipe = graph.recipes.find(r =>
    r.out === id && r.groups.some(g => g.items.some(it => it.id === sourceId))
  )
  const qty = recipe ? qtyNeeded(recipe, sourceId) : null
  const station = recipe?.st ? graph.stations.find(s => s.id === recipe.st) : undefined

  if (!item || depth > 4) return null

  const tile = (
    <div className="flex flex-col items-center gap-[7px] flex-shrink-0">
      <Diamond item={item} size={48} variant="rust" onClick={() => nav(`/item/${item.id}`)} />
      <div className="flex flex-col items-center gap-[2px] max-w-[110px] text-center">
        <span className="text-[11px] text-rust leading-[1.25] tracking-[.02em]">{item.n ?? item.nz ?? item.id}</span>
        {qty != null && <span className="text-[11px] font-bold text-rust tabular-nums">needs ×{qty}</span>}
        {station?.n && <span className="text-[9px] text-text-dim uppercase tracking-[.1em] font-medium">{station.n}</span>}
      </div>
    </div>
  )

  if (!upstream.length) return tile

  const seen = new Set<string>()
  const children = upstream
    .map(rid => graph.recipes.find(rr => rr.id === rid))
    .filter((r): r is Recipe => !!r)
    .filter(r => seen.has(r.out) ? false : (seen.add(r.out), true))

  return (
    <div className="flex flex-col items-center" style={{ minWidth: 'fit-content' }}>
      {tile}
      <div className="w-px h-6 bg-rust-dim flex-shrink-0 self-center" />
      <div className="flex flex-row relative self-stretch justify-center">
        {children.map(r => (
          <div key={r.out} className="flow-branch-item rust vert flex flex-col items-center">
            <div className="mt-[14px]">
              <UsedInFlowNode graph={graph} byId={byId} usedInIdx={usedInIdx}
                              id={r.out} sourceId={id} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
