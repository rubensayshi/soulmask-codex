import type { TechUnlock as TechUnlockType } from '../lib/types'

const MASK_TIERS: Record<number, string> = {
  1: 'Stone',
  2: 'Bone',
  3: 'Bronze',
  4: 'Iron',
  5: 'Steel',
}

interface Props {
  unlocks: TechUnlockType[]
}

export default function TechUnlock({ unlocks }: Props) {
  if (!unlocks.length) return null

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {unlocks.map(u => {
        const name = u.name_en ?? u.name_zh ?? u.id
        const tier = u.required_mask_level != null
          ? MASK_TIERS[u.required_mask_level] ?? `Tier ${u.required_mask_level}`
          : null
        return (
          <div key={u.id} className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] border border-hair bg-panel">
            <svg viewBox="0 0 12 12" className="w-3 h-3 text-gold flex-shrink-0" fill="currentColor">
              <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" />
            </svg>
            <span className="text-text font-medium">{name}</span>
            {tier && <span className="text-text-dim">({tier} Mask)</span>}
          </div>
        )
      })}
    </div>
  )
}
