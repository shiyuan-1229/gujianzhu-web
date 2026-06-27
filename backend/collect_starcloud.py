"""
古建星云 · 数据采集脚本
========================
用 Firecrawl 抓取 starcloud_sources.json 里每条目标网页的正文，
（可选）再用 DeepSeek 把正文抽取成统一字段，输出 data/star-cloud.raw.json。

  ⚠ 输出是「初稿」。竞赛准确性靠人工校对：
     - 核对年代 ≤ 1911（year 字段）
     - 剔除庙宇 / 宝塔
     - 对象限定 民居 / 官府 / 皇宫 / 桥梁（building 的 category）
     校对后把合格条目并入 data/star-cloud.json 即可被前端星系加载。

用法：
    cd backend
    pip install -r requirements.txt
    python collect_starcloud.py                # 抓取全部
    python collect_starcloud.py --limit 5      # 只抓前 5 条（测试）
    python collect_starcloud.py --no-llm       # 不调用 DeepSeek，仅存正文摘要
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time

import requests

import config

FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/scrape"
TYPE_DEFAULT_WEIGHT = {"scientist": 0.7, "book": 0.7, "achievement": 0.55, "building": 0.65}


def firecrawl_scrape(url: str) -> str:
    """抓取单个 URL，返回 markdown 正文。"""
    headers = {"Authorization": f"Bearer {config.FIRECRAWL_API_KEY}", "Content-Type": "application/json"}
    payload = {"url": url, "formats": ["markdown"], "onlyMainContent": True}
    resp = requests.post(FIRECRAWL_ENDPOINT, json=payload, headers=headers, timeout=90)
    resp.raise_for_status()
    data = resp.json()
    return (data.get("data") or {}).get("markdown", "") or ""


def deepseek_extract(name: str, type_: str, text: str) -> dict | None:
    """用 DeepSeek 从正文抽取结构化字段；无 key 时返回 None。"""
    if not config.DEEPSEEK_API_KEY:
        return None
    text = text[:4000]
    prompt = (
        f"下面是关于中国古代建筑「{name}」（类别：{type_}）的资料。"
        "请抽取为 JSON，字段：dynasty(朝代,如'北宋')、year(代表年份的整数,公元前用负数,须≤1911)、"
        "summary(一句不超过40字的中文简介)、tags(3-4个中文关键词数组)。"
        "只输出 JSON，不要解释。\n\n资料：\n" + text
    )
    try:
        resp = requests.post(
            f"{config.DEEPSEEK_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {config.DEEPSEEK_API_KEY}", "Content-Type": "application/json"},
            json={"model": config.DEEPSEEK_MODEL, "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.2, "stream": False},
            timeout=90,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        m = re.search(r"\{.*\}", content, re.S)
        return json.loads(m.group(0)) if m else None
    except Exception as e:  # noqa: BLE001
        print(f"    ! DeepSeek 抽取失败：{e}")
        return None


def fallback_summary(text: str) -> str:
    """无 LLM 时的兜底：取正文首句作为摘要草稿。"""
    clean = re.sub(r"[\[\]\(\)#>*`!|\-]+", " ", text)
    clean = re.sub(r"https?://\S+", "", clean)
    clean = re.sub(r"\s+", "", clean)
    sentence = re.split(r"[。！？]", clean)
    return (sentence[0][:60] + "…") if sentence and sentence[0] else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="只处理前 N 条")
    ap.add_argument("--no-llm", action="store_true", help="不调用 DeepSeek")
    args = ap.parse_args()

    if not config.FIRECRAWL_API_KEY:
        print("✗ 未配置 FIRECRAWL_API_KEY（backend/.env）。")
        return 1

    sources = json.loads(config.STARCLOUD_SOURCES.read_text(encoding="utf-8"))["sources"]
    if args.limit:
        sources = sources[: args.limit]

    out = []
    for i, src in enumerate(sources, 1):
        name, type_ = src["name"], src["type"]
        print(f"[{i}/{len(sources)}] 抓取 {name} … {src['url']}")
        try:
            md = firecrawl_scrape(src["url"])
        except Exception as e:  # noqa: BLE001
            print(f"    ✗ 抓取失败：{e}")
            continue
        if not md.strip():
            print("    ! 正文为空，跳过")
            continue

        star = {
            "id": src["id"], "name": name, "type": type_,
            "dynasty": "", "year": None,
            "weight": TYPE_DEFAULT_WEIGHT.get(type_, 0.6),
            "summary": "", "tags": [], "related": [],
            "_source_url": src["url"], "_needs_review": True,
        }
        if src.get("category"):
            star["category"] = src["category"]
        if type_ == "building":
            star["building"] = name

        extracted = None if args.no_llm else deepseek_extract(name, type_, md)
        if extracted:
            star["dynasty"] = extracted.get("dynasty", "")
            star["year"] = extracted.get("year")
            star["summary"] = extracted.get("summary", "")
            star["tags"] = extracted.get("tags", []) or []
        else:
            star["summary"] = fallback_summary(md)

        out.append(star)
        time.sleep(1.2)  # 友好限速

    config.STARCLOUD_RAW.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {"generated_by": "collect_starcloud.py", "count": len(out),
                 "warning": "初稿，需人工校对年代≤1911、剔除庙宇宝塔后再并入 star-cloud.json"},
        "stars": out,
    }
    config.STARCLOUD_RAW.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ 已写入 {config.STARCLOUD_RAW}（{len(out)} 条）")
    print("  下一步：人工校对 -> 把合格条目并入 data/star-cloud.json 的 stars 数组。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
