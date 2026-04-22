from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db


class User(db.Model):
    """Tracker rows are scoped by user_id. Auth via Google OAuth and/or password."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False, default=datetime.utcnow
    )

    courses: Mapped[list["Course"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    todos: Mapped[list["Todo"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    weekly_plans: Mapped[list["WeeklyPlan"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Course(db.Model):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), default="")
    color: Mapped[str] = mapped_column(String(32), default="#cccccc")
    professor: Mapped[str] = mapped_column(String(200), default="")
    schedule_text: Mapped[str] = mapped_column(String(300), default="")
    grade_categories_json: Mapped[str] = mapped_column(Text, default="[]")

    user: Mapped["User"] = relationship(back_populates="courses")
    assignments: Mapped[list["Assignment"]] = relationship(
        back_populates="course", cascade="all, delete-orphan"
    )

    def grade_categories_list(self) -> list[dict[str, Any]]:
        try:
            data = json.loads(self.grade_categories_json or "[]")
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []

    def set_grade_categories_list(self, value: list[dict[str, Any]]) -> None:
        self.grade_categories_json = json.dumps(value, ensure_ascii=False)


class Assignment(db.Model):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    course_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(500), default="")
    due_date: Mapped[str] = mapped_column(String(10), default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(40), default="manual")
    points_value: Mapped[str] = mapped_column(String(80), default="")
    category_id: Mapped[str] = mapped_column(String(36), default="")
    earned_points: Mapped[str] = mapped_column(String(80), default="")

    course: Mapped["Course"] = relationship(back_populates="assignments")


class Todo(db.Model):
    __tablename__ = "todos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_name: Mapped[str] = mapped_column(String(500), default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="todos")


class WeeklyPlan(db.Model):
    __tablename__ = "weekly_plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan_date: Mapped[str] = mapped_column("plan_date", String(10), nullable=False, index=True)
    ref_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ref_id: Mapped[str] = mapped_column(String(36), nullable=False)
    sub_task_description: Mapped[str] = mapped_column(String(500), default="")

    user: Mapped["User"] = relationship(back_populates="weekly_plans")
