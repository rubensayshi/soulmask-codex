package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type TechSubNode struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	NameZh         *string          `json:"name_zh,omitempty"`
	Slug           *string          `json:"slug,omitempty"`
	AwarenessLevel *int64           `json:"awareness_level,omitempty"`
	Points         *int64           `json:"points,omitempty"`
	Recipes        []TechRecipeLink `json:"recipes"`
}

type TechRecipeLink struct {
	RecipeID   string  `json:"recipe_id"`
	ItemID     string  `json:"item_id"`
	ItemName   string  `json:"item_name"`
	ItemNameZh *string `json:"item_name_zh,omitempty"`
	ItemSlug   *string `json:"item_slug,omitempty"`
	ItemIcon   *string `json:"item_icon,omitempty"`
}

type TechMainNode struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	NameZh         *string       `json:"name_zh,omitempty"`
	Slug           *string       `json:"slug,omitempty"`
	AwarenessLevel *int64        `json:"awareness_level,omitempty"`
	IconPath       *string       `json:"icon_path,omitempty"`
	DependsOn      []string      `json:"depends_on,omitempty"`
	SubNodes       []TechSubNode `json:"sub_nodes"`
}

type TechTier struct {
	ID             string           `json:"id"`
	Name           string           `json:"name"`
	AwarenessLevel int64            `json:"awareness_level"`
	Columns        [][]TechMainNode `json:"columns"`
}

type TechTreeResponse struct {
	Tiers    []TechTier     `json:"tiers"`
	Untiered []TechMainNode `json:"untiered"`
}

var bonfireChain = []string{
	"BP_KJS_GZT_GouHuo",
	"BP_KJS_GZT_YingHuo",
	"BP_KJS_GZT_YingHuo_2",
	"BP_KJS_GZT_YingHuo_3",
	"BP_KJS_GZT_YingHuo_4",
	"BP_KJS_GZT_YingHuo_5",
}

var bonfireNames = map[string]string{
	"BP_KJS_GZT_GouHuo":    "Campfire",
	"BP_KJS_GZT_YingHuo":   "Bonfire",
	"BP_KJS_GZT_YingHuo_2": "Bronze Pit Bonfire",
	"BP_KJS_GZT_YingHuo_3": "Black Iron Pit Bonfire",
	"BP_KJS_GZT_YingHuo_4": "Steel Pit Bonfire",
	"BP_KJS_GZT_YingHuo_5": "Fine Steel Pit Bonfire",
}

func (s *Server) handleTechTree(w http.ResponseWriter, r *http.Request) {
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "survival"
	}

	var mainCat, subCat string
	switch mode {
	case "soldier":
		mainCat, subCat = "main_action", "sub_action"
	case "management":
		mainCat, subCat = "main_management", "sub_management"
	default:
		mainCat, subCat = "main", "sub"
	}

	ctx := r.Context()
	q := dbgen.New(s.DB)

	allNodes, err := q.ListTechNodes(ctx)
	if err != nil {
		http.Error(w, "failed to load tech nodes", 500)
		return
	}

	allPrereqs, err := q.ListTechNodePrerequisites(ctx)
	if err != nil {
		http.Error(w, "failed to load prerequisites", 500)
		return
	}

	allRecipes, err := q.ListTechNodeRecipeUnlocks(ctx)
	if err != nil {
		http.Error(w, "failed to load recipe unlocks", 500)
		return
	}

	prereqMap := map[string][]string{}
	for _, p := range allPrereqs {
		prereqMap[p.TechNodeID] = append(prereqMap[p.TechNodeID], p.PrerequisiteID)
	}

	recipeMap := map[string][]TechRecipeLink{}
	for _, r := range allRecipes {
		recipeMap[r.TechNodeID] = append(recipeMap[r.TechNodeID], TechRecipeLink{
			RecipeID:   r.RecipeID,
			ItemID:     r.ItemID,
			ItemName:   stringOrEmpty(r.ItemNameEn),
			ItemNameZh: nullStr(r.ItemNameZh),
			ItemSlug:   nullStr(r.ItemSlug),
			ItemIcon:   nullStr(r.ItemIcon),
		})
	}

	mainNodes := map[string]dbgen.TechNode{}
	subNodes := map[string]dbgen.TechNode{}
	childMap := map[string][]string{}
	bonfireNodes := map[string]dbgen.TechNode{}

	for _, n := range allNodes {
		cat := ""
		if n.Category.Valid {
			cat = n.Category.String
		}
		if cat == mainCat {
			mainNodes[n.ID] = n
		} else if cat == subCat {
			subNodes[n.ID] = n
			if n.ParentID.Valid {
				childMap[n.ParentID.String] = append(childMap[n.ParentID.String], n.ID)
			}
		}
		if cat == "main" {
			bonfireNodes[n.ID] = n
		}
	}

	bonfireSet := map[string]bool{}
	for _, id := range bonfireChain {
		bonfireSet[id] = true
	}

	tierCache := map[string]string{}
	var findTier func(id string, visited map[string]bool) string
	findTier = func(id string, visited map[string]bool) string {
		if bonfireSet[id] {
			return id
		}
		if cached, ok := tierCache[id]; ok {
			return cached
		}
		if visited[id] {
			return ""
		}
		visited[id] = true
		best := ""
		bestIdx := -1
		for _, pid := range prereqMap[id] {
			t := findTier(pid, visited)
			if t != "" {
				for i, bf := range bonfireChain {
					if bf == t && i > bestIdx {
						best = t
						bestIdx = i
					}
				}
			}
		}
		tierCache[id] = best
		return best
	}

	tierNodes := map[string][]string{}
	var untieredIDs []string

	for id := range mainNodes {
		if bonfireSet[id] {
			continue
		}
		visited := map[string]bool{}
		tier := findTier(id, visited)
		if tier == "" {
			untieredIDs = append(untieredIDs, id)
		} else {
			tierNodes[tier] = append(tierNodes[tier], id)
		}
	}

	buildMainNode := func(id string) TechMainNode {
		n := mainNodes[id]
		mn := TechMainNode{
			ID:             id,
			Name:           stringOrEmpty(n.NameEn),
			NameZh:         nullStr(n.NameZh),
			Slug:           nullStr(n.Slug),
			AwarenessLevel: nullInt(n.RequiredMaskLevel),
			IconPath:       nullStr(n.IconPath),
			SubNodes:       []TechSubNode{},
		}
		for _, pid := range prereqMap[id] {
			if !bonfireSet[pid] {
				mn.DependsOn = append(mn.DependsOn, pid)
			}
		}
		for _, sid := range childMap[id] {
			sn := subNodes[sid]
			sub := TechSubNode{
				ID:             sid,
				Name:           stringOrEmpty(sn.NameEn),
				NameZh:         nullStr(sn.NameZh),
				Slug:           nullStr(sn.Slug),
				AwarenessLevel: nullInt(sn.RequiredMaskLevel),
				Points:         nullInt(sn.ConsumePoints),
				Recipes:        recipeMap[sid],
			}
			if sub.Recipes == nil {
				sub.Recipes = []TechRecipeLink{}
			}
			mn.SubNodes = append(mn.SubNodes, sub)
		}
		return mn
	}

	sortByLevel := func(nodes []TechMainNode) {
		sort.Slice(nodes, func(i, j int) bool {
			li, lj := int64(9999), int64(9999)
			if nodes[i].AwarenessLevel != nil {
				li = *nodes[i].AwarenessLevel
			}
			if nodes[j].AwarenessLevel != nil {
				lj = *nodes[j].AwarenessLevel
			}
			if li != lj {
				return li < lj
			}
			return nodes[i].ID < nodes[j].ID
		})
	}

	var tiers []TechTier
	for _, bfID := range bonfireChain {
		bfNode, hasBf := bonfireNodes[bfID]
		if !hasBf {
			continue
		}

		name := bonfireNames[bfID]
		if bfNode.NameEn.Valid && bfNode.NameEn.String != "" {
			name = bfNode.NameEn.String
		}

		level := int64(0)
		if bfNode.RequiredMaskLevel.Valid {
			level = bfNode.RequiredMaskLevel.Int64
		}

		nodeIDs := tierNodes[bfID]
		tierNodeSet := map[string]bool{}
		for _, id := range nodeIDs {
			tierNodeSet[id] = true
		}

		builtNodes := map[string]TechMainNode{}
		for _, id := range nodeIDs {
			builtNodes[id] = buildMainNode(id)
		}

		internalDeps := map[string][]string{}
		for id, mn := range builtNodes {
			for _, dep := range mn.DependsOn {
				if tierNodeSet[dep] {
					internalDeps[id] = append(internalDeps[id], dep)
				}
			}
		}

		depthCache := map[string]int{}
		var nodeDepth func(string) int
		nodeDepth = func(id string) int {
			if d, ok := depthCache[id]; ok {
				return d
			}
			best := 0
			for _, dep := range internalDeps[id] {
				if d := nodeDepth(dep) + 1; d > best {
					best = d
				}
			}
			depthCache[id] = best
			return best
		}

		maxDepth := 0
		for id := range builtNodes {
			if d := nodeDepth(id); d > maxDepth {
				maxDepth = d
			}
		}

		columns := make([][]TechMainNode, maxDepth+1)
		for id, mn := range builtNodes {
			col := nodeDepth(id)
			columns[col] = append(columns[col], mn)
		}
		sortByLevel(columns[0])
		for c := 1; c <= maxDepth; c++ {
			sortColumnByPrevPosition(columns[c-1], columns[c])
		}
		for i := range columns {
			if columns[i] == nil {
				columns[i] = []TechMainNode{}
			}
		}

		tiers = append(tiers, TechTier{
			ID:             bfID,
			Name:           name,
			AwarenessLevel: level,
			Columns:        columns,
		})
	}

	var untiered []TechMainNode
	for _, id := range untieredIDs {
		untiered = append(untiered, buildMainNode(id))
	}
	sortByLevel(untiered)
	if untiered == nil {
		untiered = []TechMainNode{}
	}

	if tiers == nil {
		tiers = []TechTier{}
	}
	resp := TechTreeResponse{Tiers: tiers, Untiered: untiered}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func sortColumnByPrevPosition(prev, col []TechMainNode) {
	prevPos := map[string]int{}
	for i, n := range prev {
		prevPos[n.ID] = i
	}
	sort.SliceStable(col, func(i, j int) bool {
		pi, pj := len(prev), len(prev)
		for _, dep := range col[i].DependsOn {
			if p, ok := prevPos[dep]; ok && p < pi {
				pi = p
			}
		}
		for _, dep := range col[j].DependsOn {
			if p, ok := prevPos[dep]; ok && p < pj {
				pj = p
			}
		}
		return pi < pj
	})
}

func stringOrEmpty(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}
