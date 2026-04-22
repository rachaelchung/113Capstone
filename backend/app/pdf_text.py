from __future__ import annotations

import io
from typing import Final

from pypdf import PageObject
from pypdf import PdfReader

_MAX_PAGES: Final = 80


def _pick_best_plain_layout(plain: str, layout: str) -> str:
    """Prefer the richer of plain vs layout (generators differ; layout often wins on tables)."""
    p, l_ = plain.strip(), layout.strip()
    if not p:
        return l_
    if not l_:
        return p
    return l_ if len(l_) >= len(p) else p


def _best_text_for_page(page: PageObject) -> str:
    plain = page.extract_text(extraction_mode="plain") or ""
    layout = page.extract_text(extraction_mode="layout") or ""
    return _pick_best_plain_layout(plain, layout)


def extract_text_from_pdf(data: bytes) -> str:
    """Pull plain text from a PDF byte string (text-based PDFs; image-only pages yield nothing)."""
    reader = PdfReader(io.BytesIO(data), strict=False)
    parts: list[str] = []
    for i, page in enumerate(reader.pages):
        if i >= _MAX_PAGES:
            break
        raw = _best_text_for_page(page)
        if raw:
            parts.append(raw)
    return "\n\n".join(parts).strip()


def extract_text_from_pdf_page_stats(data: bytes) -> tuple[str, list[tuple[int, int, int, int]]]:
    """Returns (full_text, [(page_no, plain_len, layout_len, chosen_len), ...]) for debugging."""
    reader = PdfReader(io.BytesIO(data), strict=False)
    parts: list[str] = []
    stats: list[tuple[int, int, int, int]] = []
    for i, page in enumerate(reader.pages):
        if i >= _MAX_PAGES:
            break
        plain = (page.extract_text(extraction_mode="plain") or "").strip()
        layout = (page.extract_text(extraction_mode="layout") or "").strip()
        chosen = _pick_best_plain_layout(plain, layout)
        stats.append((i + 1, len(plain), len(layout), len(chosen)))
        if chosen:
            parts.append(chosen)
    return "\n\n".join(parts).strip(), stats
