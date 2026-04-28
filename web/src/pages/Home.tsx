import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { itemPath } from '../lib/graph'

const CHANGELOG: { type: 'feat' | 'fix'; text: string }[] = [
  { type: 'feat', text: 'Browse the full tech tree with tier groupings, dependency lines, and recipe previews' },
  { type: 'feat', text: 'Spawn maps show where creatures live on both Cloud & Mist and Shifting Sands' },
  { type: 'feat', text: 'Seed farming info — planting requirements and how to get seeds' },
  { type: 'feat', text: 'Preview how quality tiers affect weapon damage and durability' },
  { type: 'feat', text: 'See base stats (damage, armor, durability) on weapons and equipment' },
  { type: 'feat', text: 'Filter drop sources by creature, chest, or gathering node' },
  { type: 'feat', text: 'Item descriptions now show in English' },
  { type: 'feat', text: 'Tech tree unlocks show the full research path' },
  { type: 'feat', text: 'Item pages now show where to get materials and what tech to unlock' },
  { type: 'fix',  text: 'Removed duplicate tech unlocks and drop source entries' },
]

const FEATURED: { id: string; label: string; blurb: string }[] = [
  { id: 'Daoju_Item_TieDing',  label: 'Iron Ingot',      blurb: 'Smelted from iron ore and carbon powder in the Blast Furnace.' },
  { id: 'BP_GongJu_FuZi_4',    label: 'Iron Axe',        blurb: 'A top-tier gathering tool. Follow the chain from iron ore + hardwood + leather.' },
  { id: 'DaoJu_Item_PiGe_3',   label: 'Premium Leather', blurb: 'A multi-step tanning chain from raw hide to finished leather.' },
  { id: 'Daoju_Item_GangDing', label: 'Steel Ingot',     blurb: 'Iron ingots refined with coal — prerequisite for steel weapons and armor.' },
]

function MaskSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className}>
      <g stroke="#8aa074" strokeWidth=".6" opacity=".5">
        <line x1="100" y1="8" x2="100" y2="192" />
        <line x1="8" y1="100" x2="192" y2="100" />
      </g>
      <g stroke="#8aa074" strokeWidth=".4" opacity=".2">
        <line x1="28" y1="28" x2="172" y2="172" />
        <line x1="172" y1="28" x2="28" y2="172" />
      </g>
      <g fill="#8aa074">
        <path d="M100 8 L104 20 L100 26 L96 20 Z" />
        <path d="M100 192 L104 180 L100 174 L96 180 Z" />
        <circle cx="8" cy="100" r="2.5" />
        <circle cx="192" cy="100" r="2.5" />
      </g>
      <circle cx="100" cy="100" r="74" fill="none" stroke="#8aa074" strokeWidth=".5" opacity=".35" />
      <circle cx="100" cy="100" r="58" fill="none" stroke="#8aa074" strokeWidth=".5" opacity=".35" />
      <g transform="translate(150 50)">
        <circle r="8" fill="#b8a060" opacity=".7" />
        <circle cx="3" r="8" fill="#161815" />
      </g>
      <path d="M100 44 L138 100 L100 156 L62 100 Z" fill="#1c1f1b" stroke="#8aa074" strokeWidth="2" />
      <circle cx="86" cy="92" r="4.5" fill="#b8a060" />
      <circle cx="114" cy="92" r="4.5" fill="#b8a060" />
      <circle cx="86" cy="92" r="1.5" fill="#d8dcc8" />
      <circle cx="114" cy="92" r="1.5" fill="#d8dcc8" />
      <path d="M100 96 L100 124" stroke="#8aa074" strokeWidth="1.2" fill="none" />
      <path d="M95 134 L105 134 L100 142 Z" fill="#8aa074" />
      <path d="M100 56 L106 64 L100 72 L94 64 Z" fill="#8aa074" opacity=".8" />
    </svg>
  )
}

export default function Home() {
  const graph = useStore(s => s.graph)
  const status = useStore(s => s.graphStatus)
  if (status === 'loading' || !graph) return <div className="p-8 text-text-dim">Loading…</div>

  const byId = new Map(graph.items.map(i => [i.id, i]))
  const available = FEATURED.filter(f => byId.has(f.id))

  const stationCount = new Set(graph.recipes.map(r => r.st).filter(Boolean)).size
  const categoryCount = new Set(graph.items.map(i => i.cat).filter(Boolean)).size

  return (
    <div className="-mx-9 -mt-7">
      <Helmet>
        <title>Soulmask Codex — Atlas of the Crafted World</title>
        <meta name="description" content={`Browse ${graph.items.length.toLocaleString()} items and ${graph.recipes.length.toLocaleString()} recipes — crafting chains, drop sources, tech tree, and food buffs for Soulmask.`} />
        <link rel="canonical" href="https://soulmask-codex.fly.dev/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Soulmask Codex — Atlas of the Crafted World" />
        <meta property="og:description" content="Every weapon, tool, recipe, and material traced from raw resource to final form. Crafting chains, drop sources, tech tree, and food buffs." />
        <meta property="og:url" content="https://soulmask-codex.fly.dev/" />
        <meta name="twitter:title" content="Soulmask Codex — Atlas of the Crafted World" />
        <meta name="twitter:description" content="Every weapon, tool, recipe, and material traced from raw resource to final form." />
      </Helmet>
      {/* Hero */}
      <div className="m-6 border border-hair relative overflow-hidden"
           style={{
             background: 'radial-gradient(ellipse 900px 500px at 50% 30%, rgba(138,160,116,.08), transparent 60%), radial-gradient(ellipse 700px 400px at 80% 90%, rgba(184,160,96,.05), transparent 60%), linear-gradient(180deg, #1c1f1b 0%, #161815 100%)',
           }}>
        {/* Sparkles */}
        {[
          { top: '12%', left: '8%' },  { top: '18%', left: '88%' },
          { top: '68%', left: '5%' },  { top: '75%', left: '92%' },
          { top: '40%', left: '3%' },  { top: '55%', left: '96%' },
        ].map((s, i) => (
          <div key={i} className="absolute w-[2px] h-[2px] bg-green rounded-full opacity-60" style={s} />
        ))}

        {/* Two-column body */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-14 px-12 py-14 relative z-10">
          {/* Left: mark with orbit rings */}
          <div className="relative w-[200px] h-[200px]">
            <div className="absolute -inset-5 rounded-full border border-hair opacity-50" />
            <div className="absolute -inset-11 rounded-full border border-hair opacity-25" />
            <MaskSvg className="w-full h-full" />
          </div>

          {/* Right: copy */}
          <div>
            <div className="flex items-center gap-3.5 mb-5 text-[11px] tracking-[.4em] uppercase text-gold">
              <span className="w-10 h-px bg-gold opacity-50" />
              V1.0 · The Crafted World
            </div>

            <h1 className="font-heading font-bold tracking-[.1em] text-text leading-none mb-1"
                style={{ fontSize: 48, textShadow: '0 4px 24px rgba(138,160,116,.15)' }}>
              SOULMASK
            </h1>
            <h2 className="font-heading font-black tracking-[.1em] text-green leading-none mb-3"
                style={{ fontSize: 48 }}>
              CODEX
            </h2>
            <p className="font-display italic text-[20px] font-medium text-green opacity-85 tracking-wider2 mb-5">
              Atlas of the Crafted World
            </p>
            <p className="text-[14px] text-text-mute max-w-md leading-relaxed">
              Every weapon, tool, ritual mask and trade — traced from raw material to final form.
              One compass for the crafted world.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex border-t border-hair">
          {[
            { num: graph.recipes.length.toLocaleString(), label: 'Recipes Traced' },
            { num: graph.items.length.toLocaleString(), label: 'Items Indexed' },
            { num: String(stationCount), label: 'Stations' },
            { num: String(categoryCount), label: 'Categories' },
          ].map((s, i) => (
            <div key={i} className="flex-1 flex flex-col px-6 py-5 border-r border-hair last:border-r-0">
              <span className="font-heading text-[22px] font-bold text-green tracking-[.04em] mb-1">
                {s.num}
              </span>
              <span className="text-[10px] tracking-[.3em] uppercase text-text-dim">
                ◆ {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured chains + Changelog */}
      <div className="px-9 pt-10 pb-12 max-w-[1100px] mx-auto grid grid-cols-2 gap-8">
        {/* Featured chains */}
        <div>
          <div className="flex items-center gap-3.5 mb-5">
            <span className="text-[12px] text-green">◆</span>
            <span className="font-heading text-[11px] tracking-[.32em] uppercase text-text-dim">Featured Chains</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(138,160,116,.14)' }} />
          </div>

          <div className="grid gap-2">
            {available.map(f => {
              const item = byId.get(f.id)!
              return (
                <Link
                  key={f.id}
                  to={itemPath(item)}
                  className="relative block p-4 bg-panel border border-hair-strong hover:border-green-dim transition-colors"
                >
                  <div className="pointer-events-none absolute -top-px -left-px -right-px h-px opacity-60"
                       style={{ background: 'linear-gradient(90deg, transparent, #5a6e48 30%, #5a6e48 70%, transparent)' }} />
                  <div className="font-display text-[18px] text-text mb-1 tracking-[.02em] font-semibold">{f.label}</div>
                  <div className="text-[12px] text-text-mute">{f.blurb}</div>
                </Link>
              )
            })}
            {available.length === 0 && (
              <p className="text-text-dim text-xs italic">
                Featured items aren't in the database yet — use the sidebar search to find something.
              </p>
            )}
          </div>
        </div>

        {/* Changelog */}
        <div>
          <div className="flex items-center gap-3.5 mb-5">
            <span className="text-[12px] text-gold">◆</span>
            <span className="font-heading text-[11px] tracking-[.32em] uppercase text-text-dim">Changelog</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(184,160,96,.14)' }} />
          </div>

          <div className="grid gap-1.5">
            {CHANGELOG.map((entry, i) => (
              <div key={i} className="flex gap-3 px-3 py-2.5 bg-panel border border-hair-strong">
                <span className={`shrink-0 w-[38px] text-center mt-[3px] text-[9px] font-bold uppercase tracking-wider py-0.5 rounded ${
                  entry.type === 'feat' ? 'bg-green/15 text-green' : 'bg-gold/15 text-gold'
                }`}>
                  {entry.type}
                </span>
                <span className="text-[12px] text-text-mute leading-snug mt-[3px]">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
