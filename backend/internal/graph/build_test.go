package graph

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

// fixtureDB opens an in-memory SQLite, applies schema.sql + a tiny seed, returns it.
func fixtureDB(t *testing.T) *sql.DB {
	t.Helper()
	schema, err := os.ReadFile(filepath.Join("..", "db", "schema.sql"))
	if err != nil {
		t.Fatalf("read schema: %v", err)
	}
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(string(schema)); err != nil {
		t.Fatalf("apply schema: %v", err)
	}
	seed := `
INSERT INTO items (id, category, name_zh, name_en, role) VALUES
  ('iron_ore',   'material',  '铁矿石', 'Iron Ore',   'raw'),
  ('iron_ingot', 'processed', '铁锭',   'Iron Ingot', 'intermediate');
INSERT INTO stations (id, name_en) VALUES ('blast_furnace', 'Blast Furnace');
INSERT INTO recipes (id, output_item_id, output_qty, station_id) VALUES
  ('rec_ingot', 'iron_ingot', 1, 'blast_furnace');
INSERT INTO recipe_input_groups (id, recipe_id, group_index, kind) VALUES
  (1, 'rec_ingot', 0, 'all');
INSERT INTO recipe_input_group_items (group_id, item_id, quantity) VALUES
  (1, 'iron_ore', 2);
`
	if _, err := conn.Exec(seed); err != nil {
		t.Fatalf("seed: %v", err)
	}
	return conn
}

func TestBuildReturnsItemsRecipesStations(t *testing.T) {
	conn := fixtureDB(t)
	defer conn.Close()

	g, err := Build(context.Background(), conn)
	if err != nil {
		t.Fatal(err)
	}
	if len(g.Items) != 2 {
		t.Fatalf("want 2 items, got %d", len(g.Items))
	}
	if len(g.Recipes) != 1 {
		t.Fatalf("want 1 recipe, got %d", len(g.Recipes))
	}
	if len(g.Stations) != 1 {
		t.Fatalf("want 1 station, got %d", len(g.Stations))
	}
}

func TestBuildFoldsGroupsCorrectly(t *testing.T) {
	conn := fixtureDB(t)
	defer conn.Close()
	g, err := Build(context.Background(), conn)
	if err != nil {
		t.Fatal(err)
	}
	rec := g.Recipes[0]
	if len(rec.Groups) != 1 {
		t.Fatalf("want 1 group, got %d", len(rec.Groups))
	}
	if rec.Groups[0].Kind != "all" {
		t.Errorf("want kind=all, got %s", rec.Groups[0].Kind)
	}
	if len(rec.Groups[0].Items) != 1 || rec.Groups[0].Items[0].ID != "iron_ore" {
		t.Errorf("group items wrong: %+v", rec.Groups[0].Items)
	}
	if rec.Groups[0].Items[0].Q != 2 {
		t.Errorf("want quantity 2, got %d", rec.Groups[0].Items[0].Q)
	}
}
