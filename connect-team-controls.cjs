const nativeFs=require('node:fs'),changes=new Map();
const fs={readFileSync:(p,e)=>changes.has(p)?changes.get(p):nativeFs.readFileSync(p,e),writeFileSync:(p,s)=>changes.set(p,s)};
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')).replace(/\r?\n/g,'\r\n'));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a);return s.replace(a,b);}
function sf(s){return ts.createSourceFile('page.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);}
function nodes(s,predicate){const source=sf(s),found=[];function visit(n){if(predicate(n,source))found.push(n);ts.forEachChild(n,visit);}visit(source);return {source,found};}
function wrap(s,n,source,component){const a=n.getStart(source);return s.slice(0,a)+'<'+component+'>'+n.getText(source)+'</'+component+'>'+s.slice(n.end);}
function hideSearch(s,value,component='input'){
 const {source,found}=nodes(s,(n,f)=>(ts.isJsxSelfClosingElement(n)||ts.isJsxElement(n)) && (ts.isJsxSelfClosingElement(n)?n.tagName:n.openingElement.tagName).getText(f)===component && (ts.isJsxSelfClosingElement(n)?n.attributes:n.openingElement.attributes).properties.some(a=>a.name?.getText(f)==='value'&&a.initializer?.getText(f)==='{'+value+'}'));
 if(found.length!==1)throw Error('Search nodes '+value+': '+found.length);
 let parent=found[0].parent;while(parent&&!ts.isJsxElement(parent))parent=parent.parent;
 const a=parent.getStart(source);return s.slice(0,a)+'{!grouped && '+parent.getText(source)+'}'+s.slice(parent.end);
}
function wrapClass(s,name,component='TeamToolbar'){
 const {source,found}=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.attributes.properties.some(a=>a.name?.getText(f)==='className'&&ts.isStringLiteral(a.initializer)&&a.initializer.text===name));
 if(found.length!==1)throw Error('Class '+name+': '+found.length);
 return wrap(s,found[0],source,component);
}
function wrapRef(s,ref){const {source,found}=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.attributes.properties.some(a=>a.name?.getText(f)==='ref'&&a.initializer?.getText(f)==='{'+ref+'}'));if(found.length!==1)throw Error('ref '+ref);return wrap(s,found[0],source,'TeamToolbar');}
function header(s,text){
 const {source,found}=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(f)==='h1'&&n.getText(f).includes(text));
 if(found.length!==1)throw Error('Title '+text);
 const title=found[0].parent,row=title.parent;
 const actions=row.children.find(n=>ts.isJsxElement(n)&&n.pos>title.end);
 if(!actions)throw Error('Header actions '+text);
 const updates=[{a:title.getStart(source),b:title.end,t:'<TeamPageTitle>'+title.getText(source)+'</TeamPageTitle>'},{a:actions.getStart(source),b:actions.end,t:'<TeamToolbar>'+actions.getText(source)+'</TeamToolbar>'}];
 const attr=row.openingElement.attributes.properties.find(a=>a.name?.getText(source)==='className');
 if(attr&&ts.isStringLiteral(attr.initializer))updates.push({a:attr.initializer.getStart(source),b:attr.initializer.end,t:'{grouped ? "contents" : '+JSON.stringify(attr.initializer.text)+'}'});
 for(const u of updates.sort((a,b)=>b.a-a.a))s=s.slice(0,u.a)+u.t+s.slice(u.b);return s;
}
edit('pages/SopPage.tsx',s=>{
 s=hideSearch(s,'search');
 s=wrapClass(s,'flex flex-wrap items-center gap-2 pb-2');
 // Library filters and actions already use host targets; moving those targets preserves the iframe and unsaved edits.
 for(const ref of ['setMainFiltersTarget','setNewOverviewFiltersTarget']) {
  const {source,found}=nodes(s,(n,f)=>ts.isJsxSelfClosingElement(n)&&n.attributes.properties.some(a=>a.name?.getText(f)==='ref'&&a.initializer?.getText(f)==='{'+ref+'}'));
  if(found.length!==1)throw Error(ref);s=wrap(s,found[0],source,'TeamToolbar');
 }
 return header(s,'"SOP"');
});
edit('pages/ViktorLogsPage.tsx',s=>{
 s='import { teamMatchesSearch } from "../components/teamAutomationFilters";\n'+s;
 s=hideSearch(s,'searchTerm');s=header(s,'Viktor Logs');s=wrapRef(s,'dropdownRef');
 s=rep(s,'  const filteredWorkflows = useMemo(() => {','  const searchedHistoryItems = useMemo(() => historyItems.filter(item => teamMatchesSearch(searchTerm, ...Object.values(item))), [historyItems, searchTerm]);\n  const searchedPromptHistoryItems = useMemo(() => promptHistoryItems.filter(item => teamMatchesSearch(searchTerm, ...Object.values(item))), [promptHistoryItems, searchTerm]);\n  const filteredWorkflows = useMemo(() => {');
 return s.replaceAll('historyItems.map((h, i)', 'searchedHistoryItems.map((h, i)').replaceAll('historyItems.length === 0 ?', 'searchedHistoryItems.length === 0 ?').replaceAll('promptHistoryItems.map((item)', 'searchedPromptHistoryItems.map((item)').replaceAll('promptHistoryItems.length === 0 ?', 'searchedPromptHistoryItems.length === 0 ?');
});
edit('pages/ProductivityPage.tsx',s=>{
 s=hideSearch(s,'searchTerm');
 s=rep(s,'{canRead && <span className="hidden items-center gap-2 sm:flex">','{canRead && !grouped && <span className="hidden items-center gap-2 sm:flex">');
 s=wrapClass(s,'flex items-center justify-between flex-wrap gap-3 p-3.5 bg-dark-bg2 border border-dark-border rounded-2xl shadow-lg');
 const {source,found}=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.attributes.properties.some(a=>a.name?.getText(f)==='className'&&a.initializer?.getText(f).includes('mainTab === "productivity"')));
 if(found.length!==1)throw Error('Workfolio actions '+found.length);
 return wrap(s,found[0],source,'TeamToolbar');
});
edit('pages/TaskManagementPage.tsx',s=>{
 s=hideSearch(s,'query','SearchBox');
 const {source,found}=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(f)==='h1'&&n.getText(f).includes('Task Management'));
 s=wrap(s,found[0].parent,source,'TeamPageTitle');
 const a=nodes(s,(n,f)=>ts.isJsxElement(n)&&n.openingElement.attributes.properties.some(p=>p.name?.getText(f)==='className'&&p.initializer?.getText(f)==='"tm-phead"'));
 const right=a.found[0].children.filter(n=>ts.isJsxElement(n)).at(-1);
 s=wrap(s,right,a.source,'TeamToolbar');
 s=wrapClass(s,'tm-vbar pb-1');
 s=rep(s,'<TeamToolbar><div className="tm-row">','<TeamToolbar><div className="tm-e tm-row">');
 s=rep(s,'<TeamToolbar><div className="tm-vbar pb-1">','<TeamToolbar><div className="tm-e tm-vbar pb-1">');
 return rep(s,'<TeamSection tasks={scopedTasks}', '<TeamSection tasks={scopedTasks.filter(task => matchesQuery(task, deferredQuery))}');
});
edit('pages/TdoSopPage.tsx',s=>{
 s=rep(s,"{subTab === 'tracker' && activeDept === '' && (","{!grouped && subTab === 'tracker' && activeDept === '' && (");
 return rep(s,'<div className="flex items-center justify-between mb-4 shrink-0">','<div className={grouped ? "contents" : "flex items-center justify-between mb-4 shrink-0"}>');
});
edit('components/sop/main/SopMainLibrary.tsx',s=>{
 s='import { useTeamSearch } from "../../teamAutomationFilters";\n'+s;
 s=rep(s,'  const isNewOverview =','  const { search: teamSearch, setSearch: setTeamSearch, grouped } = useTeamSearch();\n  const isNewOverview =');
 s=rep(s,'  if (loadError) return',`  useEffect(() => {
    if (!grouped || !ready || !active || filters.query === teamSearch) return;
    setFilters(current => ({ ...current, query: teamSearch }));
    post("filter", { key: "query", value: teamSearch });
  }, [grouped, ready, active, teamSearch, filters.query, post]);
  if (loadError) return`);
 s=hideSearch(s,'filters.query');
 return rep(s,'onClick={() => post("reset-filters")}','onClick={() => { if (grouped) setTeamSearch(""); post("reset-filters"); }}');
});
edit('components/sop/CustomTaskRegister.tsx',s=>{
 s='import { useTeamSearch } from "../teamAutomationFilters";\n'+s;
 s=rep(s,'  const [search, setSearch] = useState("");','  const { search, setSearch, grouped } = useTeamSearch();');
 // The editor's search is independent; only remove the register's duplicate search field.
 const {source,found}=nodes(s,(n,f)=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(f)==='input'&&n.attributes.properties.some(a=>a.name?.getText(f)==='aria-label'&&a.initializer?.getText(f)==='"Search created tasks"'));
 if(found.length!==1)throw Error('custom task search');const parent=found[0].parent;
 return s.slice(0,parent.getStart(source))+'{!grouped && '+parent.getText(source)+'}'+s.slice(parent.end);
});
edit('components/task_management/Sections.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../teamAutomationFilters";\n'+s;
 s=rep(s,'  const [kind, setKind] = useState("all");','  const { search: teamSearch } = useTeamSearch();\n  const [kind, setKind] = useState("all");');
 return rep(s,'const entries = all.filter((entry) => kind === "all" || (entry.item_id !== undefined && sourceOf(entry.item_id) === kind));','const entries = all.filter((entry) => (kind === "all" || (entry.item_id !== undefined && sourceOf(entry.item_id) === kind)) && teamMatchesSearch(teamSearch, entry.actor, entry.body, entry.item_title));');
});
for(const [path,s] of changes) nativeFs.writeFileSync(path,s);
console.log('Existing page controls moved to the header; shared search connected to library, tasks, logs, conversation history and timesheets.');
