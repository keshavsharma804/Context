const fs=require('node:fs');
const path='D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/components/ads/meta/MetaOverviewTab.tsx';
const ts=require('D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/node_modules/typescript');
let source=fs.readFileSync(path,'utf8');
const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),ranges=[];
const deadVariables=new Set(['dateDiffDays','handleExportMeta','exportRequestRef','pageSize','totalRows','totalPages','safePage','paginatedCampaigns']);
function remove(node){ranges.push([node.getStart(parsed),node.end]);}
function visit(node){
 if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>deadVariables.has(d.name.getText(parsed))||d.name.getText(parsed)==='[currentPage, setCurrentPage]'||d.name.getText(parsed)==='[exportingMeta, setExportingMeta]')){remove(node);return;}
 if(ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(parsed)==='useEffect'&&(node.getText(parsed).includes('exportRequestRef')||node.getText(parsed).includes('setCurrentPage(1)'))){remove(node);return;}
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(parsed)==='button'&&node.openingElement.attributes.properties.some(a=>a.name?.getText(parsed)==='onClick'&&a.initializer?.getText(parsed).includes('handleExportMeta'))){remove(node);return;}
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(parsed)==='div'&&node.children.filter(ts.isJsxElement).some(c=>c.openingElement.tagName.getText(parsed)==='button'&&c.getText(parsed).includes('setCurrentPage'))){remove(node);return;}
 ts.forEachChild(node,visit);
}
visit(parsed);
if(ranges.length!==17)throw Error('Unexpected removal count: '+ranges.length);
for(const [start,end]of ranges.sort((a,b)=>b[0]-a[0]))source=source.slice(0,start)+source.slice(end);
source=source.replaceAll('paginatedCampaigns','sortedCampaigns').replace('ExternalLink, Download, RefreshCw','ExternalLink, RefreshCw');
source=source.replace(/^[ \t]+(?=\r?$)/gm,'').replace(/(?:\r?\n){3,}/g,'\r\n\r\n');
const updated=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
if(updated.parseDiagnostics.length)throw Error('Invalid TSX after removing Ads controls.');
fs.writeFileSync(path,source);
console.log('Removed Campaigns, Ad Sets and Ads export buttons and Prev/range/Next controls. The full sorted campaign list remains visible.');
