const fs = require('node:fs');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const changes = new Map();
function edit(file, transform) {
  const path = root + file;
  changes.set(path, transform(fs.readFileSync(path, 'utf8')));
}
function replace(source, before, after) {
  if (!source.includes(before)) throw new Error('Missing layout anchor: ' + before);
  return source.replace(before, after);
}
edit('components/OrdersPage.tsx', source => replace(source,
  'className="ml-auto flex flex-wrap items-center justify-end gap-2"',
  'className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2"'));
edit('components/TeamAutomationWorkspace.tsx', source => replace(replace(source,
  'className="relative w-56 max-w-full"', 'className="order-0 relative w-56 max-w-full"'),
  'className="flex items-center gap-1 rounded-md border border-dark-border bg-dark-bg2 p-1 text-xs"',
  'className="order-10 flex shrink-0 items-center gap-1 rounded-md border border-dark-border bg-dark-bg2 p-1 text-xs"'));
edit('pages/ProductivityPage.tsx', source => {
  source = replace(source,
    '<TeamToolbar><div className={`flex items-center gap-3 ${mainTab === "productivity" ? "" : "hidden"}`}>',
    '<TeamToolbar><div className={`order-20 flex flex-wrap items-center justify-end gap-2 ${mainTab === "productivity" ? "" : "hidden"}`}>');
  source = replace(source,
    '<TeamToolbar><div className="flex items-center justify-between flex-wrap gap-3 p-3.5 bg-dark-bg2 border border-dark-border rounded-2xl shadow-lg">',
    '<TeamToolbar><div className={grouped ? "order-30 flex min-w-0 max-w-full basis-full flex-wrap items-center justify-end gap-2" : "flex items-center justify-between flex-wrap gap-3 p-3.5 bg-dark-bg2 border border-dark-border rounded-2xl shadow-lg"}>');
  source = replace(source,
    '<div className="flex items-center gap-1.5 overflow-x-auto text-xs">',
    '<div className={grouped ? "flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-xs" : "flex items-center gap-1.5 overflow-x-auto text-xs"}>');
  source = replace(source,
    '{/* Right: Premium Sort Selector Dropdown */}\r\n            <div className="flex items-center gap-2">',
    '{/* Column controls and sorting stay alongside the productivity filters. */}\n            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">');
  return source;
});
const ts = require(root + '../node_modules/typescript');
for (const [path, source] of changes) {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (parsed.parseDiagnostics.length) throw new Error('Invalid TSX: ' + path);
}
for (const [path, source] of changes) fs.writeFileSync(path, source.replace(/\r?\n/g, '\r\n'));
console.log('Workfolio header aligned: search, week and actions first; filters, columns and sorting in a compact second row.');
