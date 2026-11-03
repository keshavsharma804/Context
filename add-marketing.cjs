const fs = require('node:fs');
const root = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
function edit(file, transform) {
  const path = root + file;
  const source = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, transform(source), 'utf8');
}
function replace(source, before, after) {
  if (!source.includes(before)) throw new Error('Missing anchor: ' + before);
  return source.replace(before, after);
}
fs.writeFileSync(root + 'components/MarketingWorkspace.tsx', `import type { ReactNode } from "react";
import { Megaphone } from "lucide-react";
import type { DashboardMenuItem } from "../lib/dashboardMenu";
import OrdersPage, { type WorkspaceTab } from "./OrdersPage";

export const MARKETING_PATH = "/marketing";
const SECTIONS = [
  { path: "/ads", label: "Ads" },
  { path: "/seo", label: "SEO" },
  { path: "/klaviyo", label: "Email / Klaviyo" },
  { path: "/content", label: "Content" },
];

export const isMarketingPath = (path: string) => path === MARKETING_PATH || SECTIONS.some(section => section.path === path);

// Callers supply dashboards filtered by the existing access and enable rules.
export function marketingTabs(dashboards: DashboardMenuItem[]) {
  return SECTIONS.flatMap(section => {
    const dashboard = dashboards.find(item => item.path === section.path);
    return dashboard ? [{ ...section, dashboard }] : [];
  });
}

export default function MarketingWorkspace({ tabs, children }: { tabs: WorkspaceTab[]; children: ReactNode }) {
  return <OrdersPage title="Marketing" icon={Megaphone} tabs={tabs}>{children}</OrdersPage>;
}
`, 'utf8');
edit('App.tsx', s => {
  s = 'import { marketingTabs, MARKETING_PATH } from "./components/MarketingWorkspace";\n' + s;
  s = replace(s, '  const customersSupportSectionTabs =', '  const marketingSectionTabs = marketingTabs(pages);\n  const customersSupportSectionTabs =');
  s = replace(s, '            <Route path={CUSTOMERS_SUPPORT_PATH}', '            <Route path={MARKETING_PATH} element={<Navigate to={marketingSectionTabs[0]?.path || "/no-access"} replace />} />\n            <Route path={CUSTOMERS_SUPPORT_PATH}');
  return s;
});
edit('components/Layout.tsx', s => {
  s = 'import MarketingWorkspace, { marketingTabs, isMarketingPath, MARKETING_PATH } from "./MarketingWorkspace";\n' + s;
  s = replace(s, '  const customersSupportSectionTabs =', '  const marketingSectionTabs = useMemo(() => marketingTabs(dashboards.filter(item => canOpenDashboard(item, auth.user?.role, auth.canView))), [dashboards, auth.user?.role, auth.canView]);\n  const customersSupportSectionTabs =');
  s = replace(s, 'isCustomersSupportPath(item.path)) continue;', 'isCustomersSupportPath(item.path) || isMarketingPath(item.path)) continue;');
  s = replace(s, '    if (customersSupportSectionTabs.length) {', `    if (marketingSectionTabs.length) {
      const section = marketingSectionTabs[0].dashboard.group;
      const group = groups.get(section) || [];
      group.push({ to: MARKETING_PATH, label: "Marketing", icon: dashboardIcon("Megaphone"), enabled: true, admin_only: false });
      groups.set(section, group);
    }
    if (customersSupportSectionTabs.length) {`);
  s = s.replaceAll('listingSectionTabs, templateSectionTabs, customersSupportSectionTabs]', 'listingSectionTabs, templateSectionTabs, customersSupportSectionTabs, marketingSectionTabs]');
  s = replace(s, '    if (to === CUSTOMERS_SUPPORT_PATH)', '    if (to === MARKETING_PATH) { prefetchDashboardPage(marketingSectionTabs[0]?.dashboard.component); return; }\n    if (to === CUSTOMERS_SUPPORT_PATH)');
  s = s.replaceAll('listingSectionTabs, customersSupportSectionTabs]', 'listingSectionTabs, customersSupportSectionTabs, marketingSectionTabs]');
  s = replace(s, '  const onCustomersSupportPage =', '  const onMarketingPage = isMarketingPath(loc.pathname);\n  const onCustomersSupportPage =');
  s = s.replaceAll('item.to === CUSTOMERS_SUPPORT_PATH ? onCustomersSupportPage : loc.pathname === item.to', 'item.to === CUSTOMERS_SUPPORT_PATH ? onCustomersSupportPage : item.to === MARKETING_PATH ? onMarketingPage : loc.pathname === item.to');
  s = replace(s, '              : onCustomersSupportPage ?', '              : onMarketingPage ? <MarketingWorkspace tabs={marketingSectionTabs}>{children}</MarketingWorkspace>\n              : onCustomersSupportPage ?');
  return s;
});
console.log('Marketing workspace and navigation added.');
