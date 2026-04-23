// Package graph builds the compact crafting graph served at /api/graph.
package graph

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

// Graph is the shape shipped to the client on page load.
type Graph struct {
	Items    []Item    `json:"items"`
	Recipes  []Recipe  `json:"recipes"`
	Stations []Station `json:"stations"`
}

type Item struct {
	ID       string      `json:"id"`
	S        *string     `json:"s,omitempty"` // slug
	N        *string     `json:"n"`           // name_en
	NZ       *string     `json:"nz"`          // name_zh
	Cat      *string     `json:"cat"`
	Role     string      `json:"role"` // 'final' | 'intermediate' | 'raw' | 'standalone'
	IconPath *string     `json:"ic,omitempty"`
	DescZh   *string     `json:"dz,omitempty"`
	Weight   *float64    `json:"w,omitempty"`
	Dur      *int64      `json:"dur,omitempty"`
	Stats    interface{} `json:"stats,omitempty"`
}

type Recipe struct {
	ID      string   `json:"id"`
	Out     string   `json:"out"`          // output_item_id
	OutQ    int64    `json:"outQ"`         // output_qty
	Station *string  `json:"st,omitempty"` // station_id
	Time    *float64 `json:"t,omitempty"`  // craft_time_seconds
	Prof    *string  `json:"prof,omitempty"`
	ProfXP  *float64 `json:"profXp,omitempty"`
	AwXP    *int64   `json:"awXp,omitempty"`
	Mask    *int64   `json:"mask,omitempty"`
	Groups  []Group  `json:"groups"`
}

type Group struct {
	Kind  string      `json:"kind"` // 'all' | 'one_of'
	Items []GroupItem `json:"items"`
}

type GroupItem struct {
	ID string `json:"id"`
	Q  int64  `json:"q"`
}

type Station struct {
	ID string  `json:"id"`
	N  *string `json:"n"`
}

// Build reads all items, recipes, groups, and stations from the db and
// assembles the graph.
func Build(ctx context.Context, sqlDB *sql.DB) (*Graph, error) {
	q := dbgen.New(sqlDB)

	itemRows, err := q.ListItemsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list items: %w", err)
	}
	items := make([]Item, 0, len(itemRows))
	for _, r := range itemRows {
		var stats interface{}
		if r.StatsJson.Valid {
			_ = json.Unmarshal([]byte(r.StatsJson.String), &stats)
		}
		items = append(items, Item{
			ID:       r.ID,
			S:        nullable(r.Slug),
			N:        nullable(r.NameEn),
			NZ:       nullable(r.NameZh),
			Cat:      nullable(r.Category),
			Role:     r.Role,
			IconPath: nullable(r.IconPath),
			DescZh:   nullable(r.DescriptionZh),
			Weight:   nullablef(r.Weight),
			Dur:      nullablei(r.Durability),
			Stats:    stats,
		})
	}

	recipeRows, err := q.ListRecipesForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list recipes: %w", err)
	}
	recipesByID := make(map[string]*Recipe, len(recipeRows))
	recipes := make([]Recipe, 0, len(recipeRows))
	for _, r := range recipeRows {
		rec := Recipe{
			ID:      r.ID,
			Out:     r.OutputItemID,
			OutQ:    r.OutputQty,
			Station: nullable(r.StationID),
			Time:    nullablef(r.CraftTimeSeconds),
			Prof:    nullable(r.Proficiency),
			ProfXP:  nullablef(r.ProficiencyXp),
			AwXP:    nullablei(r.AwarenessXp),
			Groups:  []Group{},
		}
		recipes = append(recipes, rec)
	}
	// Build map AFTER the slice is settled, so pointers are stable.
	for i := range recipes {
		recipesByID[recipes[i].ID] = &recipes[i]
	}

	maskRows, err := q.ListRecipeMaskLevels(ctx)
	if err != nil {
		return nil, fmt.Errorf("list mask levels: %w", err)
	}
	for _, m := range maskRows {
		if rec, ok := recipesByID[m.RecipeID]; ok {
			if v, ok := m.MaskLevel.(int64); ok {
				rec.Mask = &v
			}
		}
	}

	groupRows, err := q.ListRecipeGroupsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}
	// Rows are ordered by recipe_id, group_index. Fold into structured Groups.
	var curRecipe *Recipe
	var curGroupID int64 = -1
	var curGroup *Group
	for _, gr := range groupRows {
		rec, ok := recipesByID[gr.RecipeID]
		if !ok {
			continue
		}
		if rec != curRecipe || gr.GroupID != curGroupID {
			rec.Groups = append(rec.Groups, Group{Kind: gr.Kind, Items: []GroupItem{}})
			curRecipe = rec
			curGroupID = gr.GroupID
			curGroup = &rec.Groups[len(rec.Groups)-1]
		}
		curGroup.Items = append(curGroup.Items, GroupItem{ID: gr.ItemID, Q: gr.Quantity})
	}

	stationRows, err := q.ListStationsForGraph(ctx)
	if err != nil {
		return nil, fmt.Errorf("list stations: %w", err)
	}
	stations := make([]Station, 0, len(stationRows))
	for _, s := range stationRows {
		stations = append(stations, Station{ID: s.ID, N: nullable(s.NameEn)})
	}

	return &Graph{Items: items, Recipes: recipes, Stations: stations}, nil
}

// Marshal is a tiny helper that serializes a Graph deterministically.
func Marshal(g *Graph) ([]byte, error) {
	return json.Marshal(g)
}

func nullable(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	v := s.String
	return &v
}

func nullablef(f sql.NullFloat64) *float64 {
	if !f.Valid {
		return nil
	}
	v := f.Float64
	return &v
}

func nullablei(i sql.NullInt64) *int64 {
	if !i.Valid {
		return nil
	}
	v := i.Int64
	return &v
}
