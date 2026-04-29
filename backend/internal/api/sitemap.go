package api

import (
	"encoding/xml"
	"fmt"
	"net/http"

	dbgen "github.com/rubensayshi/soulmask-codex/backend/internal/db/gen"
)

const siteBase = "https://soulmask-codex.com"

type urlSet struct {
	XMLName xml.Name  `xml:"urlset"`
	XMLNS   string    `xml:"xmlns,attr"`
	URLs    []siteURL `xml:"url"`
}

type siteURL struct {
	Loc        string `xml:"loc"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

func (s *Server) HandleSitemap(w http.ResponseWriter, r *http.Request) {
	q := dbgen.New(s.DB)
	items, err := q.ListItemSlugs(r.Context())
	if err != nil {
		s.Log.Error().Err(err).Msg("sitemap: list items")
		http.Error(w, "internal error", 500)
		return
	}

	urls := []siteURL{
		{Loc: siteBase + "/", ChangeFreq: "weekly", Priority: "1.0"},
		{Loc: siteBase + "/awareness-xp", ChangeFreq: "weekly", Priority: "0.8"},
		{Loc: siteBase + "/food-almanac", ChangeFreq: "weekly", Priority: "0.8"},
	}
	for _, it := range items {
		path := it.ID
		if it.Slug.Valid {
			path = it.Slug.String
		}
		urls = append(urls, siteURL{
			Loc:        fmt.Sprintf("%s/item/%s", siteBase, path),
			ChangeFreq: "weekly",
			Priority:   "0.6",
		})
	}

	set := urlSet{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: urls}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write([]byte(xml.Header))
	enc := xml.NewEncoder(w)
	enc.Indent("", "  ")
	enc.Encode(set)
}
