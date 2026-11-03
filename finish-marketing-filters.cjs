const fs=require('node:fs');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/';
const ts=require(root+'frontend/node_modules/typescript');
function edit(file,fn){const p=root+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')).replace(/\r?\n/g,'\r\n'));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a);return s.replace(a,b);}
edit('frontend/src/components/marketingFilters.tsx',s=>{
 s=rep(s,'createContext, useContext, useMemo,','createContext, useContext, useMemo, useState,');
 s=rep(s,'type Filters = Range & {','type Filters = Range & { refreshKey: number; refresh: () => void;');
 s=rep(s,'  const [range, setRange]', '  const [refreshKey, setRefreshKey] = useState(0);\n  const [range, setRange]');
 s=rep(s,'const filters = useMemo(() => ({ ...range,','const filters = useMemo(() => ({ ...range, refreshKey, refresh: () => setRefreshKey(key => key + 1),');
 return rep(s,'}), [range, setRange]);','}), [range, setRange, refreshKey]);');
});
edit('frontend/src/components/seo-console/shared.tsx',s=>rep(s,'  }, [path]);','  }, [path, marketing?.refreshKey]);'));
edit('frontend/src/components/seo-console/SearchConsolePage.tsx',s=>{
 s='import { useContext } from "react";\nimport { RefreshCw } from "lucide-react";\nimport { MarketingFiltersContext } from "../marketingFilters";\nimport { OrdersToolbar } from "../orders/OrdersToolbar";\n'+s;
 s=rep(s,'  const [params, setParams] = useSearchParams();','  const marketing = useContext(MarketingFiltersContext);\n  const [params, setParams] = useSearchParams();');
 return rep(s,'    <div className="tm-e min-h-full bg-dark-bg">','    <div className="tm-e min-h-full bg-dark-bg">\n      {marketing && <OrdersToolbar><button type="button" onClick={marketing.refresh} className="btn-primary"><RefreshCw size={11} />Refresh</button></OrdersToolbar>}');
});
edit('frontend/src/components/ads/meta/MetaOverviewTab.tsx',s=>{
 const sf=ts.createSourceFile('meta.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let node;
 function visit(n){if(ts.isJsxElement(n) && n.openingElement.attributes.properties.some(a=>a.name?.getText(sf)==='ref' && a.initializer?.getText(sf)==='{columnsDropdownRef}'))node=n;ts.forEachChild(n,visit);}
 visit(sf);if(!node)throw Error('Columns control missing');
 s=s.slice(0,node.getStart(sf))+'<MarketingToolbar>'+node.getText(sf)+'</MarketingToolbar>'+s.slice(node.end);
 return 'import { OrdersToolbar as MarketingToolbar } from "../../orders/OrdersToolbar";\n'+s;
});
edit('frontend/src/pages/AdsPage.tsx',s=>rep(s,'<MarketingToolbar><div className="flex items-center gap-2">','<MarketingToolbar><div className="flex flex-wrap items-center gap-2">'));
// Register the Marketing icon so the sidebar uses the same icon as the workspace.
edit('frontend/src/lib/dashboardMenuIcons.ts',s=>s.replaceAll('ListChecks, Mail, Monitor,','ListChecks, Mail, Megaphone, Monitor,'));
console.log('Header columns, SEO refresh and Marketing icon completed.');
