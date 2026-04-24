import { useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { primaryRecipeFor, buildUsedInIndex, resolveItem, hasMatchingFinal, indexItems } from '../lib/graph'
import { fetchItemDetail } from '../lib/api'
import type { ItemDetail } from '../lib/types'
import ItemHeader from '../components/ItemHeader'
import FlowView from '../components/FlowView'
import RawMatsCollapsible from '../components/RawMats'
import UsedIn from '../components/UsedIn'
import ObtainedFrom from '../components/ObtainedFrom'
import TechUnlock from '../components/TechUnlock'
import ItemStats from '../components/ItemStats'

export default function Item() {
  const { id: slugOrId } = useParams<{ id: string }>()

  const pushVisit  = useStore(s => s.pushVisit)
  const graph      = useStore(s => s.graph)
  const tweaks     = useStore(s => s.tweaks)
  const setTweaks  = useStore(s => s.setTweaks)

  const item = useMemo(() => graph && slugOrId ? resolveItem(graph, slugOrId) : undefined, [graph, slugOrId])
  const id = item?.id

  useEffect(() => { if (id) pushVisit(id) }, [id, pushVisit])

  const [detail, setDetail] = useState<ItemDetail | null>(null)
  useEffect(() => {
    if (!id) return
    setDetail(null)
    fetchItemDetail(id).then(setDetail).catch(() => setDetail(null))
  }, [id])

  const recipe = useMemo(() => graph && id ? primaryRecipeFor(graph, id) : undefined, [graph, id])
  const station = useMemo(
    () => recipe?.st ? graph?.stations.find(s => s.id === recipe.st) : undefined,
    [graph, recipe]
  )

  const usedInIdx = useMemo(() => graph ? buildUsedInIndex(graph) : new Map<string, string[]>(), [graph])
  const byId = useMemo(() => graph ? indexItems(graph) : new Map(), [graph])

  const { finalIds, intermediateIds } = useMemo(() => {
    if (!id) return { finalIds: [] as string[], intermediateIds: [] as string[] }
    const directRecipeIds = usedInIdx.get(id) ?? []
    const seen = new Set<string>()
    const outputIds = directRecipeIds
      .map(rid => graph?.recipes.find(r => r.id === rid))
      .filter(r => !!r)
      .map(r => r!.out)
      .filter(oid => seen.has(oid) ? false : (seen.add(oid), true))

    const finals: string[] = []
    const intermediates: string[] = []
    for (const oid of outputIds) {
      const it = byId.get(oid)
      if (!it) continue
      if (it.role === 'intermediate') intermediates.push(oid)
      else finals.push(oid)
    }
    return { finalIds: finals, intermediateIds: intermediates }
  }, [id, usedInIdx, graph, byId])

  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())
  useEffect(() => { setSelectedCats(new Set()) }, [id])

  const finalCats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const fid of finalIds) {
      const cat = byId.get(fid)?.cat ?? 'other'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [finalIds, byId])

  const filteredFinalIds = useMemo(
    () => selectedCats.size === 0 ? finalIds : finalIds.filter(fid => selectedCats.has(byId.get(fid)?.cat ?? 'other')),
    [finalIds, selectedCats, byId]
  )

  const filteredIntermediateIds = useMemo(
    () => selectedCats.size === 0 ? intermediateIds : intermediateIds.filter(iid =>
      hasMatchingFinal(graph!, byId, usedInIdx, iid, selectedCats)
    ),
    [intermediateIds, selectedCats, graph, byId, usedInIdx]
  )

  if (!graph) return <div className="p-8 text-text-dim">Loading…</div>
  if (!item) return <div className="p-8 text-text-dim">Item not found: {slugOrId}</div>

  return (
    <div>
      <ItemHeader item={item} recipe={recipe} station={station} />

      {item.stats && item.stats.length > 0 && (
        <>
          <SectionHeader title="Stats" sub="Equipment Attributes" accent="green" />
          <ItemStats stats={item.stats} />
        </>
      )}

      {detail?.tech_unlocked_by && detail.tech_unlocked_by.length > 0 && (
        <>
          <SectionHeader title="Unlocked By" sub="Tech Tree" accent="gold" />
          <TechUnlock unlocks={detail.tech_unlocked_by} />
        </>
      )}

      {recipe && (
        <>
          <SectionHeader title="Materials Required" sub="Direct Ingredients" accent="green"
            trailing={!tweaks.showRaw ? (
              <button
                onClick={() => setTweaks({ showRaw: true })}
                className="text-text-dim hover:text-rust transition-colors"
                title="Show gathering checklist"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
                  <path d="M1 1h2.5l1.2 2M4.7 3H14l-1.5 6H5.5L4.7 3Z" />
                  <circle cx="6" cy="13" r="1.2" />
                  <circle cx="11.5" cy="13" r="1.2" />
                </svg>
              </button>
            ) : undefined}
          />
          <FlowView graph={graph} rootId={item.id} />
          <RawMatsCollapsible graph={graph} rootId={item.id} />
        </>
      )}

      <SectionHeader title="Used in Final Items" sub="Weapons · Tools · Structures" accent="final" count={selectedCats.size > 0 ? filteredFinalIds.length : finalIds.length} />
      {finalIds.length > 0 && finalCats.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {finalCats.map(([cat, count]) => {
            const active = selectedCats.has(cat)
            return (
              <button key={cat}
                onClick={() => setSelectedCats(prev => {
                  const next = new Set(prev)
                  if (next.has(cat)) next.delete(cat); else next.add(cat)
                  return next
                })}
                className={`px-2.5 py-[3px] text-[10px] tracking-[.08em] uppercase font-medium border transition-colors ${
                  active
                    ? 'bg-green-dim/30 border-green-dim text-green-hi'
                    : 'bg-panel border-hair text-text-dim hover:text-text hover:border-text-dim'
                }`}
              >
                {cat} <span className="tabular-nums opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}
      {finalIds.length > 0
        ? <UsedIn graph={graph} rootId={item.id} filterIds={filteredFinalIds} />
        : <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">Not used in any final item</div>}

      <SectionHeader title="Used in Intermediate Components" sub="Ingredients feeding other recipes" accent="intermediate" count={filteredIntermediateIds.length} />
      {filteredIntermediateIds.length > 0
        ? <UsedIn graph={graph} rootId={item.id} filterIds={filteredIntermediateIds} catFilter={selectedCats} />
        : <div className="p-8 text-center text-[12px] text-text-dim italic border border-dashed border-hair bg-panel">Not used in any intermediate component</div>}

      {detail?.drop_sources && detail.drop_sources.length > 0 && (
        <>
          <SectionHeader title="Obtained From" sub="Drop Sources" accent="rust" />
          <ObtainedFrom sources={detail.drop_sources} />
        </>
      )}
    </div>
  )
}

function Ornament({ accent }: { accent: string }) {
  const color =
    accent === 'green' ? '#8aa074' :
    accent === 'final' ? '#8aa074' :
    accent === 'intermediate' ? '#b8a060' :
    accent === 'gold' ? '#b8a060' :
    accent === 'rust' ? '#a67a52' :
    '#a67a52'
  return (
    <svg viewBox="0 0 14 14" className="w-[14px] h-[14px]" fill="none" stroke={color} strokeWidth="1" strokeLinecap="square">
      <path d="M7 1 L13 7 L7 13 L1 7 Z" />
      <path d="M7 4 L10 7 L7 10 L4 7 Z" fill={color} stroke="none" opacity=".6" />
    </svg>
  )
}

function SectionHeader({ title, sub, accent, count, trailing }: { title: string; sub: string; accent: string; count?: number; trailing?: React.ReactNode }) {
  const gradient =
    accent === 'green' ? 'linear-gradient(90deg, #5a6e48 0%, transparent 100%)' :
    accent === 'final' ? 'linear-gradient(90deg, #5a6e48 0%, transparent 100%)' :
    accent === 'intermediate' ? 'linear-gradient(90deg, #7a6830 0%, transparent 100%)' :
    accent === 'gold' ? 'linear-gradient(90deg, #7a6830 0%, transparent 100%)' :
    accent === 'rust' ? 'linear-gradient(90deg, #6e4d2e 0%, transparent 100%)' :
    'linear-gradient(90deg, #6e4d2e 0%, transparent 100%)'
  const titleColor =
    accent === 'final' ? 'text-green-hi' :
    accent === 'green' ? 'text-green-hi' :
    accent === 'intermediate' ? 'text-gold' :
    accent === 'gold' ? 'text-gold' :
    accent === 'rust' ? 'text-rust' :
    'text-text'
  const countColor =
    accent === 'final' ? 'text-green-hi border-green-dim' :
    accent === 'intermediate' ? 'text-gold border-gold-dim' :
    accent === 'gold' ? 'text-gold border-gold-dim' :
    'text-text-dim border-hair'

  return (
    <div className="flex items-center gap-3.5 mt-7 mb-4">
      <Ornament accent={accent} />
      <span className={`font-display text-[16px] font-semibold tracking-[.04em] flex-shrink-0 ${titleColor}`}>{title}</span>
      <span className="text-[10px] tracking-[.14em] uppercase text-text-dim font-medium ml-1.5 flex-shrink-0">{sub}</span>
      {count != null && (
        <span className={`text-[10px] font-bold tabular-nums px-2 py-[2px] bg-panel border tracking-[.06em] flex-shrink-0 ${countColor}`}>
          {count}
        </span>
      )}
      <div className="flex-1 h-px" style={{ background: gradient }} />
      {trailing}
    </div>
  )
}
