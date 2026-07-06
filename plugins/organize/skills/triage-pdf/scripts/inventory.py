#!/usr/bin/env python3
"""Mechanical inventory pass for triage-pdf (steps 0–2 of SKILL.md).

For every *.pdf in <source-folder>, emit a JSON record with:
  path, size, pages, words, md5, text_layer_kind, first_page, last_page

text_layer_kind classification ported from
~/CRAP/suntrust-indexer/stage5_pdf_kind.py (Native | OCR | OCR-likely | Sparse | Scan).

first_page/last_page hold whitespace-collapsed text snippets (default 1200 chars
each). last_page is included so a reversed scan reveals its real letter front.

Usage:
  inventory.py <source-folder>                  # JSON to stdout
  inventory.py <source-folder> --pretty         # pretty-printed
  inventory.py <source-folder> --snippet 2000   # longer page snippets

Exit non-zero only on usage error. Per-file failures are recorded in the JSON
record's "error" field; the run continues.

Dependencies: poppler (pdfinfo, pdffonts, pdftotext) — already present on host.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


# ── text-layer kind (lifted from suntrust-indexer/stage5_pdf_kind.py) ────────

OCR_FONT_RE = re.compile(r"GlyphLessFont|OCRBOPT|OCR-A|OCR-B|Tesseract", re.I)
EMBED_RE = re.compile(r"\byes\b\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+")


def font_info(path: Path) -> dict:
    info = {"fonts_total": 0, "fonts_embedded": 0, "fonts_type3": 0, "ocr_signature": False}
    try:
        r = subprocess.run(
            ["pdffonts", str(path)], capture_output=True, text=True, timeout=15
        )
    except Exception as e:
        info["err"] = f"pdffonts: {e!s:.60}"
        return info
    for line in r.stdout.splitlines()[2:]:
        line = line.strip()
        if not line:
            continue
        info["fonts_total"] += 1
        if "Type 3" in line:
            info["fonts_type3"] += 1
        if EMBED_RE.search(line):
            info["fonts_embedded"] += 1
        if OCR_FONT_RE.search(line):
            info["ocr_signature"] = True
    return info


def classify_kind(info: dict, words: int, pages: int) -> str:
    if not pages:
        return "?"
    sample_pages = max(1, min(pages, 2))
    density = words / sample_pages
    fonts = info.get("fonts_total", 0)
    if fonts == 0 or words < 5:
        return "Scan"
    if info.get("ocr_signature") or info.get("fonts_type3", 0) > 0:
        return "OCR"
    if info.get("fonts_embedded", 0) == 0 and density < 80:
        return "OCR-likely"
    if density >= 150:
        return "Native"
    if density >= 30:
        return "Sparse"
    return "OCR-likely"


# ── per-file inspection ─────────────────────────────────────────────────────


def md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pdfinfo_pages(path: Path) -> int:
    try:
        r = subprocess.run(
            ["pdfinfo", str(path)], capture_output=True, text=True, timeout=15
        )
    except Exception:
        return 0
    for line in r.stdout.splitlines():
        if line.startswith("Pages:"):
            try:
                return int(line.split(":", 1)[1].strip())
            except ValueError:
                return 0
    return 0


def page_text(path: Path, first: int, last: int, max_chars: int) -> str:
    try:
        r = subprocess.run(
            ["pdftotext", "-f", str(first), "-l", str(last), str(path), "-"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception as e:
        return f"<<extract failed: {e!s:.60}>>"
    return re.sub(r"\s+", " ", r.stdout).strip()[:max_chars]


def all_text_word_count(path: Path) -> int:
    try:
        r = subprocess.run(
            ["pdftotext", str(path), "-"], capture_output=True, text=True, timeout=60
        )
    except Exception:
        return 0
    return len(r.stdout.split())


def inspect(path: Path, snippet_chars: int) -> dict:
    rec: dict = {"path": str(path), "name": path.name}
    try:
        rec["size"] = path.stat().st_size
    except Exception as e:
        rec["error"] = f"stat: {e!s:.60}"
        return rec
    pages = pdfinfo_pages(path)
    rec["pages"] = pages
    rec["words"] = all_text_word_count(path)
    rec["md5"] = md5(path)
    rec["fonts"] = font_info(path)
    rec["text_layer_kind"] = classify_kind(rec["fonts"], rec["words"], pages)
    rec["first_page"] = page_text(path, 1, 1, snippet_chars) if pages >= 1 else ""
    rec["last_page"] = page_text(path, pages, pages, snippet_chars) if pages > 1 else ""
    return rec


# ── cli ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    ap.add_argument("source", help="Folder containing PDFs to inventory")
    ap.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    ap.add_argument("--snippet", type=int, default=1200, help="Chars per page snippet")
    args = ap.parse_args()

    src = Path(args.source).expanduser()
    if not src.is_dir():
        print(f"not a directory: {src}", file=sys.stderr)
        return 2

    pdfs = sorted(p for p in src.iterdir() if p.is_file() and p.suffix.lower() == ".pdf")
    records = [inspect(p, args.snippet) for p in pdfs]

    out = {"source": str(src), "count": len(records), "files": records}
    json.dump(out, sys.stdout, indent=2 if args.pretty else None, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
