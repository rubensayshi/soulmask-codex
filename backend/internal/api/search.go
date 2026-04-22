package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"

	dbgen "github.com/rubendevries/souldb/backend/internal/db/gen"
)

type SearchHit struct {
	ID       string  `json:"id"`
	NameEn   *string `json:"name_en"`
	NameZh   *string `json:"name_zh"`
	Category *string `json:"category"`
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeJSON(w, []SearchHit{})
		return
	}
	limit := int64(50)
	if l, err := strconv.ParseInt(r.URL.Query().Get("limit"), 10, 64); err == nil && l > 0 && l <= 200 {
		limit = l
	}

	// Caller passes plain query text; add SQL wildcards here so LIKE finds substrings.
	rows, err := dbgen.New(s.DB).SearchItems(r.Context(), dbgen.SearchItemsParams{
		Q:   sql.NullString{String: "%" + q + "%", Valid: true},
		Lim: limit,
	})
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	hits := make([]SearchHit, 0, len(rows))
	for _, r := range rows {
		hits = append(hits, SearchHit{
			ID:       r.ID,
			NameEn:   nullStr(r.NameEn),
			NameZh:   nullStr(r.NameZh),
			Category: nullStr(r.Category),
		})
	}
	// Rank prefix matches above substring matches. Stable so the DB's name_en
	// ordering is preserved within each rank.
	qLower := strings.ToLower(q)
	sort.SliceStable(hits, func(i, j int) bool {
		return rank(hits[i], qLower) < rank(hits[j], qLower)
	})
	writeJSON(w, hits)
}

func rank(h SearchHit, qLower string) int {
	en := ""
	if h.NameEn != nil {
		en = strings.ToLower(*h.NameEn)
	}
	zh := ""
	if h.NameZh != nil {
		zh = *h.NameZh
	}
	switch {
	case strings.HasPrefix(en, qLower):
		return 0
	case strings.HasPrefix(zh, qLower):
		return 1
	default:
		return 2
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func nullStr(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	v := n.String
	return &v
}
func nullInt(n sql.NullInt64) *int64 {
	if !n.Valid {
		return nil
	}
	v := n.Int64
	return &v
}
func nullFloat(n sql.NullFloat64) *float64 {
	if !n.Valid {
		return nil
	}
	v := n.Float64
	return &v
}
