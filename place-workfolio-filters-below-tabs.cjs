const fs = require('node:fs');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts = require(root + '../node_modules/typescript');
const changes = new Map();
function edit(file, fn) { const path = root + file; changes.set(path, fn(fs.readFileSync(path, 'utf8'))); }
function replace(source, before, after) { if (!source.includes(before)) throw Error('Missing anchor: ' + before); return source.replace(before, after); }
edit('pages/ProductivityPage.tsx', source => {
  const parsed = ts.createSourceFile('ProductivityPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let filters;
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(parsed) === 'TeamToolbar' && node.getText(parsed).includes('setFilterPill("high")')) filters = node;
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (!filters) throw Error('Workfolio filters not found');
  const block = filters.children.find(node => ts.isJsxElement(node)).getText(parsed);
  let localFilters = replace(block,
    '"order-30 flex min-w-0 max-w-full basis-full flex-wrap items-center justify-end gap-2"',
    '"flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-dark-border pb-3"');
  localFilters = replace(localFilters,
    '"flex min-w-0 flex-wrap items-center justify-end gap-1.5 text-xs"',
    '"flex min-w-0 flex-wrap items-center gap-1.5 text-xs"');
  source = source.slice(0, filters.getStart(parsed)) + source.slice(filters.end);
  source = replace(source, '          {/* Controls Bar (Search & Sleek Sort Filter Dropdowns) */}', '');
  source = replace(source,
    '          {/* 5 KPI Summary Cards Row */}',
    '          {/* Workfolio filters stay inside this tab, above its summary cards. */}\n          ' + localFilters + '\n\n          {/* 5 KPI Summary Cards Row */}');
  return replace(source, 'order-20 flex flex-wrap items-center justify-end gap-2', 'order-2 flex flex-wrap items-center justify-end gap-2');
});
edit('components/OrdersPage.tsx', source => {
  source = replace(source, 'icon: Icon = Package, onCreateTemplate }: {', 'icon: Icon = Package, onCreateTemplate, toolbarClassName = "" }: {');
  source = replace(source, 'icon?: LucideIcon; onCreateTemplate?: () => void;', 'icon?: LucideIcon; onCreateTemplate?: () => void; toolbarClassName?: string;');
  return replace(source,
    'className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2"',
    'className={`ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 ${toolbarClassName}`}');
});
edit('components/TeamAutomationWorkspace.tsx', source => {
  source = replace(source, 'icon={Bot} tabs={tabs}', 'icon={Bot} tabs={tabs} toolbarClassName="flex-1"');
  return replace(source, 'order-10 flex shrink-0', 'order-1 flex shrink-0');
});
for (const [path, source] of changes) {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (parsed.parseDiagnostics.length) throw Error('Invalid TSX: ' + path);
}
for (const [path, source] of changes) fs.writeFileSync(path, source.replace(/\r?\n/g, '\r\n'));
console.log('Workfolio filters moved below the tabs and above the summary cards. Shared header uses the available width with valid control ordering.');
