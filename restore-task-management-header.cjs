const fs=require('node:fs');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
const changes=new Map();
function edit(file,fn){const path=root+file;changes.set(path,fn(fs.readFileSync(path,'utf8')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing anchor: '+a);return s.replace(a,b);}
edit('pages/TaskManagementPage.tsx',s=>{
 s=rep(s,'import { RefreshCw } from "lucide-react";\r\n','');
 s=rep(s,'import { OrdersToolbar as TeamToolbar, OrdersPageTitle as TeamPageTitle }','import { OrdersPageTitle as TeamPageTitle }');
 s=rep(s,'isFetching: boardFetching, ','');
 s=rep(s,'search: query, setSearch: setQuery, grouped','search: query, setSearch: setQuery');
 if((s.match(/<TeamToolbar>/g)||[]).length!==2)throw Error('Expected two Task Management control groups.');
 s=s.replaceAll('<TeamToolbar>','').replaceAll('</TeamToolbar>','');
 s=rep(s,'<TeamPageTitle><div>','<div>');
 s=rep(s,'</div></TeamPageTitle>','</div>');
 s=rep(s,'<h1 className="tm-h1">Task Management</h1>','<TeamPageTitle><h1 className="tm-h1">Task Management</h1></TeamPageTitle>');
 s=rep(s,'className="tm-e tm-row"','className="tm-row"');
 s=rep(s,'className="tm-e tm-vbar pb-1"','className="tm-vbar pb-1"');
 s=rep(s,'{section === "tasks" && !grouped && <span','{section === "tasks" && <span');
 s=s.replace(/^\s*<button type="button" disabled=\{!ready \|\| boardFetching\}[^\r\n]*<RefreshCw[^\r\n]*<\/button>\r?\n/m,'\n');
 if(s.includes('boardFetching')||s.includes('TeamToolbar'))throw Error('Obsolete header references remain.');
 return s;
});
edit('components/TeamAutomationWorkspace.tsx',s=>{
 s=rep(s,' controlsBelowTabs={pathname === "/task-management"}','');
 return rep(s,'><TeamFilters />{children}</OrdersPage>', '>{pathname !== "/task-management" && <TeamFilters />}{children}</OrdersPage>');
});
for(const [path,s]of changes){const parsed=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(parsed.parseDiagnostics.length)throw Error('Invalid TSX: '+path);}
for(const [path,s]of changes)fs.writeFileSync(path,s.replace(/\r?\n/g,'\r\n'));
console.log('Task Management header restored: description pills and search/actions, section tabs, then the view and filter toolbar.');
