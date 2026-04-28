import type { TechTier as TechTierType } from '../lib/types'
import TechNode from './TechNode'

const TIER_COLORS = [
  '#9a9a9a', // Normal (Campfire)
  '#5a9e4b', // Fine (Bonfire)
  '#4a7ec2', // Superior (Bronze Pit)
  '#9b59b6', // Excellent (Iron Pit)
  '#e67e22', // Epic (Steel Pit)
  '#e74c3c', // Legendary (Fine Steel Pit)
]

interface Props {
  tier: TechTierType
  tierIndex: number
  expandedNodeId: string | null
  onToggleNode: (id: string) => void
  hoveredNodeId: string | null
  onHoverNode: (id: string | null) => void
  highlightedNodes?: Set<string>
  initialOpenSubId?: string | null
}

export default function TechTier({ tier, tierIndex, expandedNodeId, onToggleNode, hoveredNodeId, onHoverNode, highlightedNodes, initialOpenSubId }: Props) {
  const isHighlighted = (id: string) => highlightedNodes?.has(id) ?? false
  const isDimmed = (id: string) => !!hoveredNodeId && !isHighlighted(id)
  const color = TIER_COLORS[tierIndex] ?? TIER_COLORS[0]
  const colCount = tier.columns.length

  return (
    <div className="flex-none border border-hair bg-panel overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-hair">
        <svg viewBox="0 0 14 14" className="w-[14px] h-[14px] flex-shrink-0" fill="none" stroke={color} strokeWidth="1" strokeLinecap="square">
          <path d="M7 1 L13 7 L7 13 L1 7 Z" />
          <path d="M7 4 L10 7 L7 10 L4 7 Z" fill={color} stroke="none" opacity=".6" />
        </svg>
        <span className="font-display text-[15px] font-semibold tracking-[.04em]" style={{ color }}>{tier.name}</span>
        <span className="text-[10px] tracking-[.14em] uppercase text-text-dim font-medium">Lv.{tier.awareness_level}</span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${color}80 0%, transparent 100%)` }} />
      </div>

      <div className="flex p-2" style={{ minWidth: colCount * 180 + (colCount - 1) * 24 }}>
        {tier.columns.map((col, colIdx) => (
          <div
            key={colIdx}
            className="flex-none flex flex-col gap-1"
            style={{ width: 180, marginLeft: colIdx > 0 ? 24 : 0 }}
          >
            {col.map(node => (
              <div
                key={node.id}
                onMouseEnter={() => onHoverNode(node.id)}
                onMouseLeave={() => onHoverNode(null)}
              >
                <TechNode
                  node={node}
                  isExpanded={expandedNodeId === node.id}
                  onToggle={() => onToggleNode(node.id)}
                  highlighted={isHighlighted(node.id)}
                  dimmed={isDimmed(node.id)}
                  initialOpenSubId={expandedNodeId === node.id ? initialOpenSubId : undefined}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
