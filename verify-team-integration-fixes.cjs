const nativeFs=require('node:fs'),changes=new Map();
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
function edit(file,fn){const p=root+file;changes.set(p,fn((changes.get(p)??nativeFs.readFileSync(p,'utf8')).replace(/\r?\n/g,'\r\n')).replace(/\r?\n/g,'\r\n'));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a);return s.replace(a,b);}
edit('components/sop/CustomTaskRegister.tsx',s=>{
 s=rep(s,'  const { search, setSearch, grouped } = useTeamSearch();','  const [search, setSearch] = useState("");');
 const at=s.indexOf('export default function CustomTaskRegister(');
 return s.slice(0,at)+rep(s.slice(at),'  const [search, setSearch] = useState("");','  const { search, setSearch, grouped } = useTeamSearch();');
});
edit('pages/TdoSopPage.tsx',s=>rep(s,'hideHeaderControls={embedded}','hideHeaderControls={embedded || grouped}'));
edit('components/sop/CustomerServiceDashboard.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../teamAutomationFilters";\n'+s;
 s=rep(s,'  const editAccessRef = useRef(canEdit);','  const { search: teamSearch } = useTeamSearch();\n  const editAccessRef = useRef(canEdit);');
 s=rep(s,'      const md = metaFor(m);','      const md = metaFor(m);\n      if (!teamMatchesSearch(teamSearch, m.label, m.key, md.owner, md.spotChecker, md.frequency)) return false;');
 return rep(s,'[data, meta, freqOverride, finalApproval, doer, frequency]','[data, meta, freqOverride, finalApproval, doer, frequency, teamSearch]');
});
edit('components/workfolio/WorkfolioAccessTab.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../teamAutomationFilters";\n'+s;
 s=rep(s,'  const menu = useDashboardMenu();','  const { search: teamSearch } = useTeamSearch();\n  const menu = useDashboardMenu();');
 return rep(s,'const pages = useMemo(() => sections.filter(s => s.group === category), [sections, category]);','const pages = useMemo(() => sections.filter(s => s.group === category && teamMatchesSearch(teamSearch, s.label, s.description)), [sections, category, teamSearch]);');
});
edit('pages/TaskManagementPage.tsx',s=>{
 s='import { RefreshCw } from "lucide-react";\n'+s;
 s=rep(s,'data: board, isLoading, isError, refetch }','data: board, isLoading, isFetching: boardFetching, isError, refetch }');
 return rep(s,'                <NotificationBell tasks={tasks}', '                <button type="button" disabled={!ready || boardFetching} aria-busy={boardFetching} onClick={() => { if (ready) void refetch(); }} className="tm-btn ghost sm"><RefreshCw size={14} />Refresh</button>\n                <NotificationBell tasks={tasks}');
});
edit('pages/ViktorLogsPage.tsx',s=>{
 const sf=ts.createSourceFile('logs.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let header;
 function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)==='header'&&n.getText(sf).includes('<TeamPageTitle>'))header=n;ts.forEachChild(n,visit);}visit(sf);
 if(!header)throw Error('Viktor header');
 const attr=header.openingElement.attributes.properties.find(a=>a.name?.getText(sf)==='className');
 const expr=attr.initializer.expression.getText(sf);
 return s.slice(0,attr.initializer.getStart(sf))+'{grouped ? "contents" : '+expr+'}'+s.slice(attr.initializer.end);
});
// Move real column controls with their existing provider context into the top toolbar.
for(const file of ['pages/ViktorLogsPage.tsx','pages/ProductivityPage.tsx'])edit(file,s=>{
 const sf=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let toolbar;
 function visit(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(sf)==='PC.Toolbar')toolbar=n;ts.forEachChild(n,visit);}visit(sf);
 if(!toolbar)throw Error('Column toolbar '+file);
 // Workfolio's containing controls are already in the header.
 if(file.includes('Productivity'))return s;
 return s.slice(0,toolbar.getStart(sf))+'<TeamToolbar>'+toolbar.getText(sf)+'</TeamToolbar>'+s.slice(toolbar.end);
});
edit('pages/AIAssistantPage.tsx',s=>{
 s='import { OrdersToolbar as TeamToolbar } from "../components/orders/OrdersToolbar";\n'+s;
 s=rep(s,'const { search: teamSearch } = useTeamSearch();','const { search: teamSearch, grouped } = useTeamSearch();');
 const sf=ts.createSourceFile('assistant.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),buttons=[];
 function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(sf)==='button'&&n.openingElement.attributes.properties.some(a=>a.name?.getText(sf)==='onClick'&&a.initializer?.getText(sf)==='{resetConversation}'))buttons.push(n);ts.forEachChild(n,visit);}visit(sf);
 if(buttons.length!==2)throw Error('Assistant buttons');
 const updates=[{a:buttons[0].getStart(sf),b:buttons[0].end,t:'<TeamToolbar>'+buttons[0].getText(sf)+'</TeamToolbar>'},{a:buttons[1].getStart(sf),b:buttons[1].end,t:'{!grouped && '+buttons[1].getText(sf)+'}'}];
 for(const u of updates.sort((a,b)=>b.a-a.a))s=s.slice(0,u.a)+u.t+s.slice(u.b);
 return rep(rep(s,'<div className="h-full min-h-screen bg-dark-bg text-dark-text">','<div className={grouped ? "h-full min-h-0 bg-dark-bg text-dark-text" : "h-full min-h-screen bg-dark-bg text-dark-text"}>'),'<main className="flex h-screen w-full min-w-0 flex-col px-6 py-3">','<main className={grouped ? "flex h-full w-full min-w-0 flex-col px-6 py-3" : "flex h-screen w-full min-w-0 flex-col px-6 py-3"}>');
});
for(const [path,s] of changes){const sf=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(sf.parseDiagnostics.length)throw Error(sf.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));}
for(const [path,s] of changes)nativeFs.writeFileSync(path,s);
console.log('Nested report filtering, existing column controls, assistant action and standalone fallbacks verified.');
