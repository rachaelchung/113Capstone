/**
 * trackerMain.js — UI for calendar, todos, weekly board, courses + Ollama hooks.
 */

document.addEventListener('DOMContentLoaded', () => {
  TrackerStore.init();

  const els = {
    tabs: document.querySelectorAll('[data-tracker-tab]'),
    panels: document.querySelectorAll('[data-tracker-panel]'),
    coursesRoot: document.getElementById('trackerCourses'),
    calendarRoot: document.getElementById('trackerCalendar'),
    todoRoot: document.getElementById('trackerTodo'),
    weeklyRoot: document.getElementById('trackerWeekly'),
  };

  let activeTab = 'weekly';
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let weekCursor = TrackerStore.startOfWeekMonday(new Date());

  function setTab(name) {
    activeTab = name;
    els.tabs.forEach((btn) => {
      btn.classList.toggle('tracker-tab--active', btn.dataset.trackerTab === name);
    });
    els.panels.forEach((p) => {
      p.hidden = p.dataset.trackerPanel !== name;
    });
    render();
  }

  els.tabs.forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.trackerTab));
  });

  function render() {
    if (activeTab === 'courses') renderCourses();
    if (activeTab === 'calendar') renderCalendar();
    if (activeTab === 'todo') renderTodo();
    if (activeTab === 'weekly') renderWeekly();
  }

  function renderCourses() {
    const root = els.coursesRoot;
    if (!root) return;
    const { courses, assignments, settings } = TrackerStore.state;

    const courseOptions = courses
      .map(
        (c) =>
          `<option value="${escapeAttr(c.id)}">${escapeHtml(c.name)}</option>`,
      )
      .join('');

    root.innerHTML = `
      <h2 class="tracker-h1">courses</h2>
      <p class="tracker-lede">add a course, paste a syllabus, then let local ollama propose dated assignments. you can still edit everything later.</p>

      <form id="courseAddForm" class="tracker-row" style="align-items:flex-end">
        <div class="tracker-field">
          <label class="tracker-label" for="courseName">course name</label>
          <input class="tracker-input" id="courseName" name="name" required maxlength="80" placeholder="e.g. compilers" />
        </div>
        <div class="tracker-field">
          <label class="tracker-label" for="courseProf">professor (optional)</label>
          <input class="tracker-input" id="courseProf" name="prof" maxlength="80" />
        </div>
        <div class="tracker-field" style="flex:2 1 260px">
          <label class="tracker-label" for="courseSched">class time (optional)</label>
          <input class="tracker-input" id="courseSched" name="sched" maxlength="120" placeholder="e.g. mon/wed 10am" />
        </div>
        <button type="submit" class="tracker-btn tracker-btn--small">add course</button>
      </form>

      <div class="tracker-row" style="margin-top:18px">
        <div class="tracker-field">
          <label class="tracker-label" for="syllabusCourse">syllabus → course</label>
          <select class="tracker-select" id="syllabusCourse" ${courses.length ? '' : 'disabled'}>
            ${courses.length ? courseOptions : `<option value="">add a course first</option>`}
          </select>
        </div>
        <div class="tracker-field" style="flex:2 1 280px">
          <label class="tracker-label" for="ollamaBase">ollama base url</label>
          <input class="tracker-input" id="ollamaBase" value="${escapeAttr(settings.ollamaBaseUrl)}" />
        </div>
        <div class="tracker-field">
          <label class="tracker-label" for="ollamaModel">model</label>
          <input class="tracker-input" id="ollamaModel" value="${escapeAttr(settings.ollamaModel)}" />
        </div>
      </div>
      <div class="tracker-field" style="margin-bottom:10px">
        <label class="tracker-label" for="syllabusText">syllabus text</label>
        <textarea class="tracker-textarea" id="syllabusText" placeholder="paste syllabus text here…"></textarea>
      </div>
      <div class="tracker-row">
        <button type="button" class="tracker-btn tracker-btn--mint" id="parseSyllabusBtn" ${courses.length ? '' : 'disabled'}>parse with ollama</button>
        <p class="tracker-status" id="courseStatus" role="status"></p>
      </div>

      <h3 class="tracker-h1" style="margin-top:22px">your courses</h3>
      <div class="tracker-course-grid" id="courseGrid"></div>
      <p class="tracker-footnote">local ai needs ollama running. if the page is not served from localhost, set <code>OLLAMA_ORIGINS</code> on your machine so the browser may call the api (see testing notes).</p>
    `;

    const grid = root.querySelector('#courseGrid');
    grid.innerHTML = courses
      .map((c) => {
        const count = assignments.filter((a) => a.courseId === c.id).length;
        return `
          <article class="tracker-course-card" style="border-left:6px solid ${escapeAttr(c.color)}">
            <h4 class="tracker-course-card__name"><span class="tracker-course-dot" style="background:${escapeAttr(c.color)}"></span>${escapeHtml(c.name)}</h4>
            <p class="tracker-course-card__sub">${c.professor ? escapeHtml(c.professor) + ' · ' : ''}${escapeHtml(c.scheduleText || '')}<br/>${count} assignment${count === 1 ? '' : 's'}</p>
            <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" data-remove-course="${escapeAttr(c.id)}">remove</button>
          </article>`;
      })
      .join('') || `<p class="tracker-lede">no courses yet — add one above.</p>`;

    root.querySelector('#courseAddForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get('name') || '');
      if (!name.trim()) return;
      TrackerStore.addCourse({
        name,
        professor: String(fd.get('prof') || ''),
        scheduleText: String(fd.get('sched') || ''),
      });
      renderCourses();
    });

    root.querySelectorAll('[data-remove-course]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-course');
        if (!id || !window.confirm('remove this course and its assignments?')) return;
        TrackerStore.removeCourse(id);
        renderCourses();
      });
    });

    const statusEl = root.querySelector('#courseStatus');
    const saveSettings = () => {
      const base = root.querySelector('#ollamaBase')?.value?.trim() || settings.ollamaBaseUrl;
      const model = root.querySelector('#ollamaModel')?.value?.trim() || settings.ollamaModel;
      TrackerStore.updateSettings({ ollamaBaseUrl: base, ollamaModel: model });
    };

    root.querySelector('#ollamaBase')?.addEventListener('change', saveSettings);
    root.querySelector('#ollamaModel')?.addEventListener('change', saveSettings);

    root.querySelector('#parseSyllabusBtn')?.addEventListener('click', async () => {
      saveSettings();
      const st = TrackerStore.state;
      const courseId = root.querySelector('#syllabusCourse')?.value;
      const syllabusText = root.querySelector('#syllabusText')?.value || '';
      const course = TrackerStore.getCourse(courseId);
      if (!course || !syllabusText.trim()) {
        setStatus(statusEl, 'pick a course and paste syllabus text.', true);
        return;
      }
      setStatus(statusEl, 'talking to ollama…', false);
      try {
        const rows = await TrackerOllama.parseSyllabus({
          baseUrl: st.settings.ollamaBaseUrl,
          model: st.settings.ollamaModel,
          courseName: course.name,
          syllabusText,
        });
        const added = TrackerStore.addAssignmentsBulk(
          rows.map((r) => ({ ...r, courseId, source: 'syllabus' })),
        );
        setStatus(statusEl, `added ${added.length} assignment${added.length === 1 ? '' : 's'}.`, false, true);
      } catch (err) {
        setStatus(statusEl, err?.message || String(err), true);
      }
    });
  }

  function renderCalendar() {
    const root = els.calendarRoot;
    if (!root) return;
    const { assignments } = TrackerStore.state;
    const first = new Date(calYear, calMonth, 1);
    const monthLabel = first.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const pad = (first.getDay() + 6) % 7;

    const byDate = new Map();
    assignments.forEach((a) => {
      if (!a.dueDate) return;
      if (!byDate.has(a.dueDate)) byDate.set(a.dueDate, []);
      byDate.get(a.dueDate).push(a);
    });

    const cells = [];
    for (let i = 0; i < pad; i += 1) cells.push({ type: 'blank' });
    for (let d = 1; d <= daysInMonth; d += 1) {
      const ymd = TrackerStore.toYmd(new Date(calYear, calMonth, d));
      cells.push({ type: 'day', d, ymd });
    }

    root.innerHTML = `
      <h2 class="tracker-h1">calendar</h2>
      <p class="tracker-lede">dated assignments only (per spec). tap a row to toggle done.</p>
      <div class="tracker-cal-head">
        <span class="tracker-cal-title">${escapeHtml(monthLabel)}</span>
        <div class="tracker-row" style="margin:0">
          <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" id="calPrev">← prev</button>
          <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" id="calNext">next →</button>
        </div>
      </div>
      <div class="tracker-cal-grid" id="calGrid"></div>
    `;

    const grid = root.querySelector('#calGrid');
    grid.innerHTML = cells
      .map((cell) => {
        if (cell.type === 'blank') {
          return `<div class="tracker-cal-day" style="opacity:0.35"></div>`;
        }
        const list = byDate.get(cell.ymd) || [];
        const chips = list
          .map((a) => {
            const c = TrackerStore.getCourse(a.courseId);
            const tag = c ? c.name : 'course';
            return `<button type="button" class="tracker-chip ${a.completed ? 'tracker-chip--done' : ''}" data-toggle-assignment="${escapeAttr(a.id)}" style="border-left:4px solid ${escapeAttr(c?.color || '#ccc')}">
              ${escapeHtml(a.name)}
              <span class="tracker-chip__tag">${escapeHtml(tag)} · due</span>
            </button>`;
          })
          .join('');
        return `<div class="tracker-cal-day">
          <div class="tracker-cal-day__label">${cell.d}</div>
          ${chips || `<span style="font-size:0.7rem;color:var(--text-hint)">free day</span>`}
        </div>`;
      })
      .join('');

    root.querySelector('#calPrev')?.addEventListener('click', () => {
      calMonth -= 1;
      if (calMonth < 0) {
        calMonth = 11;
        calYear -= 1;
      }
      renderCalendar();
    });
    root.querySelector('#calNext')?.addEventListener('click', () => {
      calMonth += 1;
      if (calMonth > 11) {
        calMonth = 0;
        calYear += 1;
      }
      renderCalendar();
    });

    root.querySelectorAll('[data-toggle-assignment]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-assignment');
        if (id) TrackerStore.toggleAssignmentComplete(id);
        renderCalendar();
      });
    });
  }

  function renderTodo() {
    const root = els.todoRoot;
    if (!root) return;
    const { todos } = TrackerStore.state;

    root.innerHTML = `
      <h2 class="tracker-h1">to-do</h2>
      <p class="tracker-lede">undated tasks live here until you drag them into the weekly board (they keep no due date).</p>
      <form id="todoAddForm" class="tracker-row" style="align-items:flex-end">
        <div class="tracker-field" style="flex:2 1 280px">
          <label class="tracker-label" for="todoName">new task</label>
          <input class="tracker-input" id="todoName" maxlength="120" placeholder="e.g. email prof" required />
        </div>
        <button type="submit" class="tracker-btn tracker-btn--small">add</button>
      </form>
      <ul class="tracker-todo-list" id="todoList"></ul>
    `;

    const list = root.querySelector('#todoList');
    list.innerHTML = todos
      .map(
        (t) => `
      <li class="tracker-todo-row ${t.completed ? 'tracker-todo-row--done' : ''}">
        <input type="checkbox" data-todo-check="${escapeAttr(t.id)}" ${t.completed ? 'checked' : ''} />
        <span>${escapeHtml(t.taskName)}</span>
        <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" data-remove-todo="${escapeAttr(t.id)}">remove</button>
      </li>`,
      )
      .join('');

    root.querySelector('#todoAddForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = root.querySelector('#todoName');
      const v = input?.value?.trim();
      if (!v) return;
      TrackerStore.addTodo(v);
      input.value = '';
      renderTodo();
    });

    list.querySelectorAll('[data-todo-check]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-todo-check');
        if (id) TrackerStore.toggleTodo(id);
        renderTodo();
      });
    });

    list.querySelectorAll('[data-remove-todo]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-todo');
        if (id) TrackerStore.removeTodo(id);
        renderTodo();
      });
    });
  }

  function renderWeekly() {
    const root = els.weeklyRoot;
    if (!root) return;
    const { assignments, todos, weeklyPlan, settings } = TrackerStore.state;
    const weekDays = TrackerStore.weekRangeFromMonday(weekCursor);
    const weekLabel = `${weekDays[0]} → ${weekDays[6]}`;

    const draggables = [
      ...assignments
        .filter((a) => !a.completed)
        .map((a) => {
          const c = TrackerStore.getCourse(a.courseId);
          return {
            kind: 'assignment',
            id: a.id,
            label: a.name,
            color: c?.color || '#999',
          };
        }),
      ...todos
        .filter((t) => !t.completed)
        .map((t) => ({
          kind: 'todo',
          id: t.id,
          label: t.taskName,
          color: '#9a9085',
        })),
    ];

    const dayLabels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    root.innerHTML = `
      <h2 class="tracker-h1">weekly view</h2>
      <p class="tracker-lede">drag assignments or to-dos onto a day. planned sub-tasks (like "read 5 pages") stay here only — they do not change real due dates.</p>
      <div class="tracker-week-nav">
        <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" id="wkPrev">← prev week</button>
        <span class="tracker-cal-title">${escapeHtml(weekLabel)}</span>
        <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" id="wkNext">next week →</button>
        <button type="button" class="tracker-btn tracker-btn--mint tracker-btn--small" id="wkAiBtn">ask ollama for suggestions</button>
        <p class="tracker-status" id="wkStatus" role="status"></p>
      </div>
      <div class="tracker-week-grid" id="wkGrid"></div>
      <div class="tracker-pool">
        <p class="tracker-pool__title">backlog — drag into a day</p>
        <div id="wkPool">
          ${draggables
            .map((d) => {
              const cls = d.kind === 'todo' ? 'tracker-drag tracker-drag--todo' : 'tracker-drag';
              return `<span class="${cls}" draggable="true" data-ref-type="${escapeAttr(d.kind)}" data-ref-id="${escapeAttr(d.id)}"><span class="tracker-drag__dot" style="background:${escapeAttr(d.color)}"></span>${escapeHtml(d.label)}</span>`;
            })
            .join('') || `<span style="font-size:0.8rem;color:var(--text-muted)">nothing left to drag — nice.</span>`}
        </div>
      </div>
      <p class="tracker-footnote">double-click a planned chip to remove it from the week (the assignment or to-do itself stays).</p>
    `;

    const wkGrid = root.querySelector('#wkGrid');
    wkGrid.innerHTML = weekDays
      .map((ymd, i) => {
        const plans = weeklyPlan.filter((p) => p.date === ymd);
        const chips = plans
          .map((p) => {
            let title = '';
            let color = '#ccc';
            if (p.refType === 'assignment') {
              const a = assignments.find((x) => x.id === p.refId);
              title = a?.name || 'assignment';
              color = TrackerStore.getCourse(a?.courseId)?.color || '#ccc';
            } else {
              const t = todos.find((x) => x.id === p.refId);
              title = t?.taskName || 'to-do';
              color = '#9a9085';
            }
            const sub = p.subTaskDescription
              ? `<span class="tracker-plan-chip__sub">${escapeHtml(p.subTaskDescription)}</span>`
              : '';
            return `<div class="tracker-plan-chip" style="border-left:4px solid ${escapeAttr(color)}" data-plan-id="${escapeAttr(p.id)}" title="double-click to remove">
              ${escapeHtml(title)}${sub}
            </div>`;
          })
          .join('');
        return `<div class="tracker-week-col" data-drop-date="${escapeAttr(ymd)}">
          <div class="tracker-week-col__head">${dayLabels[i]} · ${escapeHtml(ymd.slice(5))}</div>
          ${chips}
        </div>`;
      })
      .join('');

    root.querySelector('#wkPrev')?.addEventListener('click', () => {
      weekCursor = TrackerStore.addDays(weekCursor, -7);
      renderWeekly();
    });
    root.querySelector('#wkNext')?.addEventListener('click', () => {
      weekCursor = TrackerStore.addDays(weekCursor, 7);
      renderWeekly();
    });

    const wkStatus = root.querySelector('#wkStatus');
    root.querySelector('#wkAiBtn')?.addEventListener('click', async () => {
      TrackerStore.updateSettings({
        ollamaBaseUrl: document.getElementById('ollamaBase')?.value?.trim() || settings.ollamaBaseUrl,
        ollamaModel: document.getElementById('ollamaModel')?.value?.trim() || settings.ollamaModel,
      });
      const st = TrackerStore.state;
      const monday = weekCursor;
      const sunday = TrackerStore.addDays(monday, 6);
      const monY = TrackerStore.toYmd(monday);
      const sunY = TrackerStore.toYmd(sunday);
      const horizon = TrackerStore.addDays(sunday, 7);
      const horizonY = TrackerStore.toYmd(horizon);

      const relevant = st.assignments.filter((a) => {
        if (a.completed) return false;
        return a.dueDate >= monY && a.dueDate <= horizonY;
      });

      const existing = st.weeklyPlan.filter((p) => p.date >= monY && p.date <= sunY);
      setStatus(wkStatus, 'asking ollama…', false);
      try {
        const sug = await TrackerOllama.suggestWeeklyBreakdown({
          baseUrl: st.settings.ollamaBaseUrl,
          model: st.settings.ollamaModel,
          weekStartYmd: monY,
          assignments: relevant,
          existingPlans: existing,
        });
        let n = 0;
        sug.forEach((s) => {
          if (!weekDays.includes(s.date)) return;
          const exists = TrackerStore.state.weeklyPlan.some(
            (p) =>
              p.date === s.date &&
              p.refType === 'assignment' &&
              p.refId === s.assignmentId &&
              p.subTaskDescription === s.subTaskDescription,
          );
          if (exists) return;
          TrackerStore.addWeeklyPlan({
            dateYmd: s.date,
            refType: 'assignment',
            refId: s.assignmentId,
            subTaskDescription: s.subTaskDescription,
          });
          n += 1;
        });
        setStatus(wkStatus, `added ${n} suggestion${n === 1 ? '' : 's'} to the week.`, false, true);
      } catch (err) {
        setStatus(wkStatus, err?.message || String(err), true);
      }
      renderWeekly();
    });

    root.querySelectorAll('[data-plan-id]').forEach((el) => {
      el.addEventListener('dblclick', () => {
        const id = el.getAttribute('data-plan-id');
        if (id) TrackerStore.removeWeeklyPlan(id);
        renderWeekly();
      });
    });

    root.querySelectorAll('.tracker-week-col').forEach((col) => {
      const date = col.getAttribute('data-drop-date');
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('tracker-week-col--drop');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('tracker-week-col--drop');
      });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('tracker-week-col--drop');
        const raw = e.dataTransfer?.getData('text/plain');
        if (!raw || !date) return;
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          return;
        }
        if (!payload?.refType || !payload.refId) return;
        TrackerStore.addWeeklyPlan({
          dateYmd: date,
          refType: payload.refType,
          refId: payload.refId,
          subTaskDescription: '',
        });
        renderWeekly();
      });
    });

    root.querySelectorAll('[data-ref-type][data-ref-id]').forEach((el) => {
      el.addEventListener('dragstart', (e) => {
        const refType = el.getAttribute('data-ref-type');
        const refId = el.getAttribute('data-ref-id');
        if (!refType || !refId) return;
        const payload = JSON.stringify({ refType, refId });
        e.dataTransfer?.setData('text/plain', payload);
        e.dataTransfer.effectAllowed = 'copyMove';
      });
    });
  }

  function setStatus(el, text, isErr, isOk) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('tracker-status--err', 'tracker-status--ok');
    if (isErr) el.classList.add('tracker-status--err');
    if (isOk) el.classList.add('tracker-status--ok');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  // Fix calendar cell bug: used cell.md instead of cell.ymd
  // I'll patch renderCalendar - I used cell.md in byDate.get - wrong variable name

  setTab('weekly');
});
