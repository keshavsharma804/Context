const fs=require('node:fs');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
const changes=new Map();
function edit(file,fn){const path=root+file;changes.set(path,fn(fs.readFileSync(path,'utf8')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing anchor '+a);return s.replace(a,b);}
changes.set(root+'components/AdminWorkspace.tsx',`import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import type { DashboardMenuItem } from "../lib/dashboardMenu";
import OrdersPage, { type WorkspaceTab } from "./OrdersPage";

export const ADMIN_WORKSPACE_PATH = "/admin";
const SECTIONS = [
  { path: "/connections", label: "Connections" },
  { path: "/settings", label: "Settings" },
];
export const isAdminWorkspacePath = (path: string) => path === ADMIN_WORKSPACE_PATH || SECTIONS.some(section => section.path === path);
// Callers apply the existing dashboard permissions, including Settings' admin-only access.
export function adminWorkspaceTabs(dashboards: DashboardMenuItem[]) {
  return SECTIONS.flatMap(section => {
    const dashboard = dashboards.find(item => item.path === section.path);
    return dashboard ? [{ ...section, dashboard }] : [];
  });
}
export default function AdminWorkspace({ tabs, children }: { tabs: WorkspaceTab[]; children: ReactNode }) {
  return <OrdersPage title="Admin" icon={Shield} tabs={tabs}>{children}</OrdersPage>;
}
`);
edit('App.tsx',s=>{
 s='import { adminWorkspaceTabs, ADMIN_WORKSPACE_PATH } from "./components/AdminWorkspace";\n'+s;
 s=rep(s,'  const teamAutomationSectionTabs =','  const adminSectionTabs = adminWorkspaceTabs(pages);\n  const teamAutomationSectionTabs =');
 return rep(s,'            <Route path={TEAM_AUTOMATION_PATH}', '            <Route path={ADMIN_WORKSPACE_PATH} element={<Navigate to={adminSectionTabs[0]?.path || "/no-access"} replace />} />\n            <Route path={TEAM_AUTOMATION_PATH}');
});
edit('components/Layout.tsx',s=>{
 s='import AdminWorkspace, { adminWorkspaceTabs, isAdminWorkspacePath, ADMIN_WORKSPACE_PATH } from "./AdminWorkspace";\n'+s;
 s=rep(s,'  const teamAutomationSectionTabs =','  const adminSectionTabs = useMemo(() => adminWorkspaceTabs(dashboards.filter(item => canOpenDashboard(item, auth.user?.role, auth.canView))), [dashboards, auth.user?.role, auth.canView]);\n  const teamAutomationSectionTabs =');
 s=rep(s,'isTeamAutomationPath(item.path)) continue;','isTeamAutomationPath(item.path) || isAdminWorkspacePath(item.path)) continue;');
 s=rep(s,'    if (teamAutomationSectionTabs.length) {',`    if (adminSectionTabs.length) {
      const group = groups.get("Admin control panel") || [];
      group.push({ to: ADMIN_WORKSPACE_PATH, label: "Admin", icon: dashboardIcon("Shield"), enabled: true, admin_only: adminSectionTabs.every(tab => tab.dashboard.admin_only) });
      groups.set("Admin control panel", group);
    }
    if (teamAutomationSectionTabs.length) {`);
 s=s.replaceAll('marketingSectionTabs, teamAutomationSectionTabs]','marketingSectionTabs, teamAutomationSectionTabs, adminSectionTabs]');
 s=rep(s,'    if (to === TEAM_AUTOMATION_PATH)', '    if (to === ADMIN_WORKSPACE_PATH) { prefetchDashboardPage(adminSectionTabs[0]?.dashboard.component); return; }\n    if (to === TEAM_AUTOMATION_PATH)');
 s=rep(s,'  const onTeamAutomationPage =','  const onAdminWorkspacePage = isAdminWorkspacePath(loc.pathname);\n  const onTeamAutomationPage =');
 s=s.replaceAll('item.to === TEAM_AUTOMATION_PATH ? onTeamAutomationPage : loc.pathname === item.to','item.to === TEAM_AUTOMATION_PATH ? onTeamAutomationPage : item.to === ADMIN_WORKSPACE_PATH ? onAdminWorkspacePage : loc.pathname === item.to');
 return rep(s,'              : onTeamAutomationPage ?', '              : onAdminWorkspacePage ? <AdminWorkspace tabs={adminSectionTabs}>{children}</AdminWorkspace>\n              : onTeamAutomationPage ?');
});
edit('pages/SettingsPage.tsx',s=>'import { OrdersPageTitle } from "../components/orders/OrdersToolbar";\n'+rep(s,'<h1 className="settings-title">Settings</h1>','<OrdersPageTitle><h1 className="settings-title">Settings</h1></OrdersPageTitle>'));
edit('pages/ConnectionsPage.tsx',s=>{
 const parsed=ts.createSourceFile('connections.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let title;
 function visit(n){if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(parsed)==='h1'&&n.getText(parsed).includes('Connections'))title=n.parent;ts.forEachChild(n,visit);}visit(parsed);
 if(!title)throw Error('Connections title missing');
 s=s.slice(0,title.getStart(parsed))+'<OrdersPageTitle>'+title.getText(parsed)+'</OrdersPageTitle>'+s.slice(title.end);
 return 'import { OrdersPageTitle } from "../components/orders/OrdersToolbar";\n'+s;
});
for(const [path,source] of changes){const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(parsed.parseDiagnostics.length)throw Error('Invalid TSX '+path);}
for(const [path,source] of changes)fs.writeFileSync(path,source.replace(/\r?\n/g,'\r\n'));
console.log('Admin workspace added with Connections and Settings using their existing access rules.');
