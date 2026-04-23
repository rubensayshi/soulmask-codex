# Soulmask Codex Parsed Data Reference

Overview of the four JSON outputs in `Game/Parsed/`, what fields they carry, and how they cross-reference.

---

## Summary

| File            | Records | Size | Source                             |
|-----------------|---------|------|------------------------------------|
| `items.json`    | 2,015   | 1.1M | `BP_DaoJu/**` blueprints           |
| `recipes.json`  | 1,109   | 1.2M | `BP_PeiFang/**` blueprints         |
| `tech_tree.json`| 777     | 472K | `BP_KJS/**` blueprints             |
| `drops.json`    | 1,292   | 6.5M | 11 drop-table DataTables           |

All four are arrays of objects. IDs are Blueprint filenames (no extension). Text fields are Chinese — English resolution is a TODO via the PO localization file.

---

## items.json — catalogue of everything inventory-able

### Shape

```json
{
  "id": "Daoju_Item_Wood",
  "category": "material",
  "subcategory": "ZhiWu",
  "name_zh": "木材",
  "description_zh": "常见的木材，可用于建造和加工",
  "weight": 0.5,
  "max_stack": 100,
  "durability": null,
  "durability_decay": null,
  "material_type": "EDJCL_ZhiWu",
  "spoil_time_seconds": null,
  "storage_level": "EDJCD_LiJiCunDang",
  "stats": null,
  "icon_path": "/Game/UI/Icon/..."
}
```

### Categories (16)

Derived from the top-level `DaoJu/` subfolder:

| category      | count | meaning                                          |
|---------------|-------|--------------------------------------------------|
| equipment     | 391   | mount saddles, armor pieces, gear                |
| material      | 348   | raw + processed materials (wood, ore, hide…)     |
| building      | 254   | placeable structures (walls, workbenches in UI)  |
| weapon        | 229   | all weapon tiers/variants                        |
| tool          | 157   | axes, picks, bows (gathering tools)              |
| mask          | 140   | soulmask tiers + modules                         |
| processed     | 118   | intermediate crafting products                   |
| function      | 100   | emotes, festival items, repair kits, packs       |
| fashion       | 80    | cosmetics                                        |
| data          | 72    | meta / database items                            |
| food          | 53    | cooked/raw edibles                               |
| key           | 28    | dungeon/relic keys                               |
| potion        | 23    | consumable potions                               |
| tip           | 15    | UI tip items                                     |
| lighting      | 1     | lighting modules                                 |

### Fill rates

| field               | fill % | notes                                    |
|---------------------|--------|------------------------------------------|
| `name_zh`           | 97%    | Chinese display name                     |
| `description_zh`    | 93%    |                                          |
| `weight`            | 88%    | inventory weight (float)                 |
| `max_stack`         | 60%    | `MaxAmount` — null on non-stackable gear |
| `durability`        | 19%    | weapons + equipment only                 |
| `durability_decay`  | 20%    | per-use decay coefficient                |
| `material_type`     | 47%    | enum, see below                          |
| `storage_level`     | 81%    | enum, see below                          |
| `stats`             | 15%    | equipment stat modifiers                 |
| `spoil_time_seconds`| 3%     | food only                                |
| `icon_path`         | 92%    |                                          |
| `subcategory`       | 72%    | nested folder segment                    |

### Enum: `material_type` (CaiLiaoType)

| value              | count | meaning                   |
|--------------------|-------|---------------------------|
| EDJCL_JianZhu      | 367   | building material         |
| EDJCL_Mask         | 133   | mask material             |
| EDJCL_DongWu       | 104   | animal-origin             |
| EDJCL_KuangWu      | 60    | ore/mineral               |
| EDJCL_LiaoLi       | 47    | cooking ingredient        |
| EDJCL_BanChenPin   | 47    | semi-finished product     |
| EDJCL_GongJu       | 41    | tool material             |
| EDJCL_YaoWu        | 39    | medicinal                 |
| EDJCL_WuQi         | 38    | weapon material           |
| EDJCL_ShiCai       | 36    | food ingredient           |
| EDJCL_ZhiWu        | 34    | plant-origin              |
| EDJCL_FangJu       | 7     | armor material            |
| EDJCL_QiMin        | 2     | container/tool            |

### Enum: `storage_level` (DJCunDangDengJi)

- `EDJCD_LiJiCunDang` — immediately stored
- `EDJCD_ZangBiaoJiCunDang` — chest/stash stored
- `EDJCD_NoCunDang` — non-storable

### Stats array

306 items (mostly gear/weapons) carry `stats: [{attr, value, op}]`. Common attrs:

| attr                       | what it modifies              |
|----------------------------|-------------------------------|
| Defense / Attack           | base combat stats             |
| MaxHealth                  | health pool                   |
| Crit / CritDamageInc       | crit rate / damage            |
| WuQiDamageInc / ...Dec     | weapon damage in/out          |
| BlockWeakenTenacityDefense | block-breaking resistance     |
| MaxFuZhong                 | carry weight                  |
| ShengYinRatio              | noise ratio (stealth)         |
| SpeedRate                  | movement speed                |
| WenDuBaoNuan               | warmth (cold climates)        |
| BleedingDamageCarried      | bleed damage on hit           |
| TiLiRecover                | stamina regen                 |

---

## recipes.json — transform inputs into an output

### Shape

```json
{
  "id": "BP_PeiFang_WQ_ChangGong_1",
  "unique_id": "WuQI_ChangGong_1",
  "brief_zh": "制作兽骨长弓",
  "recipe_level": 1,
  "output": { "item_id": "BP_WuQi_ChangGong_1", "item_path": "/Game/..." },
  "inputs": [
    { "item_id": "Daoju_Item_Bone",   "item_path": "...", "quantity": 4 },
    { "item_id": "DaoJu_Item_Sheng",  "item_path": "...", "quantity": 3 },
    { "item_id": "Daoju_Item_Branch", "item_path": "...", "quantity": 5 }
  ],
  "station_id": "BP_GongZuoTai_ZhuZaoTai",
  "station_name": "Smithing Station",
  "station_paths": null,
  "station_required_level": null,
  "can_make_by_hand": true,
  "craft_time_seconds": 60.0,
  "proficiency": "Weapon Smithing",
  "proficiency_xp": 90.0,
  "quality_levels": null
}
```

### Fill rates

| field                   | fill % | notes                                    |
|-------------------------|--------|------------------------------------------|
| `output`                | 95%    | recipe result (null for pure consumers)  |
| `inputs`                | 99%    | `[{item_id, item_path, quantity}]`       |
| `craft_time_seconds`    | 100%   | `PeiFangMakeTime`                        |
| `proficiency`           | 100%   | 12 skill trees (see below)               |
| `proficiency_xp`        | 100%   | XP awarded                               |
| `station_id`            | 94%    | primary station                          |
| `station_paths`         | 13%    | set when recipe accepts multiple stations|
| `station_required_level`| 26%    | station upgrade tier required            |
| `can_make_by_hand`      | 13%    | bypasses station                         |
| `recipe_level`          | 88%    | `PeiFangDengJi` — recipe tier            |
| `quality_levels`        | 11%    | output can roll levels 1–6               |
| `brief_zh`              | 92%    | short Chinese description                |

### Proficiencies (12)

| proficiency       | recipes |
|-------------------|---------|
| Carpentry         | 310     |
| Armor Crafting    | 202     |
| Mount Equipment   | 139     |
| Weapon Smithing   | 115     |
| Alchemy           | 84      |
| None / special    | 76      |
| Cooking           | 67      |
| Leatherworking    | 59      |
| Metal Smelting    | 21      |
| Farming           | 18      |
| Weaving           | 13      |
| Pottery           | 5       |

### Input quantities

Distinct quantities range 1–200. Output quantity is not modelled — most recipes produce 1 (assumed default).

---

## tech_tree.json — hierarchical skill/progression tree

### Shape

```json
{
  "id": "BP_KJS_SubNode_BingJiao_1",
  "category": "sub",
  "is_sub": true,
  "name_zh": "冰窖",
  "description_zh": "学会建造冰窖",
  "required_mask_level": 40,
  "consume_points": 3,
  "prerequisite_main_nodes": ["BP_KJS_GZT_BingJiao"],
  "prerequisite_sub_nodes":  null,
  "child_sub_nodes":         null,
  "auto_learn_sub_nodes":    null,
  "unlocks_recipes":         ["BP_PeiFang_BingJiao"],
  "icon_path":               null
}
```

### Node types (6)

Two axes: **main vs sub**, and **regular / action / management**:

| category          | count | role                                         |
|-------------------|-------|----------------------------------------------|
| sub               | 382   | subnode under a main node                    |
| sub_action        | 126   | subnode, action tree                         |
| sub_management    | 89    | subnode, management tree                     |
| main              | 102   | top-level progression hub                    |
| main_action       | 41    | top-level, action tree                       |
| main_management   | 37    | top-level, management tree                   |

Main nodes group sub nodes. Sub nodes cost `consume_points` and unlock recipes.

### Fill rates

| field                     | fill % | notes                                     |
|---------------------------|--------|-------------------------------------------|
| `name_zh`                 | 100%   |                                           |
| `description_zh`          | 99%    |                                           |
| `required_mask_level`     | 79%    | mask tier gate (1–60)                     |
| `consume_points`          | 41%    | subnode cost: 1–6 points                  |
| `prerequisite_main_nodes` | 87%    | unified: parent main node for subs, prereqs for mains |
| `prerequisite_sub_nodes`  | 29%    | additional subnode prereqs                |
| `child_sub_nodes`         | 23%    | set on mains: 180/180 have children       |
| `auto_learn_sub_nodes`    | 23%    | subnodes learned for free                 |
| `unlocks_recipes`         | 77%    | subnodes that grant a recipe              |
| `icon_path`               | 23%    | only mains                                |

### Coverage

- 180 main nodes, each with children
- 597 sub nodes, 596 of which unlock at least one recipe
- 2,162 total recipe-unlock references
- Unlock counts: avg 3.6 per sub, max 35
- Point costs: 1 (67), 2 (120), 3 (52), 4 (44), 5 (37), 6 (2)
- Mask level spread: 1–60

---

## drops.json — weighted loot tables

### Shape

```json
{
  "row_key": "PuTong_001",
  "bag_name": "PuTong_001",
  "source_type": "npc",
  "groups": [
    { "probability": 30, "items": [
      { "item": "Roasted Pumpkin",
        "item_ref": "BlueprintGeneratedClass'\"/Game/.../DaoJu_Item_KaoNanGua_C\"'",
        "qty_min": 1, "qty_max": 3, "weight": 10, "quality": 1 },
      ...
    ]},
    { "probability": 10, "items": [...] }
  ]
}
```

### Structure

- **Bag** → list of **groups**; each group rolls independently with `probability` (%).
- Within a group, items compete by `weight` (relative chance).
- Each item has a quantity range (`qty_min`–`qty_max`) and a `quality` (1–6).

### Source types (11)

| source_type      | count | origin                         |
|------------------|-------|--------------------------------|
| npc              | 280   | base-game NPCs                 |
| creature_body    | 252   | harvested creature bodies      |
| npc_dlc          | 184   | DLC NPCs (AdditionMap01)       |
| relic_dlc        | 161   | DLC relics                     |
| ruins            | 116   | ruin loot                      |
| plant            | 100   | gathered plants                |
| tribe            | 70    | tribe camps                    |
| tribe_dlc        | 53    | DLC tribes                     |
| item_bag         | 43    | crafted item bags              |
| underground_city | 19    | underground city loot          |
| dungeon_dlc      | 14    | DLC dungeons                   |

### Per-bag shape

- Groups per bag: min 1, max 47, avg 5.9
- Quality levels: 1–6 (Common → Legendary)
- Item name is already resolved to English via PO localization; the raw class is in `item_ref`.

---

## Cross-references

What you can join across files:

| from            | via                                   | to                 | coverage           |
|-----------------|---------------------------------------|--------------------|--------------------|
| recipe.output   | `output.item_id`                      | item.id            | 1039 / 1045 (99%)  |
| recipe.inputs   | `inputs[].item_id`                    | item.id            | 456 / 479 (95%)    |
| tech_node       | `unlocks_recipes[]`                   | recipe.id          | 965 / 1143 (84%)   |
| drop.items      | parse `item_ref` → Blueprint filename | item.id            | 838 / 1120 (75%)   |
| recipe.station  | `station_id`                          | (no station file)  | —                  |
| tech_node       | `prerequisite_main_nodes[]`           | tech_node.id       | self-reference     |
| tech_node       | `child_sub_nodes[]`                   | tech_node.id       | self-reference     |

### Implications

- **Raw materials**: 245 item IDs appear as recipe inputs but are never produced by any recipe — these must come from gathering or drops.
- **Always-available recipes**: 144 recipes are not unlocked by any tech node — presumably starter recipes or always-known.
- **Drop-only items**: the 282 drop items not matched to `items.json` are likely in unexported subfolders (DLC-specific `BuLuo/`, `ZhuangBei/BuLuo/` equipment variants, Ship parts, etc.) or specialized types.

---

## Known gaps / TODOs

1. **English names**: `name_zh` / `description_zh` / `brief_zh` fields carry Chinese. The PO localization file (`parse_localization.py`, 5,203 entries) has English translations keyed by asset path — a join is needed to add `name_en` fields.
2. **Output quantities**: recipes don't model how many units the output produces; most are 1, some may not be.
3. **Alternative inputs / OR-groups**: the data model allows for this but no recipe appears to use it.
4. **Stations**: there's no standalone `stations.json`; station metadata (workbench tiers, fuel, etc.) would come from `Blueprints/JianZhu/GongZuoTai/` (80 files exported, not yet parsed).
5. **Drop `item_ref` matching**: ~25% of dropped items don't resolve to `items.json` because their blueprints live under unexported subfolders (DLC equipment, Ship parts).
6. **Tech tree `icon_path`**: only set on main nodes.

---

## Useful queries

| Question                         | Path                                                  |
|----------------------------------|-------------------------------------------------------|
| Where does X come from?          | search `drops` for items with `item_ref` matching X   |
| What can I make with X?          | filter `recipes` where inputs contain `item_id == X`  |
| How do I unlock recipe R?        | search `tech_tree` for `unlocks_recipes` containing R |
| What does tech node N give?      | `tech_tree[N].unlocks_recipes`                        |
| Full tree up to item X?          | recurse recipes → inputs → recipes; ground in drops   |
| What's the stats of weapon W?    | `items[W].stats` + `durability` + `weight`            |
| What does the campfire craft?    | filter recipes where `station_id == BP_GongZuoTai_X`  |
