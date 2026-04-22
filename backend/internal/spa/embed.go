// Package spa serves the React SPA. Prod: serves from embedded dist/.
// Dev: reverse-proxies to Vite at localhost:5173.
package spa

import (
	"embed"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

//go:embed dist/*
var distFS embed.FS

// ProdHandler serves embedded dist/; any path that isn't a file in dist
// returns index.html (SPA deep-link fallback).
func ProdHandler() (http.Handler, error) {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		return nil, err
	}
	fileServer := http.FileServer(http.FS(sub))
	index, err := fs.ReadFile(sub, "index.html")
	if err != nil {
		// dist/ may be empty during early scaffolding; serve a stub so the
		// binary still builds and runs.
		index = []byte("<!doctype html><title>Soulmask</title><p>SPA not built yet.</p>")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Heuristic: a URL path with a file extension is likely a real asset;
		// everything else is an SPA route, so return index.html.
		if strings.HasSuffix(r.URL.Path, "/") || !strings.Contains(r.URL.Path[1:], ".") {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write(index)
			return
		}
		fileServer.ServeHTTP(w, r)
	}), nil
}

// DevHandler reverse-proxies non-api requests to Vite (HMR, live rebuilds).
func DevHandler(target string) (http.Handler, error) {
	u, err := url.Parse(target)
	if err != nil {
		return nil, err
	}
	return httputil.NewSingleHostReverseProxy(u), nil
}
