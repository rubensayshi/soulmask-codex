package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	sdb "github.com/rubendevries/souldb/backend/internal/db"
	"github.com/rubendevries/souldb/backend/internal/graph"
)

type graphCache struct {
	mu      sync.RWMutex
	builtAt time.Time
	dbMtime time.Time
	body    []byte
	etag    string
}

func newGraphCache() *graphCache { return &graphCache{} }

func (s *Server) handleGraph(w http.ResponseWriter, r *http.Request) {
	body, etag, err := s.cachedGraph(r.Context())
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Content-Type", "application/json")
	if match := r.Header.Get("If-None-Match"); match == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Write(body)
}

func (s *Server) cachedGraph(ctx context.Context) ([]byte, string, error) {
	mtime, err := sdb.Mtime(s.DBPath)
	if err != nil {
		return nil, "", err
	}

	s.graph.mu.RLock()
	if !s.graph.dbMtime.IsZero() && s.graph.dbMtime.Equal(mtime) {
		body, etag := s.graph.body, s.graph.etag
		s.graph.mu.RUnlock()
		return body, etag, nil
	}
	s.graph.mu.RUnlock()

	s.graph.mu.Lock()
	defer s.graph.mu.Unlock()
	if s.graph.dbMtime.Equal(mtime) {
		return s.graph.body, s.graph.etag, nil
	}
	g, err := graph.Build(ctx, s.DB)
	if err != nil {
		return nil, "", err
	}
	body, err := json.Marshal(g)
	if err != nil {
		return nil, "", err
	}
	s.graph.body = body
	s.graph.dbMtime = mtime
	s.graph.etag = fmt.Sprintf("W/\"%d-%d\"", mtime.UnixNano(), len(body))
	s.graph.builtAt = time.Now()
	return body, s.graph.etag, nil
}
