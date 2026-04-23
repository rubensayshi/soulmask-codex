#!/usr/bin/env python3
"""Download item/tech icons from soulmaskdatabase.com as webp files.

Reads icon_path from items.json and tech_tree.json, deduplicates,
and downloads each to Game/Icons/{filename}.webp with rate limiting.

Usage:
    python3 pipeline/download_icons.py            # download missing only
    python3 pipeline/download_icons.py --force     # re-download all
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARSED_DIR = os.path.join(REPO_ROOT, "Game", "Parsed")
OUT_DIR = os.path.join(REPO_ROOT, "Game", "Icons")
BASE_URL = "https://www.soulmaskdatabase.com/images"
DELAY = 0.2  # seconds between requests


def collect_icon_filenames():
    fnames = set()
    for name in ("items.json", "tech_tree.json"):
        path = os.path.join(PARSED_DIR, name)
        if not os.path.exists(path):
            continue
        with open(path) as f:
            for entry in json.load(f):
                icon_path = entry.get("icon_path")
                if icon_path:
                    fnames.add(icon_path.rsplit("/", 1)[-1])
    return sorted(fnames)


def download_icons(force=False):
    os.makedirs(OUT_DIR, exist_ok=True)

    filenames = collect_icon_filenames()
    print(f"Unique icons to fetch: {len(filenames)}")

    skipped = 0
    downloaded = 0
    failed = []

    for i, fname in enumerate(filenames, 1):
        dest = os.path.join(OUT_DIR, f"{fname}.webp")

        if not force and os.path.exists(dest):
            skipped += 1
            continue

        url = f"{BASE_URL}/{fname}.webp"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "SoulDB-icon-scraper/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            with open(dest, "wb") as f:
                f.write(data)
            downloaded += 1
        except (urllib.error.HTTPError, urllib.error.URLError, OSError) as e:
            failed.append((fname, str(e)))

        if i % 100 == 0:
            print(f"  {i}/{len(filenames)}  ({downloaded} new, {skipped} cached, {len(failed)} failed)")

        time.sleep(DELAY)

    print(f"\nDone: {downloaded} downloaded, {skipped} already cached, {len(failed)} failed")
    if failed:
        print(f"\nFailed ({len(failed)}):")
        for fname, err in failed:
            print(f"  {fname}: {err}")


if __name__ == "__main__":
    download_icons(force="--force" in sys.argv)
