from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select

from app.extensions import db
from app.models import Assignment, Course, Todo, User, WeeklyPlan


def state_dict_for_user(user_id: int) -> dict[str, Any]:
    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("user not found")

    courses_out: list[dict[str, Any]] = []
    for c in db.session.scalars(select(Course).where(Course.user_id == user_id).order_by(Course.id)):
        courses_out.append(
            {
                "id": c.id,
                "name": c.name or "",
                "color": c.color or "#cccccc",
                "professor": c.professor or "",
                "scheduleText": c.schedule_text or "",
                "gradeCategories": c.grade_categories_list(),
            }
        )

    course_ids = [x["id"] for x in courses_out]
    assignments_out: list[dict[str, Any]] = []
    if course_ids:
        q = select(Assignment).where(Assignment.course_id.in_(course_ids)).order_by(Assignment.due_date)
        for a in db.session.scalars(q):
            assignments_out.append(
                {
                    "id": a.id,
                    "name": a.name or "",
                    "dueDate": (a.due_date or "")[:10],
                    "courseId": a.course_id,
                    "completed": bool(a.completed),
                    "source": a.source or "manual",
                    "pointsValue": a.points_value or "",
                    "categoryId": a.category_id or "",
                    "earnedPoints": a.earned_points or "",
                }
            )

    todos_out = [
        {"id": t.id, "taskName": t.task_name or "", "completed": bool(t.completed)}
        for t in db.session.scalars(select(Todo).where(Todo.user_id == user_id).order_by(Todo.id))
    ]

    weekly_out = [
        {
            "id": p.id,
            "date": p.plan_date,
            "refType": p.ref_type,
            "refId": p.ref_id,
            "subTaskDescription": p.sub_task_description or "",
        }
        for p in db.session.scalars(
            select(WeeklyPlan).where(WeeklyPlan.user_id == user_id).order_by(WeeklyPlan.plan_date)
        )
    ]

    return {
        "courses": courses_out,
        "assignments": assignments_out,
        "todos": todos_out,
        "weeklyPlan": weekly_out,
    }


def replace_state_for_user(user_id: int, payload: dict[str, Any]) -> None:
    user = db.session.get(User, user_id)
    if not user:
        raise ValueError("user not found")

    courses = payload.get("courses") if isinstance(payload, dict) else None
    assignments = payload.get("assignments") if isinstance(payload, dict) else None
    todos = payload.get("todos") if isinstance(payload, dict) else None
    weekly = payload.get("weeklyPlan") if isinstance(payload, dict) else None

    if not isinstance(courses, list):
        courses = []
    if not isinstance(assignments, list):
        assignments = []
    if not isinstance(todos, list):
        todos = []
    if not isinstance(weekly, list):
        weekly = []

    db.session.execute(delete(WeeklyPlan).where(WeeklyPlan.user_id == user_id))
    db.session.execute(delete(Todo).where(Todo.user_id == user_id))
    db.session.execute(
        delete(Assignment).where(
            Assignment.course_id.in_(select(Course.id).where(Course.user_id == user_id))
        )
    )
    db.session.execute(delete(Course).where(Course.user_id == user_id))

    for row in courses:
        if not isinstance(row, dict):
            continue
        cid = str(row.get("id", "")).strip()
        if not cid:
            continue
        cats = row.get("gradeCategories")
        if not isinstance(cats, list):
            cats = []
        clean_cats: list[dict[str, Any]] = []
        for cat in cats:
            if not isinstance(cat, dict):
                continue
            cat_id = str(cat.get("id", "")).strip()
            cat_name = str(cat.get("name", "")).strip()
            if not cat_id or not cat_name:
                continue
            w = cat.get("weightPercent", 0)
            try:
                wf = float(w)
            except (TypeError, ValueError):
                wf = 0.0
            clean_cats.append({"id": cat_id, "name": cat_name, "weightPercent": wf})

        c = Course(
            id=cid,
            user_id=user_id,
            name=str(row.get("name", ""))[:200],
            color=str(row.get("color", "#cccccc"))[:32],
            professor=str(row.get("professor", ""))[:200],
            schedule_text=str(row.get("scheduleText", ""))[:300],
        )
        c.set_grade_categories_list(clean_cats)
        db.session.add(c)

    for row in assignments:
        if not isinstance(row, dict):
            continue
        aid = str(row.get("id", "")).strip()
        course_id = str(row.get("courseId", "")).strip()
        name = str(row.get("name", "")).strip()
        due = str(row.get("dueDate", "")).strip()[:10]
        if not aid or not course_id or not name or not due:
            continue
        db.session.add(
            Assignment(
                id=aid,
                course_id=course_id,
                name=name[:500],
                due_date=due,
                completed=bool(row.get("completed")),
                source=str(row.get("source", "manual") or "manual")[:40],
                points_value=str(row.get("pointsValue", "") or "")[:80],
                category_id=str(row.get("categoryId", "") or "")[:36],
                earned_points=str(row.get("earnedPoints", "") or "")[:80],
            )
        )

    for row in todos:
        if not isinstance(row, dict):
            continue
        tid = str(row.get("id", "")).strip()
        task_name = str(row.get("taskName", "")).strip()
        if not tid or not task_name:
            continue
        db.session.add(
            Todo(
                id=tid,
                user_id=user_id,
                task_name=task_name[:500],
                completed=bool(row.get("completed")),
            )
        )

    for row in weekly:
        if not isinstance(row, dict):
            continue
        pid = str(row.get("id", "")).strip()
        d = str(row.get("date", "")).strip()[:10]
        ref_type = str(row.get("refType", "")).strip()
        ref_id = str(row.get("refId", "")).strip()
        if not pid or not d or not ref_type or not ref_id:
            continue
        if ref_type not in ("assignment", "todo"):
            continue
        sub = str(row.get("subTaskDescription", "") or "")[:500]
        db.session.add(
            WeeklyPlan(
                id=pid,
                user_id=user_id,
                plan_date=d,
                ref_type=ref_type,
                ref_id=ref_id,
                sub_task_description=sub,
            )
        )

    db.session.commit()


def ensure_default_user() -> User:
    u = db.session.get(User, 1)
    if u:
        return u
    u = User(id=1, username="local")
    db.session.add(u)
    db.session.commit()
    return u
