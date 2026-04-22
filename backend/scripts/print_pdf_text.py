#!/usr/bin/env python3
"""Print text extracted from a PDF (same layer as /api/parse-syllabus)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Run from repo `backend/` with: PYTHONPATH=. python scripts/print_pdf_text.py "path/to.pdf"
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.pdf_text import extract_text_from_pdf  # noqa: E402
from app.pdf_text import extract_text_from_pdf_page_stats  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description="Extract plain text from a PDF using pypdf.")
    p.add_argument("pdf", type=str, help="Path to .pdf (use quotes if the path has spaces)")
    p.add_argument("--limit", type=int, default=4000, help="Max characters to print (default 4000)")
    p.add_argument(
        "--stats",
        action="store_true",
        help="Print per-page character counts (plain vs layout vs chosen) to stderr",
    )
    args = p.parse_args()
    path = Path(args.pdf.strip()).expanduser().resolve()
    if not path.is_file():
        print(f"not a file: {path}", file=sys.stderr)
        sys.exit(1)
    raw = path.read_bytes()
    if args.stats:
        text, rows = extract_text_from_pdf_page_stats(raw)
        print("page | plain_chars | layout_chars | chosen_chars", file=sys.stderr)
        for pg, pl, ll, cl in rows:
            print(f" {pg:3} | {pl:11} | {ll:12} | {cl:12}", file=sys.stderr)
        print(f"total chosen chars: {len(text)}", file=sys.stderr)
    else:
        text = extract_text_from_pdf(raw)
    out = text if args.limit <= 0 else text[: args.limit]
    print(out)
    if args.limit > 0 and len(text) > args.limit:
        print(f"\n… truncated ({len(text)} chars total)", file=sys.stderr)


if __name__ == "__main__":
    main()
