const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const study={id:'synthetic',title:'Synthetic study',domains:[{id:'one',name:'One'},{id:'two',name:'Two'}],modules:[
 {id:'m1',title:'Module one',domainId:'one',lessons:[{id:'r1',type:'report',title:'Report one',path:'one.md'},{id:'s1',type:'story',title:'Story',path:'story.md'}]},
 {id:'m2',title:'Module two',domainId:'two',lessons:[{id:'r2',type:'report',title:'Shared report',path:'two.md',domainIds:['one']}]}]};
function harness(hash='#/studies/synthetic',overrides={}){
 const elements=new Map();const messages=[];
 const env={state:{studyOpen:true,galleryOpen:false,readFilter:'all',attempt:{get questions(){throw Error('Stale attempt accessed');}}},location:{hash},
 document:{body:{style:{}}},localStorage:{},StudyPathProgress:{isComplete:(_s,_p,m)=>m==='m1'},
 el(id){if(!elements.has(id))elements.set(id,{hidden:true,value:'',focus(){}});return elements.get(id);},
 loadStudy:async()=>({study,base:'synthetic/'}),safeStudyUrl:(b,p)=>b+p,
 studyLessonDomains:(m,l)=>[m.domainId,...(l.domainIds||[])],studyRoute:(s,d,m,l)=>`#/studies/${s}/${d}/${m}/${l}`,
 esc:s=>s,fetch:async()=>({ok:true,text:async()=>'synthetic searchable mechanism'}),toast:m=>messages.push(m),...overrides};
 vm.createContext(env);
 const start=source.indexOf('function openIndex()');const end=source.indexOf('/* Three views',start);
 vm.runInContext(source.slice(start,end),env);
 const filters=source.indexOf('function renderReadFilter()');const finish=source.indexOf('/* Reading the reports',filters);
 vm.runInContext(source.slice(filters,finish),env);
 return {env,elements,messages};
}
test('Reports use study identity and explicit domain associations, with no duplicate in all domains',async()=>{
 const h=harness();await h.env.openIndex();assert.equal(h.env.state.studyReportIndex.items.length,2);
 assert.match(h.elements.get('indexBody').innerHTML,/#\/studies\/synthetic\/one\/m1\/r1/);
 assert.doesNotMatch(h.elements.get('indexBody').innerHTML,/Story/);
 const scoped=harness('#/studies/synthetic/one');await scoped.env.openIndex();assert.equal(scoped.env.state.studyReportIndex.items.length,2);
 const empty=harness('#/studies/synthetic/empty');await empty.env.openIndex();assert.equal(empty.env.state.studyReportIndex.items.length,0);assert.match(empty.elements.get('indexBody').innerHTML,/Nenhum Report/);
});
test('Study report filters use explicit study completion and search report contents',async()=>{
 const h=harness();await h.env.openIndex();h.env.state.readFilter='unread';h.env.renderIndex('searchable');
 assert.match(h.elements.get('indexBody').innerHTML,/Shared report/);assert.doesNotMatch(h.elements.get('indexBody').innerHTML,/Report one/);
 h.env.state.readFilter='read';h.env.renderIndex('');assert.match(h.elements.get('indexBody').innerHTML,/Report one/);assert.doesNotMatch(h.elements.get('indexBody').innerHTML,/Shared report/);
 h.env.state.readFilter='all';h.env.renderIndex('no-match');assert.match(h.elements.get('indexBody').innerHTML,/Nenhum Report/);
});
test('A stale study load or an asynchronous search cannot reopen a closed Reports index',async()=>{
 const h=harness();h.env.loadStudy=async()=>{h.env.location.hash='#/certifications/gallery';return {study,base:'synthetic/'};};await h.env.openIndex();assert.equal(h.env.state.studyReportIndex,undefined);
 const second=harness();await second.env.openIndex();second.env.closeIndex();second.env.renderIndex('late search');assert.equal(second.elements.get('index').hidden,true);
});
test('Gallery Reports cannot fall back to a previously selected attempt',()=>{
 const h=harness('#/certifications/gallery');h.env.state.studyOpen=false;h.env.state.galleryOpen=true;h.env.openIndex();assert.equal(h.elements.has('index'),false);assert.equal(h.messages.length,1);
});
test('HTTP outside localhost keeps reading available and cannot claim to save offline',async()=>{
 const els={offlineLabel:{textContent:''},offlineBtn:{disabled:false}};
 let fetches=0;
 const env={window:{isSecureContext:false},navigator:{},state:{studyOpen:true},el:id=>els[id],fetch:()=>{fetches++;throw Error('must not fetch');}};
 vm.createContext(env);vm.runInContext(source.slice(source.indexOf('async function refreshOfflineUi()'),source.indexOf('function wirePwa()')),env);
 await env.refreshOfflineUi();assert.equal(els.offlineBtn.disabled,true);assert.equal(els.offlineLabel.textContent,'Offline unavailable');
 await env.saveOffline();assert.equal(fetches,0);
});
test('Selecting the currently open study Report closes the overlay even without a hash change',()=>{
 let listener,closed=0,focused=0;
 const env={location:{hash:'#/studies/synthetic/one/m1/r1'},closeIndex:()=>{closed++;},el:id=>id==='indexBody'?{addEventListener:(_e,cb)=>{listener=cb;}}:{querySelector:()=>({focus:()=>{focused++;}})}};
 vm.createContext(env);
 const start=source.indexOf('  el("indexBody").addEventListener("click"');
 const end=source.indexOf('  // story deck',start);
 vm.runInContext(source.slice(start,end),env);
 listener({target:{closest:selector=>selector==='[data-study-report]'?{getAttribute:()=>env.location.hash}:null}});
 assert.equal(closed,1);assert.equal(focused,1);
});
