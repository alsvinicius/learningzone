#!/usr/bin/env python3
"""Serve the static Skill Builder on the loopback interface for Project Gallery."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("WEB_PORT", "8000"))
PRIVATE_INDEX_PATH = os.environ.get("PRIVATE_INDEX_PATH")

PRIVATE_INDEX = None
if PRIVATE_INDEX_PATH:
    candidate = Path(PRIVATE_INDEX_PATH)
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    PRIVATE_INDEX = candidate.resolve()
    if ROOT not in PRIVATE_INDEX.parents or not PRIVATE_INDEX.is_file():
        raise SystemExit("PRIVATE_INDEX_PATH must name an existing file inside the project.")


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        # Requests may contain paths into user-owned study material.
        pass

    def translate_path(self, path):
        relative = unquote(urlsplit(path).path).lstrip("/")
        requested = Path(relative)
        if PRIVATE_INDEX is not None and requested.as_posix() == "data/index.json":
            candidate = PRIVATE_INDEX
        else:
            candidate = (ROOT / relative).resolve()
        if ROOT not in candidate.parents and candidate != ROOT:
            return str(ROOT / ".gallery-forbidden")
        if any(part.startswith(".") for part in requested.parts):
            return str(ROOT / ".gallery-forbidden")
        return str(candidate)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
