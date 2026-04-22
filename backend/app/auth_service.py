from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models import User

JWT_DAYS = 30


def mint_tracker_jwt(user_id: int, secret: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, secret, algorithm="HS256")


def verify_tracker_jwt(token: str, secret: str) -> int | None:
    try:
        data = jwt.decode(token, secret, algorithms=["HS256"])
        return int(data["sub"])
    except Exception:
        return None


def _slug_username(raw: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9_-]+", "_", (raw or "").strip())[:40]
    return s.strip("_") or "student"


def allocate_username(base: str) -> str:
    candidate = _slug_username(base)
    n = 0
    while True:
        hit = db.session.scalar(select(User.id).where(User.username == candidate))
        if hit is None:
            return candidate
        n += 1
        candidate = f"{_slug_username(base)[:32]}_{n}"


def upsert_google_user(
    *,
    google_sub: str,
    email: str | None,
    display_name: str | None,
    avatar_url: str | None,
) -> User:
    u = db.session.scalar(select(User).where(User.google_sub == google_sub))
    if u:
        if email:
            u.email = email
        if display_name:
            u.display_name = display_name
        if avatar_url:
            u.avatar_url = avatar_url
        return u
    base = (email or "").split("@")[0] if email else f"g_{google_sub[:8]}"
    u = User(
        google_sub=google_sub,
        email=(email or None),
        display_name=(display_name or None),
        avatar_url=(avatar_url or None),
        username=allocate_username(base),
    )
    db.session.add(u)
    db.session.flush()
    return u


def register_local_user(
    *,
    email: str,
    password: str,
    username: str,
    display_name: str | None,
) -> User:
    em = email.strip().lower()
    un = _slug_username(username)
    if len(em) < 3 or "@" not in em:
        raise ValueError("invalid email")
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    if len(un) < 2:
        raise ValueError("invalid username")
    if db.session.scalar(select(User.id).where(User.email == em)):
        raise ValueError("email already registered")
    if db.session.scalar(select(User.id).where(User.username == un)):
        raise ValueError("username taken")
    u = User(
        email=em,
        username=un,
        display_name=(display_name or "").strip() or None,
        password_hash=generate_password_hash(password),
    )
    db.session.add(u)
    try:
        db.session.flush()
    except IntegrityError as e:
        db.session.rollback()
        raise ValueError("could not create user") from e
    return u


def authenticate_local(*, email_or_username: str, password: str) -> User | None:
    raw = (email_or_username or "").strip()
    if not raw:
        return None
    q = select(User).where(User.password_hash.isnot(None))
    if "@" in raw:
        u = db.session.scalar(q.where(User.email == raw.lower()))
    else:
        u = db.session.scalar(q.where(User.username == _slug_username(raw)))
    if not u or not u.password_hash:
        return None
    if not check_password_hash(u.password_hash, password):
        return None
    return u


def user_public_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username or "",
        "email": u.email or "",
        "displayName": u.display_name or "",
        "avatarUrl": u.avatar_url or "",
        "hasGoogle": bool(u.google_sub),
    }
