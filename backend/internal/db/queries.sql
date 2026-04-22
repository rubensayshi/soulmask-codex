-- name: GetItem :one
SELECT * FROM items WHERE id = ?;

-- name: ListItemsForGraph :many
SELECT id, name_en, name_zh, category, is_raw, icon_path FROM items;

-- name: ListRecipesForGraph :many
SELECT id, output_item_id, output_qty, station_id, craft_time_seconds,
       proficiency, recipe_level
FROM recipes;

-- name: ListRecipeGroupsForGraph :many
SELECT rig.id AS group_id, rig.recipe_id, rig.group_index, rig.kind,
       rigi.item_id, rigi.quantity
FROM recipe_input_groups rig
JOIN recipe_input_group_items rigi ON rigi.group_id = rig.id
ORDER BY rig.recipe_id, rig.group_index;

-- name: ListStationsForGraph :many
SELECT id, name_en, name_zh FROM stations;

-- name: SearchItems :many
-- Substring match over name_en + name_zh. Prefix ordering is done client-side
-- in the handler (sqlc's @named-arg reuse is buggy with ORDER BY CASE in sqlite).
SELECT id, name_en, name_zh, category
FROM items
WHERE name_en LIKE @q COLLATE NOCASE
   OR name_zh LIKE @q
ORDER BY name_en
LIMIT @lim;

-- name: GetRecipesForOutput :many
SELECT * FROM recipes WHERE output_item_id = ?;

-- name: GetRecipesUsingInput :many
SELECT DISTINCT r.* FROM recipes r
JOIN recipe_input_groups rig ON rig.recipe_id = r.id
JOIN recipe_input_group_items rigi ON rigi.group_id = rig.id
WHERE rigi.item_id = ?;

-- name: GetTechUnlocksForRecipe :many
SELECT tn.* FROM tech_nodes tn
JOIN tech_node_unlocks_recipe u ON u.tech_node_id = tn.id
WHERE u.recipe_id = ?;
