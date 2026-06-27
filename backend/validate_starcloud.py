#!/usr/bin/env python3
"""Validate data/star-cloud.json for competition constraints and graph health."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "star-cloud.json"

BANNED = re.compile(r"寺|庙|塔|庵|禅|佛像|石窟塔")
ALLOWED_BUILDING_CATS = {"民居", "官府", "皇宫", "桥梁", "城墙"}
HUB_IDS = ["beijing-gugong", "li-jie", "lei-fada", "kuai-xiang", "ying-zao-fa-shi"]


def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    stars = data["stars"]
    by_id = {s["id"]: s for s in stars}
    errors: list[str] = []
    warnings: list[str] = []

    for s in stars:
        sid = s["id"]
        if s.get("year") is not None and s["year"] > 1911:
            errors.append(f"{sid}: year {s['year']} > 1911")
        for r in s.get("related") or []:
            if r not in by_id:
                errors.append(f"{sid}: dangling related '{r}'")
        for r in s.get("works") or []:
            if r not in by_id:
                warnings.append(f"{sid}: dangling works '{r}'")
        if s.get("parent") and s["parent"] not in by_id:
            warnings.append(f"{sid}: dangling parent '{s['parent']}'")
        if s["type"] == "building":
            cat = s.get("category")
            if cat and cat not in ALLOWED_BUILDING_CATS:
                errors.append(f"{sid}: invalid category '{cat}'")
        text = (s.get("name", "") + s.get("summary", ""))
        if BANNED.search(text) and sid not in ("taiyuan-jinci",):
            warnings.append(f"{sid}: possible temple/pagoda keyword in text")

    def degree(sid: str) -> int:
        rel = set(by_id[sid].get("related") or [])
        for o in stars:
            if sid in (o.get("related") or []):
                rel.add(o["id"])
        return len(rel)

    for hid in HUB_IDS:
        if hid in by_id and degree(hid) < 8:
            warnings.append(f"hub {hid}: degree {degree(hid)} < 8")

    scientists = [s for s in stars if s["type"] == "scientist"]
    avg_sci = sum(len(s.get("related") or []) for s in scientists) / max(1, len(scientists))
    if avg_sci < 3:
        warnings.append(f"scientist avg related {avg_sci:.1f} < 3")

    print(f"Stars: {len(stars)} | scientists: {len(scientists)} | avg scientist related: {avg_sci:.1f}")
    for hid in HUB_IDS:
        if hid in by_id:
            print(f"  hub {hid}: degree {degree(hid)}")

    if warnings:
        print("\nWarnings:")
        for w in warnings[:20]:
            print("  !", w)
        if len(warnings) > 20:
            print(f"  ... +{len(warnings) - 20} more")

    if errors:
        print("\nErrors:")
        for e in errors:
            print("  ✗", e)
        return 1

    print("\n✓ Validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
