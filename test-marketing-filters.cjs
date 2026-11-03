const fs = require('node:fs');
const assert = require('node:assert/strict');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/';
const ts = require(root + 'node_modules/typescript');
const store = new Map();
let context, revision = 0;
const react = {
  createContext: () => (context = { current: null, Provider: 'Provider' }),
  useContext: c => c.current,
  useMemo: fn => fn(),
  useState: () => [revision, next => { revision = typeof next === 'function' ? next(revision) : next; }],
};
function load(file) {
 const source=fs.readFileSync(root+'src/'+file,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 new Function('require','exports',compiled)(name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props})};
  if(name.includes('useUserPreferenceState'))return {useUserPreferenceState:(key,initial,writable=true)=>{
   if(!store.has(key))store.set(key,typeof initial==='function'?initial():initial);
   return [store.get(key),next=>{if(writable)store.set(key,typeof next==='function'?next(store.get(key)):next);}];
  }};
  if(name.includes('dateRange'))return {daysAgoISO:()=> '2026-10-05',todayISO:()=> '2026-11-03'};
  throw Error('Unexpected import '+name);
 },exports);
 return exports;
}
const m=load('components/marketingFilters.tsx');
function render(){context.current=m.MarketingFiltersProvider({children:'existing-page'}).props.value;}
render();
context.current.setStart('2026-09-16'); context.current.setEnd('2026-10-14'); render();
for(const key of ['ads','content','klaviyo']) {
 const range=m.useMarketingDateRange(key+'.start',key+'.end','2020-01-01','2020-01-02');
 assert.equal(range.start,'2026-09-16');assert.equal(range.end,'2026-10-14');assert.equal(range.grouped,true);
}
const content=m.useMarketingDateRange('content.start','content.end','2020-01-01','2020-01-02');
content.setStart('2026-09-01');render();
assert.equal(m.useMarketingDateRange('ads.start','ads.end','','').start,'2026-09-01');
context.current.setEnd('');render();assert.equal(context.current.end,'2026-10-14');
context.current.refresh();render();assert.equal(context.current.refreshKey,1);
for(const endpoint of ['performance','performance/rows','performance/export','overview','insights']) {
 const path=m.marketingReportPath('/seo-console/'+endpoint+'?site=example&range=24h',context.current);
 const p=new URLSearchParams(path.split('?')[1]);
 assert.equal(p.get('start'),'2026-09-01');assert.equal(p.get('end'),'2026-10-14');assert.equal(p.get('site'),'example');
}
assert.equal(m.marketingReportPath('/seo-console/pages?site=example',context.current),'/seo-console/pages?site=example');
assert.equal(m.marketingReportPath(null,context.current),null);
context.current=null;
const fallback=m.useMarketingDateRange('content.start','content.end','','');
assert.equal(fallback.start,'2020-01-01');assert.equal(fallback.grouped,false);
fallback.setStart('2021-01-01');assert.equal(store.get('content.start'),'2021-01-01');
for(const file of ['pages/AdsPage.tsx','pages/ContentPage.tsx','pages/KlaviyoPage.tsx']) {
 const s=fs.readFileSync(root+'src/'+file,'utf8');assert.ok(s.includes('useMarketingDateRange('));assert.ok(s.includes('<MarketingToolbar>'));
 assert.ok(s.includes('<MarketingPageTitle>'));assert.ok(s.includes('!grouped &&')||s.includes('hideDateRange={grouped}'));
}
console.log('Marketing filter tests passed: shared state across tabs, persistence, setters, standalone fallback, SEO report and export paths, header controls.');
