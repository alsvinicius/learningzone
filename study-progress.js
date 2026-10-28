/* Private, browser-local progress for study paths. Kept separate from attempt
   review state so the two measures never imply the same kind of mastery. */
(function (root) {
  const KEY = "sb-study-progress-v1";

  function read(storage) {
    try {
      const value = JSON.parse(storage.getItem(KEY) || "{}");
      if (!value || value.schemaVersion !== 1 || typeof value.studies !== "object") return { schemaVersion: 1, studies: {} };
      return value;
    } catch { return { schemaVersion: 1, studies: {} }; }
  }

  function write(storage, value) {
    try {
      storage.setItem(KEY, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  function lessonKey(moduleId, lessonId) { return `${moduleId}/${lessonId}`; }

  function isComplete(storage, studyId, moduleId, lessonId) {
    const study = read(storage).studies[studyId];
    return study?.completed?.includes(lessonKey(moduleId, lessonId)) || false;
  }

  function toggle(storage, studyId, moduleId, lessonId) {
    const value = read(storage);
    const study = value.studies[studyId] || { completed: [], review: [] };
    const key = lessonKey(moduleId, lessonId);
    const set = new Set(study.completed || []);
    if (set.has(key)) set.delete(key); else set.add(key);
    study.completed = [...set].sort();
    value.studies[studyId] = study;
    return write(storage, value);
  }

  function toggleReview(storage, studyId, moduleId, lessonId) {
    const value = read(storage);
    const study = value.studies[studyId] || { completed: [], review: [] };
    const key = lessonKey(moduleId, lessonId);
    const set = new Set(study.review || []);
    if (set.has(key)) set.delete(key); else set.add(key);
    study.review = [...set].sort();
    value.studies[studyId] = study;
    return write(storage, value);
  }

  function isReview(storage, studyId, moduleId, lessonId) {
    const study = read(storage).studies[studyId];
    return study?.review?.includes(lessonKey(moduleId, lessonId)) || false;
  }

  root.StudyPathProgress = { KEY, read, write, isComplete, toggle, isReview, toggleReview, lessonKey };
  if (typeof module !== "undefined" && module.exports) module.exports = root.StudyPathProgress;
})(globalThis);
