from __future__ import annotations

import json
import math
import re
from typing import Dict, Generator, List, Optional

import requests

from config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    INDEX_FILE,
    RETRIEVAL_TOP_K,
)


def _load_records() -> List[Dict]:
    if not INDEX_FILE.exists():
        return []
    try:
        return json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def _lang_label(lang: str) -> str:
    return "English" if str(lang).lower().startswith("en") else "中文"


ALIAS_TO_BUILDING = {
    "故宫": "北京故宫",
    "紫禁城": "北京故宫",
    "太和殿": "北京故宫",
    "四合院": "北京四合院",
    "乔家": "乔家大院",
    "拙政园": "苏州拙政园",
    "广济桥": "潮州广济桥",
}


def _tokens(text: str) -> set:
    text = (text or "").lower()
    tokens = set()
    # English / numeric tokens
    tokens.update(re.findall(r"[a-z0-9]+", text))
    # Chinese bigram tokens for better recall
    for seg in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(seg) == 1:
            tokens.add(seg)
            continue
        for i in range(len(seg) - 1):
            tokens.add(seg[i : i + 2])
    return tokens


def _expand_query(query: str) -> str:
    expanded = [query]
    for alias, building in ALIAS_TO_BUILDING.items():
        if alias in query:
            expanded.append(building)
    return " ".join(expanded)


def _contains_chinese_phrase(text: str, query: str) -> bool:
    for seg in re.findall(r"[\u4e00-\u9fff]{2,}", query):
        if seg and seg in text:
            return True
    return False


def _bm25(q_tokens: set, d_tokens: List[str], df: Dict[str, int], avgdl: float, n_docs: int) -> float:
    if not q_tokens or not d_tokens:
        return 0.0
    k1 = 1.5
    b = 0.75
    tf = {}
    for t in d_tokens:
        tf[t] = tf.get(t, 0) + 1
    dl = max(1, len(d_tokens))
    score = 0.0
    for q in q_tokens:
        if q not in tf:
            continue
        nqi = df.get(q, 0)
        idf = math.log((n_docs - nqi + 0.5) / (nqi + 0.5) + 1.0)
        f = tf[q]
        denom = f + k1 * (1 - b + b * dl / max(1.0, avgdl))
        score += idf * ((f * (k1 + 1)) / denom)
    return score


def retrieve(query: str, top_k: int = RETRIEVAL_TOP_K) -> List[Dict]:
    expanded_query = _expand_query(query)
    q_tokens = _tokens(expanded_query)
    records = _load_records()

    if not records:
        return []

    tokenized_docs = []
    df = {}
    total_len = 0
    for item in records:
        content = item.get("content", "")[:1500]
        d_tokens_list = list(_tokens(content))
        tokenized_docs.append(d_tokens_list)
        total_len += max(1, len(d_tokens_list))
        for t in set(d_tokens_list):
            df[t] = df.get(t, 0) + 1
    n_docs = len(records)
    avgdl = total_len / float(max(1, n_docs))

    target_buildings = set()
    for alias, building in ALIAS_TO_BUILDING.items():
        if alias in query:
            target_buildings.add(building)
    for item in records:
        b = (item.get("meta", {}) or {}).get("building", "")
        if b and b in query:
            target_buildings.add(b)

    scored = []
    for idx, item in enumerate(records):
        content = item.get("content", "")
        meta = item.get("meta", {}) or {}
        d_tokens = tokenized_docs[idx]
        score = _bm25(q_tokens, d_tokens, df, avgdl, n_docs)

        source = meta.get("source", "")
        building = meta.get("building", "")
        province = meta.get("province", "")
        category = meta.get("category", "")
        meta_text = " ".join([source, building, province, category])

        if _contains_chinese_phrase(content[:1200], query):
            score += 1.2
        if _contains_chinese_phrase(meta_text, query):
            score += 1.4
        if target_buildings and building in target_buildings:
            score += 3.0
        if building and building in query:
            score += 2.0
        if province and province in query:
            score += 1.0
        if category and category in query:
            score += 0.8

        scored.append((score, item))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_items = []
    seen_sources = set()
    for score, item in scored:
        source_key = (item.get("meta", {}) or {}).get("source", "") + "::" + (item.get("meta", {}) or {}).get(
            "chunk_index", ""
        )
        if source_key in seen_sources:
            continue
        seen_sources.add(source_key)
        top_items.append((score, item))
        if len(top_items) >= top_k:
            break

    refs: List[Dict] = []
    for idx, (score, item) in enumerate(top_items, start=1):
        meta = item.get("meta", {})
        refs.append(
            {
                "index": idx,
                "content": item.get("content", ""),
                "score": round(score, 4),
                "source": meta.get("source", ""),
                "province": meta.get("province", ""),
                "building": meta.get("building", ""),
                "category": meta.get("category", ""),
                "relative_path": meta.get("relative_path", ""),
            }
        )
    return refs


def build_prompt(query: str, refs: List[Dict], lang: str) -> List[Dict]:
    ref_lines = []
    for item in refs:
        ref_lines.append(
            f"[{item['index']}] {item['content']}\n来源：{item['source']} | 建筑：{item['building']} | 地区：{item['province']}"
        )
    ref_text = "\n\n".join(ref_lines) if ref_lines else "无可用参考资料。"
    target_lang = _lang_label(lang)
    system = (
        f"你是古建智寻平台的AI导览员。请使用{target_lang}回答。"
        "优先依据提供的参考文献作答，表达准确、学术、详细。"
        "请提供深入的学术分析，包括相关历史背景、建筑特点和文化内涵。"
        "回答长度应适中，至少包含3-5个完整句子，确保信息丰富且有深度。"
        "若回答使用了文献信息，请在句末标注引用编号，如[1][2]。"
        "若资料不足，请明确说明‘知识库中暂无足够证据’。"
    )
    user = f"用户问题：{query}\n\n参考资料：\n{ref_text}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _stringify_page_context(page_context: Optional[Dict]) -> str:
    if not page_context:
        return ""
    parts = []
    field_order = [
        ("page_title", "页面标题"),
        ("building_name", "建筑名称"),
        ("section_titles", "关键小节"),
        ("highlights", "页面内容摘要"),
        ("hotspots", "页面热点要点"),
        ("path", "页面路径"),
    ]
    for key, label in field_order:
        value = str((page_context or {}).get(key, "") or "").strip()
        if value:
            parts.append(f"{label}: {value}")
    return "\n".join(parts)


def build_page_narration_prompt(query: str, refs: List[Dict], lang: str, page_context: Optional[Dict]) -> List[Dict]:
    ref_lines = []
    for item in refs:
        ref_lines.append(f"- {item['building']} | {item['source']}\n{item['content'][:240]}")
    ref_text = "\n\n".join(ref_lines) if ref_lines else "暂无可用参考资料。"
    page_text = _stringify_page_context(page_context) or "暂无可用页面信息。"
    target_lang = _lang_label(lang)
    system = (
        f"你是古建智寻平台的AI导览员。请使用{target_lang}输出一段适合朗读的口语化导览稿。"
        "请优先根据当前页面内容讲解，再结合参考文献补充必要的历史、建筑或文化信息。"
        "输出要像导览员在对游客讲解，自然、连贯、有节奏，控制在6到10句。"
        "不要使用 markdown、条目、编号或[1]这类引用标记，也不要写“好的”“下面我来”等客套开场。"
        "如果页面信息不够，就基于现有页面内容做稳妥延展，不要编造细节。"
    )
    user = (
        f"目标：{query}\n\n"
        f"当前页面信息：\n{page_text}\n\n"
        f"参考文献摘要：\n{ref_text}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _build_messages(
    query: str,
    refs: List[Dict],
    lang: str,
    mode: str = "chat",
    page_context: Optional[Dict] = None,
) -> List[Dict]:
    if mode == "page_narration":
        return build_page_narration_prompt(query=query, refs=refs, lang=lang, page_context=page_context)
    return build_prompt(query=query, refs=refs, lang=lang)


def stream_answer(
    query: str,
    lang: str,
    history: Optional[List[Dict]] = None,
    mode: str = "chat",
    page_context: Optional[Dict] = None,
) -> Generator[str, None, None]:
    retrieve_query = query
    if mode == "page_narration" and page_context:
        retrieve_query = " ".join(
            part
            for part in [
                query,
                str((page_context or {}).get("building_name", "") or "").strip(),
                str((page_context or {}).get("page_title", "") or "").strip(),
            ]
            if part
        )

    refs = retrieve(query=retrieve_query, top_k=RETRIEVAL_TOP_K)
    safe_refs = []
    for ref in refs:
        item = {k: v for k, v in ref.items() if k != "content"}
        item["content"] = ref.get("content", "")[:300]
        safe_refs.append(item)
    yield json.dumps({"type": "kb_sources", "data": safe_refs}, ensure_ascii=False)

    if not DEEPSEEK_API_KEY:
        yield json.dumps(
            {
                "type": "token",
                "data": "后端未配置 DEEPSEEK_API_KEY，当前只返回检索结果。请在 backend/.env 中配置后重试。",
            },
            ensure_ascii=False,
        )
        yield json.dumps({"type": "done"}, ensure_ascii=False)
        return

    messages = _build_messages(query=query, refs=refs, lang=lang, mode=mode, page_context=page_context)
    response = requests.post(
        DEEPSEEK_BASE_URL.rstrip("/") + "/chat/completions",
        headers={"Authorization": "Bearer " + DEEPSEEK_API_KEY, "Content-Type": "application/json"},
        json={"model": DEEPSEEK_MODEL, "messages": messages, "stream": True, "temperature": 0.4},
        stream=True,
        timeout=120,
    )
    response.raise_for_status()
    for raw_line in response.iter_lines(decode_unicode=True):
        line = (raw_line or "").strip()
        if not line.startswith("data: "):
            continue
        data = line[6:]
        if data == "[DONE]":
            break
        try:
            payload = json.loads(data)
            delta = payload.get("choices", [{}])[0].get("delta", {}).get("content", "")
        except Exception:
            delta = ""
        if delta:
            yield json.dumps({"type": "token", "data": delta}, ensure_ascii=False)
    yield json.dumps({"type": "done"}, ensure_ascii=False)
