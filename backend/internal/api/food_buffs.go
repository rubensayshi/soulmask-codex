package api

import (
	"encoding/json"
	"net/http"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

type BuffedItem struct {
	ID       string      `json:"id"`
	NameEn   *string     `json:"name_en"`
	NameZh   *string     `json:"name_zh"`
	Category *string     `json:"category"`
	IconPath *string     `json:"icon_path"`
	Slug     *string     `json:"slug"`
	Buffs    interface{} `json:"buffs"`
}

func (s *Server) handleFoodBuffs(w http.ResponseWriter, r *http.Request) {
	rows, err := dbgen.New(s.DB).ListBuffedItems(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	items := make([]BuffedItem, 0, len(rows))
	for _, row := range rows {
		var buffs interface{}
		if row.BuffsJson.Valid {
			_ = json.Unmarshal([]byte(row.BuffsJson.String), &buffs)
		}
		items = append(items, BuffedItem{
			ID:       row.ID,
			NameEn:   nullStr(row.NameEn),
			NameZh:   nullStr(row.NameZh),
			Category: nullStr(row.Category),
			IconPath: nullStr(row.IconPath),
			Slug:     nullStr(row.Slug),
			Buffs:    buffs,
		})
	}
	writeJSON(w, items)
}
