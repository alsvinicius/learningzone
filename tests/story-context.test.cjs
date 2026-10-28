const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Progress = require('../study-progress.js');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const fixture = JSON.parse(fs.readFileSync(`${__dirname}/fixtures/study-stories/study.json`, 'utf8'));
function section(start, end) {
  const first = source.indexOf(start);
  assert.notEqual(first, -1);
  const last = source.indexOf(end, first);
  assert.notEqual(last, -1);
  return source.slice(first, last);
}
function harness(hash, overrides = {}) {
  const elements = new Map();
  const calls = [];
  const state = {studyOpen: true, galleryOpen: false, deck: {}, attempt: {get questions() {throw Error('A study must never read an attempt');}}};
  const env = {state, location: {hash}, document: {activeElement: {}, body: {style: {}}},
    StudyPathProgress: Progress, el(id) {if (!elements.has(id)) elements.set(id, {hidden:true,focus(){}}); return elements.get(id);},
    loadStudy: async () => ({study:fixture,base:'sample-study/'}),
    safeStudyUrl: (base,path) => `data/${base}${path}`,
    studyLessonDomains: (m,l) => [...new Set([m.domainId,...(l.domainIds||[])])],
    showStudyDeckSlide: (...args) => calls.push(args), toast: msg => calls.push(msg), ...overrides};
  vm.createContext(env);
  vm.runInContext(section('async function openStudyDeck()', 'function paintStudyStoryCompletion'), env);
  return {env,elements,calls,state};
}
test('study Stories use the current domain, including cross-domain associations, despite a stale attempt', async () => {
  const {env,state}=harness('#/studies/sample-study/backend');
  await env.openStudyDeck();
  assert.equal(state.deck.kind,'study');
  assert.equal(state.deck.studyId,'sample-study');
  assert.deepEqual(Array.from(state.deck.items, x=>x.key),['capacity/first','capacity/second','runtime/shared']);
});
test('all-domains Stories contain each lesson once and empty domains never fall back to a certification', async () => {
  const all=harness('#/studies/sample-study'); await all.env.openStudyDeck();
  assert.equal(all.state.deck.items.length,3);
  const empty=harness('#/studies/sample-study/empty'); await empty.env.openStudyDeck();
  assert.notEqual(empty.state.deck.open,true); assert.equal(empty.calls.length,1);
});
test('study loading ignores results after the user changes route', async () => {
  const h=harness('#/studies/sample-study/backend');
  h.env.loadStudy=async()=>{h.env.location.hash='#/certifications/gallery';return {study:fixture,base:'sample-study/'};};
  await h.env.openStudyDeck(); assert.notEqual(h.state.deck.open,true);
});
test('the global Stories action dispatches by current view rather than the selected attempt', async () => {
  const h=harness('#/studies/sample-study');
  vm.runInContext(section('function openDeck(n, list)', 'function closeDeck('),h.env);
  await h.env.openDeck(); assert.equal(h.state.deck.kind,'study');
  h.state.studyOpen=false;h.state.galleryOpen=true;h.state.deck.open=false;
  h.env.openDeck();assert.equal(h.state.deck.open,false);assert.equal(h.calls.length,2);
});
test('learning Stories retain all four screens and historical certification headings still parse', () => {
  const env={state:{},StudyPathProgress:Progress};vm.createContext(env);
  vm.runInContext(section('const CARD_SECTIONS =', 'async function loadCard('),env);
  const content=fs.readFileSync(`${__dirname}/fixtures/study-stories/learning.md`,'utf8');
  const learning=env.parseCard(content);
  assert.deepEqual(Array.from(learning.screens,s=>s.body.join('').trim()),['Screen 0','Screen 1','Screen 2','Screen 3']);
  const legacy=env.parseCard(fs.readFileSync(`${__dirname}/fixtures/study-stories/certification.md`,'utf8'));
  assert.equal(legacy.screens[1].body[0],'Explanation');
});
