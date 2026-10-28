const test = require('node:test');
const assert = require('node:assert/strict');
const Progress = require('../progress.js');
const StudyPathProgress = require('../study-progress.js');
const { cacheIndividually } = require('../cache-utils.js');

class MemoryStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('read marks migrate to composite identity and remove legacy only after verification', () => {
  const identity = 'sample-cert:sample-pretest:2026-01-15';
  const legacy = Progress.readKey('2026-01-15');
  const storage = new MemoryStorage({ [legacy]: JSON.stringify(['2026-01-15:3', '2026-01-15:44']) });
  const migrated = Progress.migrateReadState(storage, identity, '2026-01-15');
  assert.deepEqual([...migrated], [`${identity}:3`, `${identity}:44`]);
  assert.equal(storage.getItem(Progress.readKey(identity)), JSON.stringify([...migrated]));
  assert.equal(storage.getItem(legacy), null);
});

test('failed read-state write keeps the legacy copy', () => {
  const identity = 'sample-cert:sample-pretest:2026-01-15';
  const legacy = Progress.readKey('2026-01-15');
  const storage = new MemoryStorage({ [legacy]: JSON.stringify(['2026-01-15:4']) });
  storage.setItem = () => { throw new Error('quota'); };
  assert.deepEqual([...Progress.migrateReadState(storage, identity, '2026-01-15')], [`${identity}:4`]);
  assert.notEqual(storage.getItem(legacy), null);
});

test('story position migrates only to an available Story and confirms the new value first', () => {
  const identity = 'sample-cert:sample-pretest:2026-01-15';
  const legacy = Progress.lastStoryKey('2026-01-15');
  const current = Progress.lastStoryKey(identity);
  const storage = new MemoryStorage({ [legacy]: JSON.stringify({ n: 44, slide: 2 }) });
  assert.deepEqual(Progress.loadStoryPosition(storage, identity, '2026-01-15', [44, 75]), { n: 44, slide: 2 });
  assert.equal(storage.getItem(current), JSON.stringify({ n: 44, slide: 2 }));
  assert.equal(storage.getItem(legacy), null);
  storage.removeItem(current);
  storage.setItem(legacy, JSON.stringify({ n: 3, slide: 1 }));
  assert.equal(Progress.loadStoryPosition(storage, identity, '2026-01-15', [44, 75]), null);
  assert.notEqual(storage.getItem(legacy), null);
});

test('offline cache keeps successful files when another file fails', async () => {
  const saved = new Map();
  const cache = {
    match: async (request) => saved.get(request),
    put: async (request, response) => { saved.set(request, response); },
  };
  const fetcher = async (request) => {
    if (request === 'missing.md') throw new Error('offline');
    return { ok: true, clone() { return this; } };
  };
  const result = await cacheIndividually(['guide.md', 'missing.md', 'q01.md'], cache, fetcher, (url) => url);
  assert.deepEqual(result, { saved: 2, total: 3 });
  assert.deepEqual([...saved.keys()], ['guide.md', 'q01.md']);
});

test('study completion and review marks remain private and independent of exam progress', () => {
  const storage = new MemoryStorage();
  assert.equal(StudyPathProgress.toggle(storage, 'sample-study', 'capacity', 'deep-dive'), true);
  assert.equal(StudyPathProgress.isComplete(storage, 'sample-study', 'capacity', 'deep-dive'), true);
  assert.equal(StudyPathProgress.isReview(storage, 'sample-study', 'capacity', 'deep-dive'), false);
  assert.equal(StudyPathProgress.toggleReview(storage, 'sample-study', 'capacity', 'deep-dive'), true);
  assert.equal(StudyPathProgress.isReview(storage, 'sample-study', 'capacity', 'deep-dive'), true);
  assert.equal(storage.getItem(StudyPathProgress.KEY).includes('sample-study'), true);
  assert.equal(storage.getItem(Progress.readKey('sample-study')), null);
});

test('study progress ignores malformed local data and survives a write failure in memory', () => {
  const malformed = new MemoryStorage({ [StudyPathProgress.KEY]: '{' });
  assert.equal(StudyPathProgress.isComplete(malformed, 's', 'm', 'l'), false);
  const blocked = new MemoryStorage();
  blocked.setItem = () => { throw new Error('quota'); };
  assert.equal(StudyPathProgress.toggle(blocked, 's', 'm', 'l'), false);
  assert.equal(StudyPathProgress.isComplete(blocked, 's', 'm', 'l'), false);
});
