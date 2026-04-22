package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	dbgen "github.com/rubendevries/souldb/backend/internal/db/gen"
)

type ItemDetail struct {
	ID             string      `json:"id"`
	NameEn         *string     `json:"name_en"`
	NameZh         *string     `json:"name_zh"`
	DescriptionZh  *string     `json:"description_zh"`
	Category       *string     `json:"category"`
	Subcategory    *string     `json:"subcategory"`
	Weight         *float64    `json:"weight"`
	MaxStack       *int64      `json:"max_stack"`
	Durability     *int64      `json:"durability"`
	IsRaw          bool        `json:"is_raw"`
	IconPath       *string     `json:"icon_path"`
	Stats          interface{} `json:"stats"`
	TechUnlockedBy []string    `json:"tech_unlocked_by"`
	RecipesToCraft []string    `json:"recipes_to_craft"`
	RecipesUsedIn  []string    `json:"recipes_used_in"`
}

func (s *Server) handleItem(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	q := dbgen.New(s.DB)
	ctx := r.Context()

	item, err := q.GetItem(ctx, id)
	if err != nil {
		http.Error(w, "item not found", 404)
		return
	}

	toCraft, _ := q.GetRecipesForOutput(ctx, id)
	usedIn, _ := q.GetRecipesUsingInput(ctx, id)

	toCraftIDs := make([]string, 0, len(toCraft))
	for _, r := range toCraft {
		toCraftIDs = append(toCraftIDs, r.ID)
	}
	usedInIDs := make([]string, 0, len(usedIn))
	for _, r := range usedIn {
		usedInIDs = append(usedInIDs, r.ID)
	}

	var tech []string
	for _, rec := range toCraft {
		nodes, _ := q.GetTechUnlocksForRecipe(ctx, rec.ID)
		for _, n := range nodes {
			tech = append(tech, n.ID)
		}
	}

	var stats interface{}
	if item.StatsJson.Valid {
		_ = json.Unmarshal([]byte(item.StatsJson.String), &stats)
	}

	detail := ItemDetail{
		ID:             item.ID,
		NameEn:         nullStr(item.NameEn),
		NameZh:         nullStr(item.NameZh),
		DescriptionZh:  nullStr(item.DescriptionZh),
		Category:       nullStr(item.Category),
		Subcategory:    nullStr(item.Subcategory),
		Weight:         nullFloat(item.Weight),
		MaxStack:       nullInt(item.MaxStack),
		Durability:     nullInt(item.Durability),
		IsRaw:          item.IsRaw != 0,
		IconPath:       nullStr(item.IconPath),
		Stats:          stats,
		TechUnlockedBy: tech,
		RecipesToCraft: toCraftIDs,
		RecipesUsedIn:  usedInIDs,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}
