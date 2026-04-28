import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { fetchTechTree } from '../lib/api'
import type { TechTreeResponse, TechMode, TechMainNode } from '../lib/types'
import TechTier from '../components/TechTier'
import TechNode from '../components/TechNode'

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

export default function TechTree() {
  const { slug } = useParams<{ slug?: string }>()

  const [mode, setMode] = useState<TechMode>('survival')
  const [data, setData] = useState<TechTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deepLinkedSubId, setDeepLinkedSubId] = useState<string | null>(null)
  const [lines, setLines] = useState<DepLine[]>([])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchTechTree(mode)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [mode])

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
  }, [computeLines, expandedNodeId, data, searchQuery])

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

          <input
            type="text"
            placeholder="Search tech nodes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-52 border border-hair bg-panel px-3 py-1 text-[11px] text-text placeholder-text-dim outline-none focus:border-green-dim"
          />
        </div>

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
                  />
                </div>
              )
            })}
          </div>
        )}

        {data && data.untiered.length > 0 && (
          <div className="px-3 pb-6">
            <div className="border border-hair bg-panel overflow-hidden" style={{ maxWidth: 400 }}>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-hair">
                <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] flex-shrink-0" fill="none" stroke="#b8a060" strokeWidth="1" strokeLinecap="square">
                  <path d="M7 1 L13 7 L7 13 L1 7 Z" />
                  <path d="M7 4 L10 7 L7 10 L4 7 Z" fill="#b8a060" stroke="none" opacity=".6" />
                </svg>
                <span className="font-display text-[15px] font-semibold text-gold tracking-[.04em]">Untiered</span>
                <span className="text-[10px] tracking-[.14em] uppercase text-text-dim font-medium">No prerequisite</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #7a6830 0%, transparent 100%)' }} />
              </div>
              <div className="p-2 flex flex-col gap-1">
                {data.untiered.map(node => (
                  <TechNode
                    key={node.id}
                    node={node}
                    isExpanded={expandedNodeId === node.id}
                    onToggle={() => handleToggleNode(node.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
