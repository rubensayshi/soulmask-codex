"""
Parse localization/Game/en/Game.po into data/translations/po.json.

Maps PO entries to our translation-key scheme:
  - .Name / .ItemName / .DisplayName on a /DaoJu/ path     → item:<BP id>
  - .Description on a /DaoJu/ path                          → item_desc:<BP id>
  - .JianZhuDisplayName / .Name on a /JianZhu/ path         → station:<BP id>  (only stations)
  - .Name on a /KeJiShu/ path                               → tech_node:<BP id>

BP id = filename before `.Default__` in the SourceLocation path, case-preserved.

This replaces data/translations/po.json (which was previously a `{}` stub).
build_db.py already prefers po.json over manual.json, so rerunning `make db`
after this script populates English names from the real PO translations.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOC = ROOT / "localization"
OUT = ROOT / "data" / "translations" / "po.json"

# en/Game.po is the only file with game-item data. Others are UObject/UI metadata.
PO_FILES = [LOC / "Game" / "en" / "Game.po"]

# SourceLocation field extractor
#   /Game/<path>/<BP_ID>.Default__<ClassName>_C.<Field>
FIELD_RE = re.compile(
    r"/Game/(?P<path>[^.]+)/(?P<bp_id>[^/.]+)\.Default__[^.]+_C\.(?P<field>[A-Za-z]+)$"
)

# Field-name priority per key prefix. First match wins.
FIELD_BY_PREFIX = {
    "item":      ("Name", "ItemName", "DisplayName"),
    "item_desc": ("Description",),
    "station":   ("JianZhuDisplayName", "Name", "DisplayName"),
    "tech_node": ("Name", "DisplayName"),
}


def classify(path: str) -> list[str]:
    """Return the key prefixes for a given Blueprints path.

    `path` comes from the regex without a trailing slash, so we normalize both
    sides with leading/trailing slashes before substring-matching. Without this,
    /Game/Blueprints/JianZhu/GongZuoTai/<BP>.Default... (path ends at GongZuoTai,
    no trailing slash) fails to match the `/JianZhu/GongZuoTai/` probe.
    """
    p = "/" + path.strip("/") + "/"
    if "/DaoJu/" in p or "/Daoju/" in p:
        return ["item", "item_desc"]
    if p.endswith("/JianZhu/GongZuoTai/"):
        return ["station"]
    if "/KeJiShu/" in p:
        return ["tech_node"]
    return []


def iter_po_entries(po_path: Path):
    """Yield (source_loc, msgid, msgstr) from a PO file. Handles multi-line strings."""
    source_loc = None
    msgid = msgstr = None
    in_msgid = in_msgstr = False

    def _unescape(s):
        return s.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")

    with po_path.open(encoding="utf-8-sig") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#. SourceLocation:"):
                source_loc = line.split(":", 1)[1].strip()
                continue
            if line.startswith('msgid "'):
                in_msgid, in_msgstr = True, False
                msgid = _unescape(line[len('msgid "'):-1])
                continue
            if line.startswith('msgstr "'):
                in_msgid, in_msgstr = False, True
                msgstr = _unescape(line[len('msgstr "'):-1])
                continue
            if line.startswith('"') and line.endswith('"'):
                val = _unescape(line[1:-1])
                if in_msgid and msgid is not None:
                    msgid += val
                elif in_msgstr and msgstr is not None:
                    msgstr += val
                continue
            if not line.strip():
                if source_loc and msgid is not None and msgstr is not None:
                    yield source_loc, msgid, msgstr
                source_loc = msgid = msgstr = None
                in_msgid = in_msgstr = False

    if source_loc and msgid is not None and msgstr is not None:
        yield source_loc, msgid, msgstr


def main():
    # Candidate translations: (prefix, bp_id) → {field: en_text}
    # We pick the best field per (prefix, bp_id) using FIELD_BY_PREFIX priority.
    candidates: dict[tuple[str, str], dict[str, str]] = {}
    stats = {"entries_scanned": 0, "entries_matched": 0}

    for po in PO_FILES:
        if not po.exists():
            print(f"SKIP missing {po}")
            continue
        print(f"Parsing {po}")
        for source_loc, msgid, msgstr in iter_po_entries(po):
            stats["entries_scanned"] += 1
            m = FIELD_RE.search(source_loc)
            if not m:
                continue
            path = m.group("path")
            bp_id = m.group("bp_id")
            field = m.group("field")
            prefixes = classify(path)
            if not prefixes:
                continue
            en = msgstr.strip() or msgid.strip()
            if not en:
                continue
            for prefix in prefixes:
                if field in FIELD_BY_PREFIX[prefix]:
                    key = (prefix, bp_id)
                    candidates.setdefault(key, {})[field] = en
                    stats["entries_matched"] += 1

    # Resolve each candidate to the preferred field.
    entries: dict[str, str] = {}
    for (prefix, bp_id), fields in candidates.items():
        for preferred in FIELD_BY_PREFIX[prefix]:
            if preferred in fields:
                entries[f"{prefix}:{bp_id}"] = fields[preferred]
                break

    by_prefix = {}
    for k in entries:
        p = k.split(":", 1)[0]
        by_prefix[p] = by_prefix.get(p, 0) + 1

    payload = {
        "source": "po",
        "generated_from": [str(p.relative_to(ROOT)) for p in PO_FILES],
        "entries": entries,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")
    print(f"  entries scanned:  {stats['entries_scanned']}")
    print(f"  entries matched:  {stats['entries_matched']}")
    print(f"  unique keys:      {len(entries)}")
    for p, n in sorted(by_prefix.items()):
        print(f"    {p}: {n}")


if __name__ == "__main__":
    main()
