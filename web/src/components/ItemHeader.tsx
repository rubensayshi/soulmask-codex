import type { Item, Recipe, Station } from '../lib/types'
import Diamond from './Diamond'

interface Props {
  item: Item
  recipe?: Recipe
  station?: Station
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'gold' | 'rust' }) {
  const color =
    accent === 'green' ? 'text-green' :
    accent === 'gold'  ? 'text-gold'  :
    accent === 'rust'  ? 'text-rust'  :
    'text-text'
  return (
    <div className="flex items-center gap-[7px] text-[11.5px] text-text-mute">
      <span className="w-[5px] h-[5px] rotate-45 bg-green opacity-80 flex-shrink-0" />
      <span className="text-text-dim uppercase text-[10px] tracking-[.1em] font-medium">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  )
}

export default function ItemHeader({ item, recipe, station }: Props) {
  const title = item.n ?? item.nz ?? item.id
  const classification =
    item.role === 'raw' ? 'Raw Material'
    : item.role === 'standalone' ? (item.cat ?? 'Drop')
    : (item.cat ?? 'Crafted')
  const showsCraftMeta = item.role === 'final' || item.role === 'intermediate'

  return (
    <div
      className="relative flex items-start gap-5 p-[22px_26px_20px] border border-hair-strong mb-[26px]"
      style={{ background: 'linear-gradient(180deg, rgba(138,160,116,.04) 0%, transparent 60%), #242822' }}
    >
      {/* Green hairline top border */}
      <div className="pointer-events-none absolute -top-px -left-px -right-px h-[2px]"
           style={{ background: 'linear-gradient(90deg, transparent 0%, #5a6e48 15%, #8aa074 50%, #5a6e48 85%, transparent 100%)' }} />
      {/* Thin separator under title block */}
      <div className="pointer-events-none absolute left-[26px] right-[26px] bottom-[18px] h-px"
           style={{ background: 'linear-gradient(90deg, #4a5040, transparent)' }} />

      <div className="flex-shrink-0">
        <Diamond item={item} size={72} variant="green-lit" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-display text-[24px] font-semibold text-text leading-[1.2] tracking-[.02em]">{title}</div>
        <div className="text-[11px] text-text-dim tracking-[.12em] uppercase mt-[3px] font-medium">
          Classification: {classification}
        </div>
        {item.dz && (
          <div className="text-[12px] text-text-mute mt-[6px] leading-[1.5] max-w-[600px]">{item.dz}</div>
        )}

        <div className="flex flex-wrap gap-[18px] mt-[14px]">
          {showsCraftMeta ? (
            <>
              {station?.n && <Stat label="Station" value={station.n} accent="green" />}
              {recipe?.t != null && <Stat label="Craft Time" value={`${recipe.t}s`} />}
              {recipe?.prof && <Stat label="Skill" value={recipe.prof} accent="gold" />}
              {recipe?.profXp != null && <Stat label="Skill XP" value={`${recipe.profXp}`} accent="gold" />}
              {recipe?.awXp != null && <Stat label="Awareness XP" value={`${recipe.awXp}`} accent="rust" />}
            </>
          ) : (
            <Stat label="Source" value={item.role === 'raw' ? 'Gathered' : 'Dropped'} accent="rust" />
          )}
          {item.w != null && <Stat label="Weight" value={`${Math.round(item.w * 100) / 100}`} />}
          {item.dur != null && <Stat label="Durability" value={`${item.dur}`} />}
        </div>
      </div>
    </div>
  )
}
