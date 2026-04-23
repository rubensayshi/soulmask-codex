package api

import (
	"database/sql"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
)

type Server struct {
	DB     *sql.DB
	DBPath string
	Log    zerolog.Logger
	graph  *graphCache
}

func NewServer(db *sql.DB, dbPath string, log zerolog.Logger) *Server {
	return &Server{DB: db, DBPath: dbPath, Log: log, graph: newGraphCache()}
}

// Router returns the /api subtree (mounted under /api by main).
func (s *Server) Router() chi.Router {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(requestLog(s.Log))

	r.Get("/graph", s.handleGraph)
	r.Get("/items/{id}", s.handleItem)
	r.Get("/search", s.handleSearch)
	r.Get("/food-buffs", s.handleFoodBuffs)
	return r
}
