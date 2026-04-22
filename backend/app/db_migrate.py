"""Lightweight SQLite column adds for existing DBs (create_all does not ALTER)."""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def migrate_sqlite_schema(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    insp = inspect(engine)
    if "users" not in insp.get_table_names():
        return
    have = {c["name"] for c in insp.get_columns("users")}
    alters: list[str] = []
    if "email" not in have:
        alters.append("ALTER TABLE users ADD COLUMN email VARCHAR(255)")
    if "google_sub" not in have:
        alters.append("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)")
    if "display_name" not in have:
        alters.append("ALTER TABLE users ADD COLUMN display_name VARCHAR(200)")
    if "avatar_url" not in have:
        alters.append("ALTER TABLE users ADD COLUMN avatar_url TEXT")
    if "password_hash" not in have:
        alters.append("ALTER TABLE users ADD COLUMN password_hash VARCHAR(255)")
    if "created_at" not in have:
        alters.append("ALTER TABLE users ADD COLUMN created_at TIMESTAMP")
    if not alters:
        return
    with engine.begin() as conn:
        for stmt in alters:
            conn.execute(text(stmt))
    with engine.begin() as conn:
        conn.execute(text("UPDATE users SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
