package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/rs/zerolog"
)

func setupServer(t *testing.T) (*Server, func()) {
	t.Helper()
	schema, err := os.ReadFile(filepath.Join("..", "db", "schema.sql"))
	if err != nil {
		t.Fatal(err)
	}

	tmp := t.TempDir()
	dbPath := filepath.Join(tmp, "test.db")
	conn, err := sql.Open("sqlite", "file:"+dbPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(string(schema)); err != nil {
		t.Fatal(err)
	}
	seed := `
INSERT INTO items (id, category, name_zh, name_en, role) VALUES
  ('iron_ore','material','铁矿石','Iron Ore','raw'),
  ('iron_ingot','processed','铁锭','Iron Ingot','intermediate');
INSERT INTO stations (id, name_en) VALUES ('bf','Blast Furnace');
INSERT INTO recipes (id, output_item_id, output_qty, station_id) VALUES
  ('rec_ingot','iron_ingot',1,'bf');
INSERT INTO recipe_input_groups (id, recipe_id, group_index, kind) VALUES (1,'rec_ingot',0,'all');
INSERT INTO recipe_input_group_items (group_id, item_id, quantity) VALUES (1,'iron_ore',2);
`
	if _, err := conn.Exec(seed); err != nil {
		t.Fatal(err)
	}

	srv := NewServer(conn, dbPath, zerolog.Nop())
	return srv, func() { conn.Close() }
}

func TestGraphEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t)
	defer cleanup()
	r := httptest.NewRequest("GET", "/graph", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "iron_ore") {
		t.Errorf("response missing item: %s", w.Body.String())
	}
	if w.Header().Get("ETag") == "" {
		t.Error("no ETag header")
	}
}

func TestGraphEndpointETagNotModified(t *testing.T) {
	srv, cleanup := setupServer(t)
	defer cleanup()

	r1 := httptest.NewRequest("GET", "/graph", nil)
	w1 := httptest.NewRecorder()
	srv.Router().ServeHTTP(w1, r1)
	etag := w1.Header().Get("ETag")

	r2 := httptest.NewRequest("GET", "/graph", nil)
	r2.Header.Set("If-None-Match", etag)
	w2 := httptest.NewRecorder()
	srv.Router().ServeHTTP(w2, r2)
	if w2.Code != http.StatusNotModified {
		t.Errorf("want 304, got %d", w2.Code)
	}
}

func TestItemEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t)
	defer cleanup()
	r := httptest.NewRequest("GET", "/items/iron_ingot", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	var d map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	if d["id"] != "iron_ingot" {
		t.Errorf("wrong id: %v", d["id"])
	}
}

func TestSearchEndpoint(t *testing.T) {
	srv, cleanup := setupServer(t)
	defer cleanup()
	r := httptest.NewRequest("GET", "/search?q=iron", nil)
	w := httptest.NewRecorder()
	srv.Router().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "Iron Ore") {
		t.Errorf("missing Iron Ore: %s", w.Body.String())
	}
}
