from __future__ import annotations

import json
from typing import Any

from openai import OpenAI

from app.config import get_settings


def complete_json_object(*, system: str, user: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured on the server")

    client = OpenAI(api_key=settings.openai_api_key)
    resp = client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content
    if not content:
        raise RuntimeError("OpenAI returned empty content")
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError("OpenAI did not return valid JSON") from e
