/**
 * trackerStore.js — assignment tracker state.
 * When `tracker-api-base` is set (see app.html), loads/saves via Flask + SQLite.
 * Otherwise uses localStorage only (legacy / offline file open).
 */

const TRACKER_STORAGE_KEY = 'henn_tracker_v1';
const TRACKER_USER_ID_KEY = 'henn_tracker_user_id';
const TRACKER_JWT_KEY = 'henn_tracker_jwt';
const PERSIST_DEBOUNCE_MS = 420;
let _persistTimer = null;

const DEFAULT_COURSE_COLORS = ['#ff6b4a', '#4ec6e6', '#ffd54f', '#5ad18b', '#9b7ed9'];

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function startOfWeekMonday(d) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Leading numeric from points fields; blank / non-numeric → null. */
function parseGradePoints(value) {
  if (value == null) return null;
  const s = String(value)
    .trim()
    .replace(/,/g, '');
  if (!s) return null;
  const m = s.match(/^[-+]?(?:\d+\.?\d*|\.\d+)/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Current grade for UI: only rows with both parseable max (>0) and earned count.
 * With syllabus weights: weighted average of category % among categories that have
 * at least one counting row; weights renormalize so partial data still shows a %.
 */
function computeCourseGradeFromState(state, courseId) {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) {
    return { percent: null, isPartial: false, reason: 'course not found' };
  }

  const cats = Array.isArray(course.gradeCategories) ? course.gradeCategories : [];
  const weighted = cats.filter((c) => (Number(c.weightPercent) || 0) > 0);
  const assignments = state.assignments.filter((a) => a.courseId === courseId);

  const rowCounts = (a) => {
    const mx = parseGradePoints(a.pointsValue);
    const er = parseGradePoints(a.earnedPoints);
    return mx != null && mx > 0 && er != null;
  };

  if (weighted.length === 0) {
    let maxSum = 0;
    let earnedSum = 0;
    for (const a of assignments) {
      if (!rowCounts(a)) continue;
      maxSum += parseGradePoints(a.pointsValue);
      earnedSum += parseGradePoints(a.earnedPoints);
    }
    if (maxSum <= 0) {
      return {
        percent: null,
        isPartial: false,
        reason: 'enter max and earned on at least one assignment',
      };
    }
    return { percent: (earnedSum / maxSum) * 100, isPartial: false, reason: null };
  }

  let contrib = 0;
  let weightWithData = 0;
  const totalW = weighted.reduce((s, c) => s + (Number(c.weightPercent) || 0), 0);

  for (const c of weighted) {
    const w = Number(c.weightPercent) || 0;
    let catMax = 0;
    let catEarn = 0;
    for (const a of assignments) {
      if (a.categoryId !== c.id) continue;
      if (!rowCounts(a)) continue;
      catMax += parseGradePoints(a.pointsValue);
      catEarn += parseGradePoints(a.earnedPoints);
    }
    if (catMax <= 0) continue;
    const avg = (catEarn / catMax) * 100;
    contrib += avg * w;
    weightWithData += w;
  }

  if (weightWithData <= 0) {
    return {
      percent: null,
      isPartial: true,
      reason: 'enter max and earned in at least one weighted category',
    };
  }

  const percent = contrib / weightWithData;
  const isPartial = weightWithData < totalW - 1e-9;
  return { percent, isPartial, reason: null };
}

function emptyState() {
  return {
    courses: [],
    assignments: [],
    todos: [],
    weeklyPlan: [],
  };
}

function normalizeWeightPercent(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 1000) / 1000;
}

function migrate(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const courses = Array.isArray(raw.courses) ? raw.courses : [];
  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
  for (const c of courses) {
    if (!Array.isArray(c.gradeCategories)) c.gradeCategories = [];
    else {
      c.gradeCategories = c.gradeCategories
        .filter((x) => x && typeof x === 'object' && x.id && x.name)
        .map((x) => ({
          id: String(x.id),
          name: String(x.name || '').trim(),
          weightPercent: normalizeWeightPercent(x.weightPercent),
        }));
    }
  }
  for (const a of assignments) {
    if (a.categoryId == null || a.categoryId === '') a.categoryId = '';
    else a.categoryId = String(a.categoryId);
    if (a.earnedPoints == null) a.earnedPoints = '';
    else a.earnedPoints = String(a.earnedPoints);
  }
  return {
    courses,
    assignments,
    todos: Array.isArray(raw.todos) ? raw.todos : [],
    weeklyPlan: Array.isArray(raw.weeklyPlan) ? raw.weeklyPlan : [],
  };
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(TRACKER_STORAGE_KEY) || 'null');
    return migrate(raw);
  } catch {
    return emptyState();
  }
}

function save(state) {
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

function parseJwtSub(jwt) {
  try {
    const body = jwt.split('.')[1];
    if (!body) return null;
    let b64 = body.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    return payload && payload.sub != null ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

function getTrackerJwt() {
  try {
    const j = localStorage.getItem(TRACKER_JWT_KEY);
    return j && j.trim() ? j.trim() : '';
  } catch {
    return '';
  }
}

function trackerAuthHeaders() {
  const uid = (() => {
    try {
      const jwt = getTrackerJwt();
      if (jwt) {
        const s = parseJwtSub(jwt);
        if (s) return s;
      }
      return localStorage.getItem(TRACKER_USER_ID_KEY) || '1';
    } catch {
      return '1';
    }
  })();
  const h = {
    'Content-Type': 'application/json',
    'X-Tracker-User-Id': uid,
  };
  const jwt = getTrackerJwt();
  if (jwt) h.Authorization = `Bearer ${jwt}`;
  return h;
}

function getTrackerUserId() {
  try {
    const jwt = getTrackerJwt();
    if (jwt) {
      const s = parseJwtSub(jwt);
      if (s) return s;
    }
    return localStorage.getItem(TRACKER_USER_ID_KEY) || '1';
  } catch {
    return '1';
  }
}

function usesRemotePersistence() {
  return typeof TrackerApi !== 'undefined' && !!TrackerApi.getBaseUrl();
}

async function putRemoteStateFull(state) {
  const base = TrackerApi.getBaseUrl();
  if (!base) return;
  const uid = getTrackerUserId();
  const body = JSON.stringify({
    courses: state.courses,
    assignments: state.assignments,
    todos: state.todos,
    weeklyPlan: state.weeklyPlan,
  });
  const res = await fetch(`${base}/api/tracker/state?user_id=${encodeURIComponent(uid)}`, {
    method: 'PUT',
    headers: { ...trackerAuthHeaders() },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 300) || `save failed (${res.status})`);
  }
}

function seedDemoIfEmpty(state) {
  if (state.courses.length || state.assignments.length || state.todos.length) return state;
  const c1 = uid();
  const c2 = uid();
  const catProjects = uid();
  const catParticipation = uid();
  const monday = startOfWeekMonday(new Date());
  const due1 = toYmd(addDays(monday, 3));
  const due2 = toYmd(addDays(monday, 5));
  return {
    ...state,
    courses: [
      {
        id: c1,
        name: 'cs capstone',
        color: DEFAULT_COURSE_COLORS[0],
        professor: 'tbd',
        scheduleText: 'tue/thu 2pm',
        gradeCategories: [
          { id: catProjects, name: 'projects', weightPercent: 50 },
          { id: catParticipation, name: 'participation', weightPercent: 50 },
        ],
      },
      { id: c2, name: 'design studio', color: DEFAULT_COURSE_COLORS[1], professor: '', scheduleText: '', gradeCategories: [] },
    ],
    assignments: [
      {
        id: uid(),
        name: 'milestone 1 writeup',
        dueDate: due1,
        courseId: c1,
        completed: false,
        source: 'manual',
        pointsValue: '',
        categoryId: catProjects,
        earnedPoints: '',
      },
      {
        id: uid(),
        name: 'reading reflection',
        dueDate: due2,
        courseId: c2,
        completed: false,
        source: 'manual',
        pointsValue: '',
        categoryId: '',
        earnedPoints: '',
      },
    ],
    todos: [
      { id: uid(), taskName: 'email advisor', completed: false },
      { id: uid(), taskName: 'sketch weekly plan ui', completed: false },
    ],
  };
}

const TrackerStore = {
  state: emptyState(),
  /** When true, mutations are synced to the backend (SQLite) instead of only localStorage. */
  _remote: false,

  async init() {
    if (!usesRemotePersistence()) {
      this._remote = false;
      this.state = seedDemoIfEmpty(load());
      save(this.state);
      return;
    }
    this._remote = true;
    const base = TrackerApi.getBaseUrl();
    const uid = getTrackerUserId();
    try {
      const res = await fetch(`${base}/api/tracker/state?user_id=${encodeURIComponent(uid)}`, {
        headers: (() => {
          const h = { 'X-Tracker-User-Id': uid };
          const jwt = getTrackerJwt();
          if (jwt) h.Authorization = `Bearer ${jwt}`;
          return h;
        })(),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t.slice(0, 240) || `load failed (${res.status})`);
      }
      const raw = await res.json();
      let state = migrate({
        courses: raw.courses || [],
        assignments: raw.assignments || [],
        todos: raw.todos || [],
        weeklyPlan: raw.weeklyPlan || [],
      });
      const empty = !state.courses.length && !state.assignments.length && !state.todos.length;
      if (empty) {
        const legacy = load();
        const legM = migrate(legacy);
        if (legM.courses.length || legM.assignments.length || legM.todos.length) {
          state = legM;
          await putRemoteStateFull(state);
          try {
            localStorage.removeItem(TRACKER_STORAGE_KEY);
          } catch {
            /* ignore */
          }
        } else {
          state = seedDemoIfEmpty(state);
          await putRemoteStateFull(state);
        }
      }
      this.state = state;
    } catch (err) {
      console.error('Tracker remote load failed; using localStorage.', err);
      this._remote = false;
      this.state = seedDemoIfEmpty(load());
      save(this.state);
    }
  },

  persist() {
    if (!this._remote) {
      save(this.state);
      return;
    }
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      _persistTimer = null;
      putRemoteStateFull(this.state).catch((e) => console.error('tracker save failed', e));
    }, PERSIST_DEBOUNCE_MS);
  },

  async flushPersist() {
    if (!this._remote) return;
    if (_persistTimer) {
      clearTimeout(_persistTimer);
      _persistTimer = null;
    }
    await putRemoteStateFull(this.state);
  },

  usesServerPersistence() {
    return this._remote;
  },

  getRemoteUserId() {
    return getTrackerUserId();
  },

  getCourse(id) {
    return this.state.courses.find((c) => c.id === id) || null;
  },

  addCourse({ name, professor = '', scheduleText = '' }) {
    const color = DEFAULT_COURSE_COLORS[this.state.courses.length % DEFAULT_COURSE_COLORS.length];
    const course = {
      id: uid(),
      name: name.trim(),
      color,
      professor: professor.trim(),
      scheduleText: scheduleText.trim(),
      gradeCategories: [],
    };
    this.state.courses.push(course);
    this.persist();
    return course;
  },

  replaceCourseGradeCategoriesFromSyllabus(courseId, categories) {
    const c = this.state.courses.find((x) => x.id === courseId);
    if (!c) return [];
    const list = Array.isArray(categories) ? categories : [];
    const next = list
      .filter((row) => row && String(row.name || '').trim())
      .map((row) => ({
        id: uid(),
        name: String(row.name).trim(),
        weightPercent: normalizeWeightPercent(row.weightPercent),
      }));
    c.gradeCategories = next;
    this.persist();
    return next;
  },

  addGradeCategory(courseId, { name, weightPercent = 0 }) {
    const c = this.state.courses.find((x) => x.id === courseId);
    if (!c) return null;
    if (!Array.isArray(c.gradeCategories)) c.gradeCategories = [];
    const cat = { id: uid(), name: String(name || '').trim(), weightPercent: normalizeWeightPercent(weightPercent) };
    if (!cat.name) return null;
    c.gradeCategories.push(cat);
    this.persist();
    return cat;
  },

  updateGradeCategory(courseId, categoryId, { name, weightPercent }) {
    const c = this.state.courses.find((x) => x.id === courseId);
    if (!c || !Array.isArray(c.gradeCategories)) return;
    const cat = c.gradeCategories.find((x) => x.id === categoryId);
    if (!cat) return;
    if (name != null) {
      const nm = String(name).trim();
      if (!nm) return;
      cat.name = nm;
    }
    if (weightPercent != null) cat.weightPercent = normalizeWeightPercent(weightPercent);
    this.persist();
  },

  removeGradeCategory(courseId, categoryId) {
    const c = this.state.courses.find((x) => x.id === courseId);
    if (!c || !Array.isArray(c.gradeCategories)) return;
    c.gradeCategories = c.gradeCategories.filter((x) => x.id !== categoryId);
    this.state.assignments.forEach((a) => {
      if (a.courseId === courseId && a.categoryId === categoryId) a.categoryId = '';
    });
    this.persist();
  },

  removeCourse(courseId) {
    const doomedIds = new Set(
      this.state.assignments.filter((a) => a.courseId === courseId).map((a) => a.id),
    );
    this.state.weeklyPlan = this.state.weeklyPlan.filter(
      (p) => !(p.refType === 'assignment' && doomedIds.has(p.refId)),
    );
    this.state.assignments = this.state.assignments.filter((a) => a.courseId !== courseId);
    this.state.courses = this.state.courses.filter((c) => c.id !== courseId);
    this.persist();
  },

  addAssignmentsBulk(list) {
    const added = [];
    for (const row of list) {
      if (!row.name || !row.dueDate) continue;
      const a = {
        id: uid(),
        name: String(row.name).trim(),
        dueDate: String(row.dueDate).trim(),
        courseId: row.courseId,
        completed: false,
        source: row.source || 'syllabus',
        pointsValue: row.pointsValue != null ? String(row.pointsValue) : '',
        categoryId: row.categoryId != null ? String(row.categoryId) : '',
        earnedPoints: row.earnedPoints != null ? String(row.earnedPoints) : '',
      };
      this.state.assignments.push(a);
      added.push(a);
    }
    this.persist();
    return added;
  },

  toggleAssignmentComplete(id) {
    const a = this.state.assignments.find((x) => x.id === id);
    if (!a) return;
    a.completed = !a.completed;
    this.persist();
  },

  addTodo(taskName) {
    const t = { id: uid(), taskName: taskName.trim(), completed: false };
    this.state.todos.push(t);
    this.persist();
    return t;
  },

  toggleTodo(id) {
    const t = this.state.todos.find((x) => x.id === id);
    if (!t) return;
    t.completed = !t.completed;
    this.persist();
  },

  removeTodo(id) {
    this.state.todos = this.state.todos.filter((t) => t.id !== id);
    this.state.weeklyPlan = this.state.weeklyPlan.filter((p) => !(p.refType === 'todo' && p.refId === id));
    this.persist();
  },

  addWeeklyPlan({ dateYmd, refType, refId, subTaskDescription }) {
    const p = {
      id: uid(),
      date: dateYmd,
      refType,
      refId,
      subTaskDescription: (subTaskDescription || '').trim(),
    };
    this.state.weeklyPlan.push(p);
    this.persist();
    return p;
  },

  removeWeeklyPlan(id) {
    this.state.weeklyPlan = this.state.weeklyPlan.filter((p) => p.id !== id);
    this.persist();
  },

  moveWeeklyPlan(planId, dateYmd) {
    const p = this.state.weeklyPlan.find((x) => x.id === planId);
    if (!p) return;
    p.date = String(dateYmd || '').slice(0, 10);
    this.persist();
  },

  clearWeekPlansForRange(startYmd, endYmd) {
    this.state.weeklyPlan = this.state.weeklyPlan.filter((p) => p.date < startYmd || p.date > endYmd);
    this.persist();
  },

  updateCourse(courseId, { name, professor, scheduleText }) {
    const c = this.state.courses.find((x) => x.id === courseId);
    if (!c) return;
    if (name != null) c.name = String(name).trim();
    if (professor != null) c.professor = String(professor).trim();
    if (scheduleText != null) c.scheduleText = String(scheduleText).trim();
    this.persist();
  },

  addAssignment({ courseId, name, dueDate, pointsValue = '', source = 'manual' }) {
    const nm = String(name || '').trim();
    const due = String(dueDate || '').trim();
    if (!nm || !due) return null;
    const a = {
      id: uid(),
      name: nm,
      dueDate: due.slice(0, 10),
      courseId,
      completed: false,
      source,
      pointsValue: pointsValue != null ? String(pointsValue) : '',
      categoryId: '',
      earnedPoints: '',
    };
    this.state.assignments.push(a);
    this.persist();
    return a;
  },

  updateAssignment(assignmentId, fields) {
    const a = this.state.assignments.find((x) => x.id === assignmentId);
    if (!a) return;
    if (fields.name != null) a.name = String(fields.name).trim();
    if (fields.dueDate != null) a.dueDate = String(fields.dueDate).trim().slice(0, 10);
    if (fields.pointsValue != null) a.pointsValue = String(fields.pointsValue);
    if (fields.completed != null) a.completed = !!fields.completed;
    if (fields.categoryId != null) a.categoryId = String(fields.categoryId || '');
    if (fields.earnedPoints != null) a.earnedPoints = String(fields.earnedPoints);
    this.persist();
  },

  deleteAssignment(assignmentId) {
    this.state.assignments = this.state.assignments.filter((x) => x.id !== assignmentId);
    this.state.weeklyPlan = this.state.weeklyPlan.filter(
      (p) => !(p.refType === 'assignment' && p.refId === assignmentId),
    );
    this.persist();
  },

  assignmentsForCalendarMonth(year, monthIndex) {
    return this.state.assignments.filter((a) => {
      const dt = parseYmd(a.dueDate);
      if (!dt) return false;
      return dt.getFullYear() === year && dt.getMonth() === monthIndex;
    });
  },

  weekRangeFromMonday(mondayDate) {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      days.push(toYmd(addDays(mondayDate, i)));
    }
    return days;
  },

  startOfWeekMonday,
  addDays,
  toYmd,
  parseYmd,

  /** @returns {{ percent: number|null, isPartial: boolean, reason: string|null }} */
  courseGradeSnapshot(courseId) {
    return computeCourseGradeFromState(this.state, courseId);
  },
};
