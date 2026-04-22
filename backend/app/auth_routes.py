from __future__ import annotations

from authlib.integrations.flask_client import OAuth
from flask import Blueprint, current_app, jsonify, redirect, request, url_for

from app.auth_service import (
    authenticate_local,
    mint_tracker_jwt,
    register_local_user,
    upsert_google_user,
    user_public_dict,
    verify_tracker_jwt,
)
from app.config import get_settings
from app.extensions import db
from app.models import User

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
_oauth = OAuth()
_google_oauth_enabled = False


def _frontend_app_url() -> str:
    origin = get_settings().frontend_origin.rstrip("/")
    return f"{origin}/app.html"


def _redirect_with_token(token: str) -> str:
    return f"{_frontend_app_url()}#tracker_auth={token}"


def _jwt_secret() -> str:
    return current_app.config.get("SECRET_KEY") or "dev-insecure-change-me"


@bp.get("/me")
def me():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return jsonify({"detail": "missing bearer token"}), 401
    token = auth[7:].strip()
    uid = verify_tracker_jwt(token, _jwt_secret())
    if uid is None:
        return jsonify({"detail": "invalid or expired token"}), 401
    u = db.session.get(User, uid)
    if u is None:
        return jsonify({"detail": "user not found"}), 404
    return jsonify({"user": user_public_dict(u)})


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    username = str(data.get("username", "")).strip()
    display_name = str(data.get("first_name", "") or data.get("display_name", "")).strip()
    try:
        u = register_local_user(
            email=email, password=password, username=username, display_name=display_name or None
        )
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return jsonify({"detail": str(e)}), 422
    token = mint_tracker_jwt(u.id, _jwt_secret())
    return jsonify({"token": token, "user": user_public_dict(u)})


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    ident = str(data.get("email_or_username", data.get("email", ""))).strip()
    password = str(data.get("password", ""))
    u = authenticate_local(email_or_username=ident, password=password)
    if u is None:
        return jsonify({"detail": "invalid email or password"}), 401
    token = mint_tracker_jwt(u.id, _jwt_secret())
    return jsonify({"token": token, "user": user_public_dict(u)})


@bp.get("/google")
def google_start():
    if not _google_oauth_enabled:
        return jsonify(
            {
                "detail": (
                    "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env "
                    "(see .env.example)."
                )
            }
        ), 503
    redirect_uri = url_for("auth.google_callback", _external=True)
    return _oauth.google.authorize_redirect(redirect_uri)


@bp.get("/google/callback")
def google_callback():
    if not _google_oauth_enabled:
        return redirect(f"{get_settings().frontend_origin.rstrip('/')}/index.html?auth=error")
    try:
        token = _oauth.google.authorize_access_token()
    except Exception as e:
        current_app.logger.warning("google oauth failed: %s", e)
        return redirect(f"{get_settings().frontend_origin.rstrip('/')}/index.html?auth=error")

    userinfo = token.get("userinfo")
    if not userinfo:
        try:
            resp = _oauth.google.get("https://openidconnect.googleapis.com/v1/userinfo", token=token)
            userinfo = resp.json()
        except Exception as e:
            current_app.logger.warning("google userinfo failed: %s", e)
            return redirect(f"{get_settings().frontend_origin.rstrip('/')}/index.html?auth=error")

    sub = str((userinfo or {}).get("sub") or "").strip()
    if not sub:
        return redirect(f"{get_settings().frontend_origin.rstrip('/')}/index.html?auth=error")

    email = (userinfo.get("email") or None) and str(userinfo["email"]).strip().lower()
    name = (userinfo.get("name") or None) and str(userinfo["name"]).strip()
    picture = (userinfo.get("picture") or None) and str(userinfo["picture"]).strip()

    try:
        u = upsert_google_user(
            google_sub=sub,
            email=email,
            display_name=name,
            avatar_url=picture,
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.exception("google user persist failed: %s", e)
        return redirect(f"{get_settings().frontend_origin.rstrip('/')}/index.html?auth=error")

    jwt_tok = mint_tracker_jwt(u.id, _jwt_secret())
    return redirect(_redirect_with_token(jwt_tok))


def init_oauth(app):
    global _google_oauth_enabled
    s = get_settings()
    app.config.setdefault("SECRET_KEY", s.secret_key)
    _oauth.init_app(app)
    _google_oauth_enabled = False
    if s.google_client_id.strip() and s.google_client_secret.strip():
        _oauth.register(
            name="google",
            client_id=s.google_client_id.strip(),
            client_secret=s.google_client_secret.strip(),
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )
        _google_oauth_enabled = True


def register_auth_routes(app):
    init_oauth(app)
    app.register_blueprint(bp)
