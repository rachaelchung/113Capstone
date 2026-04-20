/**
 * trackerOllama.js — syllabus extraction + weekly plan suggestions via local Ollama.
 */

const TrackerOllama = {
  async chatJson({ baseUrl, model, system, user }) {
    const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
    const body = {
      model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ollama http ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    const content = data?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('ollama returned empty message');
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      throw new Error('ollama did not return valid json');
    }
    return parsed;
  },

  async parseSyllabus({ baseUrl, model, courseName, syllabusText }) {
    const system = [
      'You extract structured course deadlines from a syllabus.',
      'Return ONLY valid JSON matching this shape:',
      '{"assignments":[{"name":"string","dueDate":"YYYY-MM-DD","pointsValue":"string optional"}]}',
      'Use ISO dates in local sense (no timezone). If a due date is missing, skip that row.',
      'Prefer explicit calendar dates from the syllabus text.',
    ].join(' ');
    const user = `Course name (hint): ${courseName}\n\nSyllabus:\n${syllabusText.slice(0, 24000)}`;
    const parsed = await this.chatJson({ baseUrl, model, system, user });
    const list = Array.isArray(parsed.assignments) ? parsed.assignments : [];
    return list
      .filter((r) => r && r.name && r.dueDate)
      .map((r) => ({
        name: String(r.name).trim(),
        dueDate: String(r.dueDate).trim().slice(0, 10),
        pointsValue: r.pointsValue != null ? String(r.pointsValue) : '',
      }));
  },

  async suggestWeeklyBreakdown({ baseUrl, model, weekStartYmd, assignments, existingPlans }) {
    const system = [
      'You help a student split work across days without changing real due dates.',
      'Return ONLY valid JSON: {"suggestions":[{"date":"YYYY-MM-DD","assignmentId":"string","subTaskDescription":"string"}]}',
      'assignmentId must be one of the provided ids.',
      'subTaskDescription should be concrete (e.g. "read pages 1-5", "draft intro paragraph").',
      'Only suggest for dates within the listed week.',
    ].join(' ');
    const payload = {
      weekStartYmd,
      assignments: assignments.map((a) => ({
        id: a.id,
        name: a.name,
        dueDate: a.dueDate,
        courseId: a.courseId,
      })),
      existingPlans: existingPlans.map((p) => ({
        date: p.date,
        refType: p.refType,
        refId: p.refId,
        subTaskDescription: p.subTaskDescription,
      })),
    };
    const user = JSON.stringify(payload);
    const parsed = await this.chatJson({ baseUrl, model, system, user });
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return list
      .filter((r) => r && r.date && r.assignmentId && r.subTaskDescription)
      .map((r) => ({
        date: String(r.date).trim().slice(0, 10),
        assignmentId: String(r.assignmentId),
        subTaskDescription: String(r.subTaskDescription).trim(),
      }));
  },
};
