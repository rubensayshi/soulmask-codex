import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { fetchTechTree } from '../lib/api'
import type { TechTreeResponse, TechMode, TechMainNode, TechSubNode } from '../lib/types'
import {
  buildPlannerIndex, isAutoLearned, isMainNodeAutoSatisfied,
  resolveSelect, resolveDeselect,
  encodeBuild, decodeBuild,
  type PlannerIndex,
} from '../lib/planner'
import TechTier from '../components/TechTier'
import TechNode from '../components/TechNode'
import PlannerBudgetBar from '../components/PlannerBudgetBar'
import PlannerRecipePanel from '../components/PlannerRecipePanel'
import PlannerConfirmDialog from '../components/PlannerConfirmDialog'

const MODES: { key: TechMode; label: string }[] = [
  { key: 'survival', label: 'Survival' },
  { key: 'soldier', label: 'Warrior' },
  { key: 'management', label: 'Tribe' },
]

interface DepLine {
  fromId: string
  toId: string
  x1: number
  y1: number
  x2: number
  y2: number
}

interface ConfirmState {
  type: 'select' | 'deselect'
  subId: string
  nodes: TechSubNode[]
  totalPoints: number
  ids: string[]
}

export default function TechTree() {
  const { slug } = useParams<{ slug?: string }>()

  const [mode, setMode] = useState<TechMode>(() => {
    const saved = localStorage.getItem('techTree.mode')
    return saved === 'soldier' || saved === 'management' ? saved : 'survival'
  })
  const [data, setData] = useState<TechTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deepLinkedSubId, setDeepLinkedSubId] = useState<string | null>(null)
  const [lines, setLines] = useState<DepLine[]>([])

  // Planner state
  const [plannerMode, setPlannerMode] = useState(() => localStorage.getItem('techTree.planner') !== 'off')
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const hashConsumedRef = useRef(false)

  const idx = useMemo<PlannerIndex | null>(() => {
    if (!data) return null
    return buildPlannerIndex(data)
  }, [data])

  // Load data
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchTechTree(mode)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [mode])

  // Decode URL hash on data load, fall back to localStorage
  useEffect(() => {
    if (!data || !idx || hashConsumedRef.current) return
    const raw = window.location.hash
    if (raw.startsWith('#build=')) {
      hashConsumedRef.current = true
      const hash = raw.slice(7)
      const decoded = decodeBuild(hash, idx.allSubIds)
      if (decoded) {
        if (decoded.mode !== mode) {
          setMode(decoded.mode)
          return
        }
        setSelectedNodeIds(decoded.selected)
        setPlannerMode(true)
      }
      return
    }
    hashConsumedRef.current = true
    const saved = localStorage.getItem(`techTree.build.${mode}`)
    if (saved) {
      try {
        const ids: string[] = JSON.parse(saved)
        const valid = ids.filter(id => idx.subNodes.has(id))
        if (valid.length > 0) {
          setSelectedNodeIds(new Set(valid))
          setPlannerMode(true)
        }
      } catch { /* ignore corrupt data */ }
    }
  }, [data, idx, mode])

  // Persist mode and build to localStorage
  useEffect(() => { localStorage.setItem('techTree.mode', mode) }, [mode])
  useEffect(() => { localStorage.setItem('techTree.planner', plannerMode ? 'on' : 'off') }, [plannerMode])
  useEffect(() => {
    if (!hashConsumedRef.current) return
    if (selectedNodeIds.size > 0) {
      localStorage.setItem(`techTree.build.${mode}`, JSON.stringify([...selectedNodeIds]))
    } else {
      localStorage.removeItem(`techTree.build.${mode}`)
    }
  }, [selectedNodeIds, mode])

  // Sync selections to URL hash (skip until initial decode is done)
  useEffect(() => {
    if (!hashConsumedRef.current && window.location.hash.startsWith('#build=')) return
    if (!plannerMode || !idx || selectedNodeIds.size === 0) {
      if (window.location.hash.startsWith('#build=')) {
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
      return
    }
    const encoded = encodeBuild(mode, selectedNodeIds, idx.allSubIds)
    history.replaceState(null, '', `#build=${encoded}`)
  }, [plannerMode, selectedNodeIds, mode, idx])

  // Deep link
  useEffect(() => {
    if (!slug || !data) return
    for (const tier of data.tiers) {
      const allNodes = tier.columns.flat()
      for (const node of allNodes) {
        if (node.slug === slug) {
          setExpandedNodeId(node.id)
          setTimeout(() => {
            const el = document.querySelector(`[data-node-id="${node.id}"]`)
            el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
          }, 100)
          return
        }
        for (const sub of node.sub_nodes) {
          if (sub.slug === slug) {
            setExpandedNodeId(node.id)
            setDeepLinkedSubId(sub.id)
            setTimeout(() => {
              const el = document.querySelector(`[data-node-id="${node.id}"]`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
            }, 100)
            return
          }
        }
      }
    }
  }, [slug, data])

  // Dependency lines
  const allDeps = useMemo(() => {
    if (!data) return []
    const deps: { fromId: string; toId: string }[] = []
    for (const tier of data.tiers) {
      for (const node of tier.columns.flat()) {
        for (const depId of (node.depends_on || [])) {
          deps.push({ fromId: depId, toId: node.id })
        }
      }
    }
    return deps
  }, [data])

  const computeLines = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || allDeps.length === 0) { setLines([]); return }
    const rect = container.getBoundingClientRect()
    const newLines: DepLine[] = []
    for (const dep of allDeps) {
      const fromEl = container.querySelector(`[data-node-id="${dep.fromId}"]`) as HTMLElement | null
      const toEl = container.querySelector(`[data-node-id="${dep.toId}"]`) as HTMLElement | null
      if (!fromEl || !toEl) continue
      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()
      newLines.push({
        fromId: dep.fromId,
        toId: dep.toId,
        x1: fromRect.right - rect.left + container.scrollLeft,
        y1: fromRect.top + fromRect.height / 2 - rect.top + container.scrollTop,
        x2: toRect.left - rect.left + container.scrollLeft,
        y2: toRect.top + toRect.height / 2 - rect.top + container.scrollTop,
      })
    }
    setLines(newLines)
  }, [allDeps])

  useEffect(() => {
    requestAnimationFrame(computeLines)
  }, [computeLines, expandedNodeId, data, searchQuery, plannerMode])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => requestAnimationFrame(computeLines))
    observer.observe(container)
    container.addEventListener('scroll', computeLines)
    return () => { observer.disconnect(); container.removeEventListener('scroll', computeLines) }
  }, [computeLines])

  const handleToggleNode = useCallback((id: string) => {
    setExpandedNodeId(prev => prev === id ? null : id)
  }, [])

  const matchesSearch = useCallback((node: TechMainNode): boolean => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    if ((node.name || '').toLowerCase().includes(q)) return true
    if ((node.name_zh || '').includes(searchQuery)) return true
    return node.sub_nodes.some(
      s => (s.name || '').toLowerCase().includes(q) || (s.name_zh || '').includes(searchQuery)
    )
  }, [searchQuery])

  const highlightedNodes = useMemo(() => {
    if (!hoveredNodeId) return undefined
    const set = new Set<string>([hoveredNodeId])
    for (const line of lines) {
      if (line.fromId === hoveredNodeId || line.toId === hoveredNodeId) {
        set.add(line.fromId)
        set.add(line.toId)
      }
    }
    return set
  }, [hoveredNodeId, lines])

  // Planner: computed values
  const pointsSpent = useMemo(() => {
    if (!idx) return 0
    let total = 0
    for (const sid of selectedNodeIds) {
      const sub = idx.subNodes.get(sid)
      if (sub) total += sub.points ?? 0
    }
    return total
  }, [selectedNodeIds, idx])

  const mainPrereqsMet = useMemo(() => {
    if (!idx) return new Map<string, boolean>()
    const result = new Map<string, boolean>()
    for (const [mainId] of idx.mainNodes) {
      if (isMainNodeAutoSatisfied(mainId, idx)) {
        result.set(mainId, true)
        continue
      }
      const deps = idx.mainDeps.get(mainId) || []
      const allDepsMet = deps.every(depId => {
        if (isMainNodeAutoSatisfied(depId, idx)) return true
        const depSubs = idx.mainToSubs.get(depId) || []
        return depSubs.some(s => selectedNodeIds.has(s))
      })
      result.set(mainId, allDepsMet)
    }
    return result
  }, [selectedNodeIds, idx])

  // Planner: toggle sub-node
  const handlePlannerToggleSub = useCallback((subId: string) => {
    if (!idx) return
    const sub = idx.subNodes.get(subId)
    if (!sub || isAutoLearned(sub)) return

    if (selectedNodeIds.has(subId)) {
      const result = resolveDeselect(subId, selectedNodeIds, idx)
      if (result.removals.length > 1) {
        const nodes = result.removals
          .filter(id => id !== subId)
          .map(id => idx.subNodes.get(id)!)
          .filter(Boolean)
        setConfirmDialog({
          type: 'deselect',
          subId,
          nodes,
          totalPoints: result.pointsRecovered,
          ids: result.removals,
        })
      } else {
        setSelectedNodeIds(prev => {
          const next = new Set(prev)
          next.delete(subId)
          return next
        })
      }
    } else {
      const result = resolveSelect(subId, selectedNodeIds, idx)
      if (result.additions.length > 1) {
        const nodes = result.additions
          .filter(id => id !== subId)
          .map(id => idx.subNodes.get(id)!)
          .filter(Boolean)
        setConfirmDialog({
          type: 'select',
          subId,
          nodes,
          totalPoints: result.totalCost,
          ids: result.additions,
        })
      } else {
        setSelectedNodeIds(prev => {
          const next = new Set(prev)
          for (const id of result.additions) next.add(id)
          return next
        })
      }
    }
  }, [selectedNodeIds, idx])

  const handleConfirm = useCallback(() => {
    if (!confirmDialog) return
    if (confirmDialog.type === 'select') {
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        for (const id of confirmDialog.ids) next.add(id)
        return next
      })
    } else {
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        for (const id of confirmDialog.ids) next.delete(id)
        return next
      })
    }
    setConfirmDialog(null)
  }, [confirmDialog])

  const handleShare = useCallback(() => {
    const url = window.location.href
    navigator.clipboard.writeText(url).then(() => {
      setToast('Build URL copied!')
      setTimeout(() => setToast(null), 2000)
    })
  }, [])

  const handleClear = useCallback(() => {
    setSelectedNodeIds(new Set())
  }, [])

  const handlePlannerSelectAll = useCallback((mainNodeId: string) => {
    if (!idx) return
    const subs = idx.mainToSubs.get(mainNodeId) || []
    const unselected = subs.filter(sid => {
      const sub = idx.subNodes.get(sid)
      return sub && !isAutoLearned(sub) && !selectedNodeIds.has(sid)
    })
    if (unselected.length === 0) return

    let allAdditions: string[] = []
    for (const sid of unselected) {
      const result = resolveSelect(sid, new Set([...selectedNodeIds, ...allAdditions]), idx)
      allAdditions = [...allAdditions, ...result.additions.filter(id => !allAdditions.includes(id))]
    }

    const uniqueAdditions = [...new Set(allAdditions)]
    const extraPrereqs = uniqueAdditions.filter(id => !unselected.includes(id))
    const totalCost = uniqueAdditions.reduce((sum, sid) => sum + (idx.subNodes.get(sid)?.points ?? 0), 0)

    if (extraPrereqs.length > 0) {
      const nodes = extraPrereqs.map(id => idx.subNodes.get(id)!).filter(Boolean)
      setConfirmDialog({
        type: 'select',
        subId: mainNodeId,
        nodes,
        totalPoints: totalCost,
        ids: uniqueAdditions,
      })
    } else {
      setSelectedNodeIds(prev => {
        const next = new Set(prev)
        for (const id of uniqueAdditions) next.add(id)
        return next
      })
    }
  }, [selectedNodeIds, idx])

  const handleTogglePlanner = useCallback(() => {
    setPlannerMode(prev => !prev)
  }, [])

  return (
    <>
      <Helmet>
        <title>Tech Tree — Soulmask Codex</title>
        <meta name="description" content="Explore the full Soulmask tech tree — every node, unlock requirement, and recipe it grants." />
        <link rel="canonical" href="https://soulmask-codex.fly.dev/tech-tree" />
        <meta property="og:title" content="Tech Tree — Soulmask Codex" />
        <meta property="og:description" content="Explore the full Soulmask tech tree — every node, unlock requirement, and recipe it grants." />
        <meta property="og:url" content="https://soulmask-codex.fly.dev/tech-tree" />
        <meta name="twitter:title" content="Tech Tree — Soulmask Codex" />
        <meta name="twitter:description" content="Explore the full Soulmask tech tree — every node, unlock requirement, and recipe it grants." />
      </Helmet>

      <div className="-mx-9 -mt-7">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-hair bg-bg/95 backdrop-blur px-5 py-2.5">
          <h1 className="font-heading text-[16px] font-bold text-text tracking-[.06em] mr-2">Tech Tree</h1>

          <div className="flex gap-1">
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-[.1em] transition-colors ${
                  mode === m.key
                    ? 'bg-green/15 text-green border border-green-dim'
                    : 'bg-panel text-text-dim border border-hair hover:text-text-mute'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleTogglePlanner}
            className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-semibold tracking-[.06em] transition-colors group"
          >
            <span className={plannerMode ? 'text-green' : 'text-text-dim group-hover:text-text-mute'}>Planner</span>
            <span className={`relative inline-block w-7 h-3.5 rounded-full transition-colors ${plannerMode ? 'bg-green/40' : 'bg-panel-2'}`}>
              <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${plannerMode ? 'left-[14px] bg-green' : 'left-0.5 bg-text-dim'}`} />
            </span>
          </button>

          <input
            type="text"
            placeholder="Search tech nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-52 border border-hair bg-panel px-3 py-1 text-[11px] text-text placeholder-text-dim outline-none focus:border-green-dim"
          />
        </div>

        {/* Budget bar */}
        {plannerMode && (
          <div className="sticky top-[41px] z-20 border-b border-hair bg-bg/95 backdrop-blur px-5 py-2">
            <PlannerBudgetBar
              pointsSpent={pointsSpent}
              nodeCount={selectedNodeIds.size}
              onShare={handleShare}
              onClear={handleClear}
            />
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 bg-green-dim text-text text-[11px] px-3 py-1.5 rounded shadow-lg">
            {toast}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-text-dim text-sm">Loading...</div>
        )}
        {error && (
          <div className="flex items-center justify-center py-20 text-rust text-sm">{error}</div>
        )}

        {data && (
          <div
            ref={scrollContainerRef}
            className="relative flex gap-1 p-3 overflow-x-auto items-start"
          >
            <svg
              className="absolute inset-0 pointer-events-none z-10"
              style={{ width: scrollContainerRef.current?.scrollWidth || '100%', height: scrollContainerRef.current?.scrollHeight || '100%' }}
            >
              {lines.map((line, i) => {
                const active = highlightedNodes?.has(line.fromId) && highlightedNodes?.has(line.toId)
                const dimmed = hoveredNodeId && !active
                const dx = Math.abs(line.x2 - line.x1)
                const cp = Math.min(dx * 0.4, 40)
                return (
                  <path
                    key={i}
                    d={`M ${line.x1} ${line.y1} C ${line.x1 + cp} ${line.y1}, ${line.x2 - cp} ${line.y2}, ${line.x2} ${line.y2}`}
                    stroke="#5a6e48"
                    strokeWidth={active ? 2 : 1}
                    fill="none"
                    opacity={dimmed ? 0.06 : active ? 0.7 : 0.25}
                    className="transition-opacity duration-150"
                  />
                )
              })}
            </svg>

            {data.tiers.map((tier, tierIndex) => {
              const allTierNodes = tier.columns.flat()
              const hasMatch = !searchQuery || allTierNodes.some(matchesSearch)
              return (
                <div
                  key={tier.id}
                  className={`transition-opacity ${hasMatch ? '' : 'opacity-20 pointer-events-none'}`}
                >
                  <TechTier
                    tier={searchQuery ? {
                      ...tier,
                      columns: tier.columns.map(col => col.filter(matchesSearch)),
                    } : tier}
                    tierIndex={tierIndex}
                    expandedNodeId={expandedNodeId}
                    onToggleNode={handleToggleNode}
                    hoveredNodeId={hoveredNodeId}
                    onHoverNode={setHoveredNodeId}
                    highlightedNodes={highlightedNodes}
                    initialOpenSubId={deepLinkedSubId}
                    plannerMode={plannerMode}
                    selectedIds={selectedNodeIds}
                    mainPrereqsMet={mainPrereqsMet}
                    onPlannerToggleSub={handlePlannerToggleSub}
                    onPlannerSelectAll={handlePlannerSelectAll}
                  />
                </div>
              )
            })}
          </div>
        )}


        {/* Recipe summary panel */}
        {plannerMode && data && idx && (
          <PlannerRecipePanel
            selected={selectedNodeIds}
            idx={idx}
            data={data}
          />
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmDialog && (
        <PlannerConfirmDialog
          type={confirmDialog.type}
          nodes={confirmDialog.nodes}
          totalPoints={confirmDialog.totalPoints}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  )
}
