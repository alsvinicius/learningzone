/* Local review bundles: verify fresh inputs; save manifest and Markdown atomically. */
(function (root) {
  const CACHE = 'sb-pretest-bundles-v1';
  const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  function safePath(owner, relative, suffix) {
    if (typeof relative !== 'string' || !relative || /[\\%?#:]/.test(relative) ||
        relative.split('/').some(p => !p || p === '.' || p === '..') ||
        (suffix && !relative.endsWith(suffix))) throw new Error('Invalid review path');
    return `${owner.replace(/\/$/, '')}/${relative}`;
  }
  function reasons(q) {
    const result = [];
    if (['incorrect', 'skipped'].includes(q.status)) result.push(q.status);
    if (['EDUCATED_GUESS', 'UNSURE'].includes(q.confidence)) result.push(q.confidence.toLowerCase());
    if (q.flagged) result.push('flagged');
    if (q.reviewRequested ?? Boolean(String(q.learnerNotes || '').trim())) result.push('requested');
    return result;
  }
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
    return JSON.stringify(value);
  }
  async function hash(text) {
    const bytes = new TextEncoder().encode(text);
    if (root.crypto?.subtle) {
      return [...new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    // Web Crypto is unavailable on plain HTTP outside localhost. Keep the same
    // SHA-256 contract there; online reading must not require a secure origin.
    return sha256(bytes);
  }
  function sha256(bytes) {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes); padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, Math.floor(bytes.length / 0x20000000));
    view.setUint32(padded.length - 4, bytes.length * 8);
    const words = new Uint32Array(64);
    const rotate = (x, n) => (x >>> n) | (x << (32 - n));
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let i = 0; i < 16; i++) words[i] = view.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const x = words[i - 15], y = words[i - 2];
        words[i] = words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10));
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[i] + words[i]) >>> 0;
        const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((x, i) => { state[i] += x; });
    }
    return [...state].map(x => x.toString(16).padStart(8, '0')).join('');
  }
  async function catalogDigest(cert) {
    return hash(JSON.stringify([cert.id, cert.exams.map(e => [e.id, e.path, e.attempts.map(a => [a.id, a.path])])]));
  }
  async function fresh(url, fetcher) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetcher(url, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error('Review input unavailable');
      return await res.text();
    } finally { clearTimeout(timer); }
  }
  async function snapshot(cert, fetcher) {
    const sources = {}, attempts = [], eligibleQuestions = [];
    const read = async (url) => {
      const text = await fresh(url, fetcher);
      sources[url.slice('data/'.length)] = await hash(text);
      return text;
    };
    const materials = async (owner, list) => {
      // Keep local servers and mobile browsers responsive for large catalogues.
      for (let i = 0; i < list.length; i += 6) {
        await Promise.all(list.slice(i, i + 6).map(m => read(safePath(owner, m.path, '.md'))));
      }
    };
    for (const exam of cert.exams) {
      const ep = safePath('data', exam.path, '.json');
      if (!ep.startsWith(`data/${cert.id}/`)) throw new Error('Invalid exam scope');
      const ed = JSON.parse(await read(ep));
      await materials(ep.slice(0, ep.lastIndexOf('/')), ed.materials || []);
      for (const entry of exam.attempts) {
        const ap = safePath('data', entry.path, '.json');
        if (!ap.startsWith(`data/${cert.id}/${exam.id}/`)) throw new Error('Invalid attempt scope');
        const attempt = JSON.parse(await read(ap));
        attempts.push({ examId: exam.id, attemptId: entry.id });
        await materials(ap.slice(0, ap.lastIndexOf('/')), attempt.materials || []);
        for (const q of attempt.questions) {
          const why = reasons(q);
          if (why.length) eligibleQuestions.push({ examId: exam.id, attemptId: entry.id, questionNumber: q.n, reasons: why });
        }
      }
    }
    return { catalogFingerprint: await catalogDigest(cert), sources, attempts, eligibleQuestions };
  }
  function validateBundle(bundle, certId) {
    const { cert, review, text } = bundle;
    if (!slug.test(certId) || cert?.id !== certId || review?.certificationId !== certId ||
        review.schemaVersion !== 1 || typeof text !== 'string' || !Array.isArray(review.topics) ||
        !Array.isArray(review.coverage) || !Array.isArray(review.gaps) || !review.inputs?.sources ||
        !Array.isArray(review.inputs.eligibleQuestions) || !Array.isArray(review.inputs.attempts) ||
        !Number.isFinite(Date.parse(review.updatedAt))) throw new Error('Invalid review bundle');
    safePath(`data/${certId}`, cert.preTestReview.path, '.json');
    safePath('data', review.contentPath, '.md');
    const topics = new Set();
    if (!['draft', 'reviewed'].includes(review.editorialStatus || 'draft')) throw new Error('Invalid editorial status');
    const headings = [...text.matchAll(/^## (.+)$/gm)].map(m => m[1]);
    const sections = new Map(text.split(/^## /m).slice(1).map(s => { const i = s.indexOf('\n'); return [s.slice(0, i), s.slice(i + 1)]; }));
    if (new Set(headings).size !== headings.length) throw new Error('Duplicate review section');
    if (headings[0] !== 'Last-minute priorities' || !/^-\s+\S/m.test(text)) throw new Error('Invalid review content');
    for (const topic of review.topics) {
      if (!slug.test(topic.id) || topics.has(topic.id) || !headings.includes(topic.heading) || !/^-\s+\S/m.test(sections.get(topic.heading))) throw new Error('Invalid review topic');
      topics.add(topic.id);
      if (!Array.isArray(topic.references || [])) throw new Error('Invalid review references');
      for (const reference of topic.references || []) {
        if (!reference || typeof reference.url !== 'string' || /[\s\\]/.test(reference.url)) throw new Error('Invalid review reference');
        const url = new URL(reference.url);
        if (typeof reference.title !== 'string' || !reference.title.trim() || url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid review reference');
      }
    }
    const key = q => JSON.stringify([q.examId, q.attemptId, q.questionNumber]);
    const expected = new Set(review.inputs.eligibleQuestions.map(key));
    const seen = new Set();
    for (const q of review.coverage) {
      if (!expected.has(key(q)) || seen.has(key(q)) || !Array.isArray(q.topicIds) ||
          q.topicIds.some(id => !topics.has(id)) || (!q.topicIds.length && !q.pending)) throw new Error('Incomplete review coverage');
      seen.add(key(q));
    }
    if (seen.size !== expected.size || review.gaps.some(g => typeof g !== 'string')) throw new Error('Incomplete review coverage');
    if (review.editorialStatus === 'reviewed' && review.coverage.some(q => q.pending)) throw new Error('Review has editorial pending items');
    return bundle;
  }
  function readingVersions(review) {
    if (review.readingVersions === undefined) return [];
    const versions = review.readingVersions;
    if (!Array.isArray(versions) || versions.length !== 3 ||
        versions.some((v, i) => !v || v.minutes !== [10, 30, 60][i] || typeof v.contentSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(v.contentSha256))) throw new Error('Invalid reading versions');
    for (const v of versions) safePath('data', v.contentPath, '.md');
    if (new Set(versions.map(v => v.contentPath)).size !== 3 || versions[2].contentPath !== review.contentPath || versions[2].contentSha256 !== review.contentSha256) throw new Error('Invalid full reading version');
    return versions;
  }
  async function verifyVersions(bundle) {
    for (const version of readingVersions(bundle.review)) {
      const text = bundle.readings?.[version.minutes];
      if (typeof text !== 'string' || await hash(text) !== version.contentSha256 ||
          [...text.matchAll(/^## (.+)$/gm)][0]?.[1] !== 'Last-minute priorities' || !/^-\s+\S/m.test(text)) throw new Error('Invalid reading document');
      const known = new Set(['Last-minute priorities', ...bundle.review.topics.map(t => t.heading)]);
      const headings = [...text.matchAll(/^## (.+)$/gm)].map(m => m[1]);
      if (new Set(headings).size !== headings.length || headings.some(h => !known.has(h))) throw new Error('Invalid reading topics');
      if (version.minutes === 60 && text !== bundle.text) throw new Error('Invalid full reading document');
    }
  }
  async function load(certId, { fetcher = root.fetch.bind(root), cache, currentCert } = {}) {
    if (!slug.test(certId)) throw new Error('Invalid certification');
    let liveCert = null;
    try {
      if (root.navigator?.onLine === false) throw new Error('Offline');
      const index = JSON.parse(await fresh('data/index.json', fetcher));
      liveCert = index.certifications.find(c => c.id === certId);
      if (!liveCert) return { missing: true };
      if (!liveCert.preTestReview) return { empty: true, cert: liveCert };
      const path = safePath(`data/${certId}`, liveCert.preTestReview.path, '.json');
      const review = JSON.parse(await fresh(path, fetcher));
      const text = await fresh(safePath(path.slice(0, path.lastIndexOf('/')), review.contentPath, '.md'), fetcher);
      const readings = {};
      for (const version of readingVersions(review)) {
        readings[version.minutes] = version.contentPath === review.contentPath ? text :
          await fresh(safePath(path.slice(0, path.lastIndexOf('/')), version.contentPath, '.md'), fetcher);
      }
      const bundle = validateBundle({ cert: liveCert, review, text, readings }, certId);
      await verifyVersions(bundle);
      if (await hash(text) !== review.contentSha256) throw new Error('Review revision mismatch');
      try {
        bundle.stale = stable(await snapshot(liveCert, fetcher)) !== stable(review.inputs);
        bundle.verified = true;
      } catch { bundle.verified = false; }
      return bundle;
    } catch {
      const hit = await cache?.match(`__pretest__/${certId}`);
      if (hit) {
        const bundle = validateBundle(await hit.json(), certId);
        if (await hash(bundle.text) !== bundle.review.contentSha256) throw new Error('Invalid saved review');
        await verifyVersions(bundle);
        const latest = liveCert || currentCert;
        bundle.stale = bundle.stale || Boolean(latest && await catalogDigest(latest) !== bundle.review.inputs.catalogFingerprint);
        return { ...bundle, offline: true, verified: false };
      }
      if (currentCert && !currentCert.preTestReview) return { empty: true, cert: currentCert };
      throw new Error('Review unavailable. Open and save it while connected, then retry.');
    }
  }
  async function save(bundle, cache) {
    validateBundle(bundle, bundle.cert.id);
    if (await hash(bundle.text) !== bundle.review.contentSha256) throw new Error('Review revision mismatch');
    await verifyVersions(bundle);
    // One cache.put commits the complete revision; failed updates keep the previous copy.
    const key = `__pretest__/${bundle.cert.id}`;
    await cache.put(key, new Response(JSON.stringify(bundle), { headers: { 'Content-Type': 'application/json' } }));
    const hit = await cache.match(key);
    if (!hit || stable(await hit.json()) !== stable(bundle)) throw new Error('Could not confirm offline save');
  }
  const api = { CACHE, safePath, reasons, hash, catalogDigest, snapshot, stable, readingVersions, load, save };
  root.PreTestReview = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
