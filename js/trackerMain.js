/**
 * trackerMain.js — UI for calendar, todos, weekly board, courses + backend AI.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await TrackerStore.init();

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
  let coursesDetailId = null;
  let coursesAddOpen = false;
  /** Active sub-tab inside the course modal: `info` | `assignments` | `grades`. */
  let courseDetailTab = 'info';
  /** Shown once at top of course detail modal (e.g. syllabus file format hint). */
  let courseDetailFlash = null;

  const courseDetailHost = document.getElementById('courseDetailModalHost');
  const addCourseHost = document.getElementById('addCourseModalHost');

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

  window.HeadEmptyTracker = {
    setTab,
    getActiveTab: () => activeTab,
  };

  function render() {
    if (activeTab === 'courses') renderCourses();
    if (activeTab === 'calendar') renderCalendar();
    if (activeTab === 'todo') renderTodo();
    if (activeTab === 'weekly') renderWeekly();
  }

  function closeCourseModals() {
    coursesDetailId = null;
    coursesAddOpen = false;
    if (courseDetailHost) {
      courseDetailHost.hidden = true;
      courseDetailHost.innerHTML = '';
    }
    if (addCourseHost) {
      addCourseHost.hidden = true;
      addCourseHost.innerHTML = '';
    }
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('could not read file'));
      r.readAsText(file);
    });
  }

  function isPdfFile(file) {
    if (!file || !file.name) return false;
    if ((file.type || '').toLowerCase() === 'application/pdf') return true;
    return file.name.toLowerCase().endsWith('.pdf');
  }

  /** If text is clearly not parseable syllabus text, return a user hint; otherwise null. */
  function syllabusBinaryHint(text) {
    const t = String(text || '');
    if (t.startsWith('%PDF')) {
      return 'that file looks like a pdf but was not sent as a .pdf (rename to .pdf or pick pdf again), or save as plain text.';
    }
    if (t.length >= 2 && t.charCodeAt(0) === 0x50 && t.charCodeAt(1) === 0x4b) {
      return 'that file looks like a word (.docx) or zip-based document. save as plain text (.txt) or web page (.html), then try again.';
    }
    if (t.includes('\0')) {
      return 'that file looks binary. use a .txt, .md, or .html export of your syllabus.';
    }
    return null;
  }

  function renderCourseDetailModal() {
    if (!courseDetailHost || !coursesDetailId) return;
    const course = TrackerStore.getCourse(coursesDetailId);
    if (!course) {
      closeCourseModals();
      return;
    }
    const cats = Array.isArray(course.gradeCategories) ? course.gradeCategories : [];
    const weightSum = cats.reduce((s, c) => s + (Number(c.weightPercent) || 0), 0);
    const gradeSnap = TrackerStore.courseGradeSnapshot(course.id);
    let gradeValueText = '—';
    const gradeNoteParts = [];
    if (gradeSnap.percent != null) {
      gradeValueText = `${Math.round(gradeSnap.percent * 10) / 10}%`;
      if (gradeSnap.isPartial) {
        gradeNoteParts.push(
          'partial: categories with no scored rows yet are omitted; remaining category weights are renormalized.',
        );
      }
    } else if (gradeSnap.reason) {
      gradeNoteParts.push(gradeSnap.reason);
    }
    gradeNoteParts.push('blank max or earned fields are ignored for the average.');
    const gradeNoteHtml = `<p class="tracker-syllabus-hint tracker-grade-current-note">${gradeNoteParts
      .map((t) => escapeHtml(t))
      .join(' ')}</p>`;
    const flashMsg = courseDetailFlash;
    courseDetailFlash = null;
    const { assignments } = TrackerStore.state;
    const list = assignments.filter((a) => a.courseId === course.id);
    const assignRows = list
      .map(
        (a) => `
      <tr data-assignment-id="${escapeAttr(a.id)}">
        <td><input type="text" class="js-asg-name" value="${escapeAttr(a.name)}" aria-label="assignment name" /></td>
        <td><input type="date" class="js-asg-due" value="${escapeAttr(a.dueDate)}" aria-label="due date" /></td>
        <td><input type="text" class="js-asg-pts" value="${escapeAttr(a.pointsValue)}" aria-label="points" /></td>
        <td style="text-align:center"><input type="checkbox" class="js-asg-done" ${a.completed ? 'checked' : ''} aria-label="done" /></td>
        <td><button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--table js-asg-del">remove</button></td>
      </tr>`,
      )
      .join('');

    const catRowsHtml = cats
      .map(
        (c) => `
      <tr data-grade-cat-id="${escapeAttr(c.id)}">
        <td><input type="text" class="tracker-input js-cat-name" value="${escapeAttr(c.name)}" aria-label="category name" maxlength="80" /></td>
        <td><input type="number" class="tracker-input js-cat-weight" value="${escapeAttr(String(c.weightPercent))}" min="0" max="100" step="0.1" aria-label="weight percent" /></td>
        <td><button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--table js-cat-del">remove</button></td>
      </tr>`,
      )
      .join('');

    const gradeAssignRows = list
      .map((a) => {
        const opts = ['<option value="">(none)</option>'].concat(
          cats.map((c) => `<option value="${escapeAttr(c.id)}" ${a.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`),
        );
        return `
      <tr data-grade-asg-id="${escapeAttr(a.id)}">
        <td class="tracker-grade-asg-name">${escapeHtml(a.name)}</td>
        <td>
          <select class="tracker-select js-grade-asg-cat" aria-label="grade category">${opts.join('')}</select>
        </td>
        <td><input type="text" class="tracker-input js-grade-asg-max" value="${escapeAttr(a.pointsValue)}" maxlength="24" aria-label="max points" title="max points for this assignment (saved with save grades)" /></td>
        <td><input type="text" class="tracker-input js-grade-asg-earned" value="${escapeAttr(a.earnedPoints)}" maxlength="24" aria-label="earned points" /></td>
      </tr>`;
      })
      .join('');

    const tabInfoActive = courseDetailTab === 'info';
    const tabAsgActive = courseDetailTab === 'assignments';
    const tabGradesActive = courseDetailTab === 'grades';

    courseDetailHost.innerHTML = `
      <div class="tracker-modal-panel tracker-modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="courseDetailTitle">
        <button type="button" class="tracker-modal-close" id="courseDetailClose" aria-label="close">×</button>
        <h2 class="tracker-modal-title" id="courseDetailTitle">${escapeHtml(course.name)}</h2>
        <p class="tracker-modal-lede">use the tabs to edit course info, dated assignments, and grade weights / scores.</p>
        ${flashMsg ? `<p class="tracker-status tracker-status--err" role="alert">${escapeHtml(flashMsg)}</p>` : ''}
        <div class="course-modal-tabs" role="tablist" aria-label="course sections">
          <button type="button" role="tab" class="course-modal-tab ${tabInfoActive ? 'course-modal-tab--active' : ''}" data-course-tab="info" aria-selected="${tabInfoActive}">course info</button>
          <button type="button" role="tab" class="course-modal-tab ${tabAsgActive ? 'course-modal-tab--active' : ''}" data-course-tab="assignments" aria-selected="${tabAsgActive}">assignments</button>
          <button type="button" role="tab" class="course-modal-tab ${tabGradesActive ? 'course-modal-tab--active' : ''}" data-course-tab="grades" aria-selected="${tabGradesActive}">grades</button>
        </div>

        <div class="course-modal-panel" data-course-panel="info" ${tabInfoActive ? '' : 'hidden'}>
          <div class="tracker-field">
            <label class="tracker-label" for="detailName">course name</label>
            <input class="tracker-input" id="detailName" value="${escapeAttr(course.name)}" maxlength="80" />
          </div>
          <div class="tracker-row">
            <div class="tracker-field">
              <label class="tracker-label" for="detailProf">professor</label>
              <input class="tracker-input" id="detailProf" value="${escapeAttr(course.professor)}" maxlength="80" />
            </div>
            <div class="tracker-field" style="flex:2 1 220px">
              <label class="tracker-label" for="detailSched">class time</label>
              <input class="tracker-input" id="detailSched" value="${escapeAttr(course.scheduleText)}" maxlength="120" />
            </div>
          </div>
          <button type="button" class="tracker-btn tracker-btn--small" id="detailSaveCourse">save course info</button>
          <div class="tracker-modal-actions" style="border-top:none;padding-top:18px;margin-top:18px">
            <button type="button" class="tracker-btn tracker-btn--secondary tracker-modal-danger" id="detailDeleteCourse">delete course</button>
          </div>
        </div>

        <div class="course-modal-panel" data-course-panel="assignments" ${tabAsgActive ? '' : 'hidden'}>
          <p class="tracker-modal-lede" style="margin-top:0">deadlines and points. extract from a syllabus file adds rows; optionally refresh grading weights when the model finds them.</p>
          <table class="tracker-assign-table">
            <thead><tr><th>name</th><th>due</th><th>pts</th><th>done</th><th></th></tr></thead>
            <tbody id="detailAssignBody">${assignRows || ''}</tbody>
          </table>
          <div class="tracker-row" style="align-items:flex-end;margin-top:8px">
            <div class="tracker-field" style="flex:2 1 200px">
              <label class="tracker-label" for="newAsgName">new assignment</label>
              <input class="tracker-input" id="newAsgName" placeholder="name" maxlength="120" />
            </div>
            <div class="tracker-field">
              <label class="tracker-label" for="newAsgDue">due</label>
              <input class="tracker-input" id="newAsgDue" type="date" />
            </div>
            <div class="tracker-field">
              <label class="tracker-label" for="newAsgPts">pts</label>
              <input class="tracker-input" id="newAsgPts" placeholder="optional" maxlength="24" />
            </div>
            <button type="button" class="tracker-btn tracker-btn--small" id="newAsgAdd">add</button>
          </div>
          <p class="tracker-status" id="detailSyllabusStatus" role="status"></p>
          <div class="tracker-field" style="margin-top:12px">
            <label class="tracker-label" for="detailSyllabusFile">syllabus file</label>
            <input type="file" id="detailSyllabusFile" class="tracker-file-input" />
          </div>
          <label class="tracker-check-row">
            <input type="checkbox" id="detailSyllabusReplaceWeights" checked />
            <span>replace grading weights when the syllabus lists them</span>
          </label>
          <p class="tracker-syllabus-hint">.pdf syllabi are read on the server; .txt / .md / .html also work in the browser. word (.docx) still needs a text or html export.</p>
          <div class="tracker-modal-actions" style="border-top:none;padding-top:12px">
            <button type="button" class="tracker-btn tracker-btn--secondary" id="detailSaveAssignments">save assignments</button>
            <button type="button" class="tracker-btn tracker-btn--mint tracker-btn--small" id="detailParseFile">extract from file</button>
          </div>
        </div>

        <div class="course-modal-panel" data-course-panel="grades" ${tabGradesActive ? '' : 'hidden'}>
          <div class="tracker-grade-current" role="status" aria-live="polite">
            <span class="tracker-grade-current-label">current grade</span>
            <span class="tracker-grade-current-value">${escapeHtml(gradeValueText)}</span>
            ${gradeNoteHtml}
          </div>
          <p class="tracker-modal-lede" style="margin-top:0">set category weights (percent of final). they usually sum to 100. you can paste weights from the syllabus using extract on the assignments tab, or edit here.</p>
          <p class="tracker-status" id="detailGradeWeightSum" aria-live="polite">weights total: ${escapeHtml(String(Math.round(weightSum * 1000) / 1000))}%</p>
          <table class="tracker-assign-table tracker-grade-cat-table">
            <thead><tr><th>category</th><th>weight %</th><th></th></tr></thead>
            <tbody id="detailGradeCatBody">${catRowsHtml || ''}</tbody>
          </table>
          <div class="tracker-row" style="align-items:flex-end;margin-top:8px">
            <div class="tracker-field" style="flex:2 1 200px">
              <label class="tracker-label" for="detailNewCatName">new category</label>
              <input class="tracker-input" id="detailNewCatName" placeholder="e.g. exams" maxlength="80" />
            </div>
            <div class="tracker-field">
              <label class="tracker-label" for="detailNewCatWeight">weight %</label>
              <input class="tracker-input" id="detailNewCatWeight" type="number" min="0" max="100" step="0.1" value="0" />
            </div>
            <button type="button" class="tracker-btn tracker-btn--small" id="detailNewCatAdd">add category</button>
          </div>
          <h3 class="tracker-h1" style="margin:18px 0 8px">scores by assignment</h3>
          <p class="tracker-syllabus-hint" style="margin-top:0">link each row to a category; enter max and earned here (or max on the assignments tab). click save grades to persist.</p>
          <table class="tracker-assign-table">
            <thead><tr><th>assignment</th><th>category</th><th>max pts</th><th>earned</th></tr></thead>
            <tbody id="detailGradeAsgBody">${gradeAssignRows || ''}</tbody>
          </table>
          <div class="tracker-modal-actions" style="border-top:none;padding-top:12px">
            <button type="button" class="tracker-btn" id="detailSaveGrades">save grades</button>
          </div>
        </div>
      </div>`;
    courseDetailHost.hidden = false;

    courseDetailHost.querySelectorAll('[data-course-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-course-tab');
        if (t === 'info' || t === 'assignments' || t === 'grades') {
          courseDetailTab = t;
          renderCourseDetailModal();
        }
      });
    });

    courseDetailHost.querySelector('#courseDetailClose')?.addEventListener('click', () => {
      closeCourseModals();
      renderCourses();
    });

    courseDetailHost.querySelector('#detailSaveCourse')?.addEventListener('click', () => {
      const name = courseDetailHost.querySelector('#detailName')?.value?.trim();
      const professor = courseDetailHost.querySelector('#detailProf')?.value ?? '';
      const scheduleText = courseDetailHost.querySelector('#detailSched')?.value ?? '';
      if (!name) return;
      TrackerStore.updateCourse(course.id, { name, professor, scheduleText });
      coursesDetailId = course.id;
      renderCourseDetailModal();
      renderCourses();
    });

    courseDetailHost.querySelector('#detailSaveAssignments')?.addEventListener('click', () => {
      courseDetailHost.querySelectorAll('tr[data-assignment-id]').forEach((tr) => {
        const id = tr.getAttribute('data-assignment-id');
        if (!id) return;
        const name = tr.querySelector('.js-asg-name')?.value?.trim();
        const dueDate = tr.querySelector('.js-asg-due')?.value;
        const pointsValue = tr.querySelector('.js-asg-pts')?.value ?? '';
        const completed = !!tr.querySelector('.js-asg-done')?.checked;
        if (name && dueDate) {
          TrackerStore.updateAssignment(id, { name, dueDate, pointsValue, completed });
        }
      });
      renderCourseDetailModal();
      renderCourses();
    });

    courseDetailHost.querySelectorAll('.js-asg-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr[data-assignment-id]');
        const id = tr?.getAttribute('data-assignment-id');
        if (id) TrackerStore.deleteAssignment(id);
        renderCourseDetailModal();
        renderCourses();
      });
    });

    courseDetailHost.querySelector('#newAsgAdd')?.addEventListener('click', () => {
      const name = courseDetailHost.querySelector('#newAsgName')?.value?.trim();
      const dueDate = courseDetailHost.querySelector('#newAsgDue')?.value;
      const pointsValue = courseDetailHost.querySelector('#newAsgPts')?.value ?? '';
      if (!name || !dueDate) return;
      TrackerStore.addAssignment({ courseId: course.id, name, dueDate, pointsValue, source: 'manual' });
      renderCourseDetailModal();
      renderCourses();
    });

    const stEl = courseDetailHost.querySelector('#detailSyllabusStatus');
    courseDetailHost.querySelector('#detailParseFile')?.addEventListener('click', async () => {
      const input = courseDetailHost.querySelector('#detailSyllabusFile');
      const file = input?.files?.[0];
      if (!file) {
        setStatus(stEl, 'choose a file first.', true);
        return;
      }
      const replaceWeights = !!courseDetailHost.querySelector('#detailSyllabusReplaceWeights')?.checked;
      try {
        let parsed;
        if (isPdfFile(file)) {
          setStatus(stEl, 'uploading pdf…', false);
          parsed = await TrackerApi.parseSyllabus(course.name, { pdfFile: file });
        } else {
          setStatus(stEl, 'reading…', false);
          const text = await readFileAsText(file);
          if (!text.trim()) {
            setStatus(stEl, 'file was empty.', true);
            return;
          }
          const binHint = syllabusBinaryHint(text);
          if (binHint) {
            setStatus(stEl, binHint, true);
            return;
          }
          setStatus(stEl, 'extracting…', false);
          parsed = await TrackerApi.parseSyllabus(course.name, text);
        }
        const rows = parsed.assignments || [];
        const added = TrackerStore.addAssignmentsBulk(
          rows.map((r) => ({ ...r, courseId: course.id, source: 'syllabus' })),
        );
        let msg = `added ${added.length} assignment row${added.length === 1 ? '' : 's'}.`;
        const gc = parsed.gradingCategories || [];
        if (replaceWeights && gc.length) {
          TrackerStore.replaceCourseGradeCategoriesFromSyllabus(course.id, gc);
          msg += ` applied ${gc.length} grading categor${gc.length === 1 ? 'y' : 'ies'} from the file.`;
        } else if (gc.length && !replaceWeights) {
          msg += ` found ${gc.length} grading categor${gc.length === 1 ? 'y' : 'ies'} (checkbox off — weights unchanged).`;
        }
        setStatus(stEl, msg, false, true);
        input.value = '';
        renderCourseDetailModal();
        renderCourses();
      } catch (e) {
        setStatus(stEl, e?.message || String(e), true);
      }
    });

    courseDetailHost.querySelector('#detailNewCatAdd')?.addEventListener('click', () => {
      const name = courseDetailHost.querySelector('#detailNewCatName')?.value?.trim();
      const weightRaw = courseDetailHost.querySelector('#detailNewCatWeight')?.value ?? '0';
      const weightPercent = Number(weightRaw);
      if (!name) return;
      TrackerStore.addGradeCategory(course.id, { name, weightPercent: Number.isFinite(weightPercent) ? weightPercent : 0 });
      courseDetailTab = 'grades';
      renderCourseDetailModal();
      renderCourses();
    });

    courseDetailHost.querySelectorAll('.js-cat-del').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tr = btn.closest('tr[data-grade-cat-id]');
        const id = tr?.getAttribute('data-grade-cat-id');
        if (id) TrackerStore.removeGradeCategory(course.id, id);
        courseDetailTab = 'grades';
        renderCourseDetailModal();
        renderCourses();
      });
    });

    courseDetailHost.querySelector('#detailSaveGrades')?.addEventListener('click', () => {
      courseDetailHost.querySelectorAll('tr[data-grade-cat-id]').forEach((tr) => {
        const id = tr.getAttribute('data-grade-cat-id');
        if (!id) return;
        const name = tr.querySelector('.js-cat-name')?.value?.trim();
        const w = Number(tr.querySelector('.js-cat-weight')?.value ?? '0');
        if (!name) return;
        TrackerStore.updateGradeCategory(course.id, id, {
          name,
          weightPercent: Number.isFinite(w) ? w : 0,
        });
      });
      courseDetailHost.querySelectorAll('tr[data-grade-asg-id]').forEach((tr) => {
        const id = tr.getAttribute('data-grade-asg-id');
        if (!id) return;
        const categoryId = tr.querySelector('.js-grade-asg-cat')?.value ?? '';
        const pointsValue = tr.querySelector('.js-grade-asg-max')?.value ?? '';
        const earnedPoints = tr.querySelector('.js-grade-asg-earned')?.value ?? '';
        TrackerStore.updateAssignment(id, { categoryId, pointsValue, earnedPoints });
      });
      courseDetailTab = 'grades';
      renderCourseDetailModal();
      renderCourses();
    });

    courseDetailHost.querySelector('#detailDeleteCourse')?.addEventListener('click', () => {
      if (!window.confirm('delete this course and all its assignments?')) return;
      TrackerStore.removeCourse(course.id);
      closeCourseModals();
      renderCourses();
    });

    courseDetailHost.onclick = (e) => {
      if (e.target === courseDetailHost) {
        closeCourseModals();
        renderCourses();
      }
    };
  }

  function renderAddCourseModal() {
    if (!addCourseHost || !coursesAddOpen) return;
    addCourseHost.innerHTML = `
      <div class="tracker-modal-panel tracker-modal-panel--wide" role="dialog" aria-modal="true" aria-labelledby="addCourseTitle">
        <button type="button" class="tracker-modal-close" id="addCourseClose" aria-label="close">×</button>
        <h2 class="tracker-modal-title" id="addCourseTitle">new course</h2>
        <p class="tracker-modal-lede">fill in the course, add any assignments by hand, or attach a syllabus file to extract deadlines after the course is created.</p>
        <div class="tracker-field">
          <label class="tracker-label" for="addName">course name</label>
          <input class="tracker-input" id="addName" maxlength="80" required />
        </div>
        <div class="tracker-row">
          <div class="tracker-field">
            <label class="tracker-label" for="addProf">professor</label>
            <input class="tracker-input" id="addProf" maxlength="80" />
          </div>
          <div class="tracker-field" style="flex:2 1 220px">
            <label class="tracker-label" for="addSched">class time</label>
            <input class="tracker-input" id="addSched" maxlength="120" />
          </div>
        </div>
        <h3 class="tracker-h1" style="margin:16px 0 8px">assignments (optional)</h3>
        <div id="addAssignRows"></div>
        <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small" id="addAssignRowBtn">+ add assignment row</button>
        <div class="tracker-field" style="margin-top:14px">
          <label class="tracker-label" for="addSyllabusFile">syllabus file (optional)</label>
          <input type="file" id="addSyllabusFile" class="tracker-file-input" />
        </div>
        <p class="tracker-syllabus-hint">.pdf is extracted on the server; .txt / .md / .html work from the browser. scanned-only pdfs may fail.</p>
        <p class="tracker-status" id="addCourseStatus" role="status"></p>
        <div class="tracker-modal-actions">
          <button type="button" class="tracker-btn" id="addCourseSubmit">create course</button>
          <button type="button" class="tracker-btn tracker-btn--secondary" id="addCourseCancel">cancel</button>
        </div>
      </div>`;
    addCourseHost.hidden = false;

    const rowsEl = addCourseHost.querySelector('#addAssignRows');

    function appendAssignRow(name = '', due = '', pts = '') {
      const row = document.createElement('div');
      row.className = 'tracker-row';
      row.style.alignItems = 'flex-end';
      row.style.marginBottom = '8px';
      row.innerHTML = `
        <div class="tracker-field" style="flex:2 1 180px">
          <label class="tracker-label">name</label>
          <input type="text" class="tracker-input js-add-asg-name" value="${escapeAttr(name)}" maxlength="120" />
        </div>
        <div class="tracker-field">
          <label class="tracker-label">due</label>
          <input type="date" class="tracker-input js-add-asg-due" value="${escapeAttr(due)}" />
        </div>
        <div class="tracker-field">
          <label class="tracker-label">pts</label>
          <input type="text" class="tracker-input js-add-asg-pts" value="${escapeAttr(pts)}" maxlength="24" />
        </div>
        <button type="button" class="tracker-btn tracker-btn--secondary tracker-btn--small js-add-asg-rm">×</button>`;
      row.querySelector('.js-add-asg-rm')?.addEventListener('click', () => row.remove());
      rowsEl.appendChild(row);
    }

    appendAssignRow();

    addCourseHost.querySelector('#addAssignRowBtn')?.addEventListener('click', () => appendAssignRow());

    function closeAdd() {
      coursesAddOpen = false;
      addCourseHost.hidden = true;
      addCourseHost.innerHTML = '';
      renderCourses();
    }

    addCourseHost.querySelector('#addCourseClose')?.addEventListener('click', closeAdd);
    addCourseHost.querySelector('#addCourseCancel')?.addEventListener('click', closeAdd);
    addCourseHost.onclick = (e) => {
      if (e.target === addCourseHost) closeAdd();
    };

    const addSt = addCourseHost.querySelector('#addCourseStatus');
    addCourseHost.querySelector('#addCourseSubmit')?.addEventListener('click', async () => {
      const name = addCourseHost.querySelector('#addName')?.value?.trim();
      if (!name) {
        setStatus(addSt, 'course name is required.', true);
        return;
      }
      const professor = addCourseHost.querySelector('#addProf')?.value ?? '';
      const scheduleText = addCourseHost.querySelector('#addSched')?.value ?? '';
      const course = TrackerStore.addCourse({ name, professor, scheduleText });

      addCourseHost.querySelectorAll('#addAssignRows .tracker-row').forEach((row) => {
        const nm = row.querySelector('.js-add-asg-name')?.value?.trim();
        const due = row.querySelector('.js-add-asg-due')?.value;
        const pts = row.querySelector('.js-add-asg-pts')?.value ?? '';
        if (nm && due) TrackerStore.addAssignment({ courseId: course.id, name: nm, dueDate: due, pointsValue: pts, source: 'manual' });
      });

      const file = addCourseHost.querySelector('#addSyllabusFile')?.files?.[0];
      if (file) {
        try {
          if (isPdfFile(file)) {
            setStatus(addSt, 'uploading pdf…', false);
            const parsed = await TrackerApi.parseSyllabus(course.name, { pdfFile: file });
            const rows = parsed.assignments || [];
            TrackerStore.addAssignmentsBulk(rows.map((r) => ({ ...r, courseId: course.id, source: 'syllabus' })));
            const gc = parsed.gradingCategories || [];
            if (gc.length) TrackerStore.replaceCourseGradeCategoriesFromSyllabus(course.id, gc);
          } else {
            setStatus(addSt, 'reading syllabus…', false);
            const text = await readFileAsText(file);
            const binHint = syllabusBinaryHint(text);
            if (binHint) {
              courseDetailFlash = binHint;
              coursesAddOpen = false;
              addCourseHost.hidden = true;
              addCourseHost.innerHTML = '';
              coursesDetailId = course.id;
              renderCourses();
              renderCourseDetailModal();
              return;
            }
            if (text.trim()) {
              setStatus(addSt, 'extracting deadlines…', false);
              const parsed = await TrackerApi.parseSyllabus(course.name, text);
              const rows = parsed.assignments || [];
              TrackerStore.addAssignmentsBulk(rows.map((r) => ({ ...r, courseId: course.id, source: 'syllabus' })));
              const gc = parsed.gradingCategories || [];
              if (gc.length) TrackerStore.replaceCourseGradeCategoriesFromSyllabus(course.id, gc);
            }
          }
        } catch (err) {
          setStatus(addSt, err?.message || String(err), true);
          coursesAddOpen = false;
          addCourseHost.hidden = true;
          addCourseHost.innerHTML = '';
          coursesDetailId = course.id;
          renderCourses();
          return;
        }
      }

      coursesAddOpen = false;
      addCourseHost.hidden = true;
      addCourseHost.innerHTML = '';
      coursesDetailId = course.id;
      renderCourses();
    });
  }

  function renderCourses() {
    const root = els.coursesRoot;
    if (!root) return;
    const { courses, assignments } = TrackerStore.state;

    const strip = courses
      .map((c) => {
        const count = assignments.filter((a) => a.courseId === c.id).length;
        return `<button type="button" class="courses-card" data-open-course="${escapeAttr(c.id)}">
          <div class="courses-card__name">
            <span class="courses-card__dot" style="background:${escapeAttr(c.color)}"></span>
            ${escapeHtml(c.name)}
          </div>
          <p class="courses-card__meta">${c.professor ? escapeHtml(c.professor) + ' · ' : ''}${escapeHtml(c.scheduleText || 'no schedule yet')}</p>
          <p class="courses-card__meta">${count} assignment${count === 1 ? '' : 's'}</p>
        </button>`;
      })
      .join('');

    root.innerHTML = `
      <div class="tracker-courses-wrap">
        <h2 class="tracker-h1">courses</h2>
        <p class="tracker-lede">tap a course to view details, assignments, and edits. use the plus button to add a new course.</p>
        <div class="courses-strip" id="coursesStrip">
          ${strip || '<p class="courses-empty">no courses yet — tap + to add one.</p>'}
        </div>
        <button type="button" class="courses-fab" id="coursesFab" aria-label="add course">+</button>
      </div>`;

    root.querySelectorAll('[data-open-course]').forEach((btn) => {
      btn.addEventListener('click', () => {
        coursesDetailId = btn.getAttribute('data-open-course');
        courseDetailTab = 'info';
        coursesAddOpen = false;
        if (addCourseHost) {
          addCourseHost.hidden = true;
          addCourseHost.innerHTML = '';
        }
        renderCourses();
      });
    });

    root.querySelector('#coursesFab')?.addEventListener('click', () => {
      coursesAddOpen = true;
      coursesDetailId = null;
      if (courseDetailHost) {
        courseDetailHost.hidden = true;
        courseDetailHost.innerHTML = '';
      }
      renderCourses();
    });

    if (coursesDetailId) renderCourseDetailModal();
    else if (courseDetailHost) {
      courseDetailHost.hidden = true;
      courseDetailHost.innerHTML = '';
    }

    if (coursesAddOpen) renderAddCourseModal();
    else if (addCourseHost) {
      addCourseHost.hidden = true;
      addCourseHost.innerHTML = '';
    }
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
        <button type="button" class="tracker-btn tracker-btn--mint tracker-btn--small" id="wkAiBtn">ask ai for suggestions</button>
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
      <p class="tracker-footnote">drag the ⋮ handle to move a chip to another day. × removes it from this week only (not from your list). check the box when that slice is done.</p>
    `;

    const wkGrid = root.querySelector('#wkGrid');
    wkGrid.innerHTML = weekDays
      .map((ymd, i) => {
        const plans = weeklyPlan.filter((p) => p.date === ymd);
        const chips = plans
          .map((p) => {
            let title = '';
            let color = '#ccc';
            let isDone = false;
            if (p.refType === 'assignment') {
              const a = assignments.find((x) => x.id === p.refId);
              title = a?.name || 'assignment';
              color = TrackerStore.getCourse(a?.courseId)?.color || '#ccc';
              isDone = !!a?.completed;
            } else {
              const t = todos.find((x) => x.id === p.refId);
              title = t?.taskName || 'to-do';
              color = '#9a9085';
              isDone = !!t?.completed;
            }
            const sub = p.subTaskDescription
              ? `<span class="tracker-plan-chip__sub">${escapeHtml(p.subTaskDescription)}</span>`
              : '';
            const doneClass = isDone ? ' tracker-plan-chip--done' : '';
            return `<div class="tracker-plan-chip${doneClass}" style="border-left:4px solid ${escapeAttr(color)}" data-plan-id="${escapeAttr(p.id)}">
              <span class="tracker-plan-chip__handle" draggable="true" aria-label="drag to another day" title="drag to another day">⋮</span>
              <input type="checkbox" class="tracker-plan-chip__check js-plan-done" data-ref-type="${escapeAttr(p.refType)}" data-ref-id="${escapeAttr(p.refId)}" aria-label="mark done" ${isDone ? 'checked' : ''} />
              <div class="tracker-plan-chip__main" title="double-click to remove from this week">${escapeHtml(title)}${sub}</div>
              <button type="button" class="tracker-plan-chip__rm js-plan-rm" data-plan-id="${escapeAttr(p.id)}" aria-label="remove from this week">×</button>
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
      setStatus(wkStatus, 'working…', false);
      try {
        const sug = await TrackerApi.suggestWeeklyBreakdown({
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

    root.querySelectorAll('.tracker-plan-chip__main').forEach((el) => {
      el.addEventListener('dblclick', () => {
        const chip = el.closest('[data-plan-id]');
        const id = chip?.getAttribute('data-plan-id');
        if (id) TrackerStore.removeWeeklyPlan(id);
        renderWeekly();
      });
    });

    root.querySelectorAll('.js-plan-rm').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = btn.getAttribute('data-plan-id');
        if (id) TrackerStore.removeWeeklyPlan(id);
        renderWeekly();
      });
    });

    root.querySelectorAll('.js-plan-done').forEach((cb) => {
      cb.addEventListener('change', () => {
        const refType = cb.getAttribute('data-ref-type');
        const refId = cb.getAttribute('data-ref-id');
        if (!refType || !refId) return;
        const wantDone = !!cb.checked;
        if (refType === 'assignment') {
          const a = TrackerStore.state.assignments.find((x) => x.id === refId);
          if (a && !!a.completed !== wantDone) TrackerStore.toggleAssignmentComplete(refId);
        } else if (refType === 'todo') {
          const t = TrackerStore.state.todos.find((x) => x.id === refId);
          if (t && !!t.completed !== wantDone) TrackerStore.toggleTodo(refId);
        }
        renderWeekly();
      });
    });

    root.querySelectorAll('.tracker-plan-chip__handle').forEach((handle) => {
      handle.addEventListener('dragstart', (e) => {
        const chip = handle.closest('[data-plan-id]');
        const planId = chip?.getAttribute('data-plan-id');
        if (!planId) return;
        e.dataTransfer?.setData('text/plain', JSON.stringify({ kind: 'plan', planId }));
        e.dataTransfer.effectAllowed = 'move';
      });
    });

    if (!root.dataset.wkDragEndBound) {
      root.dataset.wkDragEndBound = '1';
      root.addEventListener('dragend', () => {
        root.querySelectorAll('.tracker-week-col--drop').forEach((c) => c.classList.remove('tracker-week-col--drop'));
      });
    }

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
        if (payload?.kind === 'plan' && payload.planId) {
          TrackerStore.moveWeeklyPlan(payload.planId, date);
          renderWeekly();
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
        const payload = JSON.stringify({ kind: 'backlog', refType, refId });
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const anyOpen =
      (courseDetailHost && !courseDetailHost.hidden) || (addCourseHost && !addCourseHost.hidden);
    if (!anyOpen) return;
    closeCourseModals();
    renderCourses();
  });

  window.addEventListener('beforeunload', () => {
    if (!TrackerStore.usesServerPersistence()) return;
    const base = TrackerApi.getBaseUrl();
    if (!base) return;
    const uid = TrackerStore.getRemoteUserId();
    const body = JSON.stringify({
      courses: TrackerStore.state.courses,
      assignments: TrackerStore.state.assignments,
      todos: TrackerStore.state.todos,
      weeklyPlan: TrackerStore.state.weeklyPlan,
    });
    try {
      fetch(`${base}/api/tracker/state?user_id=${encodeURIComponent(uid)}`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-Tracker-User-Id': uid },
        body,
      });
    } catch {
      /* ignore */
    }
  });

  setTab('weekly');
  /* visual tab state is cleared when main.js lands on habitat (home) */
});
