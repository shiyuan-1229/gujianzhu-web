from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
DOCS_DIR = PROJECT_DIR / "古建筑文献资料"
CHROMA_DIR = BASE_DIR / "chroma_db"
COLLECTION_NAME = "ancient_architecture_kb"
INDEX_FILE = BASE_DIR / "kb_index.json"
POEMS_DIR = BASE_DIR / "data"
POEMS_FILE = POEMS_DIR / "architecture_poems.json"
BUILDING_POEMS_INDEX = POEMS_DIR / "building_poems_index.json"
PROJECT_POETRY_MAP = POEMS_DIR / "project_poetry_map.json"
EXTENDED_POETRY_MAP = POEMS_DIR / "extended_poetry_map.json"

load_dotenv(BASE_DIR / ".env")

# Firecrawl + 星际探索星云数据
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
STARCLOUD_SOURCES = BASE_DIR / "starcloud_sources.json"
STARCLOUD_RAW = PROJECT_DIR / "data" / "star-cloud.raw.json"

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

EMBED_MODEL_NAME = os.getenv(
    "EMBED_MODEL_NAME", "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
)
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "5"))
