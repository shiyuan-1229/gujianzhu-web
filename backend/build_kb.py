from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable
import pdfplumber
from docx import Document

from config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    DOCS_DIR,
    INDEX_FILE,
)


BUILDING_CATEGORY_MAP = {
    "北京故宫": "皇宫",
    "颐和园": "皇宫",
    "北京四合院": "民居",
    "乔家大院": "民居",
    "阆中古城": "民居",
    "卢沟桥": "桥梁",
    "宝带桥": "桥梁",
    "鱼沼飞梁": "桥梁",
    "泸定桥": "桥梁",
    "泸州龙脑桥": "桥梁",
    "淮安府衙": "官府",
    "霍州署": "官府",
    "平遥古城墙": "城墙",
}


def normalize_text(text: str) -> str:
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join([line for line in lines if line])


def read_pdf(path: Path) -> str:
    parts: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            parts.append(page.extract_text() or "")
    return normalize_text("\n".join(parts))


def read_docx(path: Path) -> str:
    doc = Document(path)
    parts = [p.text for p in doc.paragraphs]
    return normalize_text("\n".join(parts))


def split_text(text: str, size: int, overlap: int) -> list[str]:
    if not text:
        return []
    text = text.strip()
    if len(text) <= size:
        return [text]
    chunks: list[str] = []
    step = max(1, size - overlap)
    i = 0
    while i < len(text):
        chunk = text[i : i + size].strip()
        if chunk:
            chunks.append(chunk)
        i += step
    return chunks


def infer_metadata(path: Path) -> dict[str, str]:
    rel = path.relative_to(DOCS_DIR)
    province = rel.parts[0] if len(rel.parts) > 0 else "未知"
    building = rel.parts[1] if len(rel.parts) > 1 else "未知"
    category = BUILDING_CATEGORY_MAP.get(building, "未分类")
    return {
        "province": province,
        "building": building,
        "category": category,
        "source": path.name,
        "relative_path": str(rel),
    }


def iter_docs(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.suffix.lower() in {".pdf", ".docx"} and path.is_file():
            yield path


def build_collection(reset: bool) -> None:
    if not DOCS_DIR.exists():
        raise FileNotFoundError(f"文献目录不存在: {DOCS_DIR}")

    if reset and INDEX_FILE.exists():
        INDEX_FILE.unlink()

    all_docs = list(iter_docs(DOCS_DIR))
    if not all_docs:
        print("未找到文献文件。")
        return

    print(f"共发现文献 {len(all_docs)} 份，开始构建向量库...")
    records: list[dict] = []
    global_index = 0
    for doc_path in all_docs:
        suffix = doc_path.suffix.lower()
        text = read_pdf(doc_path) if suffix == ".pdf" else read_docx(doc_path)
        chunks = split_text(text, CHUNK_SIZE, CHUNK_OVERLAP)
        if not chunks:
            continue

        meta_base = infer_metadata(doc_path)
        for local_idx, chunk in enumerate(chunks):
            chunk_id = "chunk-" + str(global_index)
            global_index += 1
            meta = dict(meta_base)
            meta["chunk_index"] = str(local_idx)
            records.append({"id": chunk_id, "content": chunk, "meta": meta})
        print(f"已入库: {doc_path.name} (chunks={len(chunks)})")

    INDEX_FILE.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print("知识库构建完成。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build local ChromaDB knowledge base.")
    parser.add_argument("--reset", action="store_true", help="Delete old collection before building.")
    args = parser.parse_args()
    build_collection(reset=args.reset)
