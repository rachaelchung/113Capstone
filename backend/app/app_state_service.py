from __future__ import annotations

import json
from typing import Any

from app.extensions import db
from app.models import User

DEFAULT_APP_STATE: dict[str, Any] = {
    "v": 1,
    "game": {
        "food": 0,
        "coins": 500,
        "caught": 0,
        "foodAccumulator": 0,
    },
    "habitat": {
        "inventory": {},
        "placements": {},
        "ownedHomeBackgrounds": {"default": True},
        "ownedFocusBackgrounds": {"default": True},
        "homeBackgroundId": "default",
        "focusBackgroundId": "default",
    },
    "bonds": {"bonds": {}},
}


def _normalize_client_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Merge client PUT body onto defaults so missing keys stay valid."""
    out = json.loads(json.dumps(DEFAULT_APP_STATE))
    if not isinstance(payload, dict):
        return out
    if isinstance(payload.get("game"), dict):
        g = payload["game"]
        for k in ("food", "coins", "caught", "foodAccumulator"):
            if k not in g:
                continue
            try:
                n = int(float(g[k]))
            except (TypeError, ValueError):
                continue
            cap = 99_999_999 if k != "foodAccumulator" else 9_999_999
            out["game"][k] = max(0, min(cap, n))
    if isinstance(payload.get("habitat"), dict):
        h = payload["habitat"]
        if isinstance(h.get("inventory"), dict):
            inv: dict[str, int] = {}
            for k, v in h["inventory"].items():
                try:
                    n = int(float(v))
                    if n >= 0:
                        inv[str(k)[:80]] = n
                except (TypeError, ValueError):
                    continue
            out["habitat"]["inventory"] = inv
        if isinstance(h.get("placements"), dict):
            out["habitat"]["placements"] = {str(k): str(v) for k, v in h["placements"].items() if v}
        if isinstance(h.get("ownedHomeBackgrounds"), dict):
            out["habitat"]["ownedHomeBackgrounds"] = {**{"default": True}, **{str(k): bool(v) for k, v in h["ownedHomeBackgrounds"].items()}}
        if isinstance(h.get("ownedFocusBackgrounds"), dict):
            out["habitat"]["ownedFocusBackgrounds"] = {
                **{"default": True},
                **{str(k): bool(v) for k, v in h["ownedFocusBackgrounds"].items()},
            }
        if isinstance(h.get("homeBackgroundId"), str):
            out["habitat"]["homeBackgroundId"] = h["homeBackgroundId"][:64]
        if isinstance(h.get("focusBackgroundId"), str):
            out["habitat"]["focusBackgroundId"] = h["focusBackgroundId"][:64]
    if isinstance(payload.get("bonds"), dict) and isinstance(payload["bonds"].get("bonds"), dict):
        bonds: dict[str, Any] = {}
        for rid, b in payload["bonds"]["bonds"].items():
            if not isinstance(b, dict):
                continue
            bonds[str(rid)[:80]] = {
                "feeds": max(0, int(b.get("feeds") or 0)),
                "pets": max(0, int(b.get("pets") or 0)),
                "chats": max(0, int(b.get("chats") or 0)),
            }
        out["bonds"]["bonds"] = bonds
    out["v"] = max(1, min(99, int(payload.get("v") or 1)))
    return out


def get_app_state_dict(user_id: int) -> dict[str, Any]:
    u = db.session.get(User, user_id)
    if u is None:
        raise ValueError("user not found")
    raw = (u.app_state_json or "").strip()
    if not raw:
        return json.loads(json.dumps(DEFAULT_APP_STATE))
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(json.dumps(DEFAULT_APP_STATE))
    if not isinstance(data, dict):
        return json.loads(json.dumps(DEFAULT_APP_STATE))
    return _normalize_client_payload(data)


def replace_app_state_for_user(user_id: int, payload: dict[str, Any]) -> None:
    u = db.session.get(User, user_id)
    if u is None:
        raise ValueError("user not found")
    normalized = _normalize_client_payload(payload) if isinstance(payload, dict) else json.loads(json.dumps(DEFAULT_APP_STATE))
    u.app_state_json = json.dumps(normalized, ensure_ascii=False)
    db.session.add(u)
    db.session.commit()
