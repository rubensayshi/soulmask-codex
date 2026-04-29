import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { TechRecipeLink, TechTreeResponse } from '../lib/types'
import type { PlannerIndex } from '../lib/planner'

const ICON_BASE = import.meta.env.VITE_ICON_BASE || '/icons'

function iconUrl(path: string): string {
  const name = path.split('/').pop()
  return `${ICON_BASE}/${name}.webp`
}

interface RecipeWithTier {
  recipe: TechRecipeLink
  tierName: string
  subNodeName: string
}

interface Props {
  selected: Set<string>
  idx: PlannerIndex
  data: TechTreeResponse
}

export default function PlannerRecipePanel({ selected, idx, data }: Props) {
  const grouped = useMemo(() => {
    const tierMap = new Map<string, string>()
    const tierOrder = new Map<string, number>()
    for (let i = 0; i < data.tiers.length; i++) {
      const tier = data.tiers[i]
      tierOrder.set(tier.name, i)
      for (const col of tier.columns) {
        for (const mn of col) {
          tierMap.set(mn.id, tier.name)
        }
      }
    }
    for (const mn of data.untiered) {
      tierMap.set(mn.id, 'Untiered')
    }
    tierOrder.set('Untiered', data.tiers.length)

    const recipes: RecipeWithTier[] = []
    for (const subId of selected) {
      const sub = idx.subNodes.get(subId)
      if (!sub) continue
      const mainId = idx.subToMain.get(subId)
      const tierName = mainId ? (tierMap.get(mainId) || 'Unknown') : 'Unknown'
      for (const r of sub.recipes) {
        recipes.push({ recipe: r, tierName, subNodeName: sub.name || sub.name_zh || sub.id })
      }
    }

    const byTier = new Map<string, RecipeWithTier[]>()
    for (const r of recipes) {
      const arr = byTier.get(r.tierName) || []
      arr.push(r)
      byTier.set(r.tierName, arr)
    }
    return new Map([...byTier.entries()].sort((a, b) =>
      (tierOrder.get(a[0]) ?? 999) - (tierOrder.get(b[0]) ?? 999)
    ))
  }, [selected, idx, data])

  if (selected.size === 0) {
    return (
      <div className="border-t border-hair bg-bg px-4 py-6 text-center text-[11px] text-text-dim">
        Select tech nodes above to see unlocked recipes.
      </div>
    )
  }

  const totalRecipes = Array.from(grouped.values()).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="border-t border-hair bg-bg px-4 py-3">
      <div className="text-[11px] text-text-dim mb-3">
        {totalRecipes} recipe{totalRecipes !== 1 ? 's' : ''} unlocked
      </div>
      {Array.from(grouped.entries()).map(([tierName, recipes]) => (
        <div key={tierName} className="mb-3">
          <div className="text-[10px] text-text-dim uppercase tracking-wider2 mb-1.5">{tierName}</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {recipes.map(({ recipe, subNodeName }) => (
              <Link
                key={recipe.recipe_id}
                to={`/item/${recipe.item_slug ?? recipe.item_id}`}
                className="flex items-center gap-2 rounded border border-hair bg-panel px-2 py-1.5 hover:border-green-dim hover:bg-panel-2 transition-colors"
              >
                {recipe.item_icon ? (
                  <img src={iconUrl(recipe.item_icon)} alt="" className="h-6 w-6 rounded object-contain" />
                ) : (
                  <div className="h-6 w-6 rounded bg-panel-2 flex items-center justify-center text-[10px] text-text-dim">?</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-text truncate">{recipe.item_name || recipe.item_name_zh}</div>
                  <div className="text-[9px] text-text-dim truncate">{subNodeName}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
