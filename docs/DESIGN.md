# SoulmaskDB Design Document

## 1. Current State

### What We Have

| Data Type    | Source              | Status    | Records |
|--------------|---------------------|-----------|---------|
| Drop tables  | 11 DataTables       | Parsed    | 1,292   |
| Item names   | Localization .po    | Parsed    | 5,203   |
| Recipes      | BP_PeiFang assets   | **Missing** | ~970  |
| Items        | BP_DaoJu assets     | **Missing** | ~1,500 |
| Tech tree    | BP_KJS nodes        | **Missing** | ~300  |

### Data Sources in Modkit

```
Content/
├── Blueprints/
│   ├── DataTable/          # Drop tables (exported)
│   ├── DaoJu/              # Item blueprints (NOT exported)
│   ├── PeiFang/            # Recipe blueprints (NOT exported)
│   └── KeJiShu/Node/       # Tech tree nodes (NOT exported)
└── Localization/Game/en/   # Names (exported)
```

---

## 2. Game Concepts

### Items (DaoJu)

Everything in the inventory. Categories:

| Chinese       | English          | Path                           |
|---------------|------------------|--------------------------------|
| DaoJuShiWu    | Food             | DaoJu/DaoJuShiWu/              |
| DaoJuWuQi    | Weapons          | DaoJu/DaoJuWuQi/               |
| DaoJuFangJu   | Armor            | DaoJu/DaoJuFangJu/             |
| DaoJuGongJu   | Tools            | DaoJu/DaoJuGongJu/             |
| DaoJuJianZhu  | Building items   | DaoJu/DaoJuJianZhu/            |
| DaojuCaiLiao  | Materials        | DaoJu/DaojuCaiLiao/            |
| DaoJuMianJu   | Masks            | DaoJu/DaoJuMianJu/             |

### Recipes (PeiFang)

Transform inputs → output. Key properties:

- **Inputs**: Primary materials (required)
- **Alternative inputs**: OR-groups (e.g., Iron Ore OR Metal Chunk)
- **Optional inputs**: Enhancement materials
- **Output**: Item + quantity
- **Station**: Crafting location (hand, workbench, furnace, etc.)
- **Craft time**: Seconds
- **Proficiency**: Skill type + XP awarded

### Drops (DaoJuBao)

Loot tables with weighted random selection:

```
Drop Bag → [Group₁, Group₂, ...]
  Group → {probability%, [Item₁, Item₂, ...]}
    Item → {ref, qty_min, qty_max, weight, quality}
```

Quality levels: 1-6 (Common → Legendary)

### Tech Tree (KeJiShu)

Unlocks recipes/abilities. Structure:

```
Category → Parent Node → Sub-Nodes → [Recipes]
```

Sub-nodes reference BP_PeiFang recipes they unlock.

---

## 3. Entity Relationships

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Item      │◄─────│   Recipe     │─────►│   Station   │
│             │output│              │crafts│             │
└─────────────┘      └──────────────┘      └─────────────┘
      ▲                    ▲
      │                    │
      │ drops              │ unlocks
      │                    │
┌─────────────┐      ┌──────────────┐
│  Drop Bag   │      │  Tech Node   │
│             │      │              │
└─────────────┘      └──────────────┘
      ▲
      │ assigned to
      │
┌─────────────┐
│   Source    │  (NPC, creature, plant, ruins, etc.)
└─────────────┘
```

---

## 4. Proposed Data Model

### items

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | TEXT PK  | Blueprint path (normalized)    |
| name          | TEXT     | English display name           |
| category      | TEXT     | DaoJuShiWu, DaoJuWuQi, etc.    |
| subcategory   | TEXT     | Further classification         |
| weight        | REAL     | Inventory weight               |
| max_stack     | INT      | Stack limit                    |
| durability    | INT      | For tools/weapons              |
| quality_min   | INT      | Lowest quality (1-6)           |
| quality_max   | INT      | Highest quality (1-6)          |
| icon_path     | TEXT     | Asset path for icon            |

### recipes

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | TEXT PK  | Blueprint path               |
| name            | TEXT     | English name                 |
| output_item_id  | TEXT FK  | → items.id                   |
| output_qty      | INT      | Amount produced              |
| station_id      | TEXT FK  | → stations.id (nullable=hand)|
| craft_time      | INT      | Seconds                      |
| proficiency     | TEXT     | Skill type                   |
| proficiency_xp  | INT      | XP awarded                   |
| tech_node_id    | TEXT FK  | → tech_nodes.id (unlock)     |

### recipe_inputs

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| recipe_id     | TEXT FK  | → recipes.id                   |
| item_id       | TEXT FK  | → items.id                     |
| quantity      | INT      | Amount required                |
| group_id      | INT      | For OR-alternatives (0=primary)|
| is_optional   | BOOL     | Enhancement material?          |

### drop_bags

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | TEXT PK  | Bag name (e.g., DL_YeZhu)      |
| source_type   | TEXT     | npc, creature_body, plant...   |
| source_key    | TEXT     | Row key for lookup             |

### drop_items

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| drop_bag_id   | TEXT FK  | → drop_bags.id                 |
| group_idx     | INT      | Group within bag               |
| probability   | INT      | Group probability %            |
| item_id       | TEXT FK  | → items.id                     |
| qty_min       | INT      |                                |
| qty_max       | INT      |                                |
| weight        | INT      | Selection weight within group  |
| quality       | INT      | 1-6                            |

### tech_nodes

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | TEXT PK  | Blueprint path                 |
| name          | TEXT     | English name                   |
| parent_id     | TEXT FK  | → tech_nodes.id (nullable)     |
| category      | TEXT     | Tech category                  |
| tier          | INT      | Progression level              |

### stations

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | TEXT PK  | Blueprint path or identifier   |
| name          | TEXT     | English name                   |
| category      | TEXT     | Workbench, Furnace, etc.       |

---

## 5. Missing Data - Export Requirements

### Priority 1: Recipes (BP_PeiFang)

**Challenge**: ~970 individual Blueprint files, not a DataTable.

**Options**:
1. **UE4 Python script** - Iterate PeiFang folder, read properties via reflection
2. **FModel extraction** - Export .uasset → JSON, parse offline
3. **Scrape soulmaskdatabase.com** - HTML parsing (no API)

**Fields needed**:
- Output item reference
- Output quantity
- Input items (with quantities)
- Alternative input groups
- Optional/enhancement inputs
- Craft time
- Proficiency type/XP
- Associated station

### Priority 2: Item Metadata (BP_DaoJu)

**Challenge**: ~1,500 item Blueprints with varying properties.

**Fields needed**:
- Weight
- Max stack size
- Durability (if applicable)
- Base stats (damage, armor, etc.)
- Category/subcategory

### Priority 3: Tech Tree (BP_KJS)

**Challenge**: Hierarchical structure across multiple assets.

**Fields needed**:
- Node hierarchy (parent/child)
- Recipes unlocked by each node
- Unlock requirements

---

## 6. Extraction Strategy

### Recommended: FModel + Custom Parser

1. **FModel** extracts .uasset → JSON for all:
   - `Blueprints/PeiFang/**/*.uasset`
   - `Blueprints/DaoJu/**/*.uasset`
   - `Blueprints/KeJiShu/**/*.uasset`

2. **Python parser** processes FModel JSON output:
   - Handles UE4 property serialization
   - Resolves asset references
   - Applies localization names
   - Outputs structured JSON/SQLite

### Alternative: UE4 Python Script

Extend `export_tables.py` to iterate Blueprint folders:

```python
# Pseudocode
for bp_path in unreal.EditorAssetLibrary.list_assets('/Game/Blueprints/PeiFang', recursive=True):
    bp = unreal.load_asset(bp_path)
    cdo = unreal.get_default_object(bp)
    # Extract properties via reflection...
```

**Limitation**: UE4.27 Python API doesn't expose all Blueprint properties cleanly.

---

## 7. UI Considerations

### Core Pages

1. **Item Browser**
   - Filter by category, name search
   - Click → item detail page

2. **Item Detail**
   - Stats, description
   - "Obtained from" → drop sources
   - "Used in" → recipes as input
   - "Crafted via" → recipe (if craftable)

3. **Recipe Browser**
   - Filter by station, category
   - Search by output or input

4. **Recipe Detail**
   - Inputs (with alternatives)
   - Output
   - Station, time, proficiency
   - Tech tree requirement

5. **Drop Source Browser**
   - By source type (NPC, creature, plant, etc.)
   - Show drop tables with probabilities

6. **Tech Tree Viewer**
   - Visual tree navigation
   - Click node → unlocked recipes

### Key Queries

| Use Case                         | Query Pattern                              |
|----------------------------------|--------------------------------------------|
| "Where do I get Iron Ore?"       | items → drop_items → drop_bags             |
| "What can I make with Iron Ore?" | items → recipe_inputs → recipes            |
| "What does Furnace craft?"       | stations → recipes                         |
| "What unlocks Iron Ingot recipe?"| recipes → tech_nodes                       |
| "Full recipe tree for X"         | Recursive: recipe → inputs → recipes...    |

---

## 8. Open Questions

1. **Stations**: Is there a DataTable listing all crafting stations, or must we infer from recipes?

2. **Recipe alternatives**: How are OR-groups serialized in BP_PeiFang? Same property or separate?

3. **Quality crafting**: Does output quality depend on input quality, or fixed per recipe?

4. **DLC separation**: Should base game and DLC (AdditionMap01) items be flagged separately?

5. **Data freshness**: How to handle game updates? Re-run full export or incremental?

6. **Localization**: Support other languages, or English-only for now?

---

## 9. Next Steps

1. [ ] Export BP_PeiFang assets via FModel or UE4 script
2. [ ] Analyze recipe Blueprint structure
3. [ ] Write recipe parser
4. [ ] Export item metadata (BP_DaoJu)
5. [ ] Export tech tree (BP_KJS)
6. [ ] Build SQLite database
7. [ ] Design API layer
8. [ ] Build UI

---

## Appendix: Chinese-English Glossary

| Chinese      | Pinyin        | English           |
|--------------|---------------|-------------------|
| 道具         | DaoJu         | Item              |
| 配方         | PeiFang       | Recipe            |
| 制作         | ZhiZuo        | Crafting/Making   |
| 掉落包       | DiaoLuoBao    | Drop Bag          |
| 科技树       | KeJiShu       | Tech Tree         |
| 材料         | CaiLiao       | Material          |
| 武器         | WuQi          | Weapon            |
| 防具         | FangJu        | Armor             |
| 工具         | GongJu        | Tool              |
| 食物         | ShiWu         | Food              |
| 建筑         | JianZhu       | Building          |
| 面具         | MianJu        | Mask              |
| 生物         | ShengWu       | Creature          |
| 植被         | ZhiBei        | Plant/Vegetation  |
| 部落         | BuLuo         | Tribe             |
| 遗迹         | YiJi          | Ruins/Relic       |
| 品质         | PinZhi        | Quality           |
| 数量         | ShuLiang      | Quantity          |
| 权重         | QuanZhong     | Weight (priority) |
