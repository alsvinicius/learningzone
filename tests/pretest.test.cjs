const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
globalThis.crypto = require('node:crypto').webcrypto;
const Review = require('../pretest.js');
const fixture = path.join(__dirname, 'fixtures/pretest');

async function setup() {
  const index = JSON.parse(await fs.readFile(path.join(fixture, 'index.json'), 'utf8'));
  const cert = index.certifications[0];
  cert.preTestReview = { path: 'pre-test-review/review.json' };
  const text = await fs.readFile(path.join(fixture, 'review.md'), 'utf8');
  const files = new Map([['data/index.json', JSON.stringify(index)]]);
  for (const url of [cert.exams[0].path, cert.exams[0].attempts[0].path]) {
    files.set('data/' + url, await fs.readFile(path.join(fixture, url), 'utf8'));
  }
  const fetcher = async (url, options) => {
    assert.equal(options.cache, 'no-store');
    if (!files.has(url)) throw new Error('unavailable');
    return new Response(files.get(url));
  };
  const inputs = await Review.snapshot(cert, fetcher);
  const review = { schemaVersion: 1, certificationId: cert.id, updatedAt: '2026-10-20T12:00:00Z',
    contentPath: 'review.md', contentSha256: await Review.hash(text), inputs, gaps: [],
    topics: [{ id: 'timeouts', heading: 'Timeout boundaries' }],
    coverage: inputs.eligibleQuestions.map(({ examId, attemptId, questionNumber }) => ({ examId, attemptId, questionNumber, topicIds: ['timeouts'] })) };
  files.set('data/sample-cert/pre-test-review/review.json', JSON.stringify(review));
  files.set('data/sample-cert/pre-test-review/review.md', text);
  const saved = new Map();
  const cache = { match: async key => saved.get(key)?.clone(), put: async (key, value) => saved.set(key, value.clone()) };
  return { cert, review, files, fetcher, cache, saved };
}

test('selects all doubt signals and honours explicit editorial classification', () => {
  assert.deepEqual(Review.reasons({ status: 'correct', confidence: 'EDUCATED_GUESS', learnerNotes: 'Review' }), ['educated_guess', 'requested']);
  assert.deepEqual(Review.reasons({ status: 'correct', learnerNotes: 'Not a request', reviewRequested: false }), []);
});
test('rejects traversal, encoded paths, foreign schemes and Windows separators', () => {
  for (const p of ['../x.md', '/x.md', 'a/%2e%2e/x.md', 'https://other/x.md', 'a\\x.md', './x.md', 'a/x.md?q=1']) {
    assert.throws(() => Review.safePath('data/sample', p, '.md'));
  }
});
test('fresh load verifies coverage snapshot and content revision', async () => {
  const f = await setup();
  const bundle = await Review.load(f.cert.id, f);
  assert.equal(bundle.verified, true); assert.equal(bundle.stale, false);
  assert.equal(bundle.review.coverage.length, 6);
});
test('changed source is shown as stale', async () => {
  const f = await setup();
  f.files.set('data/' + f.cert.exams[0].attempts[0].path, f.files.get('data/' + f.cert.exams[0].attempts[0].path) + '\n');
  assert.equal((await Review.load(f.cert.id, f)).stale, true);
});
test('missing input never claims verified freshness', async () => {
  const f = await setup(); f.files.delete('data/' + f.cert.exams[0].attempts[0].path);
  assert.equal((await Review.load(f.cert.id, f)).verified, false);
});
test('atomic offline save and load keep a coherent manifest and Markdown', async () => {
  const f = await setup(); const bundle = await Review.load(f.cert.id, f);
  await Review.save(bundle, f.cache);
  const offline = await Review.load(f.cert.id, { cache: f.cache, currentCert: f.cert, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(offline.offline, true); assert.equal(offline.text, bundle.text);
  assert.equal(offline.verified, false);
});
test('mismatched new revision falls back to intact saved review', async () => {
  const f = await setup(); const bundle = await Review.load(f.cert.id, f); await Review.save(bundle, f.cache);
  f.files.set('data/sample-cert/pre-test-review/review.md', 'Incomplete update');
  const loaded = await Review.load(f.cert.id, f);
  assert.equal(loaded.offline, true); assert.equal(loaded.text, bundle.text);
});
test('failed cache update preserves previous bundle', async () => {
  const f = await setup(); const bundle = await Review.load(f.cert.id, f); await Review.save(bundle, f.cache);
  const before = (await f.cache.match('__pretest__/sample-cert')).clone();
  await assert.rejects(Review.save(bundle, { ...f.cache, put: async () => { throw new Error('quota'); } }));
  assert.equal(await (await f.cache.match('__pretest__/sample-cert')).text(), await before.text());
});
test('legacy certification returns empty without requiring a review', async () => {
  const f = await setup(); delete f.cert.preTestReview;
  f.files.set('data/index.json', JSON.stringify({ certifications: [f.cert] }));
  assert.equal((await Review.load(f.cert.id, f)).empty, true);
});
test('offline bundle cannot be used for another certification', async () => {
  const f = await setup(); const bundle = await Review.load(f.cert.id, f); await Review.save(bundle, f.cache);
  await assert.rejects(Review.load('other-cert', { cache: f.cache, fetcher: async () => { throw new Error('offline'); } }));
});
test('incomplete coverage is rejected before it can be presented as verified', async () => {
  const f = await setup(); f.review.coverage.pop();
  f.files.set('data/sample-cert/pre-test-review/review.json', JSON.stringify(f.review));
  await assert.rejects(Review.load(f.cert.id, f));
});
test('new attempts in the known catalogue invalidate an older offline snapshot', async () => {
  const f = await setup(); const bundle = await Review.load(f.cert.id, f); await Review.save(bundle, f.cache);
  const currentCert = structuredClone(f.cert);
  currentCert.exams[0].attempts.push({ id: 'try-2', path: 'sample-cert/mock-one/attempts/try-2/attempt.json' });
  const loaded = await Review.load(f.cert.id, { cache: f.cache, currentCert, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(loaded.stale, true);
});

test('optional primary references accept HTTPS and reject executable or credentialed links', async () => {
  const f = await setup();
  const write = () => f.files.set('data/sample-cert/pre-test-review/review.json', JSON.stringify(f.review));
  f.review.topics[0].references = [{ title: 'Synthetic reference', url: 'https://example.org/reference' }];
  write();
  assert.equal((await Review.load(f.cert.id, f)).verified, true);
  for (const url of ['javascript:alert(1)', 'http://example.org', 'https://user:secret@example.org', null, 'https://[broken', 'https://example.org/a b']) {
    f.review.topics[0].references[0].url = url; write();
    await assert.rejects(Review.load(f.cert.id, f));
  }
});

test('HTTP without Web Crypto retains exact SHA-256 integrity and fresh review loading', async () => {
  const vm = require('node:vm');
  const context = vm.createContext({ TextEncoder, URL, AbortController, setTimeout, clearTimeout });
  vm.runInContext(await fs.readFile(path.join(__dirname, '../pretest.js'), 'utf8'), context);
  const portable = context.PreTestReview;
  for (const text of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'Revisão 🔎\r\n'.repeat(10000)]) {
    assert.equal(await portable.hash(text), require('node:crypto').createHash('sha256').update(text).digest('hex'));
  }
  const f = await setup();
  const bundle = await portable.load(f.cert.id, f);
  assert.equal(bundle.verified, true);
  assert.equal(bundle.stale, false);
  f.files.set('data/sample-cert/pre-test-review/review.md', 'Corrupted review');
  await assert.rejects(portable.load(f.cert.id, f));
});

async function withReadingVersions() {
  const f = await setup();
  f.review.readingVersions = [];
  for (const minutes of [10, 30, 60]) {
    const text = minutes === 60 ? f.files.get('data/sample-cert/pre-test-review/review.md') : `# ${minutes} minute review\n\n## Last-minute priorities\n\n- Budget ${minutes}: check the timeout boundary.\n`;
    const contentPath = minutes === 60 ? 'review.md' : `review-${minutes}.md`;
    f.review.readingVersions.push({ minutes, contentPath, contentSha256: await Review.hash(text) });
    f.files.set('data/sample-cert/pre-test-review/' + contentPath, text);
  }
  f.files.set('data/sample-cert/pre-test-review/review.json', JSON.stringify(f.review));
  return f;
}

test('all reading documents survive offline and partial updates preserve the saved set', async () => {
  const f = await withReadingVersions();
  const bundle = await Review.load(f.cert.id, f);
  assert.deepEqual(Object.keys(bundle.readings), ['10', '30', '60']);
  await Review.save(bundle, f.cache);
  f.files.set('data/sample-cert/pre-test-review/review-30.md', 'Incomplete update');
  const fallback = await Review.load(f.cert.id, f);
  assert.equal(fallback.offline, true);
  assert.deepEqual(fallback.readings, bundle.readings);
  const corrupted = structuredClone(bundle); corrupted.readings['10'] += 'Tampered';
  await assert.rejects(Review.save(corrupted, f.cache));
  assert.deepEqual((await (await f.cache.match('__pretest__/sample-cert')).json()).readings, bundle.readings);
});

test('reading descriptors reject traversal, missing budgets and a divergent full review', async () => {
  for (const mutate of [r => r.readingVersions[0].contentPath = '../escape.md', r => r.readingVersions.pop(), r => r.readingVersions[2].contentSha256 = '0'.repeat(64)]) {
    const f = await withReadingVersions(); mutate(f.review);
    f.files.set('data/sample-cert/pre-test-review/review.json', JSON.stringify(f.review));
    await assert.rejects(Review.load(f.cert.id, f));
  }
});
