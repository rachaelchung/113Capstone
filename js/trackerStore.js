/**
 * trackerStore.js — local persistence for the assignment tracker (separate from game).
 */

const TRACKER_STORAGE_KEY = 'henn_tracker_v1';

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

function emptyState() {
  return {
    courses: [],
    assignments: [],
    todos: [],
    weeklyPlan: [],
    settings: {
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.2',
    },
  };
}

function migrate(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  return {
    courses: Array.isArray(raw.courses) ? raw.courses : [],
    assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    todos: Array.isArray(raw.todos) ? raw.todos : [],
    weeklyPlan: Array.isArray(raw.weeklyPlan) ? raw.weeklyPlan : [],
    settings: {
      ollamaBaseUrl: typeof raw.settings?.ollamaBaseUrl === 'string' ? raw.settings.ollamaBaseUrl : base.settings.ollamaBaseUrl,
      ollamaModel: typeof raw.settings?.ollamaModel === 'string' ? raw.settings.ollamaModel : base.settings.ollamaModel,
    },
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

function seedDemoIfEmpty(state) {
  if (state.courses.length || state.assignments.length || state.todos.length) return state;
  const c1 = uid();
  const c2 = uid();
  const monday = startOfWeekMonday(new Date());
  const due1 = toYmd(addDays(monday, 3));
  const due2 = toYmd(addDays(monday, 5));
  return {
    ...state,
    courses: [
      { id: c1, name: 'cs capstone', color: DEFAULT_COURSE_COLORS[0], professor: 'tbd', scheduleText: 'tue/thu 2pm' },
      { id: c2, name: 'design studio', color: DEFAULT_COURSE_COLORS[1], professor: '', scheduleText: '' },
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
      },
      {
        id: uid(),
        name: 'reading reflection',
        dueDate: due2,
        courseId: c2,
        completed: false,
        source: 'manual',
        pointsValue: '',
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

  init() {
    this.state = seedDemoIfEmpty(load());
    save(this.state);
  },

  persist() {
    save(this.state);
  },

  getCourse(id) {
    return this.state.courses.find((c) => c.id === id) || null;
  },

  addCourse({ name, professor = '', scheduleText = '' }) {
    const color = DEFAULT_COURSE_COLORS[this.state.courses.length % DEFAULT_COURSE_COLORS.length];
    const course = { id: uid(), name: name.trim(), color, professor: professor.trim(), scheduleText: scheduleText.trim() };
    this.state.courses.push(course);
    this.persist();
    return course;
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

  clearWeekPlansForRange(startYmd, endYmd) {
    this.state.weeklyPlan = this.state.weeklyPlan.filter((p) => p.date < startYmd || p.date > endYmd);
    this.persist();
  },

  updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
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
};
