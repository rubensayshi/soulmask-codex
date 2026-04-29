import { estimateLevel, MAX_POINTS } from '../lib/planner'

interface Props {
  pointsSpent: number
  nodeCount: number
  onShare: () => void
  onClear: () => void
}

export default function PlannerBudgetBar({ pointsSpent, nodeCount, onShare, onClear }: Props) {
  const { level, tablets } = estimateLevel(pointsSpent)
  const pct = Math.min(100, (pointsSpent / MAX_POINTS) * 100)

  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="text-text font-semibold">{pointsSpent} pts</span>
      <span className="text-text-dim">{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>

      <div className="flex-1 h-1.5 bg-panel-2 rounded-full overflow-hidden max-w-[200px]">
        <div
          className="h-full bg-green rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {pointsSpent > 0 && (
        <>
          <span className="text-text-mute">
            &asymp; Level {level}{tablets > 0 && ` + ~${tablets} tablet pts`}
          </span>
          <span className="relative group cursor-help">
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-text-dim group-hover:text-text-mute transition-colors" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0ZM7 7h1.25v4H7V7Z" />
            </svg>
            <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-60 bg-bg border border-hair rounded px-3 py-2 text-[10px] text-text-mute leading-relaxed shadow-lg whitespace-normal">
              <span className="font-semibold text-text block mb-1">How points work</span>
              You earn 6 tech points per level. 
              Ancient tablets grant bonus points at certain milestones.
              <span className="block mt-1">The level estimate assumes you've collected a certain amount of tablet bonuses available around that level.</span>
              <span className="block mt-1 text-text-dim">
                Lv 20: +20 &middot; Lv 30: +20 &middot; Lv 35: +13
                <br />
                Lv 40: +13 &middot; Lv 45: +13 &middot; Lv 50: +14
                <br />
                Lv 55: +13 &middot; Lv 60: +14
              </span>
              <span className="block mt-1">Max: {MAX_POINTS} pts at level 60.</span>
            </span>
          </span>
        </>
      )}

      <div className="flex gap-1 ml-auto">
        <button
          onClick={onShare}
          className="px-2 py-0.5 border border-hair text-text-mute hover:text-text hover:border-green-dim transition-colors"
          title="Copy shareable URL"
        >
          Share
        </button>
        <button
          onClick={onClear}
          className="px-2 py-0.5 border border-hair text-text-dim hover:text-rust hover:border-rust-dim transition-colors"
          title="Clear all selections"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
