const fs=require('node:fs');
const root='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/';
const ts=require(root+'../node_modules/typescript');
const changes=new Map();
function edit(file,fn){const path=root+file;changes.set(path,fn(fs.readFileSync(path,'utf8')));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a);return s.replace(a,b);}
edit('components/MarketingWorkspace.tsx',s=>rep(s,'  { path: "/content", label: "Content" },','  { path: "/content", label: "Content" },\n  { path: "/social-media", label: "Social Media" },'));
edit('pages/SocialMediaPage.tsx',s=>{
 s=rep(s,'import { useState } from "react";','import { useMarketingDateRange } from "../components/marketingFilters";\nimport { OrdersToolbar, OrdersPageTitle } from "../components/orders/OrdersToolbar";');
 s=rep(s,'  const [start, setStart] = useState<string>(daysAgoISO(29));\r\n  const [end, setEnd] = useState<string>(todayISO());','  const { start, end, setStart, setEnd, grouped } = useMarketingDateRange("socialMedia.start", "socialMedia.end", daysAgoISO(29), todayISO());');
 s=rep(s,'<div className="flex items-center justify-between mb-5 gap-3 flex-wrap">','<div className={grouped ? "contents" : "flex items-center justify-between mb-5 gap-3 flex-wrap"}>');
 s=rep(s,'        <div>\r\n          <h1','        <OrdersPageTitle><div>\n          <h1');
 s=rep(s,'        </div>\r\n        <div className="flex items-center gap-2">','        </div></OrdersPageTitle>\n        <OrdersToolbar><div className="flex flex-wrap items-center gap-2">');
 s=rep(s,'          <div className="flex items-center gap-1 bg-dark-bg2','          {!grouped && <>\n          <div className="flex items-center gap-1 bg-dark-bg2');
 s=rep(s,'          </label>\r\n          <button','          </label>\n          </>}\n          <button');
 return rep(s,'        </div>\r\n      </div>\r\n\r\n      <MetaGalleryTab','        </div></OrdersToolbar>\n      </div>\n\n      <MetaGalleryTab');
});
for(const [path,source]of changes){const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(parsed.parseDiagnostics.length)throw Error('Invalid TSX '+path);}
for(const [path,source]of changes)fs.writeFileSync(path,source.replace(/\r?\n/g,'\r\n'));
console.log('Social Media moved into Marketing with the shared date range and existing refresh control.');
