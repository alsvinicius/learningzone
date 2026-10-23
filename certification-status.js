/* Local-only archive state. This is intentionally separate from the public
   content catalog: completion status belongs to the learner's browser. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CertificationStatus = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const KEY = "sb-certification-status-v1";
  const STATUSES = new Set(["passed", "study-complete"]);
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function read(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(KEY) || "null");
      if (!parsed || parsed.schemaVersion !== 1 || !parsed.certifications || typeof parsed.certifications !== "object") return {};
      return Object.fromEntries(Object.entries(parsed.certifications).filter(([id, entry]) =>
        SLUG.test(id) && entry && STATUSES.has(entry.status) &&
        typeof entry.archivedAt === "string" && Number.isFinite(Date.parse(entry.archivedAt))
      ).map(([id, entry]) => [id, { status: entry.status, archivedAt: entry.archivedAt }]));
    } catch {
      return {};
    }
  }

  function write(storage, certifications) {
    try {
      storage.setItem(KEY, JSON.stringify({ schemaVersion: 1, certifications }));
      return true;
    } catch {
      return false;
    }
  }

  function archive(storage, certifications, id, status, archivedAt = new Date().toISOString()) {
    if (!SLUG.test(id) || !STATUSES.has(status) || !Number.isFinite(Date.parse(archivedAt))) return false;
    return write(storage, { ...certifications, [id]: { status, archivedAt } });
  }

  function restore(storage, certifications, id) {
    if (!Object.hasOwn(certifications, id)) return true;
    const next = { ...certifications };
    delete next[id];
    return write(storage, next);
  }

  return { KEY, read, write, archive, restore };
});
