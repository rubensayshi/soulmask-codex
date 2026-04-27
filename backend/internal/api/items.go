package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type DropSource struct {
	SourceName  string `json:"source_name"`
	SourceType  string `json:"source_type"`
	Probability int64  `json:"probability"`
	QtyMin      int64  `json:"qty_min"`
	QtyMax      int64  `json:"qty_max"`
}

type TechUnlock struct {
	ID                string  `json:"id"`
	NameEn            *string `json:"name_en"`
	NameZh            *string `json:"name_zh"`
	RequiredMaskLevel *int64  `json:"required_mask_level"`
	ParentNameEn      *string `json:"parent_name_en,omitempty"`
	ParentNameZh      *string `json:"parent_name_zh,omitempty"`
}

type SeedSourceEntry struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	Locations   []string `json:"locations,omitempty"`
	Notes       string   `json:"notes,omitempty"`
	Qty         string   `json:"qty,omitempty"`
	Recommended bool     `json:"recommended,omitempty"`
}

type SeedSource struct {
	NameEn       string            `json:"name_en"`
	Map          string            `json:"map"`
	Grindable    bool              `json:"grindable"`
	GrinderInput *string           `json:"grinder_input,omitempty"`
	Fertilizer   *string           `json:"fertilizer,omitempty"`
	TempGrowth   *string           `json:"temp_growth,omitempty"`
	TempOptimal  *string           `json:"temp_optimal,omitempty"`
	Sources      []SeedSourceEntry `json:"sources"`
}

type SpawnPoint struct {
	Lat int64 `json:"lat"`
	Lon int64 `json:"lon"`
}

type SpawnGroup struct {
	Creature string       `json:"creature"`
	Level    string       `json:"level"`
	Spawns   []SpawnPoint `json:"spawns"`
}

type SpawnMap struct {
	Map    string       `json:"map"`
	Groups []SpawnGroup `json:"groups"`
}

type ItemDetail struct {
	ID             string       `json:"id"`
	NameEn         *string      `json:"name_en"`
	NameZh         *string      `json:"name_zh"`
	DescriptionZh  *string      `json:"description_zh"`
	Category       *string      `json:"category"`
	Subcategory    *string      `json:"subcategory"`
	Weight         *float64     `json:"weight"`
	MaxStack       *int64       `json:"max_stack"`
	Durability     *int64       `json:"durability"`
	Role           string       `json:"role"`
	IconPath       *string      `json:"icon_path"`
	Stats          interface{}  `json:"stats"`
	TechUnlockedBy []TechUnlock `json:"tech_unlocked_by"`
	RecipesToCraft []string     `json:"recipes_to_craft"`
	RecipesUsedIn  []string     `json:"recipes_used_in"`
	DropSources    []DropSource `json:"drop_sources"`
	SeedSource     *SeedSource  `json:"seed_source,omitempty"`
	SpawnLocations []SpawnMap `json:"spawn_locations,omitempty"`
}

func (s *Server) handleItem(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	q := dbgen.New(s.DB)
	ctx := r.Context()

	item, err := q.GetItem(ctx, id)
	if err != nil {
		item, err = q.GetItemBySlug(ctx, sql.NullString{String: id, Valid: true})
	}
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

	seenNames := map[string]bool{}
	var techUnlocks []TechUnlock
	for _, rec := range toCraft {
		nodes, _ := q.GetTechUnlocksForRecipe(ctx, rec.ID)
		for _, n := range nodes {
			displayName := n.ID
			if n.NameEn.Valid {
				displayName = n.NameEn.String
			}
			if seenNames[displayName] {
				continue
			}
			seenNames[displayName] = true
			techUnlocks = append(techUnlocks, TechUnlock{
				ID:                n.ID,
				NameEn:            nullStr(n.NameEn),
				NameZh:            nullStr(n.NameZh),
				RequiredMaskLevel: nullInt(n.RequiredMaskLevel),
				ParentNameEn:      nullStr(n.ParentNameEn),
				ParentNameZh:      nullStr(n.ParentNameZh),
			})
		}
	}
	if techUnlocks == nil {
		techUnlocks = []TechUnlock{}
	}

	dropRows, _ := q.GetDropSourcesForItem(ctx, item.ID)
	dropSources := make([]DropSource, 0, len(dropRows))
	for _, d := range dropRows {
		name := ""
		if d.SourceName.Valid {
			name = d.SourceName.String
		}
		dropSources = append(dropSources, DropSource{
			SourceName:  name,
			SourceType:  d.SourceType,
			Probability: d.Probability,
			QtyMin:      d.QtyMin,
			QtyMax:      d.QtyMax,
		})
	}

	var seedSource *SeedSource
	seedRow, seedErr := q.GetSeedSourceForItem(ctx, item.ID)
	if seedErr == nil {
		var entries []SeedSourceEntry
		_ = json.Unmarshal([]byte(seedRow.SourcesJson), &entries)
		seedSource = &SeedSource{
			NameEn:      seedRow.NameEn,
			Map:         seedRow.Map,
			Grindable:   seedRow.Grindable != 0,
			Fertilizer:  nullStr(seedRow.Fertilizer),
			TempGrowth:  nullStr(seedRow.TempGrowth),
			TempOptimal: nullStr(seedRow.TempOptimal),
			Sources:     entries,
		}
		if seedRow.GrinderInput.Valid {
			seedSource.GrinderInput = &seedRow.GrinderInput.String
		}
	}

	spawnRows, _ := q.GetSpawnLocationsForItem(ctx, item.ID)
	var spawnLocations []SpawnMap
	if len(spawnRows) > 0 {
		mapIdx := make(map[string]int)
		for _, r := range spawnRows {
			mi, ok := mapIdx[r.Map]
			if !ok {
				mi = len(spawnLocations)
				mapIdx[r.Map] = mi
				spawnLocations = append(spawnLocations, SpawnMap{Map: r.Map})
			}
			sm := &spawnLocations[mi]
			level := ""
			if r.LevelDesc.Valid {
				level = r.LevelDesc.String
			}
			var found *SpawnGroup
			for i := range sm.Groups {
				if sm.Groups[i].Creature == r.CreatureType && sm.Groups[i].Level == level {
					found = &sm.Groups[i]
					break
				}
			}
			if found == nil {
				sm.Groups = append(sm.Groups, SpawnGroup{Creature: r.CreatureType, Level: level})
				found = &sm.Groups[len(sm.Groups)-1]
			}
			found.Spawns = append(found.Spawns, SpawnPoint{Lat: r.Lat, Lon: r.Lon})
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
		Role:           item.Role,
		IconPath:       nullStr(item.IconPath),
		Stats:          stats,
		TechUnlockedBy: techUnlocks,
		RecipesToCraft: toCraftIDs,
		RecipesUsedIn:  usedInIDs,
		DropSources:    dropSources,
		SeedSource:     seedSource,
		SpawnLocations: spawnLocations,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}
