package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"

	"github.com/rubensayshi/soulmask-codex/backend/internal/api"
	sdb "github.com/rubensayshi/soulmask-codex/backend/internal/db"
	"github.com/rubensayshi/soulmask-codex/backend/internal/spa"
)

func main() {
	addr := flag.String("addr", ":9060", "listen address")
	dbPath := flag.String("db", "../data/app.db", "path to app.db")
	iconsDir := flag.String("icons", "../Game/Icons", "path to icons directory")
	dev := flag.Bool("dev", false, "reverse-proxy non-api to Vite on :5173")
	flag.Parse()

	log := zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
		With().Timestamp().Logger()

	db, err := sdb.Open(*dbPath)
	if err != nil {
		log.Fatal().Err(err).Str("path", *dbPath).Msg("open db")
	}
	defer db.Close()
	log.Info().Str("db", *dbPath).Msg("db opened")

	apiServer := api.NewServer(db, *dbPath, log)

	var spaHandler http.Handler
	if *dev {
		spaHandler, err = spa.DevHandler("http://localhost:5173")
	} else {
		spaHandler, err = spa.ProdHandler()
	}
	if err != nil {
		log.Fatal().Err(err).Msg("spa handler")
	}

	root := chi.NewRouter()
	if !*dev {
		root.Use(canonicalHost("soulmask-codex.com"))
	}
	root.Mount("/api", apiServer.Router())
	root.Get("/sitemap.xml", apiServer.HandleSitemap)
	root.Handle("/icons/*", http.StripPrefix("/icons/", http.FileServer(http.Dir(*iconsDir))))
	root.Handle("/*", spaHandler)

	srv := &http.Server{
		Addr:              *addr,
		Handler:           root,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		log.Info().Str("addr", *addr).Bool("dev", *dev).Msg("listening")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("serve")
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	log.Info().Msg("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}

func canonicalHost(host string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Host != host && r.Host != "" {
				u := *r.URL
				u.Scheme = "https"
				u.Host = host
				http.Redirect(w, r, u.String(), http.StatusMovedPermanently)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
