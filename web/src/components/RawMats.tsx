import { useMemo, useState } from 'react'
import type { Graph } from '../lib/types'
import { computeRawMats, itemPath } from '../lib/graph'
import { useStore } from '../store'
import { Link } from 'react-router-dom'
import Icon from './Icon'

const QTY_PRESETS = [1, 5, 10] as const

interface Props { graph: Graph; rootId: string }

export default function RawMatsCollapsible({ graph, rootId }: Props) {
  const quantity    = useStore(s => s.quantity)
  const setQuantity = useStore(s => s.setQuantity)
  const orSel       = useStore(s => s.orSel)
  const showRaw     = useStore(s => s.tweaks.showRaw)
  const setTweaks   = useStore(s => s.setTweaks)
  const [copied, setCopied] = useState(false)
  const mats = useMemo(
    () => computeRawMats(graph, rootId, quantity, orSel),
    [graph, rootId, quantity, orSel]
  )
  const byId = useMemo(() => new Map(graph.items.map(i => [i.id, i])), [graph])
  const entries = Object.entries(mats).sort((a, b) => b[1] - a[1])
  if (!entries.length) return null

  if (!showRaw) return null

  return (
    <div className="relative mt-3.5 bg-panel border border-hair-strong">
      <div className="pointer-events-none absolute -top-px -left-px -right-px h-px"
           style={{ background: 'linear-gradient(90deg, transparent, #6e4d2e 30%, #6e4d2e 70%, transparent)' }} />

      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-[rgba(166,122,82,.04)] transition-colors"
        onClick={() => setTweaks({ showRaw: false })}
      >
        <svg className="w-4 h-4 text-rust flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M8 1 L14 4.5 L14 11.5 L8 15 L2 11.5 L2 4.5 Z" />
          <path d="M2 4.5 L8 8 L14 4.5 M8 8 L8 15" />
        </svg>
        <div>
          <div className="font-display text-[14px] font-semibold text-text tracking-[.02em]">Total Raw Materials</div>
          <div className="text-[10px] tracking-[.14em] uppercase text-text-dim font-medium">Gathering Checklist</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {QTY_PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setQuantity(p)}
              className={`px-2 py-0.5 border text-[10px] font-semibold transition-colors ${
                quantity === p
                  ? 'border-rust text-rust bg-[rgba(110,77,46,.12)]'
                  : 'border-hair text-text-dim hover:border-rust/40 hover:text-rust'
              }`}
            >×{p}</button>
          ))}
        </div>
        <span className="text-text-dim text-[11px]">▴</span>
      </div>

      <div className="border-t border-hair p-1.5">
        {entries.map(([id, qty]) => {
          const it = byId.get(id)
          return (
            <Link
              key={id}
              to={it ? itemPath(it) : `/item/${id}`}
              className="flex items-center gap-3 px-2.5 py-[7px] hover:bg-[rgba(166,122,82,.04)] transition-colors"
            >
              <Icon item={it} size={26} />
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] text-text truncate">{it?.n ?? it?.nz ?? id}</div>
                <div className="text-[10px] text-text-dim tracking-[.04em]">{it?.cat ?? 'Gathered'}</div>
              </div>
              <span className="text-[13px] font-bold text-rust tabular-nums min-w-[40px] text-right">×{qty}</span>
            </Link>
          )
        })}
        <div className="flex gap-1.5 mx-1.5 mt-1.5 mb-1.5">
          <button
            className={`flex-1 py-2 border text-[10px] tracking-[.18em] uppercase font-semibold transition-colors ${
              copied
                ? 'border-green text-green'
                : 'border-hair text-text-mute hover:border-green-dim hover:text-green-hi'
            }`}
            onClick={() => {
              navigator.clipboard?.writeText(
                entries.map(([id, q]) => `${byId.get(id)?.n ?? id}: ×${q}`).join('\n')
              )
              setCopied(true)
              setTimeout(() => setCopied(false), 1800)
            }}
          >
            {copied ? '✓ Copied to Clipboard' : 'Copy Gathering List'}
          </button>
        </div>
      </div>
    </div>
  )
}
