const fs=require('node:fs'),assert=require('node:assert/strict');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/';
const ts=require(root+'frontend/node_modules/typescript'),cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const source=fs.readFileSync(root+'frontend/src/'+file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};cache.set(file,exports);
 new Function('require','exports',code)(name=>{
  if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props})};
  if(name==='lucide-react')return {Shield:'Shield'};
  if(name==='./OrdersPage')return {default:'OrdersPage'};
  if(name==='./connectionSheets')return load('lib/connectionSheets.ts');
  throw Error('Unexpected import '+name);
 },exports);return exports;
}
const workspace=load('components/AdminWorkspace.tsx'),access=load('lib/dashboardMenu.ts');
const catalog=JSON.parse(fs.readFileSync(root+'backend/dashboard_catalog.json','utf8')).dashboards.map(d=>({...d,enabled:true}));
const tabsFor=(role,sections=[],source=catalog)=>workspace.adminWorkspaceTabs(source.filter(d=>access.canOpenDashboard(d,role,s=>sections.includes(s))));
assert.deepEqual(tabsFor('admin').map(t=>t.label),['Connections','Settings']);
assert.deepEqual(tabsFor('admin').map(t=>t.dashboard.component),['ConnectionsPage','SettingsPage']);
assert.deepEqual(tabsFor('viewer',['content']).map(t=>t.label),['Connections']);
assert.deepEqual(tabsFor('viewer'),[]);
assert.deepEqual(tabsFor(undefined,['content']),[]);
assert.deepEqual(tabsFor('admin',[],catalog.map(d=>({...d,enabled:false}))),[]);
assert.equal(workspace.isAdminWorkspacePath('/connections'),true);
assert.equal(workspace.isAdminWorkspacePath('/settings'),true);
assert.equal(workspace.isAdminWorkspacePath('/admin'),true);
assert.equal(workspace.isAdminWorkspacePath('/content'),false);
assert.equal(workspace.default({tabs:tabsFor('admin'),children:'existing-page'}).props.children,'existing-page');
console.log('Admin access checks passed: original pages, admin-only Settings, permitted Connections, disabled dashboards and route grouping.');
