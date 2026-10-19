/* Skill Builder study library. No build step, framework, or runtime dependency: fetch the JSON
   and render the markdown locally so the app works offline. */

const DATA = "data/";
const state = {
  manifest: null,
  exam: null,
  selectedCertificationId: null,
  selectedExamId: null,
  attempt: null,
  attemptDates: new Map(),
  filters: { status: "incorrect", type: "all", confidence: "all", len: "all", q: "" },
  openNotes: new Set(),
  noteCache: new Map(),
  readMinutes: new Map(),
  // Raw text of every note, so search and read time can cover the reports
  // themselves and not just the question text.
  noteIndex: new Map(),
  // Card text, same reason: the story deck has its own copy of the material and
  // searching a report should find it there too.
  cardIndex: new Map(),
  reader: { open: false, n: null, list: [], scrolled: false, material: null },
  deck: { open: false, n: null, slide: 0, list: [] },
  report: { open: false, material: null, n: null, token: 0, headings: [] },
  read: new Set(),
  readFilter: "unread",
};

/* Read state lives in localStorage: the app has no backend, and "which reports
   have I already been through" is per-device state anyway. Keyed by attempt so a
   new exam does not inherit the old one's progress. The key is a plain object
   rather than a Set so JSON.stringify does the serialising. */
const identity = () => [state.attempt?.certificationId, state.attempt?.examId, state.attempt?.attemptId].join(":");
const READ_KEY = (id) => StudyProgress.readKey(id);

function loadRead(id) {
  try {
    state.read = StudyProgress.migrateReadState(localStorage, id, state.attempt.attemptId);
  } catch {
    state.read = new Set();
  }
}

function saveRead() {
  try {
    localStorage.setItem(READ_KEY(identity()), JSON.stringify([...state.read]));
  } catch {
    /* private mode, quota: the mark still applies for this session */
  }
}

/* Where the story deck stopped. Opening Stories without a question picked is a
   resume, not a restart, so the last card and screen are kept in localStorage
   like the read marks: per browser, per device, lost with site data. Written on
   every screen change, read only by openDeck, and cleared when the run finishes
   so the next session starts on the first card still unread. */
const LAST_STORY_KEY = (id) => StudyProgress.lastStoryKey(id);

function saveLastStory(n, slide) {
  try {
    localStorage.setItem(LAST_STORY_KEY(identity()), JSON.stringify({ n, slide }));
  } catch {
    /* private mode, quota: the deck still runs, it just does not resume */
  }
}

function loadLastStory() {
  try {
    return StudyProgress.loadStoryPosition(
      localStorage,
      identity(),
      state.attempt.attemptId,
      state.attempt.questions.filter((q) => q.card).map((q) => q.n)
    );
  } catch {
    /* unreadable or half-written value: treated as "nothing remembered" */
  }
  return null;
}

function clearLastStory() {
  try {
    localStorage.removeItem(LAST_STORY_KEY(identity()));
  } catch {
    /* nothing to do: the stale value is ignored when it cannot be read back */
  }
}

const readKey = (n) => StudyProgress.questionReadKey(identity(), n);
const isRead = (n) => state.read.has(readKey(n));
const isReport = (n) => state.attempt.questions.some((q) => q.n === n && q.note);

/* Marking a report read is not a decision, it is a side effect of reading it:
   the progress bar reaching the end, or asking for the next one. The buttons
   exist to undo an automatic mark or to mark without opening. */
function markRead(n, on = true, quiet = false) {
  if (!n || !isReport(n)) return;
  const key = readKey(n);
  if (on === state.read.has(key)) return;
  if (on) state.read.add(key);
  else state.read.delete(key);
  saveRead();
  syncReadUi(n);
  if (!quiet) toast(on ? `Q${n} marked as read` : `Q${n} marked as unread`);
}

/* Every place that shows a read mark, so one call updates all of them: the
   question card, the reader header, the deck and the library rows. The same
   question can be on screen in more than one of those at a time, so it paints
   every match rather than the first. */
function syncReadUi(n) {
  const targets = n == null ? reportList() : [cardFor(n)].filter((q) => q && q.note);
  for (const q of targets) {
    for (const btn of document.querySelectorAll(`[data-read-toggle="${q.n}"]`)) {
      paintReadToggle(btn, isRead(q.n));
    }
    const card = document.querySelector(`.q[data-n="${q.n}"]`);
    if (card) card.classList.toggle("q--read", isRead(q.n));
    const row = document.querySelector(`.rpt[data-n="${q.n}"]`);
    if (row) row.classList.toggle("rpt--read", isRead(q.n));
  }
  if (n != null && state.reader.open && state.reader.n === n) {
    paintReadToggle(el("readerReadBtn"), isRead(n));
  }
  if (n != null && state.deck.open && state.deck.n === n) {
    paintReadToggle(el("deckReadBtn"), isRead(n));
  }
  if (n != null && state.report.open && state.report.n === n) {
    paintReadToggle(el("reportReadBtn"), isRead(n));
  }
  renderReadFilter();
  // A row that no longer matches the read filter has to leave the list, and
  // one that now matches has to arrive, so the list is re-rendered rather than
  // patched.
  if (!el("index").hidden) renderIndex(el("indexSearch").value);
}

function paintReadToggle(btn, on) {
  if (!btn) return;
  btn.textContent = on ? "●" : "○";
  btn.setAttribute("aria-pressed", String(on));
  btn.setAttribute("aria-label", on ? "Mark as unread" : "Mark as read");
  btn.title = on ? "Read — click to mark unread" : "Mark as read";
  btn.classList.toggle("is-read", on);
}

const el = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const CONFIDENCE = {
  CONFIDENT: { label: "confident", cls: "conf-high" },
  EDUCATED_GUESS: { label: "educated guess", cls: "conf-mid" },
  UNSURE: { label: "unsure", cls: "conf-low" },
};

const TYPE_SHORT = {
  "Multiple Choice": "single answer",
  "Multi-Select": "multiple answers",
  Matching: "match pairs",
};

const STATUS_LABEL = { correct: "correct", incorrect: "incorrect", skipped: "skipped" };

function fmtTime(seconds) {
  if (!seconds && seconds !== 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m${String(s).padStart(2, "0")}s`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

/* ---------- minimal markdown: covers what the analyses use ---------- */

function renderInline(text, base = "") {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, href) => {
    // Cross-note links are relative to the attempt folder. The page sits at the
    // root, so without the prefix the click 404s.
    const target = /^[a-z]+:\/\//.test(href) || href.startsWith("#") ? href : base + href;
    return `<a href="${target}" target="_blank" rel="noopener">${label}</a>`;
  });
  return out;
}

function renderMarkdown(src, base = "") {
  const lines = String(src).replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let i = 0;

  const flushList = (ordered, items) => {
    const tag = ordered ? "ol" : "ul";
    html.push(`<${tag}>${items.map((it) => `<li>${it}</li>`).join("")}</${tag}>`);
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // fenced code
    if (/^```/.test(line.trim())) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++;
      html.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // table
    if (line.includes("|") && /^\s*\|?[\s:-]*\|[\s:|-]*$/.test(lines[i + 1] || "")) {
      const cells = (row) =>
        row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(cells(lines[i++]));
      html.push(
        `<table><thead><tr>${head.map((h) => `<th>${renderInline(h, base)}</th>`).join("")}</tr></thead>` +
          `<tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c, base)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`
      );
      continue;
    }

    // headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      html.push(`<h${level}>${renderInline(h[2].replace(/\s*#+\s*$/, ""), base)}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      html.push("<hr>");
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      html.push(`<blockquote>${renderInline(buf.join(" "), base)}</blockquote>`);
      continue;
    }

    // lists, with one nesting level keyed off indentation
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const numbered = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const re = ordered ? /^(\s*)\d+[.)]\s+(.*)$/ : /^(\s*)[-*+]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) {
          items.push([m[2]]);
          i++;
        } else if (/^\s{2,}\S/.test(lines[i]) && items.length) {
          // The whole item is collected before it is rendered. Rendering line
          // by line would leave **bold** literal whenever it wraps, because
          // neither half of the marker is on the same line as the other.
          items[items.length - 1].push(lines[i].trim());
          i++;
        } else break;
      }
      flushList(ordered, items.map((parts) => renderInline(parts.join(" "), base)));
      continue;
    }

    // paragraph
    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>\s?|(---|\*\*\*|___)\s*$)/.test(lines[i]) &&
      !lines[i].includes("|")
    ) {
      buf.push(lines[i++]);
    }
    if (buf.length) html.push(`<p>${renderInline(buf.join(" "), base)}</p>`);
  }

  return html.join("\n");
}

/* Rough reading time for a note, cached. 220 wpm is a normal pace for
   technical prose, and it only has to be good enough to sort by. */
/* Topics come from the report H1, so they can contain inline markdown. For the
   places that take textContent, drop the markers; for the ones that take HTML,
   render them. */
function plainText(s) {
  return String(s || "").replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
}

function readMinutes(noteText) {
  if (state.readMinutes.has(noteText)) return state.readMinutes.get(noteText);
  const words = noteText.split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 220));
  state.readMinutes.set(noteText, mins);
  return mins;
}

function lenBucket(mins) {
  if (mins < 2) return "s";
  if (mins <= 4) return "m";
  return "l";
}

/* ---------- filtering ---------- */

function visibleQuestions() {
  const f = state.filters;
  const needle = f.q.trim().toLowerCase();
  return state.attempt.questions.filter((q) => {
    if (f.status !== "all" && q.status !== f.status) return false;
    if (f.type !== "all" && q.type !== f.type) return false;
    if (f.confidence !== "all" && (q.confidence || "UNSURE") !== f.confidence) return false;
    if (f.len !== "all" && q.note) {
      const cached = state.readMinutes.get(q.note);
      if (cached && lenBucket(cached) !== f.len) return false;
    }
    if (needle) {
      const hay = [
        q.text,
        q.topic || "",
        q.cardTopic || "",
        q.options.map((o) => o.text).join(" "),
        state.noteIndex.get(q.note) || "",
        state.cardIndex.get(q.card) || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/* ---------- rendering ---------- */

function currentCertification() {
  return state.manifest?.certifications.find((x) => x.id === state.selectedCertificationId);
}

function currentExamEntry() {
  return currentCertification()?.exams.find((x) => x.id === state.selectedExamId);
}

function attemptEntry(id = state.attempt?.attemptId) {
  return currentExamEntry()?.attempts.find((x) => x.id === id);
}

function formatAttemptDate(attempt) {
  const values = [attempt?.window?.startTime, attempt?.date, attempt?.attemptId];
  for (const value of values) {
    if (value == null || value === "") continue;
    let date;
    if (typeof value === "number") {
      date = new Date(Math.abs(value) < 1e11 ? value * 1000 : value);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      date = new Date(year, month - 1, day);
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) continue;
    } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      date = new Date(value);
    } else {
      continue;
    }
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }
  return null;
}

async function loadAttemptDates(examEntry) {
  await Promise.all(examEntry.attempts.map(async (entry) => {
    if (state.attemptDates.has(entry.path)) return;
    try {
      const response = await fetch(`${DATA}${entry.path}`);
      if (!response.ok) return;
      state.attemptDates.set(entry.path, formatAttemptDate(await response.json()));
    } catch { /* Keep the original label when a date is unavailable offline. */ }
  }));
}

function attemptLabel(entry) {
  const date = state.attemptDates.get(entry.path) || formatAttemptDate({ attemptId: entry.id });
  if (!date) return entry.id;
  const sameDate = (currentExamEntry()?.attempts || []).filter((item) =>
    (state.attemptDates.get(item.path) || formatAttemptDate({ attemptId: item.id })) === date
  );
  return sameDate.length > 1 ? `${date} · ${sameDate.findIndex((item) => item.id === entry.id) + 1}` : date;
}

function humanizeId(value) {
  return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function materialUrl(material, scope) {
  const owner = scope === "exam"
    ? `${state.selectedCertificationId}/${state.selectedExamId}/`
    : `${state.selectedCertificationId}/${state.selectedExamId}/attempts/${state.attempt.attemptId}/`;
  return `data/${owner}${material.path}`;
}

function resolveMaterial(ref) {
  if (!ref) return null;
  const list = ref.scope === "exam" ? state.exam?.materials : state.attempt?.materials;
  const material = list?.find((m) => m.id === ref.id);
  return material ? { ...material, scope: ref.scope, url: materialUrl(material, ref.scope) } : null;
}

function attachMaterials(attempt) {
  for (const q of attempt.questions) {
    const resolved = (q.materials || []).map(resolveMaterial).filter(Boolean);
    const report = resolved.find((m) => m.type === "report");
    const story = resolved.find((m) => m.type === "story");
    // These view-only fields keep the existing question renderer small. The
    // versioned attempt JSON remains in the normalized reference-based shape.
    q.note = report?.url || null;
    q.topic = report?.title || "";
    q.card = story?.url || null;
    q.cardTopic = story?.title || "";
    q.cardMeta = {};
  }
}

function renderCatalogControls() {
  const cert = currentCertification();
  const examEntry = currentExamEntry();
  const attempts = examEntry?.attempts || [];
  el("certSelector").innerHTML = state.manifest.certifications
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.code ? ` (${esc(c.code)})` : ""}</option>`)
    .join("");
  el("certSelector").value = state.selectedCertificationId || "";
  el("examSelector").innerHTML = (cert?.exams || [])
    .map((x) => `<option value="${esc(x.id)}">${esc(humanizeId(x.id))}</option>`).join("");
  el("examSelector").value = state.selectedExamId || "";
  el("attemptSelector").innerHTML = attempts.length
    ? attempts.map((x) => `<option value="${esc(x.id)}">${esc(attemptLabel(x))}</option>`).join("")
    : `<option value="">No attempts yet</option>`;
  el("attemptSelector").value = attempts.find((x) => x.id === state.attempt?.attemptId)?.id || attempts[0]?.id || "";
  el("examSelector").disabled = !(cert?.exams.length);
  el("attemptSelector").disabled = !attempts.length;
  renderMaterialShelf();
}

function renderMaterialShelf() {
  const host = el("materialShelf");
  const shared = state.exam?.materials || [];
  const own = state.attempt?.materials || [];
  const items = [
    ...shared.map((m) => ({ ...m, scope: "exam" })),
    ...own.map((m) => ({ ...m, scope: "attempt" })),
  ];
  if (!items.length) {
    host.innerHTML = `<span class="panel__hint">No study materials in this exam yet.</span>`;
    return;
  }
  host.innerHTML = items.map((m) =>
    `<button class="material-chip" data-material="${esc(m.id)}" data-scope="${m.scope}">
      ${m.type === "story" ? "▶ Story" : "▤ Report"} · ${esc(m.title)}
      <small>${m.scope === "exam" ? "shared" : "this attempt"}</small>
    </button>`
  ).join("");
}

function renderRail() {
  const list = (currentExamEntry()?.attempts || [])
    .map((a) => {
      const on = a.id === state.attempt?.attemptId;
      return `<button class="attempt" data-attempt="${esc(a.id)}" aria-current="${on}">
        <div class="attempt__top">
          <span class="attempt__date">${esc(attemptLabel(a))}</span>
        </div>
        <div class="attempt__meta">${esc(state.exam?.title || humanizeId(state.selectedExamId))}</div>
      </button>`;
    })
    .join("");
  el("attempts").innerHTML = list;
}

function renderSummary() {
  const a = state.attempt;
  const t = a.totals;
  const need = Math.max(0, Math.ceil((a.score.passingPercent * t.questions) / 100) - t.correct);

  el("head").innerHTML = `
    <div style="flex:1;min-width:260px">
      <h1 class="head__title">${esc(a.exam.title)}</h1>
      <div class="head__sub">
        ${esc(a.exam.certification)} · attempt started ${esc(fmtDate(a.window.startTime))}
        ${a.exam.url ? ` · <a href="${esc(a.exam.url)}" target="_blank" rel="noopener">open source</a>` : ""}
      </div>
    </div>
    <div>
      <div class="score ${a.score.passed ? "score--passed" : "score--failed"}">
        <span class="score__value">${a.score.percent}%</span>
        <span class="score__cut">pass mark ${a.score.passingPercent}%</span>
      </div>
      <span class="verdict ${a.score.passed ? "verdict--pass" : "verdict--fail"}">${
        a.score.passed ? "passed" : "failed"
      }</span>
    </div>`;

  el("stats").innerHTML = `
    <div class="stat stat--ok"><div class="stat__k">correct</div><div class="stat__v">${t.correct}</div></div>
    <div class="stat stat--bad"><div class="stat__k">incorrect</div><div class="stat__v">${t.incorrect}</div></div>
    <div class="stat"><div class="stat__k">skipped</div><div class="stat__v">${t.skipped}</div></div>
    <div class="stat"><div class="stat__k">total time</div><div class="stat__v">${fmtTime(t.timeSpentSeconds)}</div></div>
    <div class="stat"><div class="stat__k">per question</div><div class="stat__v">${fmtTime(t.avgSeconds)}</div></div>
    <div class="stat ${a.score.passed ? "stat--ok" : "stat--warn"}">
      <div class="stat__k">needed to pass</div>
      <div class="stat__v">${need} <small>more</small></div>
    </div>`;

  const byDomain = new Map();
  for (const t2 of a.tasks) {
    if (!byDomain.has(t2.domainCode)) byDomain.set(t2.domainCode, []);
    byDomain.get(t2.domainCode).push(t2);
  }

  const domains = a.domains
    .map((d) => {
      const rows = (byDomain.get(d.code) || [])
        .map((task) => {
          const cls = task.percent < 50 ? "bar--low" : task.percent < 70 ? "bar--mid" : "";
          return `<div class="task">
            <span class="task__code">${esc(task.code)}</span>
            <span class="task__name" title="${esc(task.name)}">${esc(task.name)}</span>
            <span class="bar ${cls}"><i style="width:${task.percent}%"></i></span>
            <span class="task__n">${task.correct}/${task.questions}</span>
          </div>`;
        })
        .join("");
      return `<div class="dom">
        <div class="dom__head">
          <div class="dom__name"><b>D${esc(d.code)}</b>${esc(d.name)}</div>
          <div class="dom__pct">${d.percent}% <small>· ${d.correct}/${d.questions}</small></div>
        </div>
        ${rows}
      </div>`;
    })
    .join("");

  const breakdown = el("breakdown");
  breakdown.innerHTML = `
    <summary class="panel__head">
      <div class="panel__title">Score by domain and task</div>
      <div class="panel__hint">red bars below 50%</div>
    </summary>
    <div class="panel__body">
      ${domains}
      <div class="panel__hint" style="margin-top:16px">${esc(a.caveats[0])}</div>
    </div>`;
  syncBreakdown();
}

/* On a phone the breakdown is taller than the question list header, so it
   starts collapsed. Once the user taps it, their choice wins over the viewport. */
const narrow = window.matchMedia("(max-width: 900px)");
let breakdownUserOpen = null;

function syncBreakdown() {
  el("breakdown").open = breakdownUserOpen === null ? !narrow.matches : breakdownUserOpen;
}

narrow.addEventListener("change", syncBreakdown);
el("breakdown").addEventListener("toggle", () => {
  const box = el("breakdown");
  // A state that matches the viewport default is not a user decision, which
  // also discards the toggle the browser fires for the initial markup.
  breakdownUserOpen = box.open === !narrow.matches ? null : box.open;
});

function optionNode(q, opt) {
  const isCorrect = opt.correct;
  const isChosen = opt.chosen;
  const wrongPick = isChosen && !isCorrect;
  const cls = wrongPick ? "opt--wrong" : isCorrect ? "opt--correct" : "";
  const mark = wrongPick ? "✗" : isCorrect ? "✓" : "·";
  const tags = [];
  if (isCorrect) tags.push('<span class="opt__tag">correct answer</span>');
  if (isChosen && isCorrect) tags.push('<span class="opt__tag">your answer</span>');
  if (wrongPick) tags.push('<span class="opt__tag">your answer</span>');

  return `<div class="opt ${cls}">
    <span class="opt__mark">${mark}</span>
    <div>${esc(opt.text)}${
      tags.length ? `<div class="opt__tags">${tags.join("")}</div>` : ""
    }</div>
  </div>`;
}

function questionNode(q) {
  const conf = CONFIDENCE[q.confidence] || { label: "—", cls: "conf-low" };
  const statusCls = q.status === "correct" ? "ok" : q.status === "incorrect" ? "bad" : "skip";

  let body;
  if (q.matching) {
    const optsById = new Map(q.options.map((o) => [o.id, o.text]));
    const rows = q.matching.statements
      .map((s) => {
        const right = optsById.get(s.correctOptionId) || "?";
        const got = s.chosenOptionId ? optsById.get(s.chosenOptionId) : null;
        const ok = got === right;
        return `<div class="opt ${ok ? "opt--correct" : "opt--wrong"}">
          <span class="opt__mark">${ok ? "✓" : "✗"}</span>
          <div>${esc(s.text)}<div class="opt__tags">
            <span class="opt__tag">correct: ${esc(right)}</span>
            <span class="opt__tag">yours: ${got ? esc(got) : "—"}</span>
          </div></div>
        </div>`;
      })
      .join("");
    body = `<div class="opts">${rows}</div>`;
  } else {
    body = `<div class="opts">${q.options.map((o) => optionNode(q, o)).join("")}</div>`;
    if (q.status === "incorrect" && q.type === "Multi-Select") {
      const missed = q.options.filter((o) => o.correct && !o.chosen);
      const extra = q.options.filter((o) => o.chosen && !o.correct);
      const parts = [];
      if (missed.length)
        parts.push(`Missed ${missed.length} correct ${missed.length === 1 ? "option" : "options"}.`);
      if (extra.length)
        parts.push(
          `Selected ${extra.length} ${extra.length === 1 ? "option that is not" : "options that are not"} correct.`
        );
      if (parts.length) body += `<div class="missed">${esc(parts.join(" "))}</div>`;
    }
  }

  const notePath = q.note || null;
  const open = state.openNotes.has(q.n);
  const read = isRead(q.n);

  return `<article class="q${read ? " q--read" : ""}" id="q${q.n}" data-n="${q.n}">
    <div class="q__bar">
      <span class="q__n">#${q.n}</span>
      <span class="tag tag--${statusCls}">${STATUS_LABEL[q.status]}</span>
      <span class="tag tag--plain">${esc(TYPE_SHORT[q.type] || q.type)}</span>
      ${q.correctCount > 1 ? `<span class="tag tag--plain">${q.correctCount} correct answers</span>` : ""}
      <span class="tag tag--${conf.cls}">${conf.label}</span>
      <span class="tag tag--plain">${fmtTime(q.seconds)}</span>
      <span class="q__spacer"></span>
      ${notePath ? `<span class="readflag" title="${read ? "read" : "not read yet"}">${read ? "●" : "○"}</span>` : ""}
    </div>
    <div class="q__body">
      <div class="q__text">${esc(q.text)}</div>
      ${body}
    </div>
    <div class="q__actions">
      ${
        q.card
          ? `<button class="btn btn--story" data-story="${q.n}" title="Story card (s)">▶ Story</button>`
          : ""
      }
      ${
        notePath
          ? `<button class="btn btn--primary" data-read="${q.n}">Read analysis</button>
             <button class="btn btn--inline" data-note="${q.n}">${
               open ? "Close inline" : "Show inline"
             }</button>
             <button class="btn btn--mark" data-read-toggle="${q.n}" aria-pressed="${read}">${
               read ? "● Read" : "○ Mark read"
             }</button>
             <a class="btn" href="${esc(notePath)}" target="_blank" rel="noopener">Open the .md</a>`
          : `<span class="panel__hint">No analysis written yet.</span>`
      }
      ${
        q.card
          ? `<a class="btn" href="${esc(cardPath(q))}" target="_blank" rel="noopener">Open the card</a>`
          : ""
      }
    </div>
    ${notePath ? `<div class="md" id="md${q.n}"${open ? "" : " hidden"}></div>` : ""}
  </article>`;
}

function renderInsight(list) {
  const host = el("insight");
  const wrong = list.filter((q) => q.status === "incorrect");
  if (!wrong.length) {
    host.innerHTML = "";
    host.hidden = true;
    return;
  }
  const conf = wrong.filter((q) => q.confidence === "CONFIDENT").length;
  const guess = wrong.filter((q) => q.confidence === "EDUCATED_GUESS").length;
  const unsure = wrong.filter((q) => q.confidence === "UNSURE").length;
  const avg = Math.round(wrong.reduce((s, q) => s + (q.seconds || 0), 0) / wrong.length);
  const pct = Math.round((100 * conf) / wrong.length);
  host.hidden = false;
  host.innerHTML = `
    <span>Across the <b>${wrong.length}</b> incorrect questions in view:</span>
    <span><b>${conf}</b> marked confident (${pct}%), averaging <b>${fmtTime(avg)}</b> each.</span>
    <span class="panel__hint">${guess} educated guess · ${unsure} unsure</span>`;
}

function renderList() {
  const list = visibleQuestions();
  el("count").textContent = `${list.length} of ${state.attempt.questions.length}`;
  renderInsight(list);
  el("list").innerHTML = list.length
    ? list.map(questionNode).join("")
    : `<div class="empty">Nothing matches these filters. <button class="linkbtn" id="clear">Clear them</button></div>`;

  const clear = el("clear");
  if (clear) clear.addEventListener("click", resetFilters);

  // notes that were already open
  for (const n of state.openNotes) {
    const host = el(`md${n}`);
    if (host) fillNote(n, host);
  }
}

function renderChips() {
  const t = state.attempt.totals;
  const counts = { all: t.questions, incorrect: t.incorrect, correct: t.correct, skipped: t.skipped };
  el("statusChips").innerHTML = ["incorrect", "correct", "skipped", "all"]
    .map(
      (k) =>
        `<button class="chip" data-status="${k}" aria-pressed="${state.filters.status === k}">${
          k === "all" ? "all" : STATUS_LABEL[k]
        }<span class="chip__n">${counts[k]}</span></button>`
    )
    .join("");

  const types = [...new Set(state.attempt.questions.map((q) => q.type))];
  el("typeFilter").innerHTML =
    `<option value="all">every type</option>` +
    types.map((v) => `<option value="${esc(v)}"${state.filters.type === v ? " selected" : ""}>${esc(TYPE_SHORT[v] || v)}</option>`).join("");

  el("confFilter").innerHTML =
    `<option value="all">any confidence</option>` +
    Object.keys(CONFIDENCE)
      .map((v) => `<option value="${v}"${state.filters.confidence === v ? " selected" : ""}>${CONFIDENCE[v].label}</option>`)
      .join("");

  const lenSel = el("lenFilter");
  if (lenSel.value !== state.filters.len) lenSel.value = state.filters.len;

  if (el("search").value !== state.filters.q) el("search").value = state.filters.q;
}

function renderAll() {
  renderCatalogControls();
  renderRail();
  if (!state.attempt) {
    const cert = currentCertification();
    el("head").innerHTML = `<div><h1 class="head__title">${esc(state.exam?.title || humanizeId(state.selectedExamId))}</h1>
      <div class="head__sub">${esc(cert?.name || "")}${cert?.code ? ` · ${esc(cert.code)}` : ""}</div></div>`;
    el("stats").hidden = true;
    el("breakdown").hidden = true;
    el("insight").hidden = true;
    el("list").innerHTML = `<div class="empty">This mock exam has no attempts yet. Its shared materials are available above.</div>`;
    el("count").textContent = "0 questions";
    el("indexCount").textContent = "0";
    el("offlineBtn").disabled = true;
    el("openStories").disabled = true;
    el("openIndex").disabled = true;
    return;
  }
  el("stats").hidden = false;
  el("breakdown").hidden = false;
  el("offlineBtn").disabled = false;
  el("openStories").disabled = false;
  el("openIndex").disabled = false;
  renderSummary();
  renderChips();
  renderList();
}

/* ---------- notes ---------- */

async function loadNote(q) {
  const path = q.note;
  if (state.noteCache.has(path)) return state.noteCache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  const text = await res.text();
  state.noteIndex.set(q.note, text);
  const html = renderMarkdown(text, path.slice(0, path.lastIndexOf("/") + 1));
  state.noteCache.set(path, html);
  return html;
}

/* Wide tables get wrapped so they can scroll sideways inside the column
   instead of stretching the page. */
function wrapTables(root) {
  for (const table of root.querySelectorAll("table")) {
    if (table.parentElement.classList.contains("tablewrap")) continue;
    const wrap = document.createElement("div");
    wrap.className = "tablewrap";
    table.replaceWith(wrap);
    wrap.appendChild(table);
  }
  const measure = () => {
    for (const wrap of root.querySelectorAll(".tablewrap")) {
      wrap.classList.toggle("is-scrollable", wrap.scrollWidth > wrap.clientWidth + 2);
    }
  };
  measure();
  if (!root.clientWidth) return;
  // One observer per host, not one per call: this runs again on every slide of
  // the deck, and observers that are never disconnected keep the old hosts
  // alive and keep re-measuring detached markup.
  const key = Symbol.for("tablewrap-observer");
  root[key]?.disconnect();
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  root[key] = ro;
}

async function fillNote(n, host) {
  const q = state.attempt.questions.find((x) => x.n === n);
  if (!q || !q.note) return;
  const path = q.note;
  if (state.noteCache.has(path)) {
    host.innerHTML = state.noteCache.get(path);
    wrapTables(host);
    return;
  }
  host.innerHTML = `<p class="panel__hint">Loading…</p>`;
  try {
    host.innerHTML = await loadNote(q);
    wrapTables(host);
  } catch {
    host.innerHTML = `<p class="panel__hint">Could not read <code>${esc(path)}</code>. The file is on disk but the server did not return it.</p>`;
  }
}

/* ---------- story cards ---------- */

/* The four screens, in the order the deck shows them. The card file has exactly
   these headings; anything else in the file is front matter the deck renders as
   the header of the first screen. */
const CARD_SECTIONS = [
  "Topic",
  "Why you got it wrong",
  "Why the right answer was different",
  "Concepts to nail it next time",
];

const cardPath = (q) => q.card;

function cardFor(n) {
  return state.attempt.questions.find((q) => q.n === n);
}

/* Splits a card file into the four screens. The body of each screen is markdown,
   rendered by the same renderer the reports use, so a card can hold a table. */
function parseCard(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const head = { title: "", meta: {} };
  const screens = CARD_SECTIONS.map((name) => ({ name, body: [] }));
  let cur = null;

  for (const line of lines) {
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1 && !cur) {
      head.title = h1[1].trim();
      continue;
    }
    // Checked before the front matter branch, otherwise the first H2 would be
    // swallowed as front matter and every screen would read as empty.
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      const i = CARD_SECTIONS.indexOf(h2[1].trim());
      if (i >= 0) cur = screens[i];
      continue;
    }
    if (!cur) {
      const m = /^\s*[-*]\s+\*\*(.+?)\*\*\s*:\s*(.*)$/.exec(line);
      if (m) head.meta[m[1].toLowerCase()] = m[2].trim();
      continue;
    }
    cur.body.push(line);
  }
  return { head, screens };
}

async function loadCard(q) {
  const path = cardPath(q);
  if (state.noteCache.has(path)) return state.noteCache.get(path);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  const text = await res.text();
  state.cardIndex.set(q.card, text);
  const parsed = parseCard(text);
  state.noteCache.set(path, parsed);
  return parsed;
}


/* ---------- full screen analysis reader ---------- */

function reportsInView() {
  return visibleQuestions().filter((q) => q.note);
}

function optionsBlock(q) {
  if (q.matching) {
    const byId = new Map(q.options.map((o) => [o.id, o.text]));
    return `<div class="opts">${q.matching.statements
      .map((s) => {
        const right = byId.get(s.correctOptionId) || "?";
        const got = s.chosenOptionId ? byId.get(s.chosenOptionId) : null;
        const ok = got === right;
        return `<div class="opt ${ok ? "opt--correct" : "opt--wrong"}">
          <span class="opt__mark">${ok ? "✓" : "✗"}</span>
          <div>${esc(s.text)}<div class="opt__tags">
            <span class="opt__tag">correct: ${esc(right)}</span>
            <span class="opt__tag">yours: ${got ? esc(got) : "—"}</span>
          </div></div>
        </div>`;
      })
      .join("")}</div>`;
  }
  return `<div class="opts">${q.options.map((o) => optionNode(q, o)).join("")}</div>`;
}

/* The report repeats its own title and metadata bullets. The reader chrome
   already shows the question number, the topic, the type, the confidence and
   the time, so the reader drops that front matter and opens on the content.
   The inline view keeps it, because the card does not show a topic. */
function stripFrontMatter(host) {
  const h1 = host.querySelector("h1");
  if (!h1) return;
  h1.remove();
  const next = host.firstElementChild;
  if (next && next.tagName === "UL" && /domain|task|confidence|type/i.test(next.textContent)) {
    next.remove();
  }
}

async function openReader(n, list) {
  const q = state.attempt.questions.find((x) => x.n === n);
  if (!q || !q.note) return;

  state.reader.open = true;
  state.reader.material = null;
  state.reader.n = n;
  state.reader.list = (list || reportsInView().map((x) => x.n)).slice();
  state.reader.scrolled = false;

  el("reader").hidden = false;
  el("readerQ").hidden = false;
  el("readerReadBtn").hidden = false;
  el("readerTocBtn").hidden = false;
  el("readerProgress").parentElement.hidden = false;
  el("readerNav").hidden = false;
  document.body.style.overflow = "hidden";
  el("readerQn").textContent = `Q${q.n}`;
  el("readerTopic").textContent = plainText(q.topic);
  el("readerQMeta").textContent = [
    TYPE_SHORT[q.type] || q.type,
    CONFIDENCE[q.confidence]?.label,
    fmtTime(q.seconds),
    q.correctCount > 1 ? `${q.correctCount} correct answers` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  el("readerQBody").innerHTML = `<div class="q__text">${esc(q.text)}</div>${optionsBlock(q)}`;
  el("readerQ").open = false;
  el("readerToc").hidden = true;
  el("readerBody").scrollTop = 0;
  el("readerProgress").style.width = "0%";
  paintReadToggle(el("readerReadBtn"), isRead(n));

  syncReaderNav();
  try {
    el("readerContent").innerHTML = await loadNote(q);
    stripFrontMatter(el("readerContent"));
    wrapTables(el("readerContent"));
    buildToc();
  } catch (err) {
    el("readerContent").innerHTML = `<p class="panel__hint">Could not read the analysis: ${esc(err.message)}</p>`;
  }
}

async function openMaterial(material, scope) {
  const selected = { ...material, scope, url: materialUrl(material, scope) };
  state.reader.open = true;
  state.reader.n = null;
  state.reader.material = selected;
  state.reader.list = [];
  el("reader").hidden = false;
  document.body.style.overflow = "hidden";
  el("readerQn").textContent = scope === "exam" ? "Shared" : "Material";
  el("readerTopic").textContent = material.title;
  el("readerQ").hidden = true;
  el("readerReadBtn").hidden = true;
  el("readerTocBtn").hidden = true;
  el("readerProgress").parentElement.hidden = true;
  el("readerNav").hidden = true;
  el("readerToc").hidden = true;
  el("readerBody").scrollTop = 0;
  try {
    const response = await fetch(selected.url);
    if (!response.ok) throw new Error(`${selected.url} returned ${response.status}`);
    const text = await response.text();
    const base = selected.url.slice(0, selected.url.lastIndexOf("/") + 1);
    el("readerContent").innerHTML = renderMarkdown(text, base);
    stripFrontMatter(el("readerContent"));
    wrapTables(el("readerContent"));
  } catch (err) {
    el("readerContent").innerHTML = `<p class="panel__hint">Could not read material: ${esc(err.message)}</p>`;
  }
}

function syncReaderNav() {
  const list = state.reader.list;
  const i = list.indexOf(state.reader.n);
  el("readerPos").textContent = i >= 0 ? `${i + 1} of ${list.length}` : "";
  el("readerPrev").disabled = i <= 0;
  el("readerNext").disabled = i < 0 || i >= list.length - 1;
}

async function stepReader(delta) {
  const list = state.reader.list;
  const i = list.indexOf(state.reader.n);
  const target = list[i + delta];
  if (target == null) return;
  // Asking for the next report is the other moment a report counts as read,
  // and the reason a short report is not left unread forever.
  if (delta > 0) markRead(state.reader.n, true, true);
  await openReader(target, list);
}

function closeReader() {
  state.reader.open = false;
  state.reader.n = null;
  state.reader.material = null;
  el("reader").hidden = true;
  el("readerQ").hidden = false;
  el("readerReadBtn").hidden = false;
  el("readerTocBtn").hidden = false;
  el("readerProgress").parentElement.hidden = false;
  el("readerNav").hidden = false;
  document.body.style.overflow = "";
}

function buildToc() {
  const heads = [...el("readerContent").querySelectorAll("h2, h3")];
  const toc = el("readerToc");
  if (heads.length < 3) {
    toc.hidden = true;
    return;
  }
  heads.forEach((h, i) => {
    if (!h.id) h.id = `sec${i}`;
  });
  toc.innerHTML = heads
    .map(
      (h) =>
        `<a href="#" data-sec="${h.id}" class="${h.tagName === "H3" ? "reader__toc--h3" : ""}">${esc(
          h.textContent
        )}</a>`
    )
    .join("");
}

function onReaderScroll() {
  const body = el("readerBody");
  const max = body.scrollHeight - body.clientHeight;
  const pct = max > 4 ? Math.min(100, (body.scrollTop / max) * 100) : 100;
  el("readerProgress").style.width = `${pct}%`;
  if (max > 4) {
    /* Reaching the end means read, with one guard: a report longer than the
       screen only counts once the user has actually scrolled it. Without that,
       a report whose last line is one flick away would be marked on open. */
    if (body.scrollTop <= 0) return;
    state.reader.scrolled = true;
    if (pct < 100) return;
  }
  markRead(state.reader.n, true, true);
}

/* ---------- library index ---------- */

const reportList = () => state.attempt.questions.filter((q) => q.note);

function openIndex() {
  const all = reportList();
  const date = formatAttemptDate(state.attempt);
  el("indexSub").textContent = `${all.length} reports for this attempt${date ? ` · ${date}` : ""}`;
  el("index").hidden = false;
  document.body.style.overflow = "hidden";
  renderReadFilter();
  renderIndex("");
}

function closeIndex() {
  el("index").hidden = true;
  document.body.style.overflow = "";
}

/* Three views of the same list: what is left, everything, what is done. The
   counts sit in the chips so the choice is legible without opening anything. */
function renderReadFilter() {
  const all = reportList();
  if (!all.length) return;
  const read = all.filter((q) => isRead(q.n)).length;
  const counts = { unread: all.length - read, all: all.length, read: read };
  el("readChips").innerHTML = ["unread", "all", "read"]
    .map(
      (k) =>
        `<button class="chip" data-readfilter="${k}" aria-pressed="${state.readFilter === k}">${k}<span class="chip__n">${counts[k]}</span></button>`
    )
    .join("");
  el("readProgress").innerHTML = `<b>${read}</b> of ${all.length} read`;
}

function renderIndex(needle) {
  const term = needle.trim().toLowerCase();
  const items = reportList()
    .map((x) => ({ q: x, mins: state.readMinutes.get(x.note) || 0 }))
    .filter(({ q: x }) => {
      if (state.readFilter === "unread" && isRead(x.n)) return false;
      if (state.readFilter === "read" && !isRead(x.n)) return false;
      if (!term) return true;
      const hay = [x.topic, x.text, state.noteIndex.get(x.note) || "", state.cardIndex.get(x.card) || ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });

  if (!items.length) {
    el("indexBody").innerHTML = `<div class="empty">No report matches that.</div>`;
    return;
  }

  el("indexBody").innerHTML = items
    .map(
      ({ q: x, mins }) => `<div class="rpt${isRead(x.n) ? " rpt--read" : ""}" data-n="${x.n}">
        <button class="rpt__main" data-n="${x.n}">
          <span class="rpt__n">Q${x.n}</span>
          <span>
            <span class="rpt__topic">${renderInline(plainText(x.topic || "Untitled"))}</span>
            <span class="rpt__meta">${CONFIDENCE[x.confidence]?.label || "unsure"} · ${fmtTime(x.seconds)}${x.card ? " · card" : ""}</span>
          </span>
          <span class="rpt__mins">${mins ? `${mins} min` : ""}</span>
        </button>
        ${
          x.card
            ? `<button class="rpt__story" data-story="${x.n}" aria-label="Story card for question ${x.n}" title="Story card">▶</button>`
            : ""
        }
        <button class="rpt__mark" data-read-toggle="${x.n}" aria-pressed="${isRead(x.n)}"
          aria-label="Mark question ${x.n} as ${isRead(x.n) ? "unread" : "read"}"
          title="${isRead(x.n) ? "Read — click to mark unread" : "Mark as read"}">${isRead(x.n) ? "●" : "○"}</button>
      </div>`
    )
    .join("");
}

/* Reading the reports and cards up front costs 50 small requests once per
   attempt and buys read times in the index, instant story screens, and search
   across both bodies. */
async function prefetchNotes() {
  const notes = reportList();
  const cards = state.attempt.questions.filter((q) => q.card);
  await Promise.all([
    ...notes.map(async (q) => {
      if (state.readMinutes.has(q.note)) return;
      try {
        const res = await fetch(q.note);
        if (!res.ok) return;
        const text = await res.text();
        state.noteIndex.set(q.note, text);
        state.readMinutes.set(q.note, readMinutes(text));
      } catch {
        /* a missing file just means no read time */
      }
    }),
    ...cards.map(async (q) => {
      if (state.cardIndex.has(q.card)) return;
      try {
        const res = await fetch(cardPath(q));
        if (!res.ok) return;
        state.cardIndex.set(q.card, await res.text());
      } catch {
        /* the deck shows a message if the card cannot be read */
      }
    }),
  ]);
  el("indexCount").textContent = notes.length;
}

/* ---------- Full-page report ---------- */

/* A link from the last Story screen opens this route in a new tab:
   #<cert>/<exam>/<attempt>/<report-material-id>. It is a real page, not the
   in-app reader overlay: one report, its own title and table of contents, and
   a print view. The Markdown is the same file the reader uses. */
const APP_TITLE = "Skill Builder — certification study library";

function selectionHash() {
  const a = state.attempt;
  if (!a) return `#${state.selectedCertificationId || ""}/${state.selectedExamId || ""}`;
  return `#${a.certificationId}/${a.examId}/${a.attemptId}`;
}

function reportHash(material) {
  return `${selectionHash()}/${material.id}`;
}

function materialForId(id) {
  if (!id) return null;
  for (const scope of ["attempt", "exam"]) {
    const list = scope === "attempt" ? state.attempt?.materials : state.exam?.materials;
    const material = list?.find((m) => m.id === id);
    if (material) return { ...material, scope, url: materialUrl(material, scope) };
  }
  return null;
}

function reportForId(id) {
  const material = materialForId(id);
  return material?.type === "report" ? material : null;
}

function reportKicker(material) {
  if (material.questionNumber) return `Q${material.questionNumber} · Full review`;
  if (material.id.startsWith("topic-")) return "Concept guide";
  return String(material.title || "Report").split("·")[0].trim() || "Report";
}

/* The report is a page on top of the library. Make the library behind it
   unreachable from the keyboard and from assistive technology. */
const REPORT_SHELL = [".appbar", ".shell", ".reader", ".index", ".deck"];
function setReportShellInert(on) {
  for (const selector of REPORT_SHELL) {
    const node = document.querySelector(selector);
    if (node) node.toggleAttribute("inert", on);
  }
}

/* Pull the H1 and the metadata list out of the Markdown so the page can show
   them as a hero. Everything after that is rendered by the common renderer. */
function splitReport(text) {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let title = "";
  if (/^#\s+/.test(lines[i] || "")) {
    title = plainText(lines[i].replace(/^#\s+/, "").replace(/\s*#+\s*$/, "").trim());
    i++;
  }
  while (i < lines.length && !lines[i].trim()) i++;
  const meta = [];
  if (/^\s*-\s+\*\*[^*]+:\*\*/.test(lines[i] || "")) {
    while (i < lines.length) {
      const m = /^\s*-\s+\*\*(.+?):\*\*\s*(.*)$/.exec(lines[i]);
      if (!m) break;
      meta.push({ label: m[1].trim(), value: m[2].trim() });
      i++;
    }
  }
  return { title, meta, body: lines.slice(i).join("\n").trim() };
}

function buildReportToc() {
  const heads = [...el("reportContent").querySelectorAll("h2, h3")];
  state.report.headings = heads;
  const toc = el("reportToc");
  el("reportView").classList.toggle("is-single", !heads.length);
  if (!heads.length) {
    toc.innerHTML = "";
    return;
  }
  heads.forEach((h, i) => {
    if (!h.id) h.id = `report-sec-${i}`;
  });
  toc.innerHTML = heads
    .map(
      (h) =>
        `<a href="#" data-sec="${esc(h.id)}" class="${h.tagName === "H3" ? "is-sub" : ""}">${esc(
          h.textContent
        )}</a>`
    )
    .join("");
}

/* Internal report links stay inside this reading page; external links keep
   their new-tab behavior. Story card links are left as the raw Markdown. */
function rewriteReportLinks(root) {
  const byUrl = new Map();
  const add = (material, scope) => {
    if (material.type !== "report") return;
    byUrl.set(new URL(materialUrl(material, scope), location.href).href, material);
  };
  for (const m of state.attempt?.materials || []) add(m, "attempt");
  for (const m of state.exam?.materials || []) add(m, "exam");

  for (const a of root.querySelectorAll("a[href]")) {
    const raw = a.getAttribute("href");
    if (!raw || raw.startsWith("#")) continue;
    let abs;
    try {
      abs = new URL(raw, location.href);
    } catch {
      continue;
    }
    if (abs.origin !== location.origin) continue;
    const material = byUrl.get(abs.href);
    if (!material) continue;
    a.setAttribute("href", reportHash(material));
    a.removeAttribute("target");
    a.removeAttribute("rel");
  }
}

/* A bold lead makes a paragraph a callout. Reports use "Technical caveat" and
   "Teaching note" for the two cases worth pulling out of the prose. */
function decorateReport(root) {
  for (const p of root.querySelectorAll("p")) {
    const strong = p.firstElementChild;
    if (!strong || strong.tagName !== "STRONG") continue;
    const text = strong.textContent.trim();
    if (/^Technical caveat/.test(text)) p.classList.add("md-callout", "md-callout--warn");
    else if (/^Teaching note/.test(text)) p.classList.add("md-callout", "md-callout--note");
  }
}

function onReportScroll() {
  if (!state.report.open) return;
  const sc = el("reportScroll");
  const max = sc.scrollHeight - sc.clientHeight;
  const pct = max > 4 ? Math.min(100, Math.max(0, (sc.scrollTop / max) * 100)) : 100;
  el("reportProgress").style.width = `${pct}%`;

  const heads = state.report.headings;
  let active = heads[0]?.id || null;
  const line = sc.getBoundingClientRect().top + 96;
  for (const h of heads) {
    if (h.getBoundingClientRect().top <= line) active = h.id;
  }
  if (pct >= 99 && heads.length) active = heads[heads.length - 1].id;
  for (const a of el("reportToc").querySelectorAll("a[data-sec]")) {
    const current = a.dataset.sec === active;
    a.classList.toggle("is-active", current);
    if (current) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
  }

  if (state.report.n && pct >= 99) {
    if (max > 4 && sc.scrollTop <= 0) return;
    markRead(state.report.n, true, true);
  }
}

async function openReportPage(material) {
  if (!material) return;
  const token = ++state.report.token;
  state.report.open = true;
  state.report.material = material;
  state.report.n = material.questionNumber || null;

  document.body.classList.add("is-report");
  document.body.style.overflow = "hidden";
  setReportShellInert(true);
  el("reportView").hidden = false;
  el("reportScroll").scrollTop = 0;
  el("reportContent").setAttribute("aria-busy", "true");
  el("reportContent").innerHTML = `<p class="panel__hint">Loading report…</p>`;
  el("reportKicker").textContent = reportKicker(material);
  el("reportCrumb").textContent = material.questionNumber ? "Full review" : reportKicker(material);
  el("reportTitle").textContent = material.title || "Report";
  el("reportMeta").hidden = true;
  el("reportMeta").innerHTML = "";
  el("reportToc").innerHTML = "";
  el("reportView").classList.remove("is-single");
  el("reportProgress").style.width = "0%";

  const back = selectionHash();
  for (const id of ["reportHome", "reportClose", "reportBack", "reportBackFoot"]) {
    el(id).setAttribute("href", back);
  }

  const readBtn = el("reportReadBtn");
  if (state.report.n) {
    readBtn.hidden = false;
    readBtn.dataset.readToggle = String(state.report.n);
    paintReadToggle(readBtn, isRead(state.report.n));
  } else {
    readBtn.hidden = true;
    delete readBtn.dataset.readToggle;
  }
  document.title = `${plainText(material.title || "Report")} — Skill Builder`;

  try {
    const res = await fetch(material.url);
    if (!res.ok) throw new Error(`${material.url} returned ${res.status}`);
    const text = await res.text();
    if (token !== state.report.token) return;

    const parsed = splitReport(text);
    const title = parsed.title.replace(/^Q\d+\s*[—–-]\s*/, "") || material.title || "Report";
    el("reportTitle").textContent = title;
    document.title = `${title} — Skill Builder`;

    if (parsed.meta.length) {
      el("reportMeta").innerHTML = parsed.meta
        .map(({ label, value }, i) => {
          const tone = /source result/i.test(label)
            ? /^correct/i.test(value)
              ? " is-good"
              : /^incorrect/i.test(value)
                ? " is-bad"
                : ""
            : "";
          const wide =
            parsed.meta.length % 2 === 1 && i === parsed.meta.length - 1
              ? " reportview__fact--wide"
              : "";
          return `<div class="reportview__fact${tone}${wide}"><dt>${esc(label)}</dt><dd>${esc(
            value
          )}</dd></div>`;
        })
        .join("");
      el("reportMeta").hidden = false;
    }

    const base = material.url.slice(0, material.url.lastIndexOf("/") + 1);
    const content = el("reportContent");
    content.innerHTML = renderMarkdown(parsed.body, base);
    stripFrontMatter(content);
    wrapTables(content);
    rewriteReportLinks(content);
    decorateReport(content);
    buildReportToc();
    content.setAttribute("aria-busy", "false");
    el("reportScroll").scrollTop = 0;
    el("reportTitle").focus({ preventScroll: true });
    requestAnimationFrame(onReportScroll);
  } catch (err) {
    if (token !== state.report.token) return;
    el("reportContent").setAttribute("aria-busy", "false");
    el("reportContent").innerHTML = `<p class="panel__hint">Could not read this report: ${esc(
      err.message
    )}</p>`;
  }
}

function closeReportPage() {
  if (!state.report.open) return;
  state.report.open = false;
  state.report.token++;
  state.report.material = null;
  state.report.n = null;
  state.report.headings = [];
  el("reportView").hidden = true;
  el("reportContent").innerHTML = "";
  el("reportMeta").innerHTML = "";
  el("reportToc").innerHTML = "";
  el("reportProgress").style.width = "0%";
  delete el("reportReadBtn").dataset.readToggle;
  document.body.classList.remove("is-report");
  document.body.style.overflow = "";
  setReportShellInert(false);
  document.title = APP_TITLE;
}

function handleReportRoute() {
  if (!state.attempt) return;
  const parts = location.hash.slice(1).split("/");
  const id = parts[3] || null;
  if (!id) {
    if (state.report.open) closeReportPage();
    return;
  }
  if (parts[2] !== state.attempt.attemptId) {
    if (state.report.open) closeReportPage();
    return;
  }
  const material = reportForId(id);
  if (material) {
    if (state.report.open && state.report.material?.id === id) return;
    openReportPage(material);
  } else if (state.report.open) {
    closeReportPage();
  }
}

/* ---------- PWA: install prompt + offline stories ---------- */

let deferredPrompt = null;

/* Everything the reader and the deck need for the current attempt: the
   manifest, the attempt JSON, every written analysis and every story card. */
function storyUrls() {
  const a = state.attempt;
  if (!a) return [];
  const examEntry = currentExamEntry();
  const attempt = attemptEntry();
  if (!examEntry || !attempt) return [];
  const urls = [`${DATA}index.json`, `${DATA}${examEntry.path}`, `${DATA}${attempt.path}`];
  for (const material of state.exam?.materials || []) urls.push(materialUrl(material, "exam"));
  for (const material of a.materials || []) urls.push(materialUrl(material, "attempt"));
  for (const q of a.questions) {
    if (q.note) urls.push(q.note);
    if (q.card) urls.push(q.card);
  }
  return [...new Set(urls)];
}

/* The tick means every story URL is already in a cache, so the deck opens
   with no network. Checked lazily: 50 cache.match calls after each load, not
   on every render. */
async function refreshOfflineUi() {
  const label = el("offlineLabel");
  if (!label || !state.attempt) return;
  if (!("caches" in window)) return;
  try {
    const urls = storyUrls();
    let hit = 0;
    for (const u of urls) {
      if (await caches.match(u)) hit++;
    }
    const ready = urls.length > 0 && hit >= urls.length;
    label.textContent = ready ? "✓ Offline" : "Offline";
    el("offlineBtn").title = ready
      ? "This attempt is saved for offline stories"
      : "Save this attempt for offline stories";
  } catch {
    /* Cache API blocked (private mode): the deck still works online, and the
       service worker still caches what it can. */
  }
}

async function saveOffline() {
  const btn = el("offlineBtn");
  const label = el("offlineLabel");
  const urls = storyUrls();
  if (!urls.length) return;
  // Each fetch passes through the service worker, which stores the response,
  // so warming the deck is just reading every file once.
  btn.disabled = true;
  let done = 0;
  label.textContent = `Saving 0/${urls.length}`;
  await Promise.all(
    urls.map(async (u) => {
      try {
        const res = await fetch(u);
        if (res.ok) await res.arrayBuffer();
      } catch {
        /* one missing file must not abort the other fifty */
      } finally {
        done++;
        label.textContent = `Saving ${done}/${urls.length}`;
      }
    })
  );
  btn.disabled = false;
  await refreshOfflineUi();
  toast(
    label.textContent === "✓ Offline"
      ? "Stories saved for offline"
      : "Saved what the network allowed — retry while online"
  );
}

function wirePwa() {
  el("offlineBtn").addEventListener("click", saveOffline);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    el("installBtn").hidden = false;
  });
  el("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      /* dismissed */
    }
    deferredPrompt = null;
    el("installBtn").hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    el("installBtn").hidden = true;
    toast("Installed — save an attempt for offline stories");
  });

  window.addEventListener("offline", () => toast("Offline — showing saved stories"));
  window.addEventListener("online", () => {
    toast("Back online");
    refreshOfflineUi();
  });

  // A new shell version downloads in the background; the reader keeps the old
  // one until reload, so this only announces.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return;
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              toast("New version downloaded — reload for the latest");
            }
          });
        });
      })
      .catch(() => {});
  }
}

/* ---------- story deck ---------- */

/* One deck for the whole set: four screens per question, and the end of the
   fourth rolls into the first screen of the next question. Nothing advances on
   a timer. A study card that moves by itself is a card you cannot reread. */
const cardsInView = () => visibleQuestions().filter((q) => q.card);
const cardList = () => state.attempt.questions.filter((q) => q.card);

function openDeck(n, list) {
  const items = (list || cardsInView()).filter((q) => q.card);
  const pool = items.length ? items : cardList();
  if (!pool.length) {
    toast("No story cards written yet");
    return;
  }

  /* Two ways in. A question number means "this one", always on its first screen:
     every caller that passes one is a ▶ on a specific card, in the question list
     or in the library. No number is the app bar button or the s key, and that is
     a resume: back to the last screen shown, or the first card still unread when
     there is nothing to go back to. */
  let start;
  let slide = 0;
  if (n != null) {
    start = n;
  } else {
    const last = loadLastStory();
    // A remembered card that is not in this deck — a filter changed, the card
    // was deleted — is dropped rather than fought over, so the deck falls back
    // to the first unread card instead of starting on a screen that cannot load.
    if (last && pool.some((q) => q.n === last.n)) {
      start = last.n;
      slide = Math.min(Math.max(last.slide, 0), CARD_SECTIONS.length - 1);
    } else {
      start = (pool.find((q) => !isRead(q.n)) || pool[0]).n;
      if (last) clearLastStory();
    }
  }

  state.deck.open = true;
  state.deck.list = pool.map((q) => q.n);
  el("deck").hidden = false;
  document.body.style.overflow = "hidden";
  const i = Math.max(0, state.deck.list.indexOf(start));
  showDeckSlide(i, slide);
  if (n == null && slide > 0) toast(`Continuing at Q${start} — screen ${slide + 1}/${CARD_SECTIONS.length}`);
}

function closeDeck() {
  state.deck.open = false;
  el("deck").hidden = true;
  document.body.style.overflow = "";
}

async function showDeckSlide(i, slide) {
  const list = state.deck.list;
  if (!list.length) return;
  const at = Math.min(Math.max(i, 0), list.length - 1);
  const n = list[at];

  // Past the last screen of a question means the first screen of the next one.
  if (slide >= CARD_SECTIONS.length) {
    // Past the last screen of the last question ends the run, and the position
    // goes with it: the next Stories starts on the first card still unread.
    if (at >= list.length - 1) {
      clearLastStory();
      return closeDeck();
    }
    return showDeckSlide(at + 1, 0);
  }
  if (slide < 0) {
    if (at <= 0) return;
    return showDeckSlide(at - 1, CARD_SECTIONS.length - 1);
  }

  state.deck.n = n;
  state.deck.slide = slide;
  saveLastStory(n, slide);
  const q = cardFor(n);
  if (!q) return;

  el("deckQ").textContent = `Q${q.n}`;
  el("deckTopic").textContent = plainText(q.cardTopic || q.topic || "Untitled");
  el("deckSlide").textContent = `${slide + 1}/${CARD_SECTIONS.length}`;
  el("deckCount").textContent = `question ${at + 1} of ${list.length}`;
  el("deckPrev").disabled = at === 0 && slide === 0;
  el("deckNext").textContent = at === list.length - 1 && slide === CARD_SECTIONS.length - 1 ? "✓" : "›";
  paintReadToggle(el("deckReadBtn"), isRead(n));
  el("deckScroll").scrollTop = 0;
  el("deckBars").innerHTML = CARD_SECTIONS.map(
    (name, k) => `<i class="${k < slide ? "is-done" : k === slide ? "is-now" : ""}" title="${esc(name)}"></i>`
  ).join("");

  const kicker = `<div class="deck__kicker"><span class="deck__step">${slide + 1}/4</span>${esc(
    CARD_SECTIONS[slide]
  )}</div>`;
  const head =
    slide === 0
      ? `<div class="deck__meta">
           ${q.cardMeta?.domain ? `<span><b>D${esc(q.cardMeta.domain)}</b></span>` : ""}
           ${q.cardMeta?.task ? `<span>${esc(q.cardMeta.task)}</span>` : ""}
           ${q.cardMeta?.signal ? `<span class="deck__signal">the signal in the stem: ${renderInline(
             q.cardMeta.signal
           )}</span>` : ""}
         </div>`
      : "";

  el("deckBody").innerHTML = kicker + head + `<p class="panel__hint">Loading…</p>`;
  try {
    const card = await loadCard(q);
    const body = card.screens[slide].body.join("\n").trim();
    // A card sits in the cards/ subfolder, so relative links resolve from there.
    const cardUrl = cardPath(q);
    const base = cardUrl.slice(0, cardUrl.lastIndexOf("/") + 1);
    el("deckBody").innerHTML =
      kicker + head + (body ? renderMarkdown(body, base) : `<p class="panel__hint">This screen is empty.</p>`);
    wrapTables(el("deckBody"));
  } catch (err) {
    el("deckBody").innerHTML = kicker + `<p class="panel__hint">Could not read the card: ${esc(err.message)}</p>`;
  }
}

const stepDeck = (delta) => {
  if (!state.deck.open) return;
  const at = Math.max(0, state.deck.list.indexOf(state.deck.n));
  showDeckSlide(at, state.deck.slide + delta);
};

/* Tap and swipe. A press that never moved is a tap, and which half of the card
   it landed in picks the direction; a drag is a swipe, and the dominant axis
   decides it. Anything that moves more than a few pixels in between is the
   user scrolling a long screen, not navigating. */
function wireDeckGestures() {
  const frame = el("deckFrame");
  let start = null;

  frame.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, .tablewrap")) start = null;
    else start = { x: e.clientX, y: e.clientY, t: Date.now() };
  });

  frame.addEventListener("pointerup", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const quick = Date.now() - start.t < 500;
    start = null;

    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) return stepDeck(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && quick) {
      const box = frame.getBoundingClientRect();
      const third = (e.clientX - box.left) / box.width;
      stepDeck(third < 0.33 ? -1 : third > 0.67 ? 1 : 0);
    }
  });

  frame.addEventListener(
    "wheel",
    (e) => {
      // A trackpad is a horizontal swipe here; the deck has no vertical page
      // scroll, so the wheel cannot move anything else.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 && Math.abs(e.deltaX) > 12) {
        e.preventDefault();
        stepDeck(e.deltaX > 0 ? 1 : -1);
      }
    },
    { passive: false }
  );
}

async function toggleNote(n) {
  const host = el(`md${n}`);
  if (!host) return;
  if (state.openNotes.has(n)) {
    state.openNotes.delete(n);
    host.hidden = true;
  } else {
    state.openNotes.add(n);
    host.hidden = false;
    await fillNote(n, host);
  }
  const btn = document.querySelector(`[data-note="${n}"]`);
  if (btn) btn.textContent = state.openNotes.has(n) ? "Hide inline" : "Show inline";
}

function resetFilters() {
  state.filters = { status: "incorrect", type: "all", confidence: "all", len: "all", q: "" };
  renderAll();
}

let toastTimer;
function toast(msg) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
}

/* ---------- loading ---------- */

async function loadAttempt(id, { push = true } = {}) {
  const entry = attemptEntry(id);
  const examEntry = currentExamEntry();
  if (!examEntry) throw new Error("The selected mock exam is missing from data/index.json");
  const examResponse = await fetch(`${DATA}${examEntry.path}`);
  if (!examResponse.ok) throw new Error(`${DATA}${examEntry.path} not found (${examResponse.status})`);
  state.exam = await examResponse.json();
  if (!entry) {
    state.attempt = null;
    if (push) location.hash = `#${state.selectedCertificationId}/${state.selectedExamId}`;
    try {
      localStorage.setItem("sb-selection", JSON.stringify({
        certificationId: state.selectedCertificationId,
        examId: state.selectedExamId,
        attemptId: null,
      }));
    } catch { /* selection remains usable for this session */ }
    renderAll();
    return;
  }
  const res = await fetch(`${DATA}${entry.path}`);
  if (!res.ok) throw new Error(`${DATA}${entry.path} not found (${res.status})`);
  state.attempt = await res.json();
  state.attemptDates.set(entry.path, formatAttemptDate(state.attempt));
  await loadAttemptDates(examEntry);
  attachMaterials(state.attempt);
  state.openNotes.clear();
  state.noteIndex.clear();
  state.cardIndex.clear();
  state.noteCache.clear();
  state.readMinutes.clear();
  loadRead(identity());
  loadLastStory(); // Migrate the old position key as soon as the attempt opens.
  if (push) location.hash = `#${state.selectedCertificationId}/${state.selectedExamId}/${id}`;
  try {
    localStorage.setItem("sb-selection", JSON.stringify({
      certificationId: state.selectedCertificationId,
      examId: state.selectedExamId,
      attemptId: id,
    }));
  } catch { /* selection remains usable for this session */ }
  window.scrollTo({ top: 0 });
  renderAll();
  prefetchNotes().then(refreshOfflineUi, refreshOfflineUi);
}

function setRail(open) {
  el("rail").classList.toggle("is-open", open);
  el("scrim").hidden = !open;
  el("railBtn").setAttribute("aria-expanded", String(open));
}

function paintTheme() {
  const light = document.documentElement.dataset.theme === "light";
  for (const id of ["themeBtn", "reportTheme"]) {
    const button = el(id);
    if (button) button.textContent = light ? "◐" : "◑";
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("sb-theme", next);
  paintTheme();
}

function wire() {
  el("attempts").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-attempt]");
    if (btn) {
      setRail(false);
      loadAttempt(btn.dataset.attempt).catch((err) => toast(err.message));
    }
  });

  el("certSelector").addEventListener("change", () => {
    state.selectedCertificationId = el("certSelector").value;
    const cert = currentCertification();
    state.selectedExamId = cert?.exams[0]?.id || null;
    renderCatalogControls();
    loadAttempt(currentExamEntry()?.attempts[0]?.id || null).catch((err) => toast(err.message));
  });
  el("examSelector").addEventListener("change", () => {
    state.selectedExamId = el("examSelector").value;
    renderCatalogControls();
    loadAttempt(currentExamEntry()?.attempts[0]?.id || null).catch((err) => toast(err.message));
  });
  el("attemptSelector").addEventListener("change", () => {
    loadAttempt(el("attemptSelector").value).catch((err) => toast(err.message));
  });
  el("materialShelf").addEventListener("click", (event) => {
    const button = event.target.closest("[data-material]");
    if (!button) return;
    const scope = button.dataset.scope;
    const materials = scope === "exam" ? state.exam?.materials : state.attempt?.materials;
    const material = materials?.find((x) => x.id === button.dataset.material);
    if (material) openMaterial(material, scope);
  });

  el("railBtn").addEventListener("click", () => setRail(!el("rail").classList.contains("is-open")));
  el("railClose").addEventListener("click", () => setRail(false));
  el("scrim").addEventListener("click", () => setRail(false));

  el("statusChips").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-status]");
    if (!btn) return;
    state.filters.status = btn.dataset.status;
    renderChips();
    renderList();
  });

  el("typeFilter").addEventListener("change", (e) => {
    state.filters.type = e.target.value;
    renderList();
  });
  el("confFilter").addEventListener("change", (e) => {
    state.filters.confidence = e.target.value;
    renderList();
  });
  el("lenFilter").addEventListener("change", (e) => {
    state.filters.len = e.target.value;
    renderList();
  });

  let typing;
  el("search").addEventListener("input", (e) => {
    clearTimeout(typing);
    const v = e.target.value;
    typing = setTimeout(() => {
      state.filters.q = v;
      renderList();
    }, 140);
  });

  el("reset").addEventListener("click", resetFilters);

  el("list").addEventListener("click", (e) => {
    const read = e.target.closest("[data-read]");
    if (read) return openReader(Number(read.dataset.read));
    const story = e.target.closest("[data-story]");
    if (story) return openDeck(Number(story.dataset.story));
    const mark = e.target.closest("[data-read-toggle]");
    if (mark) {
      const n = Number(mark.dataset.readToggle);
      return markRead(n, !isRead(n));
    }
    const note = e.target.closest("[data-note]");
    if (note) toggleNote(Number(note.dataset.note));
  });

  // reader
  el("readerClose").addEventListener("click", closeReader);
  el("readerPrev").addEventListener("click", () => stepReader(-1));
  el("readerNext").addEventListener("click", () => stepReader(1));
  el("readerBody").addEventListener("scroll", onReaderScroll, { passive: true });
  el("readerReadBtn").addEventListener("click", () => markRead(state.reader.n, !isRead(state.reader.n)));
  el("readerTocBtn").addEventListener("click", () => {
    el("readerToc").hidden = !el("readerToc").hidden;
  });
  el("readerToc").addEventListener("click", (e) => {
    const link = e.target.closest("[data-sec]");
    if (!link) return;
    e.preventDefault();
    const target = document.getElementById(link.dataset.sec);
    if (!target) return;
    el("readerToc").hidden = true;
    el("readerBody").scrollTo({ top: target.offsetTop - 8, behavior: "smooth" });
  });

  // index
  el("openIndex").addEventListener("click", openIndex);
  el("indexClose").addEventListener("click", closeIndex);
  let indexTyping;
  el("indexSearch").addEventListener("input", (e) => {
    clearTimeout(indexTyping);
    const v = e.target.value;
    indexTyping = setTimeout(() => renderIndex(v), 120);
  });
  el("readChips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-readfilter]");
    if (!chip) return;
    state.readFilter = chip.dataset.readfilter;
    renderReadFilter();
    renderIndex(el("indexSearch").value);
  });
  el("indexBody").addEventListener("click", (e) => {
    const mark = e.target.closest("[data-read-toggle]");
    if (mark) return markRead(Number(mark.dataset.readToggle), !isRead(Number(mark.dataset.readToggle)));
    const story = e.target.closest("[data-story]");
    if (story) {
      closeIndex();
      return openDeck(Number(story.dataset.story));
    }
    const btn = e.target.closest("[data-n]");
    if (!btn) return;
    closeIndex();
    openReader(Number(btn.dataset.n));
  });

  // story deck
  el("openStories").addEventListener("click", () => openDeck());
  el("deckClose").addEventListener("click", closeDeck);
  el("deckPrev").addEventListener("click", () => stepDeck(-1));
  el("deckNext").addEventListener("click", () => stepDeck(1));
  el("deckReadBtn").addEventListener("click", () => markRead(state.deck.n, !isRead(state.deck.n)));
  wireDeckGestures();
  wirePwa();

  // full-page report
  el("reportPrint").addEventListener("click", () => window.print());
  el("reportReadBtn").addEventListener("click", () => {
    if (state.report.n) markRead(state.report.n, !isRead(state.report.n));
  });
  el("reportScroll").addEventListener("scroll", onReportScroll, { passive: true });
  el("reportToc").addEventListener("click", (e) => {
    const link = e.target.closest("a[data-sec]");
    if (!link) return;
    e.preventDefault();
    document.getElementById(link.dataset.sec)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  window.addEventListener("hashchange", handleReportRoute);

  el("themeBtn").addEventListener("click", toggleTheme);
  el("reportTheme").addEventListener("click", toggleTheme);

  const saved = localStorage.getItem("sb-theme");
  if (saved) document.documentElement.dataset.theme = saved;
  paintTheme();

  document.addEventListener("keydown", (e) => {
    const typingNow = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);

    if (e.key === "Escape") {
      if (state.report.open) {
        e.preventDefault();
        const target = selectionHash();
        closeReportPage();
        if (location.hash !== target) location.hash = target;
        return;
      }
      if (state.deck.open) return closeDeck();
      if (state.reader.open) return closeReader();
      if (!el("index").hidden) return closeIndex();
      if (typingNow) return document.activeElement.blur();
      if (state.openNotes.size) {
        const last = [...state.openNotes].pop();
        state.openNotes.delete(last);
        const host = el(`md${last}`);
        if (host) host.hidden = true;
        const btn = document.querySelector(`[data-note="${last}"]`);
        if (btn) btn.textContent = "Show inline";
      }
      return;
    }

    if (typingNow) return;
    if (state.report.open) return;

    if (state.deck.open) {
      if (["ArrowRight", "j", " "].includes(e.key)) {
        e.preventDefault();
        stepDeck(1);
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        stepDeck(-1);
      }
      return;
    }

    if (state.reader.open) {
      if (e.key === "ArrowRight" || e.key === "j") {
        e.preventDefault();
        stepReader(1);
      } else if (e.key === "ArrowLeft" || e.key === "k") {
        e.preventDefault();
        stepReader(-1);
      } else if (e.key === "/") {
        e.preventDefault();
        el("readerToc").hidden = !el("readerToc").hidden;
      } else if (e.key === "m") {
        markRead(state.reader.n, !isRead(state.reader.n));
      }
      return;
    }

    if (e.key === "/") {
      e.preventDefault();
      el("search").focus();
      return;
    }
    if (e.key === "i") {
      state.filters.status = state.filters.status === "incorrect" ? "all" : "incorrect";
      renderChips();
      renderList();
      toast(state.filters.status === "incorrect" ? "incorrect only" : "all questions");
    }
    if (e.key === "r") {
      openIndex();
    }
    if (e.key === "s") {
      openDeck();
    }
  });
}

async function boot() {
  wire();
  try {
    const res = await fetch(`${DATA}index.json`);
    if (!res.ok) throw new Error(String(res.status));
    state.manifest = await res.json();
  } catch {
    el("list").innerHTML = `<div class="empty">Could not find <code>data/index.json</code>. Run <code>make serve</code> from the project root.</div>`;
    return;
  }
  const certifications = state.manifest.certifications || [];
  if (!certifications.length) {
    el("list").innerHTML = `<div class="empty">No certifications in <code>data/index.json</code> yet.</div>`;
    return;
  }
  const hash = location.hash.slice(1).split("/");
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("sb-selection") || "null"); } catch { /* ignore invalid local selection */ }
  const candidates = [
    hash.length >= 2 ? { certificationId: hash[0], examId: hash[1], attemptId: hash[2] || null } : null,
    saved,
  ].filter(Boolean);
  let selection = null;
  for (const candidate of candidates) {
    const cert = certifications.find((x) => x.id === candidate.certificationId);
    const exam = cert?.exams.find((x) => x.id === candidate.examId);
    const attempt = exam?.attempts.find((x) => x.id === candidate.attemptId);
    if (cert && exam && (!candidate.attemptId || attempt || !exam.attempts.length)) {
      selection = { cert, exam, attempt: attempt || exam.attempts[0] || null };
      break;
    }
  }
  if (!selection) {
    const cert = certifications.find((x) => x.exams?.length) || certifications[0];
    const exam = cert.exams?.find((x) => x.attempts?.length) || cert.exams?.[0];
    selection = { cert, exam, attempt: exam?.attempts?.[0] };
  }
  if (!selection.exam) {
    el("list").innerHTML = `<div class="empty">This certification has no mock exams yet.</div>`;
    return;
  }
  state.selectedCertificationId = selection.cert.id;
  state.selectedExamId = selection.exam.id;
  renderCatalogControls();
  await loadAttempt(selection.attempt?.id || null, { push: false });
  handleReportRoute();
}

boot();
