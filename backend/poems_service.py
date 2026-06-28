from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import (
    BUILDING_POEMS_INDEX,
    EXTENDED_POETRY_MAP,
    POEMS_FILE,
    PROJECT_POETRY_MAP,
)

ARCHITECTURE_KEYWORDS = [
    "楼", "台", "阁", "殿", "塔", "寺", "庙", "桥", "亭",
    "宫", "城", "墙", "檐", "廊", "坊", "门", "院", "庐",
    "榭", "轩", "馆", "舍", "阙", "坞", "营", "垒", "墉",
    "瓦", "柱", "阶", "砌", "梁", "栋", "宇", "宅", "邸",
    "圆明园", "阿房", "铜雀", "未央", "蓬莱", "华清", "轮台",
    "姑苏", "滕王", "黄鹤", "岳阳", "鹳雀", "开元", "秦淮",
    "故宫", "长城", "烽火", "丹陛", "须弥", "斗拱", "飞檐",
]

DEFAULT_POEMS: dict[str, Any] = {
    "meta": {
        "total": 3,
        "keywords": ARCHITECTURE_KEYWORDS,
        "sources": ["builtin"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    },
    "poems": [
        {
            "id": 1,
            "title": "登鹳雀楼",
            "author": "王之涣",
            "dynasty": "唐",
            "content": "白日依山尽，黄河入海流。\n欲穷千里目，更上一层楼。",
            "tags": ["楼"],
            "source": "builtin",
        },
        {
            "id": 2,
            "title": "滕王阁诗",
            "author": "王勃",
            "dynasty": "唐",
            "content": "滕王高阁临江渚，佩玉鸣鸾罢歌舞。\n画栋朝飞南浦云，珠帘暮卷西山雨。",
            "tags": ["阁"],
            "source": "builtin",
        },
        {
            "id": 3,
            "title": "过华清宫",
            "author": "杜牧",
            "dynasty": "唐",
            "content": "长安回望绣成堆，山顶千门次第开。\n一骑红尘妃子笑，无人知是荔枝来。",
            "tags": ["宫", "门"],
            "source": "builtin",
        },
    ],
}

_cache: dict[str, Any] | None = None
_building_index_cache: dict[str, Any] | None = None
_project_map_cache: tuple[float, dict[str, Any]] | None = None


def _ensure_data_file() -> Path:
    if not POEMS_FILE.exists():
        POEMS_FILE.parent.mkdir(parents=True, exist_ok=True)
        POEMS_FILE.write_text(
            json.dumps(DEFAULT_POEMS, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return POEMS_FILE


def load_poems(force_reload: bool = False) -> dict[str, Any]:
    global _cache
    if _cache is not None and not force_reload:
        return _cache

    path = _ensure_data_file()
    with path.open(encoding="utf-8") as f:
        _cache = json.load(f)
    return _cache


def _match_poem(
    poem: dict[str, Any],
    keyword: str | None,
    author: str | None,
    tag: str | None,
    dynasty: str | None,
) -> bool:
    if author and author not in poem.get("author", ""):
        return False
    if dynasty and dynasty not in poem.get("dynasty", ""):
        return False
    if tag and tag not in poem.get("tags", []):
        return False
    if keyword:
        haystack = poem.get("title", "") + poem.get("content", "") + poem.get("author", "")
        haystack += "".join(poem.get("tags", []))
        if keyword not in haystack:
            return False
    return True


def list_poems(
    keyword: str | None = None,
    author: str | None = None,
    tag: str | None = None,
    dynasty: str | None = None,
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    data = load_poems()
    poems = data.get("poems", [])
    filtered = [
        p for p in poems
        if _match_poem(p, keyword, author, tag, dynasty)
    ]
    total = len(filtered)
    page = max(page, 1)
    size = min(max(size, 1), 100)
    start = (page - 1) * size
    end = start + size
    return {
        "page": page,
        "size": size,
        "total": total,
        "items": filtered[start:end],
    }


def get_poem(poem_id: int) -> dict[str, Any] | None:
    data = load_poems()
    for poem in data.get("poems", []):
        if poem.get("id") == poem_id:
            return poem
    return None


def random_poem(tag: str | None = None) -> dict[str, Any] | None:
    data = load_poems()
    poems = data.get("poems", [])
    if tag:
        poems = [p for p in poems if tag in p.get("tags", [])]
    if not poems:
        return None
    return random.choice(poems)


def load_building_index(force_reload: bool = False) -> dict[str, Any]:
    global _building_index_cache
    if _building_index_cache is not None and not force_reload:
        return _building_index_cache
    if not BUILDING_POEMS_INDEX.exists():
        return {"meta": {}, "buildings": []}
    with BUILDING_POEMS_INDEX.open(encoding="utf-8") as f:
        _building_index_cache = json.load(f)
    return _building_index_cache


def list_buildings(province: str | None = None) -> dict[str, Any]:
    index = load_building_index()
    buildings = index.get("buildings", [])
    if province:
        buildings = [b for b in buildings if province in b.get("province", "")]
    return {
        "total": len(buildings),
        "items": [
            {
                "name": b["name"],
                "province": b.get("province"),
                "category": b.get("category"),
                "poem_count": b.get("poem_count", 0),
                "has_direct_match": b.get("has_direct_match", False),
                "matched_keywords": b.get("matched_keywords", []),
            }
            for b in buildings
        ],
    }


def get_building_entry(name: str) -> dict[str, Any] | None:
    try:
        proj = load_project_poetry_map()
        for building in proj.get("buildings", []):
            if building.get("name") == name:
                return building
    except Exception:
        pass
    index = load_building_index()
    for building in index.get("buildings", []):
        if building.get("name") == name:
            return building
        for alias in building.get("aliases") or []:
            if alias == name:
                return building
    return None


def list_poems_by_building(
    building_name: str,
    page: int = 1,
    size: int = 20,
) -> dict[str, Any]:
    entry = get_building_entry(building_name)
    if not entry:
        return {"page": page, "size": size, "total": 0, "building": building_name, "items": []}

    data = load_poems()
    id_set = set(entry.get("poem_ids") or [])
    poems = [p for p in data.get("poems", []) if p.get("id") in id_set]
    poems.sort(key=lambda p: p.get("id", 0))

    total = len(poems)
    page = max(page, 1)
    size = min(max(size, 1), 100)
    start = (page - 1) * size
    return {
        "building": entry["name"],
        "province": entry.get("province"),
        "category": entry.get("category"),
        "has_direct_match": entry.get("has_direct_match", False),
        "matched_keywords": entry.get("matched_keywords", []),
        "page": page,
        "size": size,
        "total": total,
        "items": poems[start : start + size],
    }


def load_project_poetry_map(force_reload: bool = False) -> dict[str, Any]:
    """项目 21 处古建专用地图（经核实的古代诗词，含无诗建筑）。"""
    global _project_map_cache
    path = PROJECT_POETRY_MAP
    if not path.exists():
        return get_poetry_landscape(scope="project", _legacy=True)

    mtime = path.stat().st_mtime
    if _project_map_cache is not None and not force_reload and _project_map_cache[0] == mtime:
        return _project_map_cache[1]

    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    _project_map_cache = (mtime, data)
    return data


def load_extended_poetry_map(force_reload: bool = False) -> dict[str, Any]:
    global _project_map_cache
    path = EXTENDED_POETRY_MAP
    if not path.exists():
        return get_poetry_landscape(scope="project", _legacy=True)

    mtime = path.stat().st_mtime
    if _project_map_cache is not None and not force_reload and _project_map_cache[0] == mtime:
        return _project_map_cache[1]

    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    _project_map_cache = (mtime, data)
    return data


def get_poetry_landscape(scope: str = "all", *, _legacy: bool = False) -> dict[str, Any]:
    if scope == "extended":
        return load_extended_poetry_map()
    if scope == "project" and not _legacy:
        return load_project_poetry_map()

    from project_buildings import PROJECT_BUILDING_NAMES, BUILDING_MAP_3D

    index = load_building_index()
    buildings = index.get("buildings", [])
    seen_names: set[str] = set()
    regions: dict[str, list] = {}
    items = []
    project_only = scope == "project"

    for b in buildings:
        name = b.get("name", "")
        if name in seen_names:
            continue
        if project_only:
            if name not in PROJECT_BUILDING_NAMES:
                continue
        elif not b.get("poem_count"):
            continue
        if name in ("故宫", "四合院") and any(
            x.get("name") == f"北京{name}" for x in buildings
        ):
            continue
        seen_names.add(name)
        province = b.get("province", "未知")
        layout = PROVINCE_LAYOUT.get(province, {"x": 50, "y": 50})
        region_list = regions.setdefault(province, [])
        offset = len(region_list) * 4
        geo = BUILDING_MAP_3D.get(name, {}) if project_only else {}
        entry = {
            "name": name,
            "province": province,
            "category": b.get("category"),
            "poem_count": b.get("poem_count", 0),
            "poem_ids": b.get("poem_ids", []),
            "has_direct_match": b.get("has_direct_match", False),
            "x": geo.get("x", min(92, max(8, layout["x"] + offset - 4))),
            "y": geo.get("y", min(90, max(10, layout["y"] + (offset % 3) * 2))),
            "z": geo.get("z", 30),
            "poems_preview": b.get("poems_preview", []),
        }
        region_list.append(entry)
        items.append(entry)

    if project_only:
        present = {e["name"] for e in items}
        for name in sorted(PROJECT_BUILDING_NAMES):
            if name in present:
                continue
            geo = BUILDING_MAP_3D.get(name, {})
            province = next(
                (x.get("province") for x in buildings if x.get("name") == name),
                "未知",
            )
            layout = PROVINCE_LAYOUT.get(province, {"x": 50, "y": 50})
            entry = {
                "name": name,
                "province": province,
                "category": "",
                "poem_count": 0,
                "poem_ids": [],
                "has_direct_match": False,
                "x": geo.get("x", layout["x"]),
                "y": geo.get("y", layout["y"]),
                "z": geo.get("z", 30),
                "poems_preview": [],
            }
            regions.setdefault(province, []).append(entry)
            items.append(entry)

    return {
        "title": "诗词山河",
        "scope": "project" if project_only else "all",
        "subtitle": (
            f"古建智寻 · 5 省 · {len(items)} 处项目古建 · 仅经核实的古代诗词"
            if project_only
            else f"古建智寻 · {len(regions)} 省域 · {len(items)} 处古建 · {index.get('meta', {}).get('total', 0)} 首诗词库"
        ),
        "building_count": len(items),
        "province_count": len(regions),
        "poem_pool_total": index.get("meta", {}).get("total", 0),
        "themes": THEME_FILTERS if not project_only else [
            {"id": "all", "label": "全部"},
            {"id": "beijing", "label": "北京", "provinces": ["北京"]},
            {"id": "shanxi", "label": "山西", "provinces": ["山西"]},
            {"id": "jiangsu", "label": "江苏", "provinces": ["江苏"]},
            {"id": "sichuan", "label": "四川", "provinces": ["四川"]},
            {"id": "guangdong", "label": "广东", "provinces": ["广东"]},
        ],
        "provinces": [
            {"name": p, "x": PROVINCE_LAYOUT.get(p, {}).get("x", 50), "y": PROVINCE_LAYOUT.get(p, {}).get("y", 50), "buildings": regions[p]}
            for p in sorted(regions.keys())
        ],
        "buildings": items,
    }


def get_stats() -> dict[str, Any]:
    data = load_poems()
    poems = data.get("poems", [])
    tag_counts: dict[str, int] = {}
    dynasty_counts: dict[str, int] = {}
    for poem in poems:
        for tag in poem.get("tags", []):
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
        dynasty = poem.get("dynasty", "未知")
        dynasty_counts[dynasty] = dynasty_counts.get(dynasty, 0) + 1
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:20]
    building_index = load_building_index()
    buildings_with_poems = sum(1 for b in building_index.get("buildings", []) if b.get("poem_count", 0) > 0)
    return {
        "total": len(poems),
        "meta": data.get("meta", {}),
        "dynasty_counts": dynasty_counts,
        "top_tags": [{"tag": t, "count": c} for t, c in top_tags],
        "keywords": ARCHITECTURE_KEYWORDS,
        "building_count": len(building_index.get("buildings", [])),
        "buildings_with_poems": buildings_with_poems,
    }
