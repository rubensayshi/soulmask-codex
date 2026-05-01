# Mobile responsive design

Make Soulmask Codex usable for quick lookups on mobile (375px+). Not full feature parity — players checking a recipe mid-game on their phone.

## Approach

Tailwind responsive utilities on existing components. Single `md:` breakpoint (768px). No new components, no new dependencies, no new global state.

## Shell: Layout + TopNav + Sidebar

### Sidebar

Hidden below `md:`. Search moves to TopNav. Recent-visits history dropped on mobile — not needed for quick lookups.

```
Sidebar:  hidden md:flex
```

### TopNav

Desktop (unchanged): logo + subtitle | text tabs | (spacer)

Mobile (below 768px):
- Height: 48px (down from 72px)
- Logo: mark + "CODEX" only. Subtitle ("Atlas of the Crafted World") and full brand name hidden.
- 4 icon-only page nav buttons (inline SVGs, stroke-based, 16x16): anvil/hammer (Recipes), node/branch (Tech Tree), lightning (Awareness XP), leaf/potion (Food Almanac)
- Search icon: toggles an inline search input that appears below the nav bar, pushes content down. Dismisses on blur or Escape. Uses the same `searchApi` as the sidebar, shows results in a dropdown overlay. Navigating to a result closes the search.
- Hamburger icon (rightmost): opens a dropdown overlay with full-text nav links + labels. Supplements the icons for discoverability — users who can't identify an icon tap the hamburger instead.

New component state (local to TopNav):
- `searchOpen: boolean`
- `menuOpen: boolean`

### Layout content area

Padding: `px-4 pt-4 md:px-9 md:pt-7`

## Page: Home

- Featured cards: `grid-cols-1 md:grid-cols-2`
- Hero heading: smaller font size on mobile
- Stats strip + changelog: stack vertically on mobile
- General padding tightened

## Page: Item detail

- ItemHeader: stack icon + title vertically on narrow screens
- FlowView: reduce `flow-vert` full-bleed negative margins on mobile via CSS media query override in `globals.css`
- Stats, drops, seed sources, spawn maps: tighter padding, already column-based
- QualitySelector: horizontal scroll if tiers overflow

## Page: Awareness XP

- Wrap 6-column grid in `overflow-x-auto` container
- Filter rows: already `flex-wrap`, just reduce padding
- No column reduction — horizontal swipe is acceptable for reference tables

## Page: Food Almanac

- Category tabs: remove `flex-1`, set `flex-nowrap`, wrap in `overflow-x-auto`. Each tab at natural width, horizontally scrollable.
- Table: already has `overflow-x-auto` — no change needed
- Sort pill row: `overflow-x-auto flex-nowrap` on mobile
- Sub-header: stack label and sort controls vertically

## Page: Tech Tree

- Top sticky bar: wrap to two rows on mobile. Row 1: title + mode buttons + planner toggle. Row 2: search input full-width.
- Tree content: already `overflow-x-auto`, no change
- Budget bar: tighter padding, remains functional

## TweaksPanel

No changes. Already fixed-position bottom-right, works on narrow screens.

## Not in scope

- Touch gestures (swipe to open sidebar, etc.)
- Bottom navigation bar
- Mobile-specific components (no `MobileNav`, no `MobileLayout`)
- Planner interaction optimization (works via existing UI, just not optimized)
- Food almanac column sorting UX
- Separate mobile routes or layouts

## Files changed

| File | Change |
| --- | --- |
| `Layout.tsx` | Hide sidebar below `md:`, reduce content padding |
| `TopNav.tsx` | Mobile nav icons, search toggle, hamburger menu, compact logo |
| `Sidebar.tsx` | Add `hidden md:flex` (one class) |
| `Home.tsx` | Responsive grid, heading sizes, padding |
| `Item.tsx` | Padding tweaks, ItemHeader stacking |
| `AwarenessXp.tsx` | `overflow-x-auto` wrapper, filter padding |
| `FoodAlmanac.tsx` | Scrollable tabs + sort row, sub-header stacking |
| `TechTree.tsx` | Toolbar wrap to two rows |
| `globals.css` | `flow-vert` mobile margin override |
