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
  certificationStatus: {},
  galleryOpen: false,
  certificationMaterialCounts: new Map(),
  galleryRenderToken: 0,
  studyOpen: false,
  selectedDomainId: null,
  activeStudy: null,
  activeStudyManifest: null,
  activeStudyModule: null,
  activeStudyLesson: null,
  studyViewToken: 0,
  studyReportIndex: null,
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
    let decoded;
    try { decoded = decodeURIComponent(href); } catch { return label; }
    if (/^https?:\/\//i.test(href)) return `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
    if (href.startsWith("#")) return `<a href="${esc(href)}">${label}</a>`;
    if (/^(\/|\\|[a-z]+:)/i.test(decoded) || decoded.split(/[\\/]/).includes("..")) return label;
    return `<a href="${esc(base + href)}" target="_blank" rel="noopener">${label}</a>`;
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
    else html.push(`<p>${renderInline(lines[i++], base)}</p>`);
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
    if (state.selectedDomainId && q.domainId && String(q.domainId) !== state.selectedDomainId) return false;
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

function certificationDomains() {
  const declared = currentCertification()?.domains;
  if (declared?.length) return declared.map((domain) => ({ id: domain.id, name: domain.name, description: domain.description || "", aggregateOnly: false }));
  return (state.attempt?.domains || []).map((domain) => ({ id: String(domain.code), name: domain.name, description: "Score aggregate from this attempt.", aggregateOnly: !state.attempt.questions?.some((q) => q.domainId != null) }));
}

function certificationArchive(certId) {
  return state.certificationStatus[certId] || null;
}

function activeCertifications() {
  return (state.manifest?.certifications || []).filter((cert) => !certificationArchive(cert.id));
}

function archiveCurrentCertification() {
  const cert = currentCertification();
  if (!cert) return;
  el("archiveDescription").textContent = `Choose how you completed ${cert.name}. You can restore it from the gallery at any time.`;
  el("archiveDialog").showModal();
}

function saveCertificationArchive(status) {
  const cert = currentCertification();
  if (!cert) return;
  const saved = CertificationStatus.archive(localStorage, state.certificationStatus, cert.id, status);
  if (!saved) {
    toast("Could not save archive status in this browser");
    return;
  }
  state.certificationStatus = CertificationStatus.read(localStorage);
  renderCatalogControls();
  renderCertificationGallery();
  if (!activeCertifications().length) openCertificationGallery();
  toast(status === "passed" ? "Certification archived as passed" : "Certification archived as finished studying");
}

function restoreCertification(certId) {
  const saved = CertificationStatus.restore(localStorage, state.certificationStatus, certId);
  if (!saved) {
    toast("Could not restore certification in this browser");
    return;
  }
  state.certificationStatus = CertificationStatus.read(localStorage);
  renderCatalogControls();
  renderCertificationGallery();
  toast("Certification restored to active study");
}

function certificationStats(cert) {
  let attempts = 0;
  for (const exam of cert.exams || []) attempts += exam.attempts?.length || 0;
  return { exams: cert.exams?.length || 0, attempts };
}

async function certificationMaterialCounts(cert) {
  if (state.certificationMaterialCounts.has(cert.id)) return state.certificationMaterialCounts.get(cert.id);
  const counts = { reports: 0, stories: 0 };
  try {
    for (const examEntry of cert.exams || []) {
      const examResponse = await fetch(`${DATA}${examEntry.path}`);
      if (!examResponse.ok) throw new Error("exam manifest unavailable");
      const exam = await examResponse.json();
      for (const material of exam.materials || []) {
        if (material.type === "report") counts.reports++;
        if (material.type === "story") counts.stories++;
      }
      const attempts = await Promise.all((examEntry.attempts || []).map(async (entry) => {
        const response = await fetch(`${DATA}${entry.path}`);
        if (!response.ok) throw new Error("attempt manifest unavailable");
        return response.json();
      }));
      for (const attempt of attempts) for (const material of attempt.materials || []) {
        if (material.type === "report") counts.reports++;
        if (material.type === "story") counts.stories++;
      }
    }
    state.certificationMaterialCounts.set(cert.id, counts);
    return counts;
  } catch {
    state.certificationMaterialCounts.set(cert.id, null);
    return null;
  }
}

function renderCertificationCard(cert, counts) {
  const archive = certificationArchive(cert.id);
  const summary = certificationStats(cert);
  const label = archive?.status === "passed" ? "Passed" : archive ? "Finished studying" : "Active";
  const archivedDate = archive ? new Date(archive.archivedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const materials = counts ? `${counts.reports} Reports · ${counts.stories} Stories` : "Materials unavailable";
  return `<article class="cert-card${archive ? " cert-card--archived" : ""}">
    <div class="cert-card__top"><span class="cert-card__status">${esc(label)}</span>${archive ? `<span class="cert-card__date">Archived ${esc(archivedDate)}</span>` : ""}</div>
    <h3>${esc(cert.name)}</h3>
    ${cert.code ? `<div class="cert-card__code">${esc(cert.code)}</div>` : ""}
    <div class="cert-card__metrics"><span><b>${summary.exams}</b> mock exams</span><span><b>${summary.attempts}</b> attempts</span><span>${esc(materials)}</span></div>
    <div class="cert-card__actions">
      <button class="btn btn--primary" data-open-cert="${esc(cert.id)}">Open study</button>
      ${archive ? `<button class="btn" data-restore-cert="${esc(cert.id)}">Restore to active</button>` : ""}
    </div>
  </article>`;
}

function safeStudyUrl(base, path) {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === ".." || part === "")) return null;
  return `${DATA}${base}${path}`;
}

function studyProgressCounts(study) {
  const stateData = StudyPathProgress.read(localStorage).studies[study.id] || { completed: [] };
  const done = new Set(stateData.completed || []);
  return { done: done.size, total: study.modules.reduce((n, m) => n + m.lessons.length, 0) };
}

function studyCard(study) {
  const counts = studyProgressCounts(study);
  return `<article class="cert-card study-card">
    <div class="cert-card__top"><span class="cert-card__status">Trilha de estudo</span><span class="cert-card__date">${study.domains.length} domains</span></div>
    <h3>${esc(study.title)}</h3>
    <div class="cert-card__metrics"><span><b>${counts.done}/${counts.total}</b> lessons marcadas como concluídas</span><span>${esc(study.description || "")}</span></div>
    <div class="cert-card__actions"><button class="btn btn--primary" data-open-study="${esc(study.id)}">Explore domains</button></div>
  </article>`;
}

async function loadStudy(studyId) {
  const entry = (state.manifest?.studies || []).find((item) => item.id === studyId);
  if (!entry) return null;
  const path = safeStudyUrl("", entry.path);
  if (!path) return null;
  const response = await fetch(path);
  if (!response.ok) throw new Error("Study path is unavailable.");
  const study = await response.json();
  return { entry, study, base: entry.path.replace(/study\.json$/, "") };
}

function studyRoute(studyId, domainId = null, moduleId = null, lessonId = null) {
  return `#/studies/${studyId}${domainId ? `/${domainId}` : ""}${moduleId ? `/${moduleId}` : ""}${lessonId ? `/${lessonId}` : ""}`;
}

function studyLessonDomains(module, lesson) {
  return [...new Set([module.domainId, ...(lesson.domainIds || [])])];
}

async function openStudyPath(studyId, { push = true } = {}) {
  if (!el("index").hidden) closeIndex();
  if (state.deck.open) { state.deck.progressChanged = false; closeDeck(); }
  const token = ++state.studyViewToken;
  if (state.report.open) closeReportPage();
  state.galleryOpen = false;
  state.studyOpen = true;
  el("openStories").disabled = false;
  el("openStories").setAttribute("aria-label", "Stories da trilha");
  el("openIndex").disabled = true;
  el("openIndex").setAttribute("aria-label", "Reports da trilha");
  el("shell").hidden = true;
  el("certGallery").hidden = false;
  el("galleryTitle").textContent = "Trilhas de estudo";
  el("galleryBack").textContent = "← Back to library";
  el("galleryBack").hidden = false;
  document.title = "Trilha de estudo — Skill Builder";
  const parts = location.hash.slice(2).split("/");
  const domainId = parts[2] || null, moduleId = parts[3] || null, lessonId = parts[4] || null;
  if (push && location.hash !== studyRoute(studyId, domainId, moduleId, lessonId)) {
    location.hash = studyRoute(studyId, domainId, moduleId, lessonId);
    return;
  }
  const host = el("galleryContent");
  host.innerHTML = `<div class="empty">Loading study path…</div>`;
  try {
    const loaded = await loadStudy(studyId);
    if (token !== state.studyViewToken || !loaded) return;
    const { study, base } = loaded;
    state.activeStudy = study;
    state.activeStudyManifest = loaded;
    const domain = study.domains.find((item) => item.id === domainId) || null;
    el("openIndex").disabled = false;
    el("indexCount").textContent = studyReportItems(study, domainId).length;
    const modules = study.modules.filter((module) => !domain || module.domainId === domain.id || module.lessons.some((lesson) => studyLessonDomains(module, lesson).includes(domain.id)));
    const completed = new Set((StudyPathProgress.read(localStorage).studies[study.id]?.completed) || []);
    const title = domain ? `${esc(study.title)} · ${esc(domain.name)}` : esc(study.title);
    const domainNav = `<nav class="domain-nav" aria-label="Domínios do estudo"><a class="domain-pill${domain ? "" : " is-current"}" href="${studyRoute(study.id)}" aria-current="${domain ? "false" : "page"}">Todos os domínios</a>${study.domains.map((item) => `<a class="domain-pill${domain?.id === item.id ? " is-current" : ""}" href="${studyRoute(study.id, item.id)}" aria-current="${domain?.id === item.id ? "page" : "false"}">${esc(item.name)}</a>`).join("")}</nav>`;
    let body;
    if (lessonId) {
      const module = study.modules.find((item) => item.id === moduleId);
      const lesson = module?.lessons.find((item) => item.id === lessonId);
      if (!module || !lesson || (domainId && !studyLessonDomains(module, lesson).includes(domainId))) {
        body = `<div class="empty">Esta lição não está disponível no domínio selecionado.</div>`;
      } else {
        const currentDomain = domainId || module.domainId;
        const ordered = study.modules.flatMap((item) => item.lessons.filter((unit) => studyLessonDomains(item, unit).includes(currentDomain)).map((unit) => ({ module: item, lesson: unit })));
        const index = ordered.findIndex((item) => item.lesson.id === lessonId && item.module.id === moduleId);
        const previous = ordered[index - 1], next = ordered[index + 1];
        const done = completed.has(StudyPathProgress.lessonKey(module.id, lesson.id));
        const review = StudyPathProgress.isReview(localStorage, study.id, module.id, lesson.id);
        const url = safeStudyUrl(base, lesson.path);
        if (!url) throw new Error("Study lesson path is invalid.");
        const response = await fetch(url);
        if (!response.ok) throw new Error("Study lesson could not be loaded.");
        const markdown = await response.text();
        if (token !== state.studyViewToken) return;
        body = `<article class="study-lesson"><div class="study-crumb"><a href="${studyRoute(study.id, currentDomain)}">${esc(domain?.name || study.domains.find((d) => d.id === module.domainId)?.name || "Domínio")}</a> / ${esc(module.title)}</div><div class="study-lesson__actions"><button class="btn" data-toggle-study-complete="${esc(module.id)}|${esc(lesson.id)}" aria-pressed="${done}">${done ? "✓ Concluída · desfazer" : "Marcar como concluída"}</button><button class="btn" data-toggle-study-review="${esc(module.id)}|${esc(lesson.id)}" aria-pressed="${review}">${review ? "★ Revisar depois" : "☆ Marcar para revisar"}</button></div>${lesson.type === "report" ? `<details class="study-report-outline"><summary>Conteúdo deste Report</summary><nav aria-label="Seções do Report"></nav></details>` : ""}<article class="md md--reader study-markdown" lang="pt-BR">${renderMarkdown(markdown, DATA + base)}</article><nav class="study-next" aria-label="Navegação das lições"><a class="btn" href="${previous ? studyRoute(study.id, currentDomain, previous.module.id, previous.lesson.id) : studyRoute(study.id, currentDomain)}">← ${previous ? esc(previous.lesson.title) : "Visão do domínio"}</a><span>${index + 1} / ${ordered.length}</span><a class="btn btn--primary" href="${next ? studyRoute(study.id, currentDomain, next.module.id, next.lesson.id) : studyRoute(study.id)}">${next ? esc(next.lesson.title) : "Todos os domínios"} →</a></nav></article>`;
      }
    } else {
      body = domain
        ? `<div class="domain-heading"><p>${esc(domain.description || "")} </p><p>${modules.reduce((sum, m) => sum + m.lessons.filter((l) => studyLessonDomains(m, l).includes(domain.id)).length, 0)} lições · ${modules.reduce((sum, m) => sum + m.lessons.filter((l) => studyLessonDomains(m, l).includes(domain.id) && completed.has(StudyPathProgress.lessonKey(m.id, l.id))).length, 0)} marcadas como concluídas</p></div><div class="study-modules">${modules.map((module) => `<section class="study-module"><div class="study-module__head"><span>${esc(domain.name)}</span><h2>${esc(module.title)}</h2></div><ol>${module.lessons.filter((lesson) => studyLessonDomains(module, lesson).includes(domain.id)).map((lesson) => `<li><a href="${studyRoute(study.id, domain.id, module.id, lesson.id)}">${esc(lesson.title)}</a><span>${completed.has(StudyPathProgress.lessonKey(module.id, lesson.id)) ? "✓ Concluída" : esc(lesson.type.replaceAll("-", " "))}</span></li>`).join("")}</ol></section>`).join("")}</div>`
        : `<p class="study-intro">Escolha um domínio para estudar em profundidade ou abra a formação completa.</p><div class="domain-grid">${study.domains.map((item) => { const scoped = study.modules.filter((m) => m.domainId === item.id || m.lessons.some((l) => studyLessonDomains(m, l).includes(item.id))); const total = scoped.reduce((n, m) => n + m.lessons.filter((l) => studyLessonDomains(m, l).includes(item.id)).length, 0); const done = scoped.reduce((n, m) => n + m.lessons.filter((l) => studyLessonDomains(m, l).includes(item.id) && completed.has(StudyPathProgress.lessonKey(m.id, l.id))).length, 0); return `<a class="domain-card" href="${studyRoute(study.id, item.id)}"><span class="domain-card__count">${scoped.length} módulos</span><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><span class="domain-card__progress">${done} de ${total} lições concluídas</span></a>`; }).join("")}<a class="domain-card domain-card--all" href="${studyRoute(study.id)}"><span class="domain-card__count">Trilha completa</span><h2>Todos os domínios</h2><p>Consulte a sequência completa de backend, arquitetura, plataforma e infraestrutura.</p></a></div>`;
    }
    host.innerHTML = `<div class="study-path"><div class="study-path__top"><span>Trilha de estudo</span><a href="#/certifications/gallery">Todas as trilhas</a></div><h2 class="study-path__title" tabindex="-1">${title}</h2>${domainNav}${body}</div>`;
    buildStudyReportOutline(host);
    wrapTables(host);
    el("galleryTitle").textContent = domain ? domain.name : (lessonId ? "Lição" : study.title);
    host.querySelector(".study-path__title")?.focus?.({ preventScroll: true });
    refreshOfflineUi();
  } catch {
    if (token === state.studyViewToken) host.innerHTML = `<div class="empty">Study content is unavailable. Check the local catalog and try again.</div>`;
  }
}

async function renderCertificationGallery() {
  const host = el("galleryContent");
  if (!host || !state.manifest) return;
  const token = ++state.galleryRenderToken;
  const certs = state.manifest.certifications || [];
  const studies = state.manifest.studies || [];
  if (!certs.length && !studies.length) {
    host.innerHTML = `<div class="empty">No study paths or certifications in <code>data/index.json</code> yet.</div>`;
    return;
  }
  host.innerHTML = `<div class="empty">Loading your study library…</div>`;
  const [counts, loadedStudies] = await Promise.all([
    Promise.all(certs.map(certificationMaterialCounts)),
    Promise.all(studies.map((entry) => loadStudy(entry.id).catch(() => null))),
  ]);
  if (token !== state.galleryRenderToken || !state.galleryOpen) return;
  const active = certs.filter((cert) => !certificationArchive(cert.id));
  const archived = certs.filter((cert) => certificationArchive(cert.id));
  const section = (title, items) => items.length
    ? `<section class="cert-gallery__section"><h2>${title}<span>${items.length}</span></h2><div class="cert-gallery__grid">${items.map((cert) => renderCertificationCard(cert, counts[certs.indexOf(cert)])).join("")}</div></section>`
    : "";
  const studyItems = loadedStudies.filter(Boolean).map((item) => item.study);
  host.innerHTML = `${studies.length ? `<section class="cert-gallery__section"><h2>Study paths<span>${studies.length}</span></h2><div class="cert-gallery__grid">${studyItems.map(studyCard).join("")}</div>${studyItems.length < studies.length ? `<p class="panel__hint">Some study manifests are unavailable.</p>` : ""}</section>` : ""}${section("Currently studying", active)}${section("Archived", archived)}` || `<div class="empty">No study paths to show.</div>`;
}

function openCertificationGallery({ push = true } = {}) {
  if (!el("index").hidden) closeIndex();
  if (state.deck.open) { state.deck.progressChanged = false; closeDeck(); }
  if (state.report.open) closeReportPage();
  state.galleryOpen = true;
  state.studyOpen = false;
  el("openStories").disabled = true;
  el("openIndex").disabled = true;
  el("indexCount").textContent = "0";
  el("openStories").setAttribute("aria-label", "Escolha uma trilha ou certificação para abrir Stories");
  el("shell").hidden = true;
  el("certGallery").hidden = false;
  document.title = "Study Library — Skill Builder";
  if (push && location.hash !== "#/certifications/gallery") location.hash = "#/certifications/gallery";
  el("galleryTitle").textContent = "Study Library";
  renderCertificationGallery();
  el("galleryTitle").focus({ preventScroll: true });
}

function closeCertificationGallery() {
  state.galleryOpen = false;
  state.studyOpen = false;
  el("openStories").disabled = !state.attempt;
  el("openStories").setAttribute("aria-label", "Stories");
  el("openIndex").disabled = !state.attempt;
  el("openIndex").setAttribute("aria-label", "Reports");
  el("certGallery").hidden = true;
  el("shell").hidden = false;
  document.title = APP_TITLE;
}

function studyOfflineUrls() {
  const loaded = state.activeStudyManifest;
  if (!loaded) return [];
  const urls = [`${DATA}index.json`, safeStudyUrl("", loaded.entry.path)];
  for (const module of loaded.study.modules) for (const lesson of module.lessons) urls.push(safeStudyUrl(loaded.base, lesson.path));
  return [...new Set(urls.filter(Boolean))];
}

function openCertificationStudy(certId) {
  const cert = state.manifest.certifications.find((item) => item.id === certId);
  if (!cert) return;
  closeCertificationGallery();
  state.selectedCertificationId = cert.id;
  const exam = cert.exams?.[0] || null;
  state.selectedExamId = exam?.id || null;
  if (!exam) {
    state.exam = null;
    state.attempt = null;
    renderAll();
    location.hash = `#${cert.id}`;
    return;
  }
  loadAttempt(exam.attempts?.[0]?.id || null).catch((err) => toast(err.message));
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
  }
}

function renderCatalogControls() {
  const cert = currentCertification();
  el('openPreTestReview').href = `#/certifications/${cert?.id || ''}/pre-test-review`;
  const examEntry = currentExamEntry();
  const attempts = examEntry?.attempts || [];
  const archive = cert && certificationArchive(cert.id);
  const certLabel = el("certSelector").closest("label");
  certLabel.hidden = Boolean(archive);
  el("certArchiveState").hidden = !archive;
  el("certArchiveState").innerHTML = archive
    ? `<span>Archived · ${archive.status === "passed" ? "Passed" : "Finished studying"}</span><button class="linkbtn" id="restoreCurrentCert">Restore</button>`
    : "";
  el("archiveCertification").hidden = !cert || Boolean(archive);
  el("certSelector").innerHTML = state.manifest.certifications
    .filter((c) => !certificationArchive(c.id))
    .map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.code ? ` (${esc(c.code)})` : ""}</option>`)
    .join("");
  if (!archive) el("certSelector").value = state.selectedCertificationId || "";
  el("examSelector").innerHTML = (cert?.exams || [])
    .map((x) => `<option value="${esc(x.id)}">${esc(humanizeId(x.id))}</option>`).join("");
  el("examSelector").value = state.selectedExamId || "";
  el("attemptSelector").innerHTML = attempts.length
    ? attempts.map((x) => `<option value="${esc(x.id)}">${esc(attemptLabel(x))}</option>`).join("")
    : `<option value="">No attempts yet</option>`;
  el("attemptSelector").value = attempts.find((x) => x.id === state.attempt?.attemptId)?.id || attempts[0]?.id || "";
  const domains = certificationDomains();
  const domainLabel = el("certDomainLabel");
  domainLabel.hidden = !domains.length;
  if (domains.length) {
    const stored = localStorage.getItem(`sb-cert-domain:${cert?.id}`) || "";
    if (!state.selectedDomainId || !domains.some((d) => d.id === state.selectedDomainId)) state.selectedDomainId = domains.some((d) => d.id === stored) ? stored : "";
    el("certDomainSelector").innerHTML = `<option value="">All domains</option>${domains.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}${d.aggregateOnly ? " · aggregate only" : ""}</option>`).join("")}`;
    el("certDomainSelector").value = state.selectedDomainId;
    el("certDomainHelp").textContent = domains.some((d) => d.aggregateOnly) ? "Esta tentativa tem agregados por domínio; sem vínculos por questão, a lista continua sem filtro." : (state.attempt?.questions?.some((q) => q.domainId == null) ? "Questões sem associação explícita permanecem visíveis." : "Questões e materiais usam associações explícitas.");
  } else state.selectedDomainId = "";
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
  const matching = state.selectedDomainId ? items.filter((m) => (m.domainIds || []).includes(state.selectedDomainId)) : items;
  if (!items.length) {
    host.innerHTML = `<span class="panel__hint">No study materials in this exam yet.</span>`;
    return;
  }
  host.innerHTML = `${state.selectedDomainId && !matching.length ? `<span class="panel__hint">No materials are explicitly associated with this domain. ${items.length} materials remain available in All domains.</span>` : ""}${matching.map((m) =>
    `<button class="material-chip" data-material="${esc(m.id)}" data-scope="${m.scope}">
      ${m.type === "story" ? "▶ Story" : "▤ Report"} · ${esc(m.title)}
      <small>${m.scope === "exam" ? "shared" : "this attempt"}</small>
    </button>`
  ).join("")}`;
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
    <div class="head__score">
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
  if (!state.galleryOpen && !state.studyOpen) {
    el("openStories").disabled = !state.attempt;
    el("openStories").setAttribute("aria-label", "Stories");
  }
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
const LEARNING_CARD_SECTIONS = [
  "Topic",
  "Where the initial model breaks",
  "A more complete model",
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
  const names = /^\s*[-*]\s+\*\*Story mode\*\*\s*:\s*learning\s*$/im.test(text) ? LEARNING_CARD_SECTIONS : CARD_SECTIONS;
  const screens = names.map((name) => ({ name, body: [] }));
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
      const i = names.indexOf(h2[1].trim());
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
  if (state.studyOpen) return openStudyReportIndex();
  if (state.galleryOpen || !state.attempt) {
    toast("Escolha uma trilha ou certificação para abrir seus Reports.");
    return;
  }
  state.studyReportIndex = null;
  const all = reportList();
  const date = formatAttemptDate(state.attempt);
  el("indexSub").textContent = `${all.length} reports for this attempt${date ? ` · ${date}` : ""}`;
  el("index").hidden = false;
  document.body.style.overflow = "hidden";
  renderReadFilter();
  renderIndex("");
  el("indexSearch").value = "";
  el("indexSearch").focus();
}

function closeIndex() {
  state.studyReportIndex = null;
  el("index").hidden = true;
  document.body.style.overflow = "";
  el("openIndex").focus();
}

function buildStudyReportOutline(host) {
  const nav = host.querySelector('.study-report-outline nav');
  if (!nav) return;
  host.querySelectorAll('.study-markdown h2').forEach((heading, index) => {
    heading.id = `study-report-section-${index}`;
    heading.tabIndex = -1;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = heading.textContent;
    button.addEventListener('click', () => {
      heading.scrollIntoView({ block: 'start' });
      heading.focus({ preventScroll: true });
    });
    nav.append(button);
  });
}

function studyReportItems(study, domainId = null) {
  return study.modules.flatMap((module) => module.lessons
    .filter((lesson) => lesson.type === "report" && (!domainId || studyLessonDomains(module, lesson).includes(domainId)))
    .map((lesson) => ({ module, lesson, domainId: domainId || module.domainId })));
}

async function openStudyReportIndex() {
  const route = /^#\/studies\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/.exec(location.hash);
  if (!route) return;
  const context = location.hash;
  try {
    const loaded = await loadStudy(route[1]);
    if (!loaded || !state.studyOpen || location.hash !== context) return;
    const items = studyReportItems(loaded.study, route[2] || null);
    const index = { ...loaded, items, context };
    state.studyReportIndex = index;
    el("indexSearch").value = "";
    el("indexSub").textContent = `${items.length} Reports · ${loaded.study.title}${route[2] ? ` · ${loaded.study.domains.find((d) => d.id === route[2])?.name || route[2]}` : " · Todos os domínios"}`;
    el("index").hidden = false;
    document.body.style.overflow = "hidden";
    renderReadFilter();
    renderIndex("");
    el("indexSearch").focus();
    await Promise.all(items.map(async (item) => {
      try {
        const url = safeStudyUrl(loaded.base, item.lesson.path);
        if (!url) return;
        const response = await fetch(url);
        if (response.ok) item.searchText = await response.text();
      } catch { /* The lesson reader reports unavailable files on open. */ }
    }));
    if (state.studyReportIndex === index && !el("index").hidden && location.hash === context) renderIndex(el("indexSearch").value);
  } catch { toast("Não foi possível carregar os Reports da trilha."); }
}

function renderStudyReportIndex(needle) {
  const index = state.studyReportIndex;
  if (!index) return;
  const term = needle.trim().toLocaleLowerCase();
  const completed = (item) => StudyPathProgress.isComplete(localStorage, index.study.id, item.module.id, item.lesson.id);
  const items = index.items.filter((item) =>
    (state.readFilter !== "unread" || !completed(item)) &&
    (state.readFilter !== "read" || completed(item)) &&
    (!term || [item.lesson.title, item.module.title, item.searchText || ""].join(" ").toLocaleLowerCase().includes(term)));
  el("indexBody").innerHTML = items.map((item) => `<div class="rpt${completed(item) ? " rpt--read" : ""}"><a class="rpt__main" data-study-report href="${esc(studyRoute(index.study.id, item.domainId, item.module.id, item.lesson.id))}"><span class="rpt__n">R</span><span><span class="rpt__topic">${esc(item.lesson.title)}</span><span class="rpt__meta">${esc(item.module.title)} · ${completed(item) ? "Concluído" : "Pendente"}</span></span></a></div>`).join("") || `<div class="empty">Nenhum Report neste filtro.</div>`;
}

/* Three views of the same list: what is left, everything, what is done. The
   counts sit in the chips so the choice is legible without opening anything. */
function renderReadFilter() {
  if (state.studyReportIndex) {
    const { study, items } = state.studyReportIndex;
    const done = items.filter((item) => StudyPathProgress.isComplete(localStorage, study.id, item.module.id, item.lesson.id)).length;
    const counts = { unread: items.length - done, all: items.length, read: done };
    const labels = { unread: "Pendentes", all: "Todos", read: "Concluídos" };
    el("readChips").innerHTML = Object.keys(labels).map((key) => `<button class="chip" data-readfilter="${key}" aria-pressed="${state.readFilter === key}">${labels[key]}<span class="chip__n">${counts[key]}</span></button>`).join("");
    el("readProgress").textContent = `${done} de ${items.length} concluídos · marcação explícita`;
    return;
  }
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
  if (el("index").hidden) return;
  if (state.studyReportIndex) return renderStudyReportIndex(needle);
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
  const attempt = state.attempt;
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
  if (state.attempt === attempt && !state.studyOpen && !state.galleryOpen) {
    el("indexCount").textContent = notes.length;
  }
}

/* ---------- Full-page report ---------- */

/* A link from the last Story screen opens this route in a new tab:
   #<cert>/<exam>/<attempt>/<report-material-id>. It is a real page, not the
   in-app reader overlay: one report, its own title and table of contents, and
   a print view. The Markdown is the same file the reader uses. */
const APP_TITLE = "Skill Builder — certification study library";

function selectionHash() {
  const a = state.attempt;
  const path = !a ? `#${state.selectedCertificationId || ""}/${state.selectedExamId || ""}` : `#${a.certificationId}/${a.examId}/${a.attemptId}`;
  return state.selectedDomainId ? `${path}?domain=${encodeURIComponent(state.selectedDomainId)}` : path;
}

function reportHash(material) {
  return `${selectionHash().split("?")[0]}/${material.id}${state.selectedDomainId ? `?domain=${encodeURIComponent(state.selectedDomainId)}` : ""}`;
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

const reportMobile = window.matchMedia('(max-width: 900px)');

function placeReviewTopics() {
  const review = state.report.material?.kind === 'pretest';
  const mobile = review && reportMobile.matches;
  const topics = el('reportTopics');
  const header = el('reportTopicHeader');
  const destination = mobile ? header : el('reportAside');
  if (topics.parentElement !== destination) {
    if (mobile) destination.append(topics);
    else destination.insertBefore(topics, el('reportBack'));
    topics.open = !mobile;
  }
  if (review && !mobile) topics.open = true;
  header.hidden = !mobile || !state.report.headings.length;
  el('reviewTopicSteps').hidden = !review || !state.report.headings.length;
  el('reportTopicSearch').hidden = !review;
  el('reportToc').setAttribute('aria-label', review ? 'Review topics' : 'Report contents');
}

function filterReportTopics() {
  const query = el('reportTopicSearch').value.trim().toLocaleLowerCase();
  let visible = 0;
  for (const link of el('reportToc').querySelectorAll('a[data-sec]')) {
    link.hidden = !link.textContent.toLocaleLowerCase().includes(query);
    if (!link.hidden) visible++;
  }
  el('reportTopicEmpty').hidden = Boolean(visible) || !state.report.headings.length;
  if (!query) highlightReportTopic(el('reportToc').querySelector('[aria-current="true"]')?.dataset.sec, true);
}

function buildReportToc() {
  const heads = [...el("reportContent").querySelectorAll("h2, h3")];
  state.report.headings = heads;
  const toc = el("reportToc");
  el("reportView").classList.toggle("is-single", !heads.length);
  if (!heads.length) {
    toc.innerHTML = "";
    placeReviewTopics();
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
  filterReportTopics();
  placeReviewTopics();
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
  highlightReportTopic(active);

  if (state.report.n && pct >= 99) {
    if (max > 4 && sc.scrollTop <= 0) return;
    markRead(state.report.n, true, true);
  }
}

function highlightReportTopic(active, reveal = false) {
  const headings = state.report.headings;
  const index = Math.max(0, headings.findIndex(h => h.id === active));
  state.report.topicIndex = index;
  if (state.report.material?.kind === 'pretest' && headings.length) {
    const count = el('reviewTopicCount');
    const label = `${index + 1}/${headings.length}`;
    if (count.textContent !== label) {
      count.textContent = label;
      count.setAttribute('aria-label', `Topic ${index + 1} of ${headings.length}`);
    }
    el('reviewTopicPrevious').disabled = index === 0;
    el('reviewTopicNext').disabled = index === headings.length - 1;
  }
  for (const a of el("reportToc").querySelectorAll("a[data-sec]")) {
    const current = a.dataset.sec === active;
    const wasCurrent = a.getAttribute('aria-current') === 'true';
    a.classList.toggle("is-active", current);
    if (current) a.setAttribute("aria-current", "true");
    else a.removeAttribute("aria-current");
    if (current && (!wasCurrent || reveal) && !a.hidden && state.report.material?.kind === 'pretest' && !reportMobile.matches) {
      const nav = el('reportToc');
      const item = a.getBoundingClientRect(), frame = nav.getBoundingClientRect();
      if (item.top < frame.top) nav.scrollTop += item.top - frame.top;
      else if (item.bottom > frame.bottom) nav.scrollTop += item.bottom - frame.bottom;
    }
  }

}

function goToReportTopic(target, { focus = true, instant = false } = {}) {
  if (!target) return;
  if (state.report.material?.kind === 'pretest' && reportMobile.matches) el('reportTopics').open = false;
  if (focus) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  const scroll = el('reportScroll');
  scroll.scrollTo({
    top: scroll.scrollTop + target.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 20,
    behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  });
  highlightReportTopic(target.id, true);
}

async function openReportPage(material) {
  if (!material) return;
  const token = ++state.report.token;
  state.report.open = true;
  state.report.material = material;
  state.report.n = material.questionNumber || null;
  state.report.reviewBundle = null;
  state.report.headings = [];
  el('reviewSaveOffline').hidden = material.kind !== 'pretest';
  el('reviewSaveOffline').disabled = true;
  el('reviewSaveOffline').textContent = 'Save offline';
  el('reviewNotice').hidden = true;
  el('reviewReading').hidden = true;
  el('reportView').classList.toggle('is-pretest', material.kind === 'pretest');
  el('reportTopics').open = material.kind !== 'pretest';
  el('reportTopicSearch').value = '';
  el('reportTopicEmpty').hidden = true;
  placeReviewTopics();

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
    let text;
    if (material.loadText) text = await material.loadText();
    else {
      const res = await fetch(material.url);
      if (!res.ok) throw new Error('Report unavailable');
      text = await res.text();
    }
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
    if (material.decorate) material.decorate(content);
    buildReportToc();
    el('reportTopicsSummary').textContent = `Browse topics (${state.report.headings.length})`;
    content.setAttribute("aria-busy", "false");
    el("reportScroll").scrollTop = 0;
    el("reportTitle").focus({ preventScroll: true });
    onReportScroll();
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
  const wasReview = state.report.material?.kind === 'pretest';
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
  if (wasReview) {
    if (!state.attempt) renderAll();
    el('openPreTestReview').focus();
  }
  state.report.reviewBundle = null;
}

function handleReportRoute() {
  const [routePath, routeQuery = ""] = location.hash.split("?");
  const query = new URLSearchParams(routeQuery);
  const routeDomain = query.get("domain");
  if (routeDomain) state.selectedDomainId = routeDomain;
  const reviewRoute = /^#\/certifications\/([a-z0-9-]+)\/pre-test-review(?:\?reading=(10|30|60))?$/.exec(location.hash);
  if (reviewRoute) {
    if (state.report.open && state.report.material?.reviewCertId === reviewRoute[1] && state.report.material?.readingMinutes === Number(reviewRoute[2] || 60)) return;
    openPreTestReview(reviewRoute[1], Number(reviewRoute[2] || 60));
    return;
  }
  if (state.report.material?.kind === 'pretest') closeReportPage();
  if (!state.attempt) {
    if (currentExamEntry()) {
      loadAttempt(currentExamEntry().attempts[0]?.id || null, { push: false })
        .then(() => { if (state.attempt) handleReportRoute(); })
        .catch(() => toast('The selected attempt could not be loaded.'));
    }
    return;
  }
  const parts = routePath.slice(1).split("/");
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

async function openPreTestReview(certId, readingMinutes = 60) {
  const cert = state.manifest?.certifications.find(c => c.id === certId);
  if (!cert) { toast('Certification not found'); return; }
  if (state.selectedCertificationId !== certId) {
    state.selectedCertificationId = certId;
    state.selectedExamId = cert.exams[0]?.id || null;
    state.attempt = null; state.exam = null;
    renderCatalogControls(); renderRail();
  }
  let bundle;
  const material = {
    id: 'pre-test-review', kind: 'pretest', reviewCertId: certId, readingMinutes,
    title: 'Pre-Test Review', url: 'data/',
    loadText: async () => {
      let cache;
      try { cache = await caches.open(PreTestReview.CACHE); } catch { /* Reading still works without Cache API. */ }
      bundle = await PreTestReview.load(certId, { cache, currentCert: cert });
      if (bundle.missing) throw new Error('Certification not found');
      if (bundle.empty) return '# Pre-Test Review\n\nNo review has been prepared for this certification yet. It will be updated when study content is prepared.';
      material.url = PreTestReview.safePath(`data/${certId}`, bundle.cert.preTestReview.path, '.json');
      const date = new Date(bundle.review.updatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const mapped = bundle.review.coverage.filter(q => q.topicIds?.length).length;
      const selectedText = bundle.readings?.[readingMinutes] ?? bundle.text;
      return `# Pre-Test Review${bundle.review.readingVersions ? ` — ${readingMinutes === 60 ? '1 hour' : readingMinutes + ' minutes'}` : ''}\n\n- **Certification:** ${cert.name}\n- **Updated:** ${date}\n- **Attempts included:** ${bundle.review.inputs.attempts.length}\n- **Questions in full review:** ${mapped}\n\n${selectedText.replace(/^# .+\r?\n/, '')}`;
    },
    decorate: content => {
      if (!bundle?.review) { el('reviewSaveOffline').hidden = true; return; }
      state.report.reviewBundle = bundle;
      el('reviewReading').hidden = !bundle.review.readingVersions;
      el('reviewReadingTime').value = String(readingMinutes);
      const notice = el('reviewNotice');
      const messages = [];
      if (bundle.review.readingVersions) messages.push(readingMinutes < 60 ? 'Selected lessons for this reading budget; the 1-hour document retains full coverage. Reading times are approximate.' : 'Full review. Allow about 1 hour for deliberate study; reading speed varies.');
      const draft = bundle.review.editorialStatus !== 'reviewed';
      if (draft) messages.push('Editorial draft: the complete study synthesis has not yet been verified.');
      if (bundle.stale) messages.push('Update needed: attempts or materials have changed since this review was prepared.');
      if (bundle.offline) messages.push('Saved copy. Changes made since it was saved cannot be checked offline.');
      else if (!bundle.verified) messages.push('Freshness could not be verified for all study inputs.');
      else if (!bundle.stale) messages.push('Up to date with all available attempts and study materials.');
      if (bundle.review.gaps.length) messages.push(`${bundle.review.gaps.length} limitation(s); see Review limitations below.`);
      const pending = bundle.review.coverage.filter(q => q.pending);
      if (pending.length) messages.push(`${pending.length} question(s) still need editorial review.`);
      const offlineSupported = 'serviceWorker' in navigator && 'caches' in globalThis;
      if (!offlineSupported) messages.push('Offline saving requires HTTPS or localhost. You can read this review online.');
      notice.textContent = messages.join(' ');
      notice.hidden = false;
      notice.classList.toggle('is-warning', Boolean(draft || bundle.stale || pending.length || bundle.review.gaps.length || !bundle.verified));
      el('reviewSaveOffline').disabled = !offlineSupported;
      el('reviewSaveOffline').textContent = !offlineSupported ? 'Offline unavailable' : bundle.offline ? 'Save offline again' : 'Save offline';
      if (bundle.review.gaps.length) {
        const details = document.createElement('details'); details.className = 'pretest-sources';
        const summary = document.createElement('summary'); summary.textContent = 'Review limitations';
        const list = document.createElement('ul');
        for (const gap of bundle.review.gaps) { const li = document.createElement('li'); li.textContent = gap; list.append(li); }
        details.append(summary, list); content.prepend(details);
      }
      for (const topic of bundle.review.topics) {
        const heading = [...content.querySelectorAll('h2')].find(h => h.textContent.trim() === topic.heading);
        if (!heading) continue;
        heading.id = `review-topic-${topic.id}`;
        const refs = bundle.review.coverage.filter(q => q.topicIds?.includes(topic.id));
        const references = topic.references || [];
        if (!refs.length && !references.length) continue;
        const details = document.createElement('details');
        details.className = 'pretest-sources';
        const summary = document.createElement('summary');
        summary.textContent = references.length
          ? `Sources (${refs.length} question${refs.length === 1 ? '' : 's'}, ${references.length} reference${references.length === 1 ? '' : 's'})`
          : `Source questions (${refs.length})`;
        details.append(summary);
        const list = document.createElement('ul');
        for (const q of refs) {
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.href = `#${certId}/${encodeURIComponent(q.examId)}/${encodeURIComponent(q.attemptId)}${q.reportId ? '/' + encodeURIComponent(q.reportId) : ''}`;
          link.target = '_blank'; link.rel = 'noopener';
          link.textContent = `${humanizeId(q.examId)} · ${q.attemptId} · Q${q.questionNumber}`;
          li.append(link, ` — ${(bundle.review.inputs.eligibleQuestions.find(x => x.examId === q.examId && x.attemptId === q.attemptId && x.questionNumber === q.questionNumber)?.reasons || []).join(', ')}`);
          list.append(li);
        }
        for (const reference of references) {
          const url = new URL(reference.url);
          if (url.protocol !== 'https:' || url.username || url.password) continue;
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.textContent = reference.title;
          li.append(link); list.append(li);
        }
        details.append(list);
        let next = heading.nextElementSibling;
        while (next && next.tagName !== 'H2') next = next.nextElementSibling;
        content.insertBefore(details, next);
      }
      if (pending.length) {
        const details = document.createElement('details');
        const summary = document.createElement('summary'); summary.textContent = 'Editorial gaps';
        details.append(summary);
        for (const q of pending) {
          const p = document.createElement('p');
          p.textContent = `${q.examId} · ${q.attemptId} · Q${q.questionNumber}: ${q.pending}`;
          details.append(p);
        }
        content.prepend(details);
      }
    },
  };
  await openReportPage(material);
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
  if (!label) return;
  const supported = window.isSecureContext && "serviceWorker" in navigator && "caches" in window;
  if (!supported) {
    el("offlineBtn").disabled = true;
    el("offlineBtn").title = "Offline saving requires HTTPS or localhost and browser storage support. Online reading remains available.";
    label.textContent = "Offline unavailable";
    return;
  }
  el("offlineBtn").disabled = !state.studyOpen && !state.attempt;
  if (state.studyOpen) {
    if (!("caches" in window)) return;
    try {
      const urls = studyOfflineUrls();
      let hit = 0;
      for (const url of urls) if (await caches.match(url)) hit++;
      const ready = urls.length > 0 && hit >= urls.length;
      label.textContent = ready ? "✓ Offline" : "Offline";
      el("offlineBtn").title = ready ? "This study path is saved for offline reading" : "Save this study path for offline reading";
    } catch { /* Cache API can be unavailable in private browsing. */ }
    return;
  }
  if (!state.attempt) return;
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
  if (!window.isSecureContext || !("serviceWorker" in navigator) || !("caches" in window)) {
    await refreshOfflineUi();
    return;
  }
  const btn = el("offlineBtn");
  const label = el("offlineLabel");
  const studySave = state.studyOpen;
  const urls = studySave ? studyOfflineUrls() : storyUrls();
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
      ? (studySave ? "Study path saved for offline" : "Stories saved for offline")
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
  // one until the new worker takes control. Reload once on that handoff so a
  // stale tab cannot keep rendering an older local catalog indefinitely.
  if ("serviceWorker" in navigator) {
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloadingForControllerChange = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      // The worker refreshes manifest-driven library/study routes itself,
      // including clients still running an older app shell.
      if (location.hash === "#/certifications/gallery" || location.hash.startsWith("#/studies/")) return;
      if (reloadingForControllerChange) return;
      reloadingForControllerChange = true;
      location.reload();
    });
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        if (!reg) return;
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              toast("New version downloaded — updating this page");
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
  if (state.studyOpen) return openStudyDeck();
  if (state.galleryOpen || !state.attempt) {
    toast("Escolha uma trilha ou certificação para abrir seus Stories.");
    return;
  }
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

  state.deck.kind = "attempt";
  state.deck.returnFocus = document.activeElement;
  state.deck.open = true;
  state.deck.list = pool.map((q) => q.n);
  el("deck").hidden = false;
  document.body.style.overflow = "hidden";
  el("deckReadBtn").hidden = false;
  el("deckClose").focus();
  const i = Math.max(0, state.deck.list.indexOf(start));
  showDeckSlide(i, slide);
  if (n == null && slide > 0) toast(`Continuing at Q${start} — screen ${slide + 1}/${CARD_SECTIONS.length}`);
}

function closeDeck() {
  const refreshStudy = state.deck.kind === "study" && state.deck.progressChanged && state.studyOpen;
  state.deck.open = false;
  state.deck.renderToken = (state.deck.renderToken || 0) + 1;
  el("deck").hidden = true;
  document.body.style.overflow = "";
  state.deck.returnFocus?.focus();
  state.deck.progressChanged = false;
  if (refreshStudy) openStudyPath(state.activeStudy.id, { push: false });
}

async function openStudyDeck() {
  const route = /^#\/studies\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?/.exec(location.hash);
  if (!route) return;
  const context = location.hash;
  try {
    const loaded = await loadStudy(route[1]);
    if (!state.studyOpen || location.hash !== context) return;
    if (!loaded) throw new Error("Study unavailable");
    const { study, base } = loaded;
    const domainId = route[2] || null;
    const items = study.modules.flatMap((module) => module.lessons
      .filter((lesson) => lesson.type === "story" && (!domainId || studyLessonDomains(module, lesson).includes(domainId)))
      .map((lesson) => ({
        key: StudyPathProgress.lessonKey(module.id, lesson.id),
        moduleId: module.id, lessonId: lesson.id,
        title: lesson.title, card: safeStudyUrl(base, lesson.path),
      }))).filter((item) => item.card);
    if (!items.length) {
      toast("Nenhum Story disponível neste domínio da trilha.");
      return;
    }
    state.deck = { ...state.deck, kind: "study", open: true, studyId: study.id,
      items, list: items.map((item) => item.key), n: items[0].key, slide: 0,
      progressChanged: false, returnFocus: document.activeElement };
    el("deck").hidden = false;
    document.body.style.overflow = "hidden";
    el("deckReadBtn").hidden = false;
    el("deckClose").focus();
    showStudyDeckSlide(0, 0);
  } catch {
    toast("Não foi possível carregar os Stories desta trilha.");
  }
}

function paintStudyStoryCompletion(item) {
  const complete = StudyPathProgress.isComplete(localStorage, state.deck.studyId, item.moduleId, item.lessonId);
  const button = el("deckReadBtn");
  button.textContent = complete ? "✓" : "○";
  button.setAttribute("aria-pressed", String(complete));
  button.setAttribute("aria-label", complete ? "Desmarcar conclusão da lição" : "Marcar lição como concluída");
  button.title = button.getAttribute("aria-label");
}

async function showStudyDeckSlide(i, slide) {
  const items = state.deck.items;
  if (!items?.length) return;
  if (slide >= 4) { i++; slide = 0; }
  if (slide < 0) { i--; slide = 3; }
  if (i < 0) return;
  if (i >= items.length) return closeDeck();
  const item = items[i];
  state.deck.n = item.key;
  state.deck.slide = slide;
  const token = state.deck.renderToken = (state.deck.renderToken || 0) + 1;
  el("deckQ").textContent = `Story ${i + 1}`;
  el("deckTopic").textContent = item.title;
  el("deckSlide").textContent = `${slide + 1}/4`;
  el("deckCount").textContent = `story ${i + 1} of ${items.length}`;
  el("deckPrev").disabled = i === 0 && slide === 0;
  el("deckNext").textContent = i === items.length - 1 && slide === 3 ? "✓" : "›";
  paintStudyStoryCompletion(item);
  el("deckScroll").scrollTop = 0;
  el("deckBody").innerHTML = `<p class="panel__hint">Loading…</p>`;
  try {
    const card = await loadCard(item);
    if (!state.deck.open || state.deck.kind !== "study" || token !== state.deck.renderToken) return;
    el("deckBars").innerHTML = card.screens.map((screen, k) => `<i class="${k < slide ? "is-done" : k === slide ? "is-now" : ""}" title="${esc(screen.name)}"></i>`).join("");
    const screen = card.screens[slide];
    const meta = card.head.meta;
    const metadata = slide === 0 ? `<div class="deck__meta">${[meta.domain, meta.task, meta.signal].filter(Boolean).map((value) => `<span>${esc(value)}</span>`).join("")}</div>` : "";
    const base = item.card.slice(0, item.card.lastIndexOf("/") + 1);
    el("deckBody").innerHTML = `<div class="deck__kicker"><span class="deck__step">${slide + 1}/4</span>${esc(screen.name)}</div>${metadata}${renderMarkdown(screen.body.join("\n"), base)}`;
    wrapTables(el("deckBody"));
  } catch {
    if (state.deck.open && token === state.deck.renderToken) el("deckBody").innerHTML = `<p class="panel__hint">Não foi possível carregar este Story.</p>`;
  }
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
  const token = state.deck.renderToken = (state.deck.renderToken || 0) + 1;
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

  el("deckBody").innerHTML = kicker + `<p class="panel__hint">Loading…</p>`;
  try {
    const card = await loadCard(q);
    if (!state.deck.open || state.deck.kind !== "attempt" || token !== state.deck.renderToken) return;
    const body = card.screens[slide].body.join("\n").trim();
    // A card sits in the cards/ subfolder, so relative links resolve from there.
    const cardUrl = cardPath(q);
    const base = cardUrl.slice(0, cardUrl.lastIndexOf("/") + 1);
    // The domain, the task and the signal come from the card's own front
    // matter, which is only known once the card has been loaded.
    const meta = card.head.meta || {};
    const head =
      slide === 0
        ? `<div class="deck__meta">
             ${meta.domain ? `<span><b>${esc(meta.domain)}</b></span>` : ""}
             ${meta.task ? `<span>${esc(meta.task)}</span>` : ""}
             ${meta.signal ? `<span class="deck__signal">the signal in the stem: ${renderInline(
               meta.signal
             )}</span>` : ""}
           </div>`
        : "";
    el("deckBody").innerHTML =
      kicker + head + (body ? renderMarkdown(body, base) : `<p class="panel__hint">This screen is empty.</p>`);
    wrapTables(el("deckBody"));
  } catch (err) {
    if (state.deck.open && state.deck.kind === "attempt" && token === state.deck.renderToken) el("deckBody").innerHTML = kicker + `<p class="panel__hint">Could not read the card: ${esc(err.message)}</p>`;
  }
}

const stepDeck = (delta) => {
  if (!state.deck.open) return;
  const at = Math.max(0, state.deck.list.indexOf(state.deck.n));
  if (state.deck.kind === "study") showStudyDeckSlide(at, state.deck.slide + delta);
  else showDeckSlide(at, state.deck.slide + delta);
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
  if (!examEntry) {
    state.exam = null; state.attempt = null;
    if (push) location.hash = selectionHash();
    renderAll();
    return;
  }
  const examResponse = await fetch(`${DATA}${examEntry.path}`);
  if (!examResponse.ok) throw new Error(`${DATA}${examEntry.path} not found (${examResponse.status})`);
  state.exam = await examResponse.json();
  if (!entry) {
    state.attempt = null;
    if (push) location.hash = selectionHash();
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
  if (push) location.hash = selectionHash();
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

/* Theme selection cycles through the three instrument themes in this order.
   "dark"/"light" were the previous values and migrate to their closest match,
   so an existing local choice is not lost. */
const THEMES = ["graphite", "workshop", "chalk"];
const THEME_MIGRATION = { dark: "graphite", light: "workshop" };
const THEME_GLYPH = { graphite: "◑", workshop: "◐", chalk: "○" };
const THEME_CANVAS = { graphite: "#151719", workshop: "#e8e1ce", chalk: "#e9e7e1" };

function paintTheme() {
  const theme = document.documentElement.dataset.theme;
  const current = THEMES.includes(theme) ? theme : "graphite";
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const label = `Theme: ${current}. Switch to ${next}`;
  for (const id of ["themeBtn", "reportTheme"]) {
    const button = el(id);
    if (!button) continue;
    button.textContent = THEME_GLYPH[current];
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_CANVAS[current];
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme;
  const current = THEMES.includes(theme) ? theme : "graphite";
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("sb-theme", next);
  } catch {
    /* private mode: the theme still applies for this session */
  }
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
    state.selectedDomainId = localStorage.getItem(`sb-cert-domain:${state.selectedCertificationId}`) || "";
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
  el("archiveCertification").addEventListener("click", archiveCurrentCertification);
  el("archiveCancel").addEventListener("click", () => el("archiveDialog").close());
  el("archiveForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = new FormData(event.currentTarget).get("archiveStatus");
    saveCertificationArchive(status);
    if (state.certificationStatus[state.selectedCertificationId]) el("archiveDialog").close();
  });
  el("openGallery").addEventListener("click", () => openCertificationGallery());
  el("galleryBack").addEventListener("click", () => {
    if (state.studyOpen) {
      location.hash = "#/certifications/gallery";
      return;
    }
    const target = selectionHash();
    closeCertificationGallery();
    if (location.hash !== target) location.hash = target;
  });
  el("galleryContent").addEventListener("click", (event) => {
    const openStudy = event.target.closest("[data-open-study]");
    if (openStudy) return openStudyPath(openStudy.dataset.openStudy);
    const complete = event.target.closest("[data-toggle-study-complete]");
    if (complete) {
      const [moduleId, lessonId] = complete.dataset.toggleStudyComplete.split("|");
      if (StudyPathProgress.toggle(localStorage, state.activeStudy.id, moduleId, lessonId)) openStudyPath(state.activeStudy.id, { push: false });
      return;
    }
    const review = event.target.closest("[data-toggle-study-review]");
    if (review) {
      const [moduleId, lessonId] = review.dataset.toggleStudyReview.split("|");
      if (StudyPathProgress.toggleReview(localStorage, state.activeStudy.id, moduleId, lessonId)) openStudyPath(state.activeStudy.id, { push: false });
      return;
    }
    const restore = event.target.closest("[data-restore-cert]");
    if (restore) return restoreCertification(restore.dataset.restoreCert);
    const open = event.target.closest("[data-open-cert]");
    if (open) openCertificationStudy(open.dataset.openCert);
  });
  el("certArchiveState").addEventListener("click", (event) => {
    if (event.target.closest("#restoreCurrentCert")) restoreCertification(state.selectedCertificationId);
  });
  el("certDomainSelector").addEventListener("change", () => {
    state.selectedDomainId = el("certDomainSelector").value;
    try { localStorage.setItem(`sb-cert-domain:${state.selectedCertificationId}`, state.selectedDomainId); } catch { /* domain remains selected for this session */ }
    location.hash = selectionHash();
    renderAll();
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
    const studyReport = e.target.closest("[data-study-report]");
    if (studyReport) {
      closeIndex();
      if (location.hash === studyReport.getAttribute("href")) {
        el("galleryContent").querySelector(".study-path__title")?.focus();
      }
      return;
    }
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
  el("deckReadBtn").addEventListener("click", () => {
    if (state.deck.kind === "study") {
      const item = state.deck.items.find((item) => item.key === state.deck.n);
      if (item && StudyPathProgress.toggle(localStorage, state.deck.studyId, item.moduleId, item.lessonId)) {
        state.deck.progressChanged = true;
        paintStudyStoryCompletion(item);
      }
      return;
    }
    markRead(state.deck.n, !isRead(state.deck.n));
  });
  wireDeckGestures();
  wirePwa();

  // full-page report
  el("reportPrint").addEventListener("click", () => window.print());
  el('reviewReadingTime').addEventListener('change', event => {
    const material = state.report.material;
    if (material?.kind === 'pretest') location.hash = `#/certifications/${material.reviewCertId}/pre-test-review?reading=${event.target.value}`;
  });
  el('reviewSaveOffline').addEventListener('click', async () => {
    const bundle = state.report.reviewBundle;
    if (!bundle) return;
    const button = el('reviewSaveOffline');
    button.disabled = true; button.textContent = 'Saving…';
    try {
      if (!navigator.serviceWorker?.controller) throw new Error('Reload once online to enable offline reading.');
      await PreTestReview.save(bundle, await caches.open(PreTestReview.CACHE));
      button.textContent = 'Saved offline';
      toast('Complete Pre-Test Review saved for offline reading');
    } catch {
      button.textContent = 'Retry save';
      toast('Could not save the review. Keep the page open; reconnect or reload online and retry.');
    } finally { button.disabled = false; }
  });
  el("reportReadBtn").addEventListener("click", () => {
    if (state.report.n) markRead(state.report.n, !isRead(state.report.n));
  });
  el("reportScroll").addEventListener("scroll", onReportScroll, { passive: true });
  el("reportToc").addEventListener("click", (e) => {
    const link = e.target.closest("a[data-sec]");
    if (!link) return;
    e.preventDefault();
    goToReportTopic(document.getElementById(link.dataset.sec));
  });
  for (const [id, delta] of [['reviewTopicPrevious', -1], ['reviewTopicNext', 1]]) {
    el(id).addEventListener('click', () => {
      const target = state.report.headings[(state.report.topicIndex || 0) + delta];
      goToReportTopic(target, { focus: false, instant: true });
    });
  }
  el('reportTopicSearch').addEventListener('input', filterReportTopics);
  reportMobile.addEventListener('change', placeReviewTopics);
  window.addEventListener("hashchange", () => {
    const studyRoute = /^#\/studies\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?$/.exec(location.hash);
    if (studyRoute) {
      openStudyPath(studyRoute[1], { push: false });
      return;
    }
    if (location.hash === "#/certifications/gallery") {
      openCertificationGallery({ push: false });
      return;
    }
    if (state.galleryOpen || state.studyOpen) closeCertificationGallery();
    handleReportRoute();
  });

  el("themeBtn").addEventListener("click", toggleTheme);
  el("reportTheme").addEventListener("click", toggleTheme);

  const saved = localStorage.getItem("sb-theme");
  const theme = THEME_MIGRATION[saved] || saved;
  if (THEMES.includes(theme)) document.documentElement.dataset.theme = theme;
  paintTheme();

  document.addEventListener("keydown", (e) => {
    const typingNow = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);

    if (e.key === "Escape") {
      if (state.report.open && state.report.material?.kind === 'pretest' && reportMobile.matches && el('reportTopics').open) {
        e.preventDefault();
        el('reportTopics').open = false;
        el('reportTopicsSummary').focus();
        return;
      }
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
  state.certificationStatus = CertificationStatus.read(localStorage);
  const certifications = state.manifest.certifications || [];
  const [initialPath, initialQuery = ""] = location.hash.split("?");
  state.selectedDomainId = new URLSearchParams(initialQuery).get("domain") || "";
  const studyRoute = /^#\/studies\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?(?:\/([a-z0-9-]+))?$/.exec(location.hash);
  if (studyRoute) {
    openStudyPath(studyRoute[1], { push: false });
    return;
  }
  if (location.hash === "#/certifications/gallery") {
    openCertificationGallery({ push: location.hash !== "#/certifications/gallery" });
    return;
  }
  if (!certifications.length) {
    if (state.manifest.studies?.length) {
      openCertificationGallery({ push: location.hash !== "#/certifications/gallery" });
      return;
    }
    el("list").innerHTML = `<div class="empty">No certifications in <code>data/index.json</code> yet.</div>`;
    return;
  }
  // A certification review must open even if an individual attempt is unavailable.
  const directReview = /^#\/certifications\/([a-z0-9-]+)\/pre-test-review(?:\?reading=(10|30|60))?$/.exec(location.hash);
  const directCert = directReview && certifications.find(c => c.id === directReview[1]);
  if (directCert) {
    state.selectedCertificationId = directCert.id;
    state.selectedExamId = directCert.exams[0]?.id || null;
    renderCatalogControls(); renderRail();
    await openPreTestReview(directCert.id, Number(directReview[2] || 60));
    return;
  }
  const hasDirectCertificationRoute = certifications.some((cert) =>
    location.hash === `#${cert.id}` || location.hash.startsWith(`#${cert.id}/`)
  );
  if (certifications.length && activeCertifications().length === 0 && !hasDirectCertificationRoute) {
    openCertificationGallery();
    return;
  }
  const hash = initialPath.slice(1).split("/");
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("sb-selection") || "null"); } catch { /* ignore invalid local selection */ }
  const candidates = [
    hash.length >= 2 ? { certificationId: hash[0], examId: hash[1], attemptId: hash[2] || null } : null,
    saved && !certificationArchive(saved.certificationId) ? saved : null,
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
    state.selectedCertificationId = selection.cert.id;
    renderCatalogControls();
    el("list").innerHTML = `<div class="empty">This certification has no mock exams yet.</div>`;
    handleReportRoute();
    return;
  }
  state.selectedCertificationId = selection.cert.id;
  state.selectedExamId = selection.exam.id;
  renderCatalogControls();
  await loadAttempt(selection.attempt?.id || null, { push: false });
  handleReportRoute();
}

boot();
