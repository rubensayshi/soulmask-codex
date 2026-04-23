import { useStore } from '../store'

function Seg({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-stretch h-[30px] border border-hair bg-bg-2 w-full">
      {options.map(o => (
        <button
          key={o.value}
          className={`flex-1 flex items-center justify-center text-[11px] tracking-[.08em] uppercase font-semibold border-r border-hair last:border-r-0 transition-colors ${
            value === o.value
              ? 'bg-panel-2 text-green-hi'
              : 'text-text-dim hover:text-text-mute'
          }`}
          style={value === o.value ? { boxShadow: 'inset 0 1px 0 rgba(138,160,116,.25)' } : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function TweaksPanel() {
  const open = useStore(s => s.tweaksOpen)
  const setOpen = useStore(s => s.setTweaksOpen)
  const tweaks = useStore(s => s.tweaks)
  const setTweaks = useStore(s => s.setTweaks)

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed right-4 bottom-4 z-[101] w-9 h-9 flex items-center justify-center border border-hair-strong bg-panel text-green hover:text-green-hi hover:border-green-dim transition-colors"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}
        title="Tweaks"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed right-4 bottom-16 z-[100] w-[280px] border border-hair-strong bg-panel"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,.7)' }}
        >
          <div className="pointer-events-none absolute -top-px -left-px -right-px h-[2px]"
               style={{ background: 'linear-gradient(90deg, transparent, #5a6e48, transparent)' }} />

          <div className="px-[18px] pt-[18px] pb-3.5 border-b border-hair">
            <div className="font-display text-[15px] font-semibold text-green-hi tracking-[.1em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green rotate-45 flex-shrink-0" />
              Tweaks
            </div>
          </div>

          <div className="px-[18px] py-3.5 space-y-3.5">
            {/* Show Raw Materials */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <span className="text-[10px] text-text-mute tracking-[.14em] uppercase">Raw Materials Block</span>
                <span className="text-[11px] text-text font-medium">{tweaks.showRaw ? 'shown' : 'hidden'}</span>
              </div>
              <Seg
                options={[{ value: 'show', label: 'Show' }, { value: 'hide', label: 'Hide' }]}
                value={tweaks.showRaw ? 'show' : 'hide'}
                onChange={v => setTweaks({ showRaw: v === 'show' })}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
