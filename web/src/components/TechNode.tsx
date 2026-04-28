import { useState, useEffect } from 'react'
import type { TechMainNode } from '../lib/types'
import TechSubNode from './TechSubNode'

interface Props {
  node: TechMainNode
  isExpanded: boolean
  onToggle: () => void
  highlighted?: boolean
  dimmed?: boolean
  initialOpenSubId?: string | null
}

export default function TechNode({ node, isExpanded, onToggle, highlighted, dimmed, initialOpenSubId }: Props) {
    const [openSubId, setOpenSubId] = useState<string | null>(initialOpenSubId ?? null)

    useEffect(() => {
      if (initialOpenSubId) setOpenSubId(initialOpenSubId)
    }, [initialOpenSubId])
    const name = node.name || node.name_zh || node.id

    return (
      <div
        data-node-id={node.id}
        className={`transition-all ${
          dimmed ? 'opacity-30' : ''
        } ${
          isExpanded
            ? 'border border-green-dim overflow-hidden'
            : highlighted
              ? 'border border-green-dim/50'
              : 'border border-hair'
        }`}
      >
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[11px] transition-colors ${
            isExpanded
              ? 'bg-green/10 text-green font-semibold'
              : 'bg-panel text-text-mute hover:bg-panel-hi'
          }`}
        >
          <span className={`text-[9px] ${isExpanded ? 'text-green' : 'text-text-dim'}`}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span className="flex-1 truncate">{name}</span>
          <span className="text-text-dim text-[10px] shrink-0">
            {node.sub_nodes.length}
          </span>
        </button>

        {isExpanded && node.sub_nodes.length > 0 && (
          <div className="border-t border-green-dim/15 bg-green/[0.02] px-1.5 py-1 pl-5 flex flex-col gap-1">
            {node.sub_nodes.map(sub => (
              <TechSubNode
                key={sub.id}
                node={sub}
                isOpen={openSubId === sub.id}
                onToggle={() => setOpenSubId(openSubId === sub.id ? null : sub.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
}
