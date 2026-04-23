import { useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Graph, Item, Recipe } from '../lib/types'
import { buildUsedInIndex, qtyNeeded, indexItems, itemPath } from '../lib/graph'
import Diamond from './Diamond'

interface Props { graph: Graph; rootId: string; filterIds: string[]; catFilter?: Set<string> }

export default function UsedIn({ graph, rootId, filterIds, catFilter }: Props) {
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
                          id={id} sourceId={rootId} depth={0} catFilter={catFilter} />
        ))}
      </div>
    </div>
  )
}

function UsedInFlowNode({ graph, byId, usedInIdx, id, sourceId, depth, catFilter }: {
  graph: Graph; byId: Map<string, Item>; usedInIdx: Map<string, string[]>;
  id: string; sourceId: string; depth: number; catFilter?: Set<string>
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
  if (catFilter && catFilter.size > 0 && item.role !== 'intermediate' && !catFilter.has(item.cat ?? 'other')) return null

  const tile = (
    <div className="flex flex-col items-center gap-[7px] flex-shrink-0">
      <Diamond item={item} size={48} variant="rust" onClick={() => nav(itemPath(item))} />
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
                              id={r.out} sourceId={id} depth={depth + 1} catFilter={catFilter} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
