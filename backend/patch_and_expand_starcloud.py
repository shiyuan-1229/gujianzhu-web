#!/usr/bin/env python3
"""Patch hub nodes, add stars, enrich related edges in data/star-cloud.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

from bulk_stars_data import all_bulk_stars

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "star-cloud.json"

HUB_RELATED = {
    "beijing-gugong": [
        "kuai-xiang", "zhongzhou-zhixian", "gugong-taihedian", "gugong-yuhuayuan",
        "lei-fada", "lei-jinyu", "lei-jingxiu", "lei-siqi", "lei-tingchang",
        "ruan-an", "cai-xin", "xu-gao", "liang-jiu", "lu-xiang",
        "jinzhuan", "wudian", "chongyan", "caihua", "dougong", "liuli", "zoushou", "yuanmingyuan",
    ],
    "li-jie": [
        "ying-zao-fa-shi", "cai-fen-zhi", "dougong", "juzhe", "juansha", "suozhu",
        "cejiao", "shengqi", "gongcheng-zuofa", "beijing-gugong", "yu-hao", "mengxi-bitan",
    ],
    "lei-fada": [
        "lei-jinyu", "lei-jiaxi", "lei-jingxiu", "lei-siqi", "lei-tingchang",
        "beijing-gugong", "yuanmingyuan", "yiheyuan", "bishu-shanzhuang",
        "gongcheng-zuofa", "gugong-taihedian",
    ],
    "kuai-xiang": [
        "beijing-gugong", "gugong-taihedian", "cai-xin", "ruan-an", "lu-xiang",
        "zhongzhou-zhixian", "yingzao-fayuan", "xu-gao", "liang-jiu",
    ],
    "ying-zao-fa-shi": [
        "li-jie", "cai-fen-zhi", "dougong", "juzhe", "juansha", "ang", "huagong", "ludou",
        "gongcheng-zuofa", "beijing-gugong", "zhaozhou-qiao", "yu-hao",
    ],
    "gugong-taihedian": [
        "beijing-gugong", "liang-jiu", "xu-gao", "wudian", "chongyan", "zoushou",
        "caihua", "dougong", "zaojing", "yuetai",
    ],
    "gugong-yuhuayuan": [
        "beijing-gugong", "diesan-lishui", "jiejing", "jiashan",
    ],
}

NEW_SCIENTISTS = [
    {"id": "chen-gui", "name": "陈规", "type": "scientist", "dynasty": "北宋", "year": 1132,
     "weight": 0.75, "summary": "著《守城录》，系统论述城防营造与守城器械。", "tags": ["城防", "守城"], "related": ["wengcheng", "pingyao-chengqiang"]},
    {"id": "feng-qiao", "name": "冯巧", "type": "scientist", "dynasty": "明", "year": 1520,
     "weight": 0.7, "summary": "明代木工名匠，精于宫殿楼阁大木作与雕饰。", "tags": ["大木", "明"], "related": ["beijing-gugong", "dougong"]},
    {"id": "zhan-de-sheng", "name": "战德盛", "type": "scientist", "dynasty": "清", "year": 1750,
     "weight": 0.65, "summary": "清代匠作名家，参与皇家建筑工程营造。", "tags": ["匠师", "清代"], "related": ["beijing-gugong", "gongcheng-zuofa"]},
    {"id": "xue-jing-shi", "name": "薛景石", "type": "scientist", "dynasty": "元", "year": 1264,
     "weight": 0.7, "summary": "著《梓人遗制》，记木工机械与家具营造形制。", "tags": ["木工", "元"], "related": ["zireng-yizhi", "sunmao"]},
    {"id": "cai-xiang", "name": "蔡襄", "type": "scientist", "dynasty": "北宋", "year": 1059,
     "weight": 0.8, "summary": "主持建造洛阳桥，创筏形基与养蛎固基法。", "tags": ["桥梁", "石梁"], "related": ["luoyang-qiao", "liangqiao"]},
    {"id": "song-yingxing", "name": "宋应星", "type": "scientist", "dynasty": "明", "year": 1637,
     "weight": 0.75, "summary": "著《天工开物》，记述砖瓦陶埏等建筑材料工艺。", "tags": ["科技", "建材"], "related": ["tiangong-kaiwu", "liuli"]},
    {"id": "shen-kuo", "name": "沈括", "type": "scientist", "dynasty": "北宋", "year": 1088,
     "weight": 0.8, "summary": "著《梦溪笔谈》，载喻皓《木经》及建筑技术见闻。", "tags": ["科技笔记", "北宋"], "related": ["mengxi-bitan", "yu-hao", "mu-jing"]},
    {"id": "wang-qi", "name": "王圻", "type": "scientist", "dynasty": "明", "year": 1607,
     "weight": 0.6, "summary": "编《三才图会》，宫室卷收建筑形制图说。", "tags": ["类书", "图说"], "related": ["sancai-tuhui"]},
    {"id": "qian-yong", "name": "钱泳", "type": "scientist", "dynasty": "清", "year": 1838,
     "weight": 0.65, "summary": "著《履园丛话》，营造卷记江南建筑做法。", "tags": ["笔记", "江南"], "related": ["lvyuan-conghua", "suzhou-zhuozhengyuan"]},
    {"id": "huang-sheng-chao", "name": "黄升朝", "type": "scientist", "dynasty": "明", "year": 1450,
     "weight": 0.55, "summary": "明代匠师，承北京宫殿木作修缮工程。", "tags": ["匠师", "宫殿"], "related": ["beijing-gugong", "kuai-xiang"]},
    {"id": "wu-liang-fu", "name": "吴良辅", "type": "scientist", "dynasty": "明", "year": 1420,
     "weight": 0.6, "summary": "明初匠师，参与紫禁城前期营建工程。", "tags": ["匠师", "紫禁城"], "related": ["beijing-gugong", "kuai-xiang"]},
    {"id": "zhang-heng", "name": "张衡", "type": "scientist", "dynasty": "东汉", "year": 120,
     "weight": 0.65, "summary": "科学家兼工程家，创候风地动仪，兼及都城规划思想。", "tags": ["工程", "汉代"], "related": ["kaogong-ji"]},
    {"id": "dong-zhongshu", "name": "董仲舒", "type": "scientist", "dynasty": "西汉", "year": -100,
     "weight": 0.5, "summary": "礼制思想影响都城与宫殿等级布局观念。", "tags": ["礼制", "规划"], "related": ["zhongzhou-zhixian", "kaogong-ji"]},
    {"id": "liang-jiu-shi", "name": "梁九思", "type": "scientist", "dynasty": "清", "year": 1700,
     "weight": 0.55, "summary": "清代大木匠，传承模型法营造技艺。", "tags": ["大木", "模型"], "related": ["liang-jiu", "gugong-taihedian"]},
    {"id": "chen-ming-yuan", "name": "陈明远", "type": "scientist", "dynasty": "清", "year": 1780,
     "weight": 0.5, "summary": "徽派木作匠师，精于砖雕木雕装饰。", "tags": ["徽派", "装饰"], "related": ["huizhou-minju", "xidi"]},
    {"id": "lin-hejing", "name": "林鹤庭", "type": "scientist", "dynasty": "清", "year": 1850,
     "weight": 0.55, "summary": "闽南石桥营造世家传人，善造跨海长桥。", "tags": ["闽南", "桥梁"], "related": ["anping-qiao", "luoyang-qiao"]},
    {"id": "huang-duo-si", "name": "黄道婆", "type": "scientist", "dynasty": "元", "year": 1300,
     "weight": 0.5, "summary": "推动棉纺技术传播，间接影响民居纺织与居住空间。", "tags": ["工艺", "民居"], "related": ["zhouzhuang-minju"]},
    {"id": "li-chun-fu", "name": "李淳风", "type": "scientist", "dynasty": "唐", "year": 650,
     "weight": 0.55, "summary": "唐代天文学家，参与长安城规制与礼制建筑布局。", "tags": ["唐", "礼制"], "related": ["daming-gong", "yan-lide"]},
    {"id": "yang-xiu-ren", "name": "杨秀仁", "type": "scientist", "dynasty": "清", "year": 1820,
     "weight": 0.5, "summary": "晋商大院营造主持匠师，善砖雕牌楼。", "tags": ["晋商", "民居"], "related": ["qiaojia-dayuan", "wangjia-dayuan"]},
    {"id": "liu-yu-chun", "name": "刘玉春", "type": "scientist", "dynasty": "明", "year": 1480,
     "weight": 0.5, "summary": "明代石桥匠师，善造联拱石桥。", "tags": ["桥梁", "石拱"], "related": ["baodaiqiao", "lugouqiao"]},
]

NEW_BOOKS = [
    {"id": "yingzao-suanli", "name": "营造算例", "type": "book", "dynasty": "清", "year": 1734,
     "weight": 0.7, "summary": "清代官式建筑算量用例，与工程做法则例配套。", "tags": ["官式", "算量"], "related": ["gongcheng-zuofa", "doukou"]},
    {"id": "gongbu-jungong", "name": "工部军器则例", "type": "book", "dynasty": "清", "year": 1815,
     "weight": 0.55, "summary": "清代工部刊行营造与军器用料则例。", "tags": ["官式", "则例"], "related": ["gongcheng-zuofa"]},
]

NEW_ACHIEVEMENTS = [
    {"id": "yanwei-sun", "name": "燕尾榫", "type": "achievement", "dynasty": "历代", "year": 500,
     "weight": 0.55, "summary": "榫头形如燕尾的牢固榫卯接合方式。", "tags": ["榫卯", "木构"], "related": ["sunmao", "tailiang"]},
    {"id": "mingzi-sun", "name": "明榫", "type": "achievement", "dynasty": "历代", "year": 600,
     "weight": 0.45, "summary": "榫头外露的榫卯形式，便于检修拆装。", "tags": ["榫卯", "木构"], "related": ["sunmao", "yanwei-sun"]},
    {"id": "anzi-sun", "name": "暗榫", "type": "achievement", "dynasty": "历代", "year": 600,
     "weight": 0.45, "summary": "榫头不外露的隐蔽接合，表面平整美观。", "tags": ["榫卯", "木构"], "related": ["sunmao", "mingzi-sun"]},
    {"id": "hexi-caihua", "name": "和玺彩画", "type": "achievement", "dynasty": "清", "year": 1734,
     "weight": 0.6, "summary": "清代宫殿最高等级彩画，龙凤图案金线勾勒。", "tags": ["彩画", "等级"], "related": ["caihua", "beijing-gugong", "gugong-taihedian"]},
    {"id": "xuanzi-caihua", "name": "旋子彩画", "type": "achievement", "dynasty": "清", "year": 1734,
     "weight": 0.55, "summary": "清式官式建筑常用彩画，以旋花图案为特色。", "tags": ["彩画", "官式"], "related": ["caihua", "gongcheng-zuofa"]},
    {"id": "sushi-caihua", "name": "苏式彩画", "type": "achievement", "dynasty": "清", "year": 1700,
     "weight": 0.55, "summary": "江南园林建筑彩画，设色淡雅、题材灵活。", "tags": ["彩画", "江南"], "related": ["caihua", "suzhou-zhuozhengyuan"]},
    {"id": "puzuo", "name": "铺作", "type": "achievement", "dynasty": "宋", "year": 1103,
     "weight": 0.6, "summary": "宋代斗拱层级的统称，规定出跳与等级。", "tags": ["斗拱", "宋式"], "related": ["dougong", "ying-zao-fa-shi"]},
    {"id": "yueliang", "name": "月梁", "type": "achievement", "dynasty": "历代", "year": 900,
     "weight": 0.5, "summary": "梁身中部上拱如月的曲线梁，多见于南方。", "tags": ["木构", "造型"], "related": ["chuandou", "suzhou-zhuozhengyuan"]},
]

PARENT_CHILD = {
    "gugong-taihedian": "beijing-gugong",
    "gugong-yuhuayuan": "beijing-gugong",
}


def slug_ids(data: dict) -> dict[str, dict]:
    return {s["id"]: s for s in data["stars"]}


def merge_related(star: dict, extra: list[str], ids: set[str]) -> None:
    cur = list(star.get("related") or [])
    seen = set(cur)
    for r in extra:
        if r in ids and r not in seen and r != star["id"]:
            cur.append(r)
            seen.add(r)
    star["related"] = cur


def auto_enrich(stars: list[dict]) -> None:
    ids = {s["id"] for s in stars}
    by_id = {s["id"]: s for s in stars}
    tag_map: dict[str, list[str]] = {}
    for s in stars:
        for t in s.get("tags") or []:
            tag_map.setdefault(t, []).append(s["id"])

    type_links = {
        "scientist": ["book", "building", "achievement", "scientist"],
        "book": ["scientist", "building", "achievement"],
        "building": ["scientist", "achievement", "building"],
        "achievement": ["building", "book", "scientist", "achievement"],
    }

    for s in stars:
        extra: list[str] = []
        if s.get("parent") and s["parent"] in ids:
            extra.append(s["parent"])
        for w in s.get("works") or []:
            if w in ids:
                extra.append(w)
        for a in s.get("architects") or []:
            if a in ids:
                extra.append(a)
        merge_related(s, extra, ids)

    for child_id, parent_id in PARENT_CHILD.items():
        if child_id in by_id and parent_id in ids:
            merge_related(by_id[child_id], [parent_id], ids)
            merge_related(by_id[parent_id], [child_id], ids)

    for s in stars:
        tags = set(s.get("tags") or [])
        if not tags:
            continue
        candidates = []
        for t in tags:
            for oid in tag_map.get(t, []):
                if oid == s["id"]:
                    continue
                other = by_id[oid]
                if other["type"] in type_links.get(s["type"], []):
                    candidates.append(oid)
        if len(s.get("related") or []) < 5:
            merge_related(s, candidates[:8], ids)

    for s in stars:
        if s["type"] == "scientist" and len(s.get("related") or []) < 4:
            stags = set(s.get("tags") or [])
            for bid in ids:
                b = by_id[bid]
                if b["type"] != "building":
                    continue
                if stags & set(b.get("tags") or []):
                    merge_related(s, [bid], ids)
                    if len(s["related"]) >= 5:
                        break


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    by_id = slug_ids(data)
    ids = set(by_id)

    for sid, related in HUB_RELATED.items():
        if sid in by_id:
            by_id[sid]["related"] = list(dict.fromkeys(related))

    for item in NEW_SCIENTISTS + NEW_BOOKS + NEW_ACHIEVEMENTS + all_bulk_stars():
        if item["id"] not in by_id:
            data["stars"].append(item)
            by_id[item["id"]] = item
            ids.add(item["id"])

    for child, parent in PARENT_CHILD.items():
        if child in by_id:
            by_id[child]["parent"] = parent
            by_id[child].setdefault("works", [])
            if parent in by_id:
                p = by_id[parent]
                p.setdefault("works", [])
                if child not in p["works"]:
                    p["works"].append(child)

    auto_enrich(data["stars"])

    for sid, related in HUB_RELATED.items():
        if sid in by_id:
            merge_related(by_id[sid], related, ids)

    data["meta"]["version"] = "0.2-expanded"
    data["meta"]["note"] = "枢纽子图策展 + 自动织边；由 patch_and_expand_starcloud.py 维护"
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ 写入 {DATA}，共 {len(data['stars'])} 颗星辰")


if __name__ == "__main__":
    main()
