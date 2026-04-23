from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, current_app, jsonify, request
from flask_cors import CORS
from pydantic import ValidationError
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.auth_routes import register_auth_routes
from app.auth_service import verify_tracker_jwt
from app.config import cors_origin_list, get_settings
from app.db_migrate import migrate_sqlite_schema
from app.extensions import db
from app.models import Assignment, Course, Todo, User, WeeklyPlan  # noqa: F401 — register models
from app.openai_json import complete_json_object
from app.pdf_text import extract_text_from_pdf
from app.schemas import (
    ParseSyllabusRequest,
    ParseSyllabusResponse,
    ParsedAssignment,
    ParsedGradingCategory,
    WeeklySuggestRequest,
    WeeklySuggestResponse,
    WeeklySuggestion,
)
from app.app_state_service import get_app_state_dict, replace_app_state_for_user
from app.tracker_service import ensure_default_user, replace_state_for_user, state_dict_for_user

load_dotenv()


@event.listens_for(Engine, "connect")
def _sqlite_enable_foreign_keys(dbapi_connection, _connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _database_uri() -> str:
    s = get_settings()
    if s.database_url and str(s.database_url).strip():
        return str(s.database_url).strip()
    backend_root = Path(__file__).resolve().parent.parent
    inst = backend_root / "instance"
    inst.mkdir(parents=True, exist_ok=True)
    p = (inst / "tracker.db").resolve()
    return "sqlite:///" + p.as_posix()


def _resolve_tracker_user_id() -> int:
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        tok = auth[7:].strip()
        secret = str(current_app.config.get("SECRET_KEY") or "")
        uid = verify_tracker_jwt(tok, secret)
        if uid is not None:
            return uid
    raw = (request.headers.get("X-Tracker-User-Id") or request.args.get("user_id") or "1").strip()
    try:
        return max(1, int(raw))
    except ValueError:
        return 1


def _resolve_user_id_jwt_only() -> int | None:
    """For per-user blobs (habitat / economy): require Bearer JWT (no X-Tracker-User-Id spoofing)."""
    auth = (request.headers.get("Authorization") or "").strip()
    if not auth.lower().startswith("bearer "):
        return None
    tok = auth[7:].strip()
    secret = str(current_app.config.get("SECRET_KEY") or "")
    return verify_tracker_jwt(tok, secret)


def create_app() -> Flask:
    s = get_settings()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = s.secret_key
    app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024
    app.config["SQLALCHEMY_DATABASE_URI"] = _database_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    with app.app_context():
        db.create_all()
        migrate_sqlite_schema(db.engine)
        ensure_default_user()

    register_auth_routes(app)

    CORS(
        app,
        origins=cors_origin_list(),
        supports_credentials=False,
        allow_headers="*",
        methods=["GET", "POST", "PUT", "OPTIONS"],
    )

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"ok": True})

    @app.route("/api/tracker/state", methods=["GET"])
    def tracker_get_state():
        uid = _resolve_tracker_user_id()
        if db.session.get(User, uid) is None:
            return jsonify({"detail": "user not found"}), 404
        try:
            return jsonify(state_dict_for_user(uid))
        except ValueError as e:
            return jsonify({"detail": str(e)}), 404

    @app.route("/api/tracker/state", methods=["PUT"])
    def tracker_put_state():
        uid = _resolve_tracker_user_id()
        if db.session.get(User, uid) is None:
            return jsonify({"detail": "user not found"}), 404
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"detail": "JSON object body required"}), 422
        try:
            replace_state_for_user(uid, data)
        except IntegrityError as e:
            db.session.rollback()
            return jsonify({"detail": f"invalid data: {e.orig}"}), 422
        except ValueError as e:
            db.session.rollback()
            return jsonify({"detail": str(e)}), 422
        return jsonify({"ok": True})

    @app.route("/api/user/app-state", methods=["GET"])
    def user_app_state_get():
        uid = _resolve_user_id_jwt_only()
        if uid is None:
            return jsonify({"detail": "Bearer token required"}), 401
        if db.session.get(User, uid) is None:
            return jsonify({"detail": "user not found"}), 404
        try:
            return jsonify(get_app_state_dict(uid))
        except ValueError as e:
            return jsonify({"detail": str(e)}), 404

    @app.route("/api/user/app-state", methods=["PUT"])
    def user_app_state_put():
        uid = _resolve_user_id_jwt_only()
        if uid is None:
            return jsonify({"detail": "Bearer token required"}), 401
        if db.session.get(User, uid) is None:
            return jsonify({"detail": "user not found"}), 404
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"detail": "JSON object body required"}), 422
        try:
            replace_app_state_for_user(uid, data)
        except ValueError as e:
            return jsonify({"detail": str(e)}), 404
        return jsonify({"ok": True})

    @app.route("/api/parse-syllabus", methods=["POST"])
    def parse_syllabus():
        syllabus_text: str | None = None
        course_name: str = ""

        ct = (request.content_type or "").lower()
        if "multipart/form-data" in ct:
            course_name = (request.form.get("course_name") or "").strip()
            if not course_name:
                return jsonify({"detail": "course_name is required"}), 422
            if len(course_name) > 200:
                return jsonify({"detail": "course_name too long"}), 422
            up = request.files.get("syllabus_pdf")
            if not up or not up.filename:
                return jsonify({"detail": "syllabus_pdf file is required"}), 422
            raw = up.read()
            if len(raw) > 10 * 1024 * 1024:
                return jsonify({"detail": "pdf too large (max 10 MB)"}), 422
            if not raw.startswith(b"%PDF"):
                return jsonify({"detail": "file does not look like a PDF"}), 422
            try:
                syllabus_text = extract_text_from_pdf(raw)
            except Exception as e:
                return jsonify({"detail": f"could not read pdf: {e}"}), 422
            if not syllabus_text or len(syllabus_text.strip()) < 5:
                return jsonify(
                    {
                        "detail": (
                            "no extractable text in this pdf (image-only / scanned syllabi need ocr; "
                            "try exporting as text or use a text-based pdf)"
                        )
                    }
                ), 422
            if len(syllabus_text) > 120_000:
                syllabus_text = syllabus_text[:120_000]
        else:
            data = request.get_json(silent=True)
            try:
                body = ParseSyllabusRequest.model_validate(data or {})
            except ValidationError as e:
                return jsonify({"detail": e.errors()}), 422
            course_name = body.course_name
            syllabus_text = body.syllabus_text

        system = (
            "You extract structured course data from a syllabus. "
            'Return ONLY a JSON object with keys: '
            '"assignments" (array) and optional "gradingCategories" (array). '
            'Each assignment object must have: "name" (string), "dueDate" (YYYY-MM-DD), '
            'optional "pointsValue" (string). '
            'Each grading category object (when the syllabus states weights) must have: '
            '"name" (string), "weightPercent" (number, percent of final grade for that category). '
            "If weights are missing or ambiguous, return gradingCategories as []. "
            "Skip assignment rows without a clear calendar due date. "
            "Use calendar dates as written in the syllabus (no timezone conversion)."
        )
        user = f"Course name (hint): {course_name}\n\nSyllabus:\n{syllabus_text}"
        try:
            raw = complete_json_object(system=system, user=user)
        except RuntimeError as e:
            return jsonify({"detail": str(e)}), 503

        rows = raw.get("assignments") if isinstance(raw, dict) else None
        if not isinstance(rows, list):
            return jsonify({"detail": "Model JSON missing assignments array"}), 502

        out: list[ParsedAssignment] = []
        for r in rows:
            if not isinstance(r, dict):
                continue
            name = str(r.get("name", "")).strip()
            due = str(r.get("dueDate", r.get("due_date", ""))).strip()[:10]
            if not name or not due:
                continue
            pv = r.get("pointsValue", r.get("points_value", ""))
            out.append(
                ParsedAssignment(
                    name=name,
                    dueDate=due,
                    pointsValue=str(pv).strip() if pv is not None else "",
                )
            )

        cat_rows = raw.get("gradingCategories", raw.get("grading_categories")) if isinstance(raw, dict) else None
        cats_out: list[ParsedGradingCategory] = []
        if isinstance(cat_rows, list):
            for r in cat_rows:
                if not isinstance(r, dict):
                    continue
                cn = str(r.get("name", "")).strip()
                if not cn:
                    continue
                w = r.get("weightPercent", r.get("weight_percent", 0))
                try:
                    wf = float(w)
                except (TypeError, ValueError):
                    wf = 0.0
                cats_out.append(ParsedGradingCategory(name=cn, weightPercent=wf))

        return jsonify(ParseSyllabusResponse(assignments=out, gradingCategories=cats_out).model_dump())

    @app.route("/api/weekly-suggestions", methods=["POST"])
    def weekly_suggestions():
        data = request.get_json(silent=True)
        try:
            body = WeeklySuggestRequest.model_validate(data or {})
        except ValidationError as e:
            return jsonify({"detail": e.errors()}), 422

        system = (
            "You help a student split work across days without changing real due dates. "
            'Return ONLY JSON: {"suggestions":[{"date":"YYYY-MM-DD","assignmentId":"string",'
            '"subTaskDescription":"string"}]}. '
            "assignmentId must be one of the ids provided. "
            "subTaskDescription must be concrete (e.g. read pages 1-5, draft intro). "
            "Only use dates within the same Monday-Sunday week as week_start_ymd (that Monday). "
            "Avoid duplicating the same date+assignmentId+subTaskDescription as existing_plans."
        )
        payload = {
            "week_start_ymd": body.week_start_ymd,
            "assignments": [a.model_dump() for a in body.assignments],
            "existing_plans": [p.model_dump() for p in body.existing_plans],
        }
        user = json.dumps(payload, ensure_ascii=False)
        try:
            raw = complete_json_object(system=system, user=user)
        except RuntimeError as e:
            return jsonify({"detail": str(e)}), 503

        sug = raw.get("suggestions") if isinstance(raw, dict) else None
        if not isinstance(sug, list):
            return jsonify({"detail": "Model JSON missing suggestions array"}), 502

        out: list[WeeklySuggestion] = []
        for r in sug:
            if not isinstance(r, dict):
                continue
            aid = str(r.get("assignmentId", r.get("assignment_id", ""))).strip()
            d = str(r.get("date", "")).strip()[:10]
            desc = str(r.get("subTaskDescription", r.get("sub_task_description", ""))).strip()
            if not aid or not d or not desc:
                continue
            out.append(WeeklySuggestion(date=d, assignmentId=aid, subTaskDescription=desc))
        return jsonify(WeeklySuggestResponse(suggestions=out).model_dump())

    return app
