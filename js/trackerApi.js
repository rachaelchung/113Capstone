/**
 * trackerApi.js — syllabus + weekly suggestions via deployed backend (OpenAI on server).
 */

function getTrackerApiBase() {
  const meta = document.querySelector('meta[name="tracker-api-base"]');
  const fromMeta = meta?.getAttribute('content')?.trim();
  if (fromMeta) return fromMeta.replace(/\/$/, '');
  if (typeof window.TRACKER_API_BASE === 'string' && window.TRACKER_API_BASE.trim()) {
    return window.TRACKER_API_BASE.trim().replace(/\/$/, '');
  }
  return '';
}

const TrackerApi = {
  getBaseUrl: getTrackerApiBase,

  requireBase() {
    const b = getTrackerApiBase();
    if (!b) {
      throw new Error(
        'Configure your API URL: set the tracker-api-base meta tag in app.html (or window.TRACKER_API_BASE) to your deployed backend.',
      );
    }
    return b;
  },

  async parseResponse(res) {
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-json */
    }
    if (!res.ok) {
      const detail = data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d) => d.msg || d).join('; ')
        : typeof detail === 'string'
          ? detail
          : text?.slice(0, 220) || `http ${res.status}`;
      throw new Error(msg);
    }
    return data;
  },

  async post(path, jsonBody) {
    const base = this.requireBase();
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonBody),
    });
    return this.parseResponse(res);
  },

  /**
   * @param {string} courseName
   * @param {string | { pdfFile: File }} syllabusTextOrSource — plain string, or `{ pdfFile }` for server-side pdf text extraction
   * @returns {Promise<{ assignments: Array<{name:string,dueDate:string,pointsValue:string}>, gradingCategories: Array<{name:string,weightPercent:number}> }>}
   */
  async parseSyllabus(courseName, syllabusTextOrSource) {
    const base = this.requireBase();
    const isPdf =
      syllabusTextOrSource &&
      typeof syllabusTextOrSource === 'object' &&
      syllabusTextOrSource.pdfFile instanceof File;

    let res;
    if (isPdf) {
      const fd = new FormData();
      fd.append('course_name', courseName);
      fd.append('syllabus_pdf', syllabusTextOrSource.pdfFile, syllabusTextOrSource.pdfFile.name);
      res = await fetch(`${base}/api/parse-syllabus`, { method: 'POST', body: fd });
    } else {
      res = await fetch(`${base}/api/parse-syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_name: courseName,
          syllabus_text: String(syllabusTextOrSource ?? ''),
        }),
      });
    }

    const data = await this.parseResponse(res);
    const list = Array.isArray(data?.assignments) ? data.assignments : [];
    const assignments = list
      .filter((r) => r && r.name && r.dueDate)
      .map((r) => ({
        name: String(r.name).trim(),
        dueDate: String(r.dueDate).trim().slice(0, 10),
        pointsValue: r.pointsValue != null ? String(r.pointsValue) : '',
      }));
    const rawCats = Array.isArray(data?.gradingCategories) ? data.gradingCategories : [];
    const gradingCategories = rawCats
      .filter((c) => c && String(c.name || '').trim())
      .map((c) => {
        const w = Number(c.weightPercent);
        return {
          name: String(c.name).trim(),
          weightPercent: Number.isFinite(w) ? w : 0,
        };
      });
    return { assignments, gradingCategories };
  },

  async suggestWeeklyBreakdown({ weekStartYmd, assignments, existingPlans }) {
    const data = await this.post('/api/weekly-suggestions', {
      week_start_ymd: weekStartYmd,
      assignments: assignments.map((a) => ({
        id: a.id,
        name: a.name,
        dueDate: a.dueDate,
        courseId: a.courseId,
      })),
      existing_plans: existingPlans.map((p) => ({
        date: p.date,
        refType: p.refType,
        refId: p.refId,
        subTaskDescription: p.subTaskDescription || '',
      })),
    });
    const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
    return list
      .filter((r) => r && r.date && r.assignmentId && r.subTaskDescription)
      .map((r) => ({
        date: String(r.date).trim().slice(0, 10),
        assignmentId: String(r.assignmentId),
        subTaskDescription: String(r.subTaskDescription).trim(),
      }));
  },
};
