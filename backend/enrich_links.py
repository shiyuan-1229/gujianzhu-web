#!/usr/bin/env python3
"""
Suggest / merge related edges for star-cloud.raw.json or star-cloud.json.
Uses tag overlap + type rules; optional DeepSeek pass via collect_starcloud.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IN = ROOT / "data" / "star-cloud.json"
DEFAULT_OUT = ROOT / "data" / "star-cloud.enriched.json"

TYPE_LINKS = {
    "scientist": {"book", "building", "achievement", "scientist"},
    "book": {"scientist", "building", "achievement"},
    "building": {"scientist", "achievement", "building"},
    "achievement": {"building", "book", "scientist", "achievement"},
}


def enrich(stars: list[dict]) -> list[dict]:
    by_id = {s["id"]: s for s in stars}
    ids = set(by_id)
    tag_map: dict[str, list[str]] = {}
    for s in stars:
        for t in s.get("tags") or []:
            tag_map.setdefault(t, []).append(s["id"])

    for s in stars:
        related = list(dict.fromkeys(s.get("related") or []))
        seen = set(related)
        stype = s["type"]
        allowed = TYPE_LINKS.get(stype, set())

        for field in ("works", "architects"):
            for rid in s.get(field) or []:
                if rid in ids and rid not in seen:
                    related.append(rid)
                    seen.add(rid)
        if s.get("parent") and s["parent"] in ids and s["parent"] not in seen:
            related.append(s["parent"])
            seen.add(s["parent"])

        tags = set(s.get("tags") or [])
        if tags and len(related) < 8:
            for t in tags:
                for oid in tag_map.get(t, []):
                    if oid == s["id"] or oid in seen:
                        continue
                    if by_id[oid]["type"] in allowed:
                        related.append(oid)
                        seen.add(oid)
                        if len(related) >= 12:
                            break
                if len(related) >= 12:
                    break
        s["related"] = related
    return stars


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", default=str(DEFAULT_IN))
    ap.add_argument("--out", dest="out", default=str(DEFAULT_OUT))
    ap.add_argument("--inplace", action="store_true")
    args = ap.parse_args()

    inp = Path(args.inp)
    data = json.loads(inp.read_text(encoding="utf-8"))
    data["stars"] = enrich(data["stars"])
    out = inp if args.inplace else Path(args.out)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ enriched {len(data['stars'])} stars → {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
