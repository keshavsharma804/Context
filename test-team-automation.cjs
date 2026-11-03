const fs=require('node:fs'),assert=require('node:assert/strict');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/';
const ts=require(root+'frontend/node_modules/typescript');
const cache=new Map(),stores=new Map(),state=new Map();
let current='',cursor=0,context;
function run(name,fn){current=name;cursor=0;return fn();}
const react={
 createContext:()=>context={value:null,Provider:'Provider'},useContext:c=>c.value,
 useState:initial=>{const key=current+':'+cursor++;if(!state.has(key)){const slot={value:typeof initial==='function'?initial():initial};slot.set=next=>{slot.value=typeof next==='function'?next(slot.value):next;};state.set(key,slot);}const slot=state.get(key);return [slot.value,slot.set];},
 useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:fn=>fn(),
};
const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function load(file){
 if(cache.has(file))return cache.get(file);
 const s=fs.readFileSync(root+'frontend/src/'+file,'utf8');
 const code=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};cache.set(file,exports);
 new Function('require','exports',code)(name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return runtime;
  if(name==='lucide-react')return new Proxy({},{get:(_,k)=>String(k)});
  if(name==='./OrdersPage')return {default:'OrdersPage'};
  if(name==='./orders/OrdersToolbar')return {OrdersToolbar:'OrdersToolbar'};
  if(name.includes('teamAutomationFilters'))return load('components/teamAutomationFilters.tsx');
  if(name==='./connectionSheets')return load('lib/connectionSheets.ts');
  if(name.includes('useUserPreferenceState'))return {useUserPreferenceState:(key,initial)=>{if(!stores.has(key))stores.set(key,typeof initial==='function'?initial():initial);return [stores.get(key),next=>stores.set(key,typeof next==='function'?next(stores.get(key)):next)];}};
  throw Error('Unexpected import '+name);
 },exports);return exports;
}
const filters=load('components/teamAutomationFilters.tsx');
const workspace=load('components/TeamAutomationWorkspace.tsx');
const access=load('lib/dashboardMenu.ts');
const dashboards=JSON.parse(fs.readFileSync(root+'backend/dashboard_catalog.json','utf8')).dashboards.map(d=>({...d,enabled:true}));
const allTabs=workspace.teamAutomationTabs(dashboards.filter(d=>access.canOpenDashboard(d,'admin',()=>true)));
assert.deepEqual(allTabs.map(t=>t.label),['SOP','Task Management','Viktor Logs','AI Assistant','Workfolio','Employee Productivity']);
assert.deepEqual(allTabs.map(t=>t.dashboard.component),['SopPage','TaskManagementPage','ViktorLogsPage','AIAssistantPage','ProductivityPage','TdoSopPage']);
for(const tab of allTabs)assert.ok(workspace.isTeamAutomationPath(tab.path));
assert.ok(workspace.isTeamAutomationPath(workspace.TEAM_AUTOMATION_PATH));
assert.equal(workspace.isTeamAutomationPath('/sop-template'),false);
assert.equal(workspace.isTeamAutomationPath('/inventory'),false);
assert.deepEqual(workspace.teamAutomationTabs([]),[]);
const viewer=workspace.teamAutomationTabs(dashboards.filter(d=>access.canOpenDashboard(d,'viewer',section=>section==='sop')));
assert.ok(viewer.length>0);assert.ok(viewer.every(t=>t.dashboard.access_sections.includes('sop')||t.dashboard.access_sections.length===0));
assert.ok(!workspace.teamAutomationTabs(dashboards.map(d=>({...d,enabled:false})).filter(d=>access.canOpenDashboard(d,'admin',()=>true))).length);
function renderProvider(){context.value=run('provider',()=>filters.TeamAutomationFiltersProvider({children:'existing-page'})).props.value;}
renderProvider();
run('header',()=>filters.useTeamSearch()).setSearch('  invoice  ');renderProvider();
for(const name of ['sop','tasks','viktor','assistant','workfolio','employee'])assert.equal(run(name,()=>filters.useTeamSearch()).search,'  invoice  ');
assert.equal(filters.teamMatchesSearch(context.value.search,'Invoice follow-up'),true);
assert.equal(filters.teamMatchesSearch(context.value.search,'General policy'),false);
assert.equal(filters.teamMatchesSearch('',null,undefined),true);
assert.equal(filters.teamMatchesSearch('ALICE','Alice',null),true);
const sopWeek=run('sop-week',()=>filters.useTeamWeek());sopWeek[1]('2026-10-26');renderProvider();
const workfolio=run('workfolio-week',()=>filters.useTeamWeekRange());
assert.deepEqual(workfolio[0],{start:'2026-10-26',end:'2026-11-01'});
workfolio[1](range=>({start:filters.shiftTeamDay(range.start,-7),end:filters.shiftTeamDay(range.end,-7)}));renderProvider();
assert.equal(run('employee-week',()=>filters.useTeamWeek())[0],'2026-10-19');
run('weekly-report',()=>filters.useTeamWeekControls(true));renderProvider();
assert.equal(run('header-week',()=>filters.useTeamWeekControlsEnabled()),true);
run('hourly-report',()=>filters.useTeamWeekControls(false));renderProvider();
assert.equal(run('header-week',()=>filters.useTeamWeekControlsEnabled()),false);
assert.equal(filters.shiftTeamDay('2024-02-28',1),'2024-02-29');
assert.equal(filters.shiftTeamDay('2026-12-31',1),'2027-01-01');
const week=filters.currentTeamWeek();assert.equal(new Date(week+'T12:00:00').getDay(),1);
context.value=null;
const standalone=run('standalone',()=>filters.useTeamSearch());assert.equal(standalone.grouped,false);standalone.setSearch('local');
assert.equal(run('standalone',()=>filters.useTeamSearch()).search,'local');
const disabled=run('disabled',()=>filters.useTeamSearch(false));assert.equal(disabled.grouped,false);
renderProvider();assert.equal(context.value.search,'  invoice  ');assert.equal(context.value.weekStart,'2026-10-19');
const shell=workspace.default({tabs:allTabs,children:'original-page'});
assert.equal(shell.props.children.props.title,'Team and Automation');
assert.equal(shell.props.children.props.children[1],'original-page');
// Execute the actual sidebar builder with the real catalog to catch duplicate links and grouping conflicts.
const layout=fs.readFileSync(root+'frontend/src/components/Layout.tsx','utf8');
const source=ts.createSourceFile('Layout.tsx',layout,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='navItems')callback=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);
const args={dashboards,ordersTabs:[],inventorySectionTabs:[],listingSectionTabs:[],templateSectionTabs:{orders:[],inventory:[],listing:[]},customersSupportSectionTabs:[],marketingSectionTabs:[],teamAutomationSectionTabs:allTabs,isListingDashboard:()=>false,isOrdersPath:()=>false,isInventoryPath:()=>false,isCustomersSupportPath:()=>false,isMarketingPath:()=>false,isTeamAutomationPath:workspace.isTeamAutomationPath,TEAM_AUTOMATION_PATH:workspace.TEAM_AUTOMATION_PATH,LISTING_WORKSPACE_PATH:'/listing-workspace',CUSTOMERS_SUPPORT_PATH:'/customers-support',MARKETING_PATH:'/marketing',dashboardIcon:()=>null,Warehouse:null};
const navCode=ts.transpileModule('const build = '+callback.getText(source)+'; return build();',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
const nav=new Function(...Object.keys(args),navCode)(...Object.values(args)).flatMap(g=>g.items);
assert.equal(nav.filter(n=>n.to===workspace.TEAM_AUTOMATION_PATH).length,1);
for(const tab of allTabs)assert.ok(!nav.some(n=>n.to===tab.path));
console.log('Team and Automation checks passed: six original pages, access/disabled menus, one sidebar entry, shared search/week state, weekly-vs-hourly controls, date boundaries, and standalone behavior.');
