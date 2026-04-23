import { Link } from 'react-router-dom'

export default function TopNav() {
  return (
    <div className="relative flex items-center h-14 px-6 flex-shrink-0 border-b border-hair"
         style={{ background: 'linear-gradient(180deg, #0f0d0a 0%, #14110d 100%)' }}>
      <div className="pointer-events-none absolute left-0 right-0 -bottom-px h-px opacity-50"
           style={{ background: 'linear-gradient(90deg, transparent 0%, #5a6e48 20%, #5a6e48 80%, transparent 100%)' }} />

      <Link to="/" className="flex items-center gap-3 pr-6">
        <svg viewBox="0 0 28 28" fill="none" stroke="#8aa074" strokeWidth="1.2" className="w-[26px] h-[26px]">
          <path d="M14 2 L26 14 L14 26 L2 14 Z" />
          <path d="M14 6 L22 14 L14 22 L6 14 Z" opacity=".6" />
          <circle cx="14" cy="14" r="2" fill="#8aa074" stroke="none" />
        </svg>
        <div className="flex flex-col leading-none">
          <span className="font-display text-[17px] font-semibold text-text tracking-[.08em]">Soulmask</span>
          <span className="text-[9px] text-text-dim tracking-widest2 uppercase mt-[3px]">Recipe Codex</span>
        </div>
      </Link>

      <div className="w-px h-8 bg-hair mx-1" />

      <div className="flex items-stretch h-full ml-4">
        <button disabled className="relative px-[22px] flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[.15em] text-text bg-transparent">
          Recipes
          <span className="text-green text-[10px] tracking-[.08em] font-semibold">[R]</span>
          <span className="absolute left-[18%] right-[18%] bottom-0 h-[2px] bg-green"
                style={{ boxShadow: '0 0 8px rgba(138,160,116,.4)' }} />
        </button>
      </div>
    </div>
  )
}
