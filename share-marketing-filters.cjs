const fs = require('node:fs');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/';
const ts = require(root + 'frontend/node_modules/typescript');
function edit(file, fn) {
  const path = root + file, source = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, fn(source).replace(/\r?\n/g, '\r\n'));
}
function rep(s, a, b) { if (!s.includes(a)) throw Error('Missing ' + a); return s.replace(a,b); }
fs.writeFileSync(root + 'frontend/src/components/marketingFilters.tsx', `import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useUserPreferenceState } from "../hooks/useUserPreferenceState";
import { daysAgoISO, todayISO } from "../lib/dateRange";

type Range = { start: string; end: string };
type Filters = Range & { setStart: (value: string) => void; setEnd: (value: string) => void };
export const MarketingFiltersContext = createContext<Filters | null>(null);

export function MarketingFiltersProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useUserPreferenceState<Range>("marketing.dateRange", () => ({ start: daysAgoISO(29), end: todayISO() }));
  const filters = useMemo(() => ({ ...range,
    setStart: (start: string) => { if (start) setRange(previous => ({ ...previous, start })); },
    setEnd: (end: string) => { if (end) setRange(previous => ({ ...previous, end })); },
  }), [range, setRange]);
  return <MarketingFiltersContext.Provider value={filters}>{children}</MarketingFiltersContext.Provider>;
}

export function useMarketingDateRange(startKey: string, endKey: string, defaultStart: string, defaultEnd: string) {
  const shared = useContext(MarketingFiltersContext);
  const [localStart, setLocalStart] = useUserPreferenceState(startKey, defaultStart, !shared);
  const [localEnd, setLocalEnd] = useUserPreferenceState(endKey, defaultEnd, !shared);
  return { start: shared?.start ?? localStart, end: shared?.end ?? localEnd,
    setStart: shared?.setStart ?? setLocalStart, setEnd: shared?.setEnd ?? setLocalEnd, grouped: Boolean(shared) };
}

/** Date-aware reports only; indexing and inspection reports represent current state. */
export function marketingReportPath(path: string | null, range: Range | null) {
  if (!path || !range) return path;
  const [endpoint, query = ""] = path.split("?");
  if (!["/seo-console/performance", "/seo-console/performance/rows", "/seo-console/performance/export", "/seo-console/overview", "/seo-console/insights"].includes(endpoint)) return path;
  const params = new URLSearchParams(query);
  params.set("start", range.start);
  params.set("end", range.end);
  return endpoint + "?" + params;
}
`);
edit('frontend/src/components/MarketingWorkspace.tsx', s => {
 s = 'import { useContext } from "react";\nimport DateRangeHeader from "./DateRangeHeader";\nimport { MarketingFiltersContext, MarketingFiltersProvider } from "./marketingFilters";\nimport { OrdersToolbar } from "./orders/OrdersToolbar";\n' + s;
 s = rep(s, '  return <OrdersPage title="Marketing" icon={Megaphone} tabs={tabs}>{children}</OrdersPage>;', '  return <MarketingFiltersProvider><OrdersPage title="Marketing" icon={Megaphone} tabs={tabs}><MarketingDateControls />{children}</OrdersPage></MarketingFiltersProvider>;');
 return s + '\nfunction MarketingDateControls() {\n  const filters = useContext(MarketingFiltersContext)!;\n  return <OrdersToolbar><DateRangeHeader startDate={filters.start} endDate={filters.end} onStartDateChange={filters.setStart} onEndDateChange={filters.setEnd} /></OrdersToolbar>;\n}\n';
});
// Wrap each existing header action group in the shared header portal; no handler duplication.
function header(s, title, standaloneTitle=false) {
 const sf = ts.createSourceFile('page.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 let titleNode;
 function visit(n) { if(ts.isJsxElement(n) && n.openingElement.tagName.getText(sf)==='h1' && n.getText(sf).includes(title)) titleNode=n; ts.forEachChild(n,visit); }
 visit(sf); if(!titleNode) throw Error('Title not found '+title);
 const titleBlock = standaloneTitle ? titleNode : titleNode.parent;
 const row = titleBlock.parent;
 const actions = row.children.find(n => ts.isJsxElement(n) && n.pos > titleBlock.end && n.openingElement.tagName.getText(sf)==='div');
 if(!actions) throw Error('Actions not found '+title);
 const changes = [{start:titleBlock.getStart(sf),end:titleBlock.end,text:'<MarketingPageTitle>'+titleBlock.getText(sf)+'</MarketingPageTitle>'},
 {start:actions.getStart(sf),end:actions.end,text:'<MarketingToolbar>'+actions.getText(sf)+'</MarketingToolbar>'}];
 const attr = row.openingElement.attributes.properties.find(n=>n.name?.getText(sf)==='className');
 if(attr && ts.isStringLiteral(attr.initializer)) changes.push({start:attr.initializer.getStart(sf),end:attr.initializer.end,text:'{grouped ? "contents" : '+JSON.stringify(attr.initializer.text)+'}'});
 for(const c of changes.sort((a,b)=>b.start-a.start)) s=s.slice(0,c.start)+c.text+s.slice(c.end);
 return s;
}
for(const [file,title,startKey,endKey,defaultStart,standalone] of [
 ['AdsPage.tsx','Ads Department','ads.start','ads.end','daysAgoISO(29)',false],
 ['ContentPage.tsx','Content Operations','content.startDate','content.endDate','daysAgoISO(29)',false],
 ['KlaviyoPage.tsx','Email Marketing','klaviyo.start','klaviyo.end','daysAgoISO(30)',true],
]) edit('frontend/src/pages/'+file,s=>{
 s=header(s,title,standalone);
 s='import { useMarketingDateRange } from "../components/marketingFilters";\nimport { OrdersToolbar as MarketingToolbar, OrdersPageTitle as MarketingPageTitle } from "../components/orders/OrdersToolbar";\n'+s;
 if(file==='AdsPage.tsx') {
  s=rep(s,'  const [start, setStart] = useState<string>(daysAgoISO(29));\r\n  const [end, setEnd] = useState<string>(todayISO());', '  const { start, end, setStart, setEnd, grouped } = useMarketingDateRange("ads.start", "ads.end", daysAgoISO(29), todayISO());');
  s=rep(s,'          {/* Quick preset chips */}', '          {!grouped && <>\n          {/* Quick preset chips */}');
  s=rep(s,'          <button\r\n            disabled', '          </>}\n          <button\r\n            disabled');
 } else if(file==='ContentPage.tsx') {
  s=rep(s,'  const [startDate, setStartDate] = useUserPreferenceState<string>("content.startDate", daysAgoISO(29));\r\n  const [endDate, setEndDate] = useUserPreferenceState<string>("content.endDate", todayISO());', '  const { start: startDate, end: endDate, setStart: setStartDate, setEnd: setEndDate, grouped } = useMarketingDateRange("content.startDate", "content.endDate", daysAgoISO(29), todayISO());');
  s=rep(s,'          <DateRangeHeader\r\n', '          <DateRangeHeader\n            hideDateRange={grouped}\n');
 } else {
  s=rep(s,'  const [start, setStart] = useUserPreferenceState<string>("klaviyo.start", daysAgoISO(30));\r\n  const [end, setEnd] = useUserPreferenceState<string>("klaviyo.end", todayISO());', '  const { start, end, setStart, setEnd, grouped } = useMarketingDateRange("klaviyo.start", "klaviyo.end", daysAgoISO(30), todayISO());');
  s=rep(s,'          <>\r\n              {/* One tray', '          {!grouped && <>\n              {/* One tray');
  s=rep(s,'          </>\r\n\r\n          {canFeature("sync")', '          </>}\n\n          {canFeature("sync")');
 }
 return s;
});
edit('frontend/src/components/DateRangeHeader.tsx',s=>{
 s=rep(s,'  onRefresh?: () => void;', '  hideDateRange?: boolean;\n  onRefresh?: () => void;');
 s=rep(s,'  onRefresh,','  hideDateRange = false,\n  onRefresh,');
 s=rep(s,'      <div className="flex items-center gap-1 bg-dark-bg2', '      {!hideDateRange && <>\n      <div className="flex items-center gap-1 bg-dark-bg2');
 s=rep(s,'      {onRefresh && (','      </>}\n      {onRefresh && (');return s;
});
// SEO dates affect every date-aware fetch, including overview KPI and insight hooks.
edit('frontend/src/components/seo-console/shared.tsx',s=>{
 s='import { useContext } from "react";\nimport { MarketingFiltersContext, marketingReportPath } from "../marketingFilters";\n'+s;
 s=rep(s,'export function useConsoleData<T>(path: string | null) {','export function useConsoleData<T>(inputPath: string | null) {\n  const marketing = useContext(MarketingFiltersContext);\n  const path = marketingReportPath(inputPath, marketing);');return s;
});
edit('frontend/src/components/seo-console/PerformanceView.tsx',s=>{
 s='import { useContext } from "react";\nimport { MarketingFiltersContext, marketingReportPath } from "../marketingFilters";\n'+s;
 s=rep(s,'  const [range, setRange] = useState("3m");','  const marketing = useContext(MarketingFiltersContext);\n  const [range, setRange] = useState("3m");');
 s=rep(s,'  const params = new URLSearchParams({ site, type, range });','  const params = new URLSearchParams({ site, type, range });\n  if (marketing) { params.set("start", marketing.start); params.set("end", marketing.end); }');
 s=rep(s,'        <div className="flex overflow-hidden rounded-md border border-dark-border text-[13px]" role="group" aria-label="Date range">','        {!marketing && <div className="flex overflow-hidden rounded-md border border-dark-border text-[13px]" role="group" aria-label="Date range">');
 s=rep(s,'        </div>\r\n        {filters.map(f => (','        </div>}\n        {filters.map(f => (');
 // Breakdown has the shared dates in base params, so downloads keep exactly the same window.
 s=s.replace('import { MarketingFiltersContext, marketingReportPath }','import { MarketingFiltersContext }');
 return s;
});
edit('frontend/src/components/seo-console/KpiStrip.tsx',s=>{
 s='import { useContext } from "react";\nimport { MarketingFiltersContext } from "../marketingFilters";\n'+s;
 s=rep(s,'  const q = `site=${encodeURIComponent(site)}`;','  const marketing = useContext(MarketingFiltersContext);\n  const q = `site=${encodeURIComponent(site)}`;');
 return rep(s,'Last 28 days vs previous</div>','{marketing ? `${marketing.start} to ${marketing.end} vs previous` : "Last 28 days vs previous"}</div>');
});
edit('frontend/src/components/seo-console/InspectionReports.tsx',s=>{
 // Keep the Insights range annotation accurate when using the common filter.
 s='import { useContext } from "react";\nimport { MarketingFiltersContext } from "../marketingFilters";\n'+s;
 s=rep(s,'export function InsightsView(', 'export function InsightsView(');
 const start=s.indexOf('export function InsightsView('), brace=s.indexOf('\n',start);
 s=s.slice(0,brace+1)+'  const marketing = useContext(MarketingFiltersContext);\n'+s.slice(brace+1);
 return rep(s,'>Last 28 days</span>', '>{marketing ? `${marketing.start} to ${marketing.end}` : "Last 28 days"}</span>');
});
edit('backend/routes/seo_console.py',s=>{
 s=rep(s,'def _window(site: str, rng: str) -> tuple[str, str]:',`def _custom_range(start: date | None, end: date | None) -> str | None:
    if start is None and end is None:
        return None
    if start is None or end is None or start > end or end > date.today():
        raise HTTPException(422, "Provide a valid start and end date, ending no later than today.")
    if (end - start).days > 486:
        raise HTTPException(422, "Search Console date ranges cannot exceed 16 months.")
    return f"{start.isoformat()}:{end.isoformat()}"


def _report_range(rng: Range = Query("3m", alias="range"), start: date | None = Query(None), end: date | None = Query(None)) -> str:
    return _custom_range(start, end) or rng


def _window(site: str, rng: str) -> tuple[str, str]:`);
 s=rep(s,'    if rng == "24h":  # fresh data', '    if ":" in rng:\n        start, end = rng.split(":", 1)\n        return start, end\n    if rng == "24h":  # fresh data');
 // The dependency validates dates for summaries, paged rows, and CSV exports alike.
 s=s.replaceAll('    rng: Range = Query("3m", alias="range"),', '    rng: str = Depends(_report_range),');
 for(const [name,defaultRange] of [['overview','3m'],['insights','28d']]) {
  s=rep(s,`def ${name}(site: str = Query(DEFAULT_SITE), user: dict = Depends(require_section("seo"))):`, `def ${name}(site: str = Query(DEFAULT_SITE), start: date | None = Query(None), end: date | None = Query(None), user: dict = Depends(require_section("seo"))):`);
  const pos=s.indexOf('def '+name+'('), next=s.indexOf('\n\n#',pos);
  let part=s.slice(pos,next);
  part=rep(part,`    start, end = _window(site, "${defaultRange}")`,`    custom = _custom_range(start, end)\n    start, end = _window(site, custom or "${defaultRange}")`);
  part=rep(part,`f"seo-console:${name}:{site}"`,`f"seo-console:${name}:{site}:{custom or '${defaultRange}'}"`);
  s=s.slice(0,pos)+part+s.slice(next);
 }
 return s;
});
console.log('Common Marketing date filters, header actions, and SEO custom dates wired.');
