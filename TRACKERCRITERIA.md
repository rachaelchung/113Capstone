1. There are pages for weekly planning, todo lists, calendar, and courses.
2. Courses display an ability to add all your courses for the semester.
3. Courses include a smart way for AI to read syllabi and fill in all the info.
4. Courses can calculate grades for you based on assignments you have or have not completed.
5. The database stores to-do list items as undated
6. the database stores assignments within courses, that appear on calendar. 
7. grades are calculated accurately
8. pdfs and .html and .txt files are able to be read by the ai.

---

## Verification audit (codebase + SPEC cross-check)

Reviewed against `tracker.html`, `js/trackerStore.js`, `js/trackerMain.js`, `js/trackerApi.js`, and `backend/app/main.py`. Date of review: 2026-04-21.

### Items from this file (TRACKERCRITERIA.md)

| # | Criterion | Verdict | Notes |
|---|-----------|---------|-------|
| 1 | Pages for weekly planning, todo lists, calendar, and courses | **[PASS]** | Tabs and panels: `weekly`, `calendar`, `todo`, `courses` in `tracker.html`; `trackerMain.js` renders each. |
| 2 | Courses: add all courses for the semester | **[PASS]** | Add-course flow, course list, per-course modal (info / assignments / grades) in `trackerMain.js` + `TrackerStore.addCourse`. |
| 3 | AI reads syllabi and fills info | **[WARN]** | Works when `tracker-api-base` points at a running backend with a valid OpenAI key (`TrackerApi.parseSyllabus` → `/api/parse-syllabus`). Extraction quality depends on the syllabus; no Canvas cross-check. |
| 4 | Courses calculate grades from completed / incomplete work | **[WARN]** | UI shows a course grade from entered max/earned points and optional category weights (`courseGradeSnapshot` / grades tab). It is **not** “auto from completion flags alone”; it needs numeric scores. Acceptable for a prototype but not the full SPEC story (Canvas/Gradescope). |
| 5 | Database stores to-do items as undated | **[WARN]** | **Data model:** to-dos are `{ id, taskName, completed }` with no due date — correct. **Persistence:** `localStorage` only (`henn_tracker_v1`), not a server database as described in SPEC. |
| 6 | Database stores assignments within courses; they appear on calendar | **[WARN]** | **Model/UI:** assignments carry `courseId` and `dueDate`; calendar lists dated assignments only — correct. **Persistence:** again `localStorage`, not a shared DB. |
| 7 | Grades calculated accurately | **[WARN]** | Weighted category averages with renormalization when some categories lack data matches the in-app explanation and mirrors `backend/app/grade_calculation.py` style logic in the store. Not validated against a gold syllabus set; edge cases (drops, curves, non-additive schemes) are out of scope. |
| 8 | PDF, HTML, and TXT readable by AI | **[PASS]** | PDF: multipart upload, server-side text extraction in `main.py`. `.txt` / `.md` / `.html`: read in the browser and sent as JSON text to the same endpoint. **Residual risk:** image-only/scanned PDFs return a clear error (no OCR). |

### Extra checks from SPEC.md relevant to “is the tracker working?”

| Topic | Verdict | Notes |
|-------|---------|-------|
| Assignment tracker scope (courses, syllabus AI, grades, calendar, todos, weekly) | **[PASS]** | Prototype implements the main surfaces; Chrome extension / game integration is separate. |
| Calendar shows dated assignments only; to-dos undated elsewhere | **[PASS]** | Calendar copy and code use assignments only; todos live under **to-do** and **weekly**. |
| Weekly: drag undated to-do onto a day without a permanent due date on the to-do | **[PASS]** | Weekly plan rows reference `refType: 'todo'` + `refId`; todos keep no `dueDate` in store (SPEC acceptance #4). |
| Offline core tracker UI | **[PASS]** | Reads/writes `localStorage` without network for CRUD, calendar, weekly, todos. |
| Syllabus parse + weekly AI suggestions need network | **[WARN]** | Requires configured backend base URL and working `/api/*` routes + API availability. |
| Canvas / Gradescope sync; “source of truth” sync priority | **[FAIL]** | No Canvas or Gradescope integration in the codebase; SPEC acceptance **#3** (Canvas updates AI-parsed assignment) is **not** implemented. |
| Per-user auth and server-persisted tracker data | **[FAIL]** | No login or Render DB in this prototype; single-browser `localStorage` only. |
| Privacy note (syllabus sent to backend / OpenAI) | **[PASS]** (behavioral) | Matches implemented architecture when the backend is used; transparency is a product/docs concern, not a code bug. |