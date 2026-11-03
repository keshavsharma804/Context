const fs = require('node:fs');
const path = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/pages/AIAssistantPage.tsx';
let source = fs.readFileSync(path, 'utf8');
function replace(before, after) {
  if (!source.includes(before)) throw new Error('Missing layout anchor: ' + before);
  source = source.replace(before, after);
}
replace('className="flex min-h-0 w-full flex-1 overflow-hidden rounded-[24px]', 'className="flex min-h-0 min-w-0 w-full flex-1 overflow-hidden rounded-[24px]');
replace('className="hidden w-[250px] shrink-0 border-r border-slate-200 bg-slate-50/70 p-4 lg:flex lg:flex-col"', 'aria-label="Conversation history" className="hidden min-h-0 min-w-0 w-[260px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50/70 p-4 lg:flex xl:w-[280px]"');
replace('<div className="mt-5">', '<div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">');
replace('<div className="flex items-center justify-between gap-2 px-2">', '<div className="flex shrink-0 items-center justify-between gap-2 px-2">');
replace('<div className="mt-3 space-y-1.5">', '<div className="mt-3 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1">');
replace('<PageLoadingBoundary loading={Boolean(historyLoading)} compact', '<PageLoadingBoundary className="min-w-0 max-w-full grid-cols-[minmax(0,1fr)] [&>.tdo-loading-content]:min-w-0 [&>.tdo-loading-content]:gap-1.5" loading={Boolean(historyLoading)} compact');
replace('className={`group relative rounded-xl transition-colors ${', 'className={`group relative min-w-0 max-w-full w-full shrink-0 overflow-hidden rounded-xl transition-colors ${');
replace('className="w-full min-h-[48px] rounded-xl px-3 py-2 pr-9 text-left transition-colors disabled:cursor-wait disabled:opacity-70"', 'aria-current={isActive ? "page" : undefined}\n                          title={conversation.title || "New conversation"}\n                          className="block min-w-0 max-w-full w-full min-h-[72px] rounded-xl px-3 py-2.5 pr-9 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 disabled:cursor-wait disabled:opacity-70"');
replace('<span className="block truncate text-sm font-medium leading-4">{conversation.title || "New conversation"}</span>', '<span className="line-clamp-2 break-words text-sm font-semibold leading-5">{conversation.title || "New conversation"}</span>');
replace('className={`mt-0.5 block truncate text-[11px] leading-4 ${', 'className={`mt-1 block max-w-full truncate text-[11px] leading-4 ${');
replace('className={`mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 ${', 'className={`mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 ${');
replace('<Clock className="h-3 w-3" />\r\n                            {formatSessionTime(conversation.updated_at || conversation.created_at)}', '<Clock className="h-3 w-3 shrink-0" />\n                            <span className="truncate">{formatSessionTime(conversation.updated_at || conversation.created_at)}</span>');
replace('<div className="flex min-w-0 flex-1 flex-col">', '<div className="flex min-h-0 min-w-0 flex-1 flex-col">');
replace('className="flex min-h-[78px] items-center justify-between', 'className="flex shrink-0 min-h-[78px] items-center justify-between');
replace('className="flex-1 overflow-y-auto bg-[#fbfcff]', 'className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcff]');
replace('<div className="border-t border-slate-200 bg-white p-3 sm:p-4">', '<div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">');
const ts = require('D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/node_modules/typescript');
const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (file.parseDiagnostics.length) throw new Error('Invalid TSX after history layout changes.');
fs.writeFileSync(path, source.replace(/\r?\n/g, '\r\n'));
console.log('Assistant history width, text wrapping, list spacing and independent scrolling fixed.');
