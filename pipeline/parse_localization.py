"""
Parse the Soulmask English PO localization file into lookup dicts.

Returns:
  names  - dict: normalized_asset_path -> English item name  (field == "Name")
  all_en - dict: (normalized_asset_path, field) -> English text  (all fields)

Usage:
    from parse_localization import load_names
    names = load_names()
"""

import re
import os

MODKIT_ROOT = r"C:\Program Files\Epic Games\SoulMaskModkit\Projects\WS"
PO_FILES = [
    os.path.join(MODKIT_ROOT, "Content", "Localization", "Game", "en", "Game.po"),
    os.path.join(MODKIT_ROOT, "Content", "Localization", "Categories", "en", "Categories.po"),
    os.path.join(MODKIT_ROOT, "Content", "Localization", "Properties", "en", "Properties.po"),
]

# PO entry fields we care about
_SOURCE_RE  = re.compile(r"^#\.\s*SourceLocation:\s*(.+)$")
_MSGID_RE   = re.compile(r'^msgid\s+"(.*)"$')
_MSGSTR_RE  = re.compile(r'^msgstr\s+"(.*)"$')


def _unescape(s):
    return s.replace('\\"', '"').replace("\\n", "\n").replace("\\\\", "\\")


def normalize_path(path):
    """
    Strip /Game/ prefix and CDO suffix, lowercase.
    /Game/Blueprints/DaoJu/Foo/Bar.Default__Bar_C.Name  ->  blueprints/daoju/foo/bar
    """
    path = path.strip()
    # Drop /Game/ prefix
    if path.startswith("/Game/"):
        path = path[6:]
    # Split off the field name (last dot-segment if it's a plain word like Name/Description)
    # e.g. .Default__Foo_C.Name  or  just .Name
    path = re.sub(r"\.Default__[^.]+_C\.[^.]+$", "", path)  # CDO + field
    path = re.sub(r"\.Default__[^.]+_C$", "", path)          # CDO without field
    # Remove trailing field-only suffix (.Name, .Description, etc.)
    path = re.sub(r"\.[A-Z][a-zA-Z]+$", "", path)
    return path.lower()


def _field_name(source_loc):
    """Extract the last dot-segment as the field name."""
    m = re.search(r"\.([A-Za-z_]+)$", source_loc)
    return m.group(1) if m else ""


def _parse_po(filepath):
    """Yield (source_loc, msgid, msgstr) tuples from a PO file."""
    with open(filepath, encoding="utf-8-sig") as f:
        lines = f.readlines()

    source_loc = None
    msgid = None
    msgstr = None
    in_msgid = False
    in_msgstr = False

    for line in lines:
        line = line.rstrip("\n")

        m = _SOURCE_RE.match(line)
        if m:
            source_loc = m.group(1).strip()
            continue

        m = _MSGID_RE.match(line)
        if m:
            in_msgid = True
            in_msgstr = False
            msgid = _unescape(m.group(1))
            continue

        m = _MSGSTR_RE.match(line)
        if m:
            in_msgid = False
            in_msgstr = True
            msgstr = _unescape(m.group(1))
            continue

        # Continuation lines: "more text"
        if line.startswith('"') and line.endswith('"'):
            val = _unescape(line[1:-1])
            if in_msgid and msgid is not None:
                msgid += val
            elif in_msgstr and msgstr is not None:
                msgstr += val
            continue

        # Blank line = end of entry
        if not line.strip():
            if source_loc and msgid is not None and msgstr is not None:
                yield source_loc, msgid, msgstr
            source_loc = None
            msgid = None
            msgstr = None
            in_msgid = False
            in_msgstr = False

    # Final entry
    if source_loc and msgid is not None and msgstr is not None:
        yield source_loc, msgid, msgstr


def load_names():
    """Build a map: normalized_asset_path -> English display name (field=Name)."""
    names = {}
    for po_path in PO_FILES:
        if not os.path.exists(po_path):
            continue
        for source_loc, msgid, msgstr in _parse_po(po_path):
            field = _field_name(source_loc)
            if field not in ("Name", "ItemName", "DisplayName", "ZhiZuoName", "PeiFangName"):
                continue
            en_name = msgstr if msgstr.strip() else msgid
            key = normalize_path(source_loc)
            if key and en_name:
                names[key] = en_name
    return names


def load_all_text():
    """Build a map: (normalized_asset_path, field) -> English text (all fields)."""
    result = {}
    for po_path in PO_FILES:
        if not os.path.exists(po_path):
            continue
        for source_loc, msgid, msgstr in _parse_po(po_path):
            en_text = msgstr if msgstr.strip() else msgid
            key = normalize_path(source_loc)
            field = _field_name(source_loc)
            if key and en_text:
                result[(key, field)] = en_text
    return result


if __name__ == "__main__":
    names = load_names()
    print("Loaded {} item names".format(len(names)))
    for k, v in list(names.items())[:15]:
        print("  {:<80s} -> {}".format(k, v))
