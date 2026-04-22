CREATE TABLE items (
  id              TEXT PRIMARY KEY,
  category        TEXT,
  subcategory     TEXT,
  name_zh         TEXT,
  name_en         TEXT,
  description_zh  TEXT,
  weight          REAL,
  max_stack       INTEGER,
  durability      INTEGER,
  icon_path       TEXT,
  is_raw          INTEGER NOT NULL,
  stats_json      TEXT
);

CREATE TABLE stations (
  id       TEXT PRIMARY KEY,
  name_zh  TEXT,
  name_en  TEXT
);

CREATE TABLE recipes (
  id                  TEXT PRIMARY KEY,
  output_item_id      TEXT NOT NULL REFERENCES items(id),
  output_qty          INTEGER NOT NULL DEFAULT 1,
  station_id          TEXT REFERENCES stations(id),
  can_make_by_hand    INTEGER,
  craft_time_seconds  REAL,
  proficiency         TEXT,
  proficiency_xp      REAL,
  recipe_level        INTEGER
);

CREATE TABLE recipe_input_groups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id    TEXT NOT NULL REFERENCES recipes(id),
  group_index  INTEGER NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('all','one_of'))
);

CREATE TABLE recipe_input_group_items (
  group_id   INTEGER NOT NULL REFERENCES recipe_input_groups(id),
  item_id    TEXT NOT NULL REFERENCES items(id),
  quantity   INTEGER NOT NULL,
  PRIMARY KEY (group_id, item_id)
);
CREATE INDEX idx_rigi_item ON recipe_input_group_items(item_id);
CREATE INDEX idx_recipe_output ON recipes(output_item_id);

CREATE TABLE tech_nodes (
  id                   TEXT PRIMARY KEY,
  category             TEXT,
  name_zh              TEXT,
  name_en              TEXT,
  description_zh       TEXT,
  required_mask_level  INTEGER,
  consume_points       INTEGER,
  parent_id            TEXT REFERENCES tech_nodes(id),
  icon_path            TEXT
);

CREATE TABLE tech_node_unlocks_recipe (
  tech_node_id  TEXT NOT NULL REFERENCES tech_nodes(id),
  recipe_id     TEXT NOT NULL REFERENCES recipes(id),
  PRIMARY KEY (tech_node_id, recipe_id)
);

CREATE TABLE translations (
  key     TEXT PRIMARY KEY,
  en      TEXT NOT NULL,
  source  TEXT NOT NULL
);
