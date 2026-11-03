const nativeFs=require('node:fs'),changes=new Map();
const fs={readFileSync:(p,e)=>(changes.has(p)?changes.get(p):nativeFs.readFileSync(p,e)).replace(/\r?\n/g,'\r\n'),writeFileSync:(p,s)=>changes.set(p,s)};
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')).replace(/\r?\n/g,'\r\n'));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a);return s.replace(a,b);}
edit('pages/TaskManagementPage.tsx',s=>rep(s,'{section === "tasks" && {!grouped && <span','{section === "tasks" && !grouped && <span').replace(/(<SearchBox[^>]+\/><\/span>)\}\}/,'$1}'));
edit('components/teamAutomationFilters.tsx',s=>{
 s=rep(s,'createContext, useCallback, useContext, useMemo,','createContext, useCallback, useContext, useEffect, useMemo,');
 s=rep(s,'type TeamFilters = { search:', 'type TeamFilters = { weekControls: boolean; setWeekControls: Dispatch<SetStateAction<boolean>>; search:');
 s=rep(s,'  const [search, setSearch] = useState("");','  const [weekControls, setWeekControls] = useState(false);\n  const [search, setSearch] = useState("");');
 s=rep(s,'({ search, setSearch, weekStart, setWeekStart }), [search, weekStart, setWeekStart]','({ search, setSearch, weekStart, setWeekStart, weekControls, setWeekControls }), [search, weekStart, setWeekStart, weekControls]');
 return s+`\nexport function useTeamWeekControls(enabled: boolean) {
  const context = useContext(TeamFiltersContext);
  const setControls = context?.setWeekControls;
  useEffect(() => { setControls?.(enabled); return () => setControls?.(false); }, [enabled, setControls]);
}
export function useTeamWeekControlsEnabled() { return useContext(TeamFiltersContext)?.weekControls ?? false; }
`;
});
edit('components/TeamAutomationWorkspace.tsx',s=>{
 s=rep(s,'import { useLocation } from "react-router-dom";\r\n','');
 s=rep(s,'currentTeamWeek, shiftTeamDay }','currentTeamWeek, shiftTeamDay, useTeamWeekControlsEnabled }');
 s=rep(s,'  const { pathname } = useLocation();\r\n  const weekly = pathname === "/productivity" || pathname === "/tdo-sop" || pathname === "/sop";','  const weekly = useTeamWeekControlsEnabled();');
 return s;
});
edit('pages/ProductivityPage.tsx',s=>{
 s=rep(s,'import { useTeamWeekRange }','import { useTeamWeekRange, useTeamWeekControls }');
 return rep(s,'  const [range, setRange] = useTeamWeekRange();','  const [range, setRange] = useTeamWeekRange();\n  useTeamWeekControls(mainTab === "productivity" && canRead);');
});
edit('pages/TdoSopPage.tsx',s=>{
 s=rep(s,'useTeamSearch, useTeamWeek }','useTeamSearch, useTeamWeek, useTeamWeekControls }');
 return rep(s,"  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);","  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);\n  useTeamWeekControls(subTab === 'tracker');");
});
edit('components/sop/HourlyDashboard.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../teamAutomationFilters";\nimport { OrdersToolbar as TeamToolbar } from "../orders/OrdersToolbar";\n'+s;
 s=rep(s,'  const initialDate = useMemo','  const { search: teamSearch } = useTeamSearch();\n  const initialDate = useMemo');
 s=rep(s,'    () => selectedEmployee\r\n      ? rows.filter((row) => String(row.employee_id) === selectedEmployee)\r\n      : rows,\r\n    [rows, selectedEmployee],','    () => rows.filter(row => (!selectedEmployee || String(row.employee_id) === selectedEmployee) && teamMatchesSearch(teamSearch, ...row.values)),\n    [rows, selectedEmployee, teamSearch],');
 const sf=ts.createSourceFile('hourly.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let input;
 function visit(n){if(ts.isJsxSelfClosingElement(n)&&n.tagName.getText(sf)==='input'&&n.attributes.properties.some(a=>a.name?.getText(sf)==='aria-label'&&a.initializer?.getText(sf)==='"Hourly work log date"'))input=n;ts.forEachChild(n,visit);}visit(sf);
 if(!input)throw Error('Hourly date input');let parent=input.parent;while(parent&&!ts.isJsxElement(parent))parent=parent.parent;
 return s.slice(0,parent.getStart(sf))+'<TeamToolbar>'+parent.getText(sf)+'</TeamToolbar>'+s.slice(parent.end);
});
edit('components/workfolio/WorkfolioScreenshotsTab.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../teamAutomationFilters";\n'+s;
 s=rep(s,'  const [employees, setEmployees]','  const { search: teamSearch } = useTeamSearch();\n  const [employees, setEmployees]');
 return rep(s,'{employees.map((person) => (','{employees.filter(person => teamMatchesSearch(teamSearch, person.name, person.email)).map((person) => (');
});
// Validate every changed TSX before writing any project file.
for(const [path,s] of changes)if(path.endsWith('.tsx')){const sf=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(sf.parseDiagnostics.length)throw Error(sf.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('\n'));}
for(const [path,s] of changes)nativeFs.writeFileSync(path,s);
console.log('Shared weekly controls limited to weekly reports; hourly date controls and search connected.');
