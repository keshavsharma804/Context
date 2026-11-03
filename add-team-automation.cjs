const nativeFs=require('node:fs');
const changes=new Map();
const fs={readFileSync:(path,encoding)=>changes.has(path)?changes.get(path):nativeFs.readFileSync(path,encoding),writeFileSync:(path,contents)=>changes.set(path,contents)};
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')).replace(/\r?\n/g,'\r\n'));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing anchor '+a);return s.replace(a,b);}
fs.writeFileSync(root+'components/teamAutomationFilters.tsx',`import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useUserPreferenceState } from "../hooks/useUserPreferenceState";

function localDay(date: Date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
export function shiftTeamDay(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  return localDay(new Date(year, month - 1, date + amount));
}
export function currentTeamWeek() {
  const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDay(date);
}
export function teamMatchesSearch(search: string, ...values: unknown[]) {
  const query = search.trim().toLowerCase();
  return !query || values.some(value => String(value ?? "").toLowerCase().includes(query));
}
type TeamFilters = { search: string; setSearch: Dispatch<SetStateAction<string>>; weekStart: string; setWeekStart: Dispatch<SetStateAction<string>> };
const TeamFiltersContext = createContext<TeamFilters | null>(null);
export function TeamAutomationFiltersProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [weekStart, setWeekStart] = useUserPreferenceState("teamAutomation.weekStart", currentTeamWeek);
  const filters = useMemo(() => ({ search, setSearch, weekStart, setWeekStart }), [search, weekStart, setWeekStart]);
  return <TeamFiltersContext.Provider value={filters}>{children}</TeamFiltersContext.Provider>;
}
export function useTeamSearch(enabled = true) {
  const context = useContext(TeamFiltersContext);
  const [local, setLocal] = useState("");
  return { search: enabled && context ? context.search : local, setSearch: enabled && context ? context.setSearch : setLocal, grouped: Boolean(enabled && context) };
}
export function useTeamWeek(): [string, Dispatch<SetStateAction<string>>] {
  const context = useContext(TeamFiltersContext);
  const [local, setLocal] = useState(currentTeamWeek);
  return [context?.weekStart ?? local, context?.setWeekStart ?? setLocal];
}
export function useTeamWeekRange() {
  const [weekStart, setWeekStart] = useTeamWeek();
  const range = useMemo(() => ({ start: weekStart, end: shiftTeamDay(weekStart, 6) }), [weekStart]);
  const setRange = useCallback<Dispatch<SetStateAction<{ start: string; end: string }>>>((next) => setWeekStart(start => {
    const value = typeof next === "function" ? next({ start, end: shiftTeamDay(start, 6) }) : next;
    return value.start;
  }), [setWeekStart]);
  return [range, setRange] as const;
}
`);
fs.writeFileSync(root+'components/TeamAutomationWorkspace.tsx',`import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Bot, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { DashboardMenuItem } from "../lib/dashboardMenu";
import OrdersPage, { type WorkspaceTab } from "./OrdersPage";
import { OrdersToolbar } from "./orders/OrdersToolbar";
import { TeamAutomationFiltersProvider, useTeamSearch, useTeamWeek, currentTeamWeek, shiftTeamDay } from "./teamAutomationFilters";

export const TEAM_AUTOMATION_PATH = "/team-automation";
const SECTIONS = [
  { path: "/sop", label: "SOP" },
  { path: "/task-management", label: "Task Management" },
  { path: "/viktor-logs", label: "Viktor Logs" },
  { path: "/ai-assistant", label: "AI Assistant" },
  { path: "/productivity", label: "Workfolio" },
  { path: "/tdo-sop", label: "Employee Productivity" },
];
export const isTeamAutomationPath = (path: string) => path === TEAM_AUTOMATION_PATH || SECTIONS.some(section => section.path === path);
// Keep the original menu, section and feature permissions; callers filter access.
export function teamAutomationTabs(dashboards: DashboardMenuItem[]) {
  return SECTIONS.flatMap(section => {
    const dashboard = dashboards.find(item => item.path === section.path);
    return dashboard ? [{ ...section, dashboard }] : [];
  });
}
export default function TeamAutomationWorkspace({ tabs, children }: { tabs: WorkspaceTab[]; children: ReactNode }) {
  return <TeamAutomationFiltersProvider><OrdersPage title="Team and Automation" icon={Bot} tabs={tabs}><TeamFilters />{children}</OrdersPage></TeamAutomationFiltersProvider>;
}
function TeamFilters() {
  const { search, setSearch } = useTeamSearch();
  const [weekStart, setWeekStart] = useTeamWeek();
  const { pathname } = useLocation();
  const weekly = pathname === "/productivity" || pathname === "/tdo-sop" || pathname === "/sop";
  return <OrdersToolbar>
    <div className="relative w-56 max-w-full">
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-dark-text3" />
      <input id="team-automation-search" type="search" aria-label="Search Team and Automation" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this tab..." className="input-field h-8 w-full pl-8 pr-7 text-xs" />
      {search && <button type="button" aria-label="Clear shared search" onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-text3"><X size={12} /></button>}
    </div>
    {weekly && <div role="group" aria-label="Reporting week" className="flex items-center gap-1 rounded-md border border-dark-border bg-dark-bg2 p-1 text-xs">
      <button type="button" aria-label="Previous reporting week" onClick={() => setWeekStart(day => shiftTeamDay(day, -7))} className="rounded p-1 hover:bg-dark-bg3"><ChevronLeft size={13} /></button>
      <input type="date" aria-label="Reporting week starting" value={weekStart} onChange={event => { if (event.target.value) { const day = new Date(event.target.value + "T12:00:00").getDay(); setWeekStart(shiftTeamDay(event.target.value, -(day + 6) % 7)); } }} className="w-28 bg-transparent text-xs text-dark-text2" />
      <button type="button" aria-label="Next reporting week" onClick={() => setWeekStart(day => shiftTeamDay(day, 7))} className="rounded p-1 hover:bg-dark-bg3"><ChevronRight size={13} /></button>
      <button type="button" onClick={() => setWeekStart(currentTeamWeek())} className="rounded px-2 py-1 hover:bg-dark-bg3">This week</button>
    </div>}
  </OrdersToolbar>;
}
`);
edit('App.tsx',s=>{
 s='import { teamAutomationTabs, TEAM_AUTOMATION_PATH } from "./components/TeamAutomationWorkspace";\n'+s;
 s=rep(s,'  const marketingSectionTabs =','  const teamAutomationSectionTabs = teamAutomationTabs(pages);\n  const marketingSectionTabs =');
 return rep(s,'            <Route path={MARKETING_PATH}', '            <Route path={TEAM_AUTOMATION_PATH} element={<Navigate to={teamAutomationSectionTabs[0]?.path || "/no-access"} replace />} />\n            <Route path={MARKETING_PATH}');
});
edit('components/Layout.tsx',s=>{
 s='import TeamAutomationWorkspace, { teamAutomationTabs, isTeamAutomationPath, TEAM_AUTOMATION_PATH } from "./TeamAutomationWorkspace";\n'+s;
 s=rep(s,'  const marketingSectionTabs =','  const teamAutomationSectionTabs = useMemo(() => teamAutomationTabs(dashboards.filter(item => canOpenDashboard(item, auth.user?.role, auth.canView))), [dashboards, auth.user?.role, auth.canView]);\n  const marketingSectionTabs =');
 s=rep(s,'isMarketingPath(item.path)) continue;', 'isMarketingPath(item.path) || isTeamAutomationPath(item.path)) continue;');
 s=rep(s,'    if (marketingSectionTabs.length) {',`    if (teamAutomationSectionTabs.length) {
      const group = groups.get("Operations") || [];
      group.push({ to: TEAM_AUTOMATION_PATH, label: "Team and Automation", icon: dashboardIcon("Bot"), enabled: true, admin_only: false });
      groups.set("Operations", group);
    }
    if (marketingSectionTabs.length) {`);
 s=s.replaceAll('customersSupportSectionTabs, marketingSectionTabs]', 'customersSupportSectionTabs, marketingSectionTabs, teamAutomationSectionTabs]');
 s=rep(s,'    if (to === MARKETING_PATH)', '    if (to === TEAM_AUTOMATION_PATH) { prefetchDashboardPage(teamAutomationSectionTabs[0]?.dashboard.component); return; }\n    if (to === MARKETING_PATH)');
 s=rep(s,'  const onMarketingPage =', '  const onTeamAutomationPage = isTeamAutomationPath(loc.pathname);\n  const onMarketingPage =');
 s=s.replaceAll('item.to === MARKETING_PATH ? onMarketingPage : loc.pathname === item.to','item.to === MARKETING_PATH ? onMarketingPage : item.to === TEAM_AUTOMATION_PATH ? onTeamAutomationPage : loc.pathname === item.to');
 return rep(s,'              : onMarketingPage ?', '              : onTeamAutomationPage ? <TeamAutomationWorkspace tabs={teamAutomationSectionTabs}>{children}</TeamAutomationWorkspace>\n              : onMarketingPage ?');
});
// Common search reuses each page's existing filtering and pagination.
for(const [file,anchor,replacement] of [
 ['pages/TaskManagementPage.tsx','  const [query, setQuery] = useState("");','  const { search: query, setSearch: setQuery, grouped } = useTeamSearch();'],
 ['pages/ProductivityPage.tsx','  const [searchTerm, setSearchTerm] = useState<string>("");','  const { search: searchTerm, setSearch: setSearchTerm, grouped } = useTeamSearch();'],
 ['pages/ViktorLogsPage.tsx','  const [searchTerm, setSearchTerm] = useState<string>("");','  const { search: searchTerm, setSearch: setSearchTerm, grouped } = useTeamSearch();'],
 ['pages/SopPage.tsx','  const [search, setSearch] = useState("");','  const { search, setSearch, grouped } = useTeamSearch();'],
]) edit(file,s=> 'import { useTeamSearch } from "../components/teamAutomationFilters";\nimport { OrdersToolbar as TeamToolbar, OrdersPageTitle as TeamPageTitle } from "../components/orders/OrdersToolbar";\n'+rep(s,anchor,replacement));
edit('pages/ProductivityPage.tsx',s=>{
 s='import { useTeamWeekRange } from "../components/teamAutomationFilters";\n'+s;
 return rep(s,'  const [range, setRange] = useState(currentWeek);','  const [range, setRange] = useTeamWeekRange();');
});
edit('pages/TdoSopPage.tsx',s=>{
 s='import { useTeamSearch, useTeamWeek } from "../components/teamAutomationFilters";\n'+s;
 s=rep(s,'externalFreq, externalSearch, onFiltersReady,','externalFreq, externalSearch: parentSearch, onFiltersReady,');
 const point=s.indexOf('export function TdoSopPage('),body=s.indexOf('\n',s.indexOf('}: TdoSopPageProps)',point));
 if(body<0)throw Error('Tdo body not found');
 s=s.slice(0,body+1)+'  const { search: teamSearch, grouped } = useTeamSearch();\n  const externalSearch = parentSearch ?? (grouped ? teamSearch : undefined);\n'+s.slice(body+1);
 return rep(s,'  const [weekStart, setWeekStart] = useState<string>(() => isoLocal(mondayOf(new Date())));','  const [weekStart, setWeekStart] = useTeamWeek();');
});
edit('pages/AIAssistantPage.tsx',s=>{
 s='import { useTeamSearch, teamMatchesSearch } from "../components/teamAutomationFilters";\n'+s;
 s=rep(s,'export default function AIAssistantPage({ auth }: Props) {','export default function AIAssistantPage({ auth }: Props) {\n  const { search: teamSearch } = useTeamSearch();');
 s=rep(s,'  const [conversations, setConversations] = useState<AssistantConversation[]>([]);','  const [conversations, setConversations] = useState<AssistantConversation[]>([]);\n  const visibleConversations = useMemo(() => conversations.filter(item => teamMatchesSearch(teamSearch, item.title, item.summary, item.last_user_message)), [conversations, teamSearch]);');
 s=s.replaceAll('conversations.length === 0 ?', 'visibleConversations.length === 0 ?').replaceAll('conversations.map((conversation)', 'visibleConversations.map((conversation)');
 return rep(s,'No conversations yet\r\n','{teamSearch.trim() ? "No conversations match your search" : "No conversations yet"}\n');
});
for(const [path,contents] of changes) nativeFs.writeFileSync(path,contents);
console.log('Team and Automation navigation and shared filter state connected.');
