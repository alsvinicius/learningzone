const test = require('node:test');
const assert = require('node:assert/strict');
const CertificationStatus = require('../certification-status.js');

function storageWith(value = null) {
  const values = new Map(value == null ? [] : [[CertificationStatus.KEY, value]]);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('missing and malformed local archive state safely return an empty map', () => {
  assert.deepEqual(CertificationStatus.read(storageWith()), {});
  assert.deepEqual(CertificationStatus.read(storageWith('{broken')), {});
  assert.deepEqual(CertificationStatus.read(storageWith(JSON.stringify({ schemaVersion: 2, certifications: {} }))), {});
});

test('archive status and timestamp persist locally and can be restored', () => {
  const storage = storageWith();
  const now = '2026-10-23T12:00:00.000Z';
  let state = CertificationStatus.read(storage);
  assert.equal(CertificationStatus.archive(storage, state, 'sample-cert', 'passed', now), true);
  state = CertificationStatus.read(storage);
  assert.deepEqual(state['sample-cert'], { status: 'passed', archivedAt: now });
  assert.equal(CertificationStatus.restore(storage, state, 'sample-cert'), true);
  assert.deepEqual(CertificationStatus.read(storage), {});
});

test('only supported statuses, certification IDs and valid timestamps are accepted', () => {
  const storage = storageWith();
  assert.equal(CertificationStatus.archive(storage, {}, 'Sample_Cert', 'passed'), false);
  assert.equal(CertificationStatus.archive(storage, {}, 'sample-cert', 'failed'), false);
  assert.equal(CertificationStatus.archive(storage, {}, 'sample-cert', 'study-complete', 'not-a-date'), false);
  const invalidEntries = {
    schemaVersion: 1,
    certifications: {
      'sample-cert': { status: 'other', archivedAt: '2026-10-23T12:00:00.000Z' },
      'bad id': { status: 'passed', archivedAt: '2026-10-23T12:00:00.000Z' },
      'invalid-date': { status: 'passed', archivedAt: 'yesterday' },
    },
  };
  assert.deepEqual(CertificationStatus.read(storageWith(JSON.stringify(invalidEntries))), {});
});

test('storage errors are reported without throwing', () => {
  const unavailable = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('quota'); } };
  assert.deepEqual(CertificationStatus.read(unavailable), {});
  assert.equal(CertificationStatus.archive(unavailable, {}, 'sample-cert', 'passed'), false);
});
