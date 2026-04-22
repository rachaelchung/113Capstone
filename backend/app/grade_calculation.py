"""
Compute course grades from tracker-shaped dicts (see module docstring in git history).

`courses` / `assignments` mirror the browser tracker (`henn_tracker_v1`). This module
stays framework-free so it can be imported from Flask or tests.
"""

from __future__ import annotations

import re
from typing import Any


def _parse_points(value: Any) -> float | None:
    """Parse a points string/number; return None if empty or not a leading number."""
    if value is None:
        return None
    s = str(value).strip().replace(",", "")
    if not s:
        return None
    m = re.match(r"^[-+]?(?:\d+\.?\d*|\.\d+)", s)
    if not m:
        return None
    try:
        n = float(m.group(0))
    except ValueError:
        return None
    if not n == n:  # NaN
        return None
    return n


def _find_course(courses: list[dict[str, Any]], course_id: str) -> dict[str, Any] | None:
    for c in courses:
        if not isinstance(c, dict):
            continue
        if str(c.get("id", "")) == course_id:
            return c
    return None


def _assignments_for_course(
    assignments: list[dict[str, Any]], course_id: str
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for a in assignments:
        if not isinstance(a, dict):
            continue
        if str(a.get("courseId", "")) == course_id:
            out.append(a)
    return out


def _category_weight(cat: dict[str, Any]) -> float:
    try:
        w = float(cat.get("weightPercent", 0))
    except (TypeError, ValueError):
        return 0.0
    if w != w or w < 0:  # NaN or negative
        return 0.0
    return w


def compute_course_grade(
    *,
    course_id: str,
    courses: list[dict[str, Any]],
    assignments: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Return a JSON-friendly dict:

    - ``percent`` (float | None): overall percent (0–100 scale) when computable.
    - ``detail``: breakdown, flags, and optional human-oriented ``message``.

    **Weighted mode** (course has at least one grade category with weight > 0):
    For each category, pool ``earnedPoints`` / ``pointsValue`` across assignments
    tagged with that ``categoryId``. Category average is ``sum(earned)/sum(max)*100``
    when ``sum(max) > 0`` and at least one earned value was parsed.

    The overall percent is the sum of ``(category_average * weight / 100)`` over
    categories with positive weight **only when every such category has a
    computable average**. Otherwise ``percent`` is ``None`` (see ``detail.message``).

    **Simple mode** (no positive-weight categories): one ratio over all course
    assignments that have parseable max and earned points (category ignored).
    """
    course = _find_course(courses, course_id)
    if course is None:
        return {
            "courseId": course_id,
            "percent": None,
            "detail": {
                "courseFound": False,
                "mode": None,
                "message": "course not found",
            },
        }

    raw_cats = course.get("gradeCategories") or []
    categories: list[dict[str, Any]] = [c for c in raw_cats if isinstance(c, dict)]
    cat_ids = {str(c.get("id", "")) for c in categories if c.get("id") is not None}

    rows = _assignments_for_course(assignments, course_id)

    # Per-category sums
    earned_by_cat: dict[str, float] = {str(c.get("id", "")): 0.0 for c in categories}
    max_by_cat: dict[str, float] = {k: 0.0 for k in earned_by_cat}
    graded_count_by_cat: dict[str, int] = {k: 0 for k in earned_by_cat}
    total_count_by_cat: dict[str, int] = {k: 0 for k in earned_by_cat}

    unc_earned = 0.0
    unc_max = 0.0
    unc_graded = 0
    unc_total = 0

    for a in rows:
        cid = str(a.get("categoryId", "") or "")
        mx = _parse_points(a.get("pointsValue"))
        er = _parse_points(a.get("earnedPoints"))

        if cid and cid in cat_ids:
            total_count_by_cat[cid] = total_count_by_cat.get(cid, 0) + 1
            if mx is not None and mx > 0 and er is not None:
                max_by_cat[cid] = max_by_cat.get(cid, 0.0) + mx
                earned_by_cat[cid] = earned_by_cat.get(cid, 0.0) + er
                graded_count_by_cat[cid] = graded_count_by_cat.get(cid, 0) + 1
        else:
            unc_total += 1
            if mx is not None and mx > 0 and er is not None:
                unc_max += mx
                unc_earned += er
                unc_graded += 1

    weighted_cats = [c for c in categories if _category_weight(c) > 0]
    weights_sum = sum(_category_weight(c) for c in weighted_cats)

    cat_details: list[dict[str, Any]] = []
    for c in categories:
        cid = str(c.get("id", ""))
        w = _category_weight(c)
        em = max_by_cat.get(cid, 0.0)
        ee = earned_by_cat.get(cid, 0.0)
        gc = graded_count_by_cat.get(cid, 0)
        tc = total_count_by_cat.get(cid, 0)
        avg: float | None
        if em > 0:
            avg = (ee / em) * 100.0
        else:
            avg = None
        cat_details.append(
            {
                "id": cid,
                "name": str(c.get("name", "")).strip(),
                "weightPercent": w,
                "earnedSum": ee,
                "maxSum": em,
                "averagePercent": avg,
                "gradedAssignmentCount": gc,
                "totalAssignmentCount": tc,
            }
        )

    base_detail: dict[str, Any] = {
        "courseFound": True,
        "courseName": str(course.get("name", "")).strip(),
        "weightsSum": round(weights_sum, 6),
        "categories": cat_details,
        "uncategorized": {
            "earnedSum": unc_earned,
            "maxSum": unc_max,
            "gradedAssignmentCount": unc_graded,
            "totalAssignmentCount": unc_total,
        },
    }

    if not weighted_cats:
        # Simple pooled ratio across assignments with both points
        if unc_max <= 0:
            return {
                "courseId": course_id,
                "percent": None,
                "detail": {
                    **base_detail,
                    "mode": "simple_points_pool",
                    "message": (
                        "no grade categories and no assignments with parseable "
                        "max + earned points"
                    ),
                },
            }
        pct = (unc_earned / unc_max) * 100.0
        return {
            "courseId": course_id,
            "percent": round(pct, 4),
            "detail": {
                **base_detail,
                "mode": "simple_points_pool",
                "message": None,
            },
        }

    # Weighted: require every positive-weight category to have computable average
    missing: list[str] = []
    contribution = 0.0
    for c in weighted_cats:
        cid = str(c.get("id", ""))
        w = _category_weight(c)
        em = max_by_cat.get(cid, 0.0)
        ee = earned_by_cat.get(cid, 0.0)
        label = str(c.get("name", "")).strip() or cid
        if em <= 0:
            missing.append(label)
            continue
        cat_pct = (ee / em) * 100.0
        contribution += cat_pct * (w / 100.0)

    if missing:
        msg = (
            "cannot compute final percent until every weighted category has "
            "at least one graded assignment (parseable max points and earned points): "
            + ", ".join(missing)
        )
        if unc_graded > 0:
            msg += (
                "; note: uncategorized assignments with scores are not included "
                "in weighted mode"
            )
        return {
            "courseId": course_id,
            "percent": None,
            "detail": {
                **base_detail,
                "mode": "weighted_categories",
                "missingCategories": missing,
                "message": msg,
            },
        }

    return {
        "courseId": course_id,
        "percent": round(contribution, 4),
        "detail": {
            **base_detail,
            "mode": "weighted_categories",
            "message": None,
        },
    }
