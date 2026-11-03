const fs = require('node:fs');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts = require(root + '../node_modules/typescript');
const changes = new Map();
function edit(file, fn) { const path = root + file; changes.set(path, fn(fs.readFileSync(path, 'utf8'))); }
function rep(source, before, after) { if (!source.includes(before)) throw Error('Missing anchor: ' + before); return source.replace(before, after); }
edit('components/OrdersPage.tsx', source => {
  source = rep(source, 'toolbarClassName = "" }: {', 'toolbarClassName = "", controlsBelowTabs = false }: {');
  source = rep(source, 'toolbarClassName?: string;', 'toolbarClassName?: string; controlsBelowTabs?: boolean;');
  const target = '<div ref={setTarget} className={`ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2 ${toolbarClassName}`} aria-label={`${title} controls`} />';
  source = rep(source, target, '{!controlsBelowTabs && controls}');
  source = rep(source, '  return <OrdersToolbarContext.Provider', '  const controls = <div ref={setTarget} className={`flex min-w-0 max-w-full flex-wrap items-center gap-2 ${controlsBelowTabs ? "w-full border-t border-dark-border py-3" : "ml-auto justify-end"} ${toolbarClassName}`} aria-label={`${title} controls`} />;\n  return <OrdersToolbarContext.Provider');
  return rep(source, '      </nav>\r\n    </header>', '      </nav>\n      {controlsBelowTabs && controls}\n    </header>');
});
edit('components/TeamAutomationWorkspace.tsx', source => {
  source = 'import { useLocation } from "react-router-dom";\n' + source;
  source = rep(source, 'export default function TeamAutomationWorkspace({ tabs, children }: { tabs: WorkspaceTab[]; children: ReactNode }) {', 'export default function TeamAutomationWorkspace({ tabs, children }: { tabs: WorkspaceTab[]; children: ReactNode }) {\n  const { pathname } = useLocation();');
  return rep(source, 'toolbarClassName="flex-1">', 'toolbarClassName="flex-1" controlsBelowTabs={pathname === "/task-management"}>');
});
for (const [path, source] of changes) {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (parsed.parseDiagnostics.length) throw Error('Invalid TSX: ' + path);
}
for (const [path, source] of changes) fs.writeFileSync(path, source.replace(/\r?\n/g, '\r\n'));
console.log('Task Management now renders workspace tabs above search, view switches, board filters, columns and New task.');
