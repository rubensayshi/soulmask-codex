# Mobile responsive implementation plan

**Goal:** Make Soulmask Codex usable for quick lookups on mobile (375px+) using Tailwind responsive utilities on existing components.

**Architecture:** Single `md:` breakpoint (768px). No new components except local state in TopNav for search/menu overlays. No new dependencies, no new global state.

**Tech Stack:** Tailwind CSS responsive utilities, inline SVG icons, existing `searchApi` from `lib/api`.

---

## File structure

| File | Change |
| --- | --- |
| `web/src/components/Sidebar.tsx` | Add `hidden md:flex` |
| `web/src/components/Layout.tsx` | Responsive content padding |
| `web/src/components/TopNav.tsx` | Mobile nav icons, search overlay, hamburger menu, compact logo |
| `web/src/pages/Home.tsx` | Responsive grid, heading sizes, hero padding, stats strip |
| `web/src/pages/Item.tsx` | ItemHeader stacking, flow-vert mobile override |
| `web/src/components/ItemHeader.tsx` | Stack icon + title vertically on narrow screens |
| `web/src/pages/AwarenessXp.tsx` | `overflow-x-auto` wrapper, filter padding |
| `web/src/pages/FoodAlmanac.tsx` | Scrollable tabs + sort row, sub-header stacking |
| `web/src/pages/TechTree.tsx` | Toolbar wrap to two rows |
| `web/src/styles/components.css` | `flow-vert` mobile margin override |

---

### Task 1: Sidebar — hide below md

**Files:**
- Modify: `web/src/components/Sidebar.tsx:54`

- [ ] **Step 1: Add `hidden md:flex` to sidebar root**

Change the `<aside>` className from:
```
relative w-[264px] flex-shrink-0 border-r border-hair bg-bg-2 flex flex-col
```
to:
```
hidden md:relative md:flex w-[264px] flex-shrink-0 border-r border-hair bg-bg-2 md:flex-col
```

Wait — that's wrong. `hidden` sets `display: none`, and `md:flex` overrides it to `display: flex` at 768px+. But `flex-col` also needs `md:` prefix since the element is hidden below that. Actually no — when `hidden` is active, `flex-col` is irrelevant. When `md:flex` kicks in, `flex-col` applies. So:

```
hidden md:flex w-[264px] flex-shrink-0 border-r border-hair bg-bg-2 flex-col
```

Also update the empty-state return (line 25) similarly. Change:
```tsx
return <aside className="w-[264px] flex-shrink-0 border-r border-hair bg-bg-2" />
```
to:
```tsx
return <aside className="hidden md:block w-[264px] flex-shrink-0 border-r border-hair bg-bg-2" />
```

- [ ] **Step 2: Verify**

Run: `pnpm --dir web dev` (or check existing dev server)
Resize browser below 768px — sidebar should disappear. Above 768px — unchanged.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Sidebar.tsx
git commit -m "feat: hide sidebar below md breakpoint for mobile"
```

---

### Task 2: Layout — responsive content padding

**Files:**
- Modify: `web/src/components/Layout.tsx:12`

- [ ] **Step 1: Change content area padding**

Change:
```tsx
<div className="px-9 pt-7 pb-12 max-w-[1400px] mx-auto">
```
to:
```tsx
<div className="px-4 pt-4 pb-12 md:px-9 md:pt-7 max-w-[1400px] mx-auto">
```

- [ ] **Step 2: Verify**

At mobile width: tighter padding (16px horizontal, 16px top). At desktop: unchanged (36px horizontal, 28px top).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Layout.tsx
git commit -m "feat: responsive content padding in Layout"
```

---

### Task 3: TopNav — mobile navigation

This is the biggest change. The TopNav needs:
- Compact logo (mark + "CODEX" only, hide subtitle and full brand name)
- 4 icon-only nav buttons (hidden on desktop, visible on mobile)
- Desktop text tabs hidden on mobile
- Search icon that toggles an inline search bar below the nav
- Hamburger icon that opens a dropdown with full-text nav links
- Reduced height on mobile (48px vs 72px)

**Files:**
- Modify: `web/src/components/TopNav.tsx`

- [ ] **Step 1: Add local state for search and menu**

Add to imports:
```tsx
import { useMemo, useState, useRef, useEffect } from 'react'
```

Add inside the component, after the existing hooks:
```tsx
const [searchOpen, setSearchOpen] = useState(false)
const [menuOpen, setMenuOpen] = useState(false)
const searchInputRef = useRef<HTMLInputElement>(null)
const [query, setQuery] = useState('')
const [hits, setHits] = useState<SearchHit[]>([])
```

Add import for search API and types:
```tsx
import { search as searchApi, type SearchHit } from '../lib/api'
```

Add search effect (debounced, same as Sidebar):
```tsx
useEffect(() => {
  if (!searchOpen) { setHits([]); setQuery(''); return }
  if (!query.trim()) { setHits([]); return }
  const handle = setTimeout(() => {
    searchApi(query.trim()).then(setHits).catch(() => setHits([]))
  }, 150)
  return () => clearTimeout(handle)
}, [query, searchOpen])
```

Add focus effect when search opens:
```tsx
useEffect(() => {
  if (searchOpen) searchInputRef.current?.focus()
}, [searchOpen])
```

Close menu on route change:
```tsx
useEffect(() => {
  setMenuOpen(false)
  setSearchOpen(false)
}, [pathname])
```

- [ ] **Step 2: Add icon definitions**

Add before the `return` statement, after the `tabs` array:

```tsx
const navIcons = [
  {
    to: recipesTo,
    label: 'Recipes',
    match: (p: string) => p.startsWith('/item/'),
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M4 14V8l4-6 4 6v6" strokeLinejoin="round" />
        <path d="M4 10h8" />
      </svg>
    ),
  },
  {
    to: '/tech-tree',
    label: 'Tech Tree',
    match: (p: string) => p.startsWith('/tech-tree'),
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="8" cy="3" r="2" />
        <circle cx="4" cy="13" r="2" />
        <circle cx="12" cy="13" r="2" />
        <path d="M8 5v3M6.5 8 4 11M9.5 8 12 11" />
      </svg>
    ),
  },
  {
    to: '/awareness-xp',
    label: 'Awareness XP',
    match: (p: string) => p === '/awareness-xp',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M8 1v5M5 3l3 3 3-3M4 9h8l-1 6H5L4 9Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: '/food-almanac',
    label: 'Food Almanac',
    match: (p: string) => p === '/food-almanac',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M5 1c-2 3-2 5 0 7M11 1c2 3 2 5 0 7" />
        <path d="M4 8h8v2a4 4 0 01-8 0V8Z" strokeLinejoin="round" />
        <path d="M8 14v1" />
      </svg>
    ),
  },
]
```

- [ ] **Step 3: Update the nav bar container**

Change the outer `<div>` from:
```tsx
<div className="relative flex items-center h-[72px] px-8 flex-shrink-0 border-b border-hair"
```
to:
```tsx
<div className="relative flex items-center h-[48px] md:h-[72px] px-3 md:px-8 flex-shrink-0 border-b border-hair"
```

- [ ] **Step 4: Update logo section**

Change the logo `<Link>` from:
```tsx
<Link to="/" className="flex items-center gap-3 pr-7 mr-3 h-full border-r border-hair">
  <img src={markSvg} alt="Soulmask Codex" className="w-[36px] h-[36px]" />
  <div className="flex flex-col gap-1">
    <div className="font-heading text-[14px] font-bold text-text tracking-[.2em]">
      SOULMASK <span className="text-green" style={{ fontWeight: 800 }}>CODEX</span>
    </div>
    <div className="font-display italic text-[12px] font-medium text-gold tracking-[.14em]">
      Atlas of the Crafted World
    </div>
  </div>
</Link>
```
to:
```tsx
<Link to="/" className="flex items-center gap-2 md:gap-3 pr-3 md:pr-7 mr-2 md:mr-3 h-full border-r border-hair">
  <img src={markSvg} alt="Soulmask Codex" className="w-[28px] h-[28px] md:w-[36px] md:h-[36px]" />
  <div className="flex flex-col gap-1">
    <div className="font-heading text-[14px] font-bold text-text tracking-[.2em]">
      <span className="hidden md:inline">SOULMASK </span><span className="text-green" style={{ fontWeight: 800 }}>CODEX</span>
    </div>
    <div className="hidden md:block font-display italic text-[12px] font-medium text-gold tracking-[.14em]">
      Atlas of the Crafted World
    </div>
  </div>
</Link>
```

- [ ] **Step 5: Add mobile icon nav + search/hamburger buttons**

After the logo `<Link>`, add the mobile icon nav:
```tsx
{/* Mobile icon nav */}
<div className="flex md:hidden items-stretch h-full">
  {navIcons.map(nav => {
    const active = nav.match(pathname)
    return (
      <Link
        key={nav.label}
        to={nav.to}
        className={`relative flex items-center px-2.5 transition-colors ${active ? 'text-green' : 'text-text-mute'}`}
      >
        {nav.icon}
        {active && (
          <span className="absolute left-2 right-2 bottom-0 h-[2px] bg-green" />
        )}
      </Link>
    )
  })}

  <button
    onClick={() => { setSearchOpen(prev => !prev); setMenuOpen(false) }}
    className={`flex items-center px-2.5 transition-colors ${searchOpen ? 'text-green' : 'text-text-mute'}`}
  >
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
    </svg>
  </button>

  <button
    onClick={() => { setMenuOpen(prev => !prev); setSearchOpen(false) }}
    className={`flex items-center px-2.5 transition-colors ${menuOpen ? 'text-green' : 'text-text-mute'}`}
  >
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
    </svg>
  </button>
</div>
```

- [ ] **Step 6: Hide desktop tabs on mobile**

Change the desktop tabs wrapper from:
```tsx
<div className="flex items-stretch h-full ml-4">
```
to:
```tsx
<div className="hidden md:flex items-stretch h-full ml-4">
```

- [ ] **Step 7: Add search overlay and hamburger dropdown after the nav bar container**

The search and hamburger overlays go inside the outer `<div>` but after all existing content, before the closing `</div>`. They render below the nav bar using absolute positioning.

Add before the final closing `</div>` of the component's return:
```tsx
{/* Mobile search overlay */}
{searchOpen && (
  <div className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-hair bg-bg/95 backdrop-blur px-3 py-2">
    <input
      ref={searchInputRef}
      value={query}
      onChange={e => setQuery(e.target.value)}
      onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false) }}
      placeholder="Search blueprints or materials..."
      className="w-full bg-panel border border-hair px-3 py-2 text-xs text-text outline-none focus:border-green-dim placeholder:text-text-dim"
    />
    {hits.length > 0 && (
      <div className="mt-1 max-h-[60vh] overflow-y-auto">
        {hits.map(hit => (
          <Link
            key={hit.id}
            to={`/item/${hit.id}`}
            onClick={() => setSearchOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] text-text hover:bg-green-bg transition-colors"
          >
            <span className="truncate">{hit.name_en ?? hit.name_zh ?? hit.id}</span>
            {hit.category && <span className="text-[10px] text-text-dim ml-auto flex-shrink-0">{hit.category}</span>}
          </Link>
        ))}
      </div>
    )}
  </div>
)}

{/* Mobile hamburger menu */}
{menuOpen && (
  <div className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-hair bg-bg/95 backdrop-blur">
    {tabs.map(tab => {
      const active = tab.match(pathname)
      return (
        <Link
          key={tab.label}
          to={tab.to}
          onClick={() => setMenuOpen(false)}
          className={`block px-4 py-3 text-[13px] font-medium border-b border-hair transition-colors ${
            active ? 'text-green bg-green-bg' : 'text-text-mute hover:text-text hover:bg-panel/50'
          }`}
        >
          {tab.label}
        </Link>
      )
    })}
  </div>
)}
```

- [ ] **Step 8: Verify**

At mobile width:
- Height is 48px
- Logo shows mark + "CODEX" only
- 4 icon buttons visible, text tabs hidden
- Search icon toggles input below nav, results appear in dropdown
- Hamburger opens full-text nav links
- Escape or navigating to a result closes overlays

At desktop:
- Everything unchanged (72px height, full brand, text tabs)

- [ ] **Step 9: Commit**

```bash
git add web/src/components/TopNav.tsx
git commit -m "feat: mobile TopNav with icon nav, search overlay, and hamburger menu"
```

---

### Task 4: Home page — responsive layout

**Files:**
- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: Make hero full-bleed use responsive negative margins**

The Home component starts with `<div className="-mx-9 -mt-7">`. Since Layout now uses `px-4 pt-4` on mobile, update this to:
```tsx
<div className="-mx-4 -mt-4 md:-mx-9 md:-mt-7">
```

- [ ] **Step 2: Make hero two-column grid responsive**

Change line 101:
```tsx
<div className="grid grid-cols-[auto_1fr] items-center gap-14 px-12 py-14 relative z-10">
```
to:
```tsx
<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-8 md:gap-14 px-5 py-8 md:px-12 md:py-14 relative z-10">
```

- [ ] **Step 3: Center the mask SVG on mobile, hide orbit rings**

Change line 103-106:
```tsx
<div className="relative w-[200px] h-[200px]">
  <div className="absolute -inset-5 rounded-full border border-hair opacity-50" />
  <div className="absolute -inset-11 rounded-full border border-hair opacity-25" />
  <MaskSvg className="w-full h-full" />
</div>
```
to:
```tsx
<div className="relative w-[120px] h-[120px] md:w-[200px] md:h-[200px] mx-auto md:mx-0">
  <div className="hidden md:block absolute -inset-5 rounded-full border border-hair opacity-50" />
  <div className="hidden md:block absolute -inset-11 rounded-full border border-hair opacity-25" />
  <MaskSvg className="w-full h-full" />
</div>
```

- [ ] **Step 4: Center hero text on mobile, reduce heading size**

Change the heading style (line 117):
```tsx
<h1 className="font-heading font-bold tracking-[.1em] text-text leading-none mb-1"
    style={{ fontSize: 48, textShadow: '0 4px 24px rgba(138,160,116,.15)' }}>
```
to:
```tsx
<h1 className="font-heading font-bold tracking-[.1em] text-text leading-none mb-1 text-center md:text-left"
    style={{ fontSize: 'clamp(32px, 8vw, 48px)', textShadow: '0 4px 24px rgba(138,160,116,.15)' }}>
```

Do the same text-center treatment for the CODEX heading, subtitle, version tag, and description paragraph. Add `text-center md:text-left` to each of these elements on lines 111, 120, 124, 127.

For the version tag line (line 111), add center alignment:
```tsx
<div className="flex items-center gap-3.5 mb-5 text-[11px] tracking-[.4em] uppercase text-gold justify-center md:justify-start">
```

- [ ] **Step 5: Make stats strip stack on mobile**

Change the stats strip (line 135):
```tsx
<div className="flex border-t border-hair">
```
to:
```tsx
<div className="grid grid-cols-2 md:flex border-t border-hair">
```

Each stat cell already uses `flex-1` which works fine with flex. For the grid fallback on mobile, the `border-r` on cells needs adjustment. Change each cell (line 142):
```tsx
<div key={i} className="flex-1 flex flex-col px-6 py-5 border-r border-hair last:border-r-0">
```
to:
```tsx
<div key={i} className="flex flex-col px-4 py-3 md:px-6 md:py-5 md:flex-1 border-r border-hair last:border-r-0 [&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r border-b md:border-b-0 [&:nth-child(n+3)]:border-b-0">
```

Actually that's getting complex. Simpler approach — just use the 2-col grid:
```tsx
<div key={i} className="flex flex-col px-4 py-3 md:px-6 md:py-5 md:flex-1 border-b border-hair md:border-b-0 md:border-r md:last:border-r-0">
```

- [ ] **Step 6: Make featured + changelog grid responsive**

Change line 155:
```tsx
<div className="px-9 pt-10 pb-12 max-w-[1100px] mx-auto grid grid-cols-2 gap-8">
```
to:
```tsx
<div className="px-4 pt-8 pb-10 md:px-9 md:pt-10 md:pb-12 max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
```

- [ ] **Step 7: Verify**

At mobile width:
- Hero stacks vertically, mask centered and smaller
- Headings smaller, text centered
- Stats in 2-col grid
- Featured chains and changelog stack vertically

At desktop: unchanged.

- [ ] **Step 8: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "feat: responsive Home page layout for mobile"
```

---

### Task 5: ItemHeader — stack vertically on mobile

**Files:**
- Modify: `web/src/components/ItemHeader.tsx:47`

- [ ] **Step 1: Stack icon + title on narrow screens**

Change the root flex container:
```tsx
className="relative flex items-start gap-5 p-[22px_26px_20px] border border-hair-strong mb-[26px] transition-colors"
```
to:
```tsx
className="relative flex flex-col md:flex-row items-center md:items-start gap-3 md:gap-5 p-[16px_16px_14px] md:p-[22px_26px_20px] border border-hair-strong mb-[26px] transition-colors"
```

- [ ] **Step 2: Center text on mobile**

Add `text-center md:text-left` to the title `<h1>` and the classification `<div>`.

- [ ] **Step 3: Verify**

At mobile: icon on top, title/meta below, centered. At desktop: side-by-side, unchanged.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ItemHeader.tsx
git commit -m "feat: stack ItemHeader vertically on mobile"
```

---

### Task 6: Item page — responsive spawn map layout + flow-vert override

**Files:**
- Modify: `web/src/pages/Item.tsx:135`
- Modify: `web/src/styles/components.css`

- [ ] **Step 1: Make spawn map layout stack on mobile**

Change line 135:
```tsx
<div className="flex gap-5 items-start mb-[26px]">
  <div className="flex-1 min-w-0 [&>div:first-child]:mb-0">
```
to:
```tsx
<div className="flex flex-col md:flex-row gap-5 items-start mb-[26px]">
  <div className="flex-1 min-w-0 w-full [&>div:first-child]:mb-0">
```

Change the spawn map container (line 151):
```tsx
<div className="w-[50%] flex-shrink-0 border border-hair-strong p-2 bg-panel">
```
to:
```tsx
<div className="w-full md:w-[50%] flex-shrink-0 border border-hair-strong p-2 bg-panel">
```

- [ ] **Step 2: Add flow-vert mobile override in components.css**

Add a media query inside the `@layer components` block, after the `.flow-vert` rule:

```css
@media (max-width: 767px) {
  .flow-vert {
    margin-left: -16px;
    left: calc((100% + 32px - 100cqw) / 2);
  }
}
```

This matches the mobile `px-4` (16px) padding in Layout, whereas the desktop uses `px-9` (36px).

- [ ] **Step 3: Verify**

At mobile: spawn map stacks below header, full width. Flow tree has correct margins.
At desktop: unchanged side-by-side layout.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Item.tsx web/src/styles/components.css
git commit -m "feat: responsive Item page layout and flow-vert mobile margins"
```

---

### Task 7: Awareness XP — overflow wrapper and filter padding

**Files:**
- Modify: `web/src/pages/AwarenessXp.tsx`

- [ ] **Step 1: Reduce outer padding on mobile**

Change line 90:
```tsx
<div className="p-6 max-w-4xl">
```
to:
```tsx
<div className="p-2 md:p-6 max-w-4xl">
```

- [ ] **Step 2: Reduce filter panel padding on mobile**

Change line 109:
```tsx
<div className="flex flex-col gap-3 mb-6 p-4 bg-panel border border-hair">
```
to:
```tsx
<div className="flex flex-col gap-3 mb-6 p-2 md:p-4 bg-panel border border-hair">
```

- [ ] **Step 3: Wrap table in overflow-x-auto**

Change line 130:
```tsx
<div className="text-[12px]">
```
to:
```tsx
<div className="text-[12px] overflow-x-auto">
```

- [ ] **Step 4: Verify**

At mobile: table horizontally scrollable, tighter padding. At desktop: unchanged.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/AwarenessXp.tsx
git commit -m "feat: responsive AwarenessXp with scrollable table"
```

---

### Task 8: Food Almanac — scrollable tabs and sort row

**Files:**
- Modify: `web/src/pages/FoodAlmanac.tsx`

- [ ] **Step 1: Make category tabs scrollable on mobile**

Change line 214:
```tsx
<div className="flex border-b border-hair mb-0">
```
to:
```tsx
<div className="flex flex-nowrap overflow-x-auto border-b border-hair mb-0">
```

Remove `flex-1` from each tab button so they use natural width on mobile. Change line 222:
```tsx
className={`relative flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors ${
```
to:
```tsx
className={`relative flex-shrink-0 md:flex-1 flex items-center gap-3 px-4 py-3 text-left transition-colors ${
```

- [ ] **Step 2: Stack sub-header on mobile, make sort pills scrollable**

Change the sub-header container (line 260):
```tsx
<div className="flex items-center justify-between py-3 border-b border-hair">
```
to:
```tsx
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-3 border-b border-hair">
```

Make the sort pill row scrollable. Change line 265:
```tsx
<div className="flex items-center gap-2 text-[11px]">
```
to:
```tsx
<div className="flex flex-nowrap overflow-x-auto items-center gap-2 text-[11px]">
```

Add `flex-shrink-0` to the "by column ->" hint span (line 269):
```tsx
<span className="text-text-faint mx-1 flex-shrink-0">by column →</span>
```

Also add `flex-shrink-0` to the sort "Sort" label:
```tsx
<span className="text-text-dim flex-shrink-0">Sort</span>
```

- [ ] **Step 3: Verify**

At mobile: tabs scroll horizontally, sub-header stacks, sort pills scroll. At desktop: unchanged.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/FoodAlmanac.tsx
git commit -m "feat: scrollable Food Almanac tabs and sort row on mobile"
```

---

### Task 9: Tech Tree — toolbar wrap to two rows

**Files:**
- Modify: `web/src/pages/TechTree.tsx`

- [ ] **Step 1: Update full-bleed negative margins for mobile**

Change line 406:
```tsx
<div className="-mx-9 -mt-7">
```
to:
```tsx
<div className="-mx-4 -mt-4 md:-mx-9 md:-mt-7">
```

- [ ] **Step 2: Make top bar wrap to two rows on mobile**

Change line 408:
```tsx
<div className="sticky top-0 z-20 flex items-center gap-3 border-b border-hair bg-bg/95 backdrop-blur px-5 py-2.5">
```
to:
```tsx
<div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 md:gap-3 border-b border-hair bg-bg/95 backdrop-blur px-3 md:px-5 py-2 md:py-2.5">
```

- [ ] **Step 3: Make search input full-width on mobile (second row)**

Change the search input (line 439):
```tsx
<input
  type="text"
  placeholder="Search tech nodes..."
  value={searchQuery}
  onChange={e => setSearchQuery(e.target.value)}
  className="w-52 border border-hair bg-panel px-3 py-1 text-[11px] text-text placeholder-text-dim outline-none focus:border-green-dim"
/>
```
to:
```tsx
<input
  type="text"
  placeholder="Search tech nodes..."
  value={searchQuery}
  onChange={e => setSearchQuery(e.target.value)}
  className="w-full md:w-52 order-last md:order-none border border-hair bg-panel px-3 py-1 text-[11px] text-text placeholder-text-dim outline-none focus:border-green-dim"
/>
```

The `order-last` pushes it to a new row when the flex container wraps. `w-full` makes it span the full width on that row.

- [ ] **Step 4: Tighten budget bar padding on mobile**

Change line 450:
```tsx
<div className="sticky top-[41px] z-20 border-b border-hair bg-bg/95 backdrop-blur px-5 py-2">
```
to:
```tsx
<div className="sticky top-[41px] z-20 border-b border-hair bg-bg/95 backdrop-blur px-3 md:px-5 py-2">
```

- [ ] **Step 5: Verify**

At mobile: title + mode buttons + planner toggle on row 1, search full-width on row 2. Budget bar tighter.
At desktop: unchanged single row.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/TechTree.tsx
git commit -m "feat: responsive Tech Tree toolbar with wrapping search"
```

---

### Task 10: Final visual QA pass

- [ ] **Step 1: Test all pages at 375px, 414px, 768px, 1280px**

Pages to check:
- `/` — hero, stats, featured, changelog
- `/item/Daoju_Item_TieDing` — header, flow tree, sections
- `/tech-tree` — toolbar, planner, tree scrolling
- `/awareness-xp` — filters, table scroll
- `/food-almanac` — tabs, sort pills, table

- [ ] **Step 2: Test TopNav interactions**

- Search icon → input appears, type → results, click result → navigates + closes
- Hamburger → full links, click → navigates + closes
- Escape → closes search
- Route change → both close

- [ ] **Step 3: Fix any regressions found**

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: mobile responsive visual polish"
```
