/* Local study-state keying and one-time migration. No browser UI dependencies. */
(function (root) {
  const readKey = (identity) => `sb-read:${identity}`;
  const lastStoryKey = (identity) => `sb-last-story:${identity}`;
  const questionReadKey = (identity, n) => `${identity}:${n}`;

  function parseRead(raw) {
    if (raw == null) return null;
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return Object.keys(value);
    } catch { /* Invalid local data is left untouched for recovery. */ }
    return null;
  }

  function migratedReadEntries(values, identity, attemptId) {
    const migrated = new Set();
    for (const value of values || []) {
      const text = String(value);
      const split = text.lastIndexOf(":");
      const prefix = split < 0 ? "" : text.slice(0, split);
      const number = split < 0 ? text : text.slice(split + 1);
      if (!/^\d+$/.test(number) || (prefix && prefix !== attemptId && prefix !== identity)) continue;
      migrated.add(questionReadKey(identity, Number(number)));
    }
    return [...migrated];
  }

  function writeConfirmed(storage, key, value) {
    try {
      const encoded = JSON.stringify(value);
      storage.setItem(key, encoded);
      return storage.getItem(key) === encoded;
    } catch { return false; }
  }

  function migrateReadState(storage, identity, attemptId) {
    const currentKey = readKey(identity);
    const legacyKey = readKey(attemptId);
    const current = parseRead(storage.getItem(currentKey));
    const legacy = parseRead(storage.getItem(legacyKey));

    if (current !== null) {
      if (legacy !== null && storage.getItem(currentKey) === JSON.stringify(current)) {
        try { storage.removeItem(legacyKey); } catch { /* Keep the verified current copy. */ }
      }
      return new Set(current);
    }

    if (legacy === null) return new Set();
    const mapped = migratedReadEntries(legacy, identity, attemptId);
    if (writeConfirmed(storage, currentKey, mapped)) {
      try { storage.removeItem(legacyKey); } catch { /* The next load can retry cleanup. */ }
    }
    return new Set(mapped);
  }

  function validPosition(value, questions) {
    return value && Number.isInteger(value.n) && value.n > 0 &&
      Number.isInteger(value.slide) && value.slide >= 0 && value.slide <= 3 &&
      questions.has(value.n);
  }

  function loadStoryPosition(storage, identity, attemptId, storyQuestions) {
    const currentKey = lastStoryKey(identity);
    const legacyKey = lastStoryKey(attemptId);
    const available = new Set(storyQuestions || []);
    const read = (key) => {
      try { return JSON.parse(storage.getItem(key) || "null"); } catch { return null; }
    };
    const current = read(currentKey);
    if (validPosition(current, available)) {
      if (storage.getItem(legacyKey) != null && storage.getItem(currentKey) === JSON.stringify(current)) {
        try { storage.removeItem(legacyKey); } catch { /* Current state is verified. */ }
      }
      return current;
    }
    const legacy = read(legacyKey);
    if (!validPosition(legacy, available)) return null;
    if (writeConfirmed(storage, currentKey, legacy)) {
      try { storage.removeItem(legacyKey); } catch { /* The next load can retry cleanup. */ }
    }
    return legacy;
  }

  const api = { readKey, lastStoryKey, questionReadKey, migrateReadState, loadStoryPosition };
  root.StudyProgress = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
