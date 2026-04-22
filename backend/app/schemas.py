from pydantic import BaseModel, Field


class ParseSyllabusRequest(BaseModel):
    course_name: str = Field(..., min_length=1, max_length=200)
    syllabus_text: str = Field(..., min_length=5, max_length=120_000)


class ParsedAssignment(BaseModel):
    name: str
    dueDate: str
    pointsValue: str = ""


class ParsedGradingCategory(BaseModel):
    name: str
    weightPercent: float = 0.0


class ParseSyllabusResponse(BaseModel):
    assignments: list[ParsedAssignment]
    gradingCategories: list[ParsedGradingCategory] = []


class AssignmentBrief(BaseModel):
    id: str
    name: str
    dueDate: str
    courseId: str


class PlanBrief(BaseModel):
    date: str
    refType: str
    refId: str
    subTaskDescription: str = ""


class WeeklySuggestRequest(BaseModel):
    week_start_ymd: str = Field(..., min_length=10, max_length=10)
    assignments: list[AssignmentBrief]
    existing_plans: list[PlanBrief] = []


class WeeklySuggestion(BaseModel):
    date: str
    assignmentId: str
    subTaskDescription: str


class WeeklySuggestResponse(BaseModel):
    suggestions: list[WeeklySuggestion]
