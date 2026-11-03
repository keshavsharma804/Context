const fs = require('node:fs');
const path = 'D:/.openclaw/PMO/Product_Management_dashboard_db/backend/routes/seo_console.py';
let s = fs.readFileSync(path, 'utf8');
for (const name of ['overview', 'insights']) {
 const prefix = `def ${name}(site: str = Query(DEFAULT_SITE), start: date | None = Query(None), end: date | None = Query(None),`;
 if (!s.includes(prefix)) throw Error('Missing '+name);
 s = s.replace(prefix, `def ${name}(site: str = Query(DEFAULT_SITE), start: date | None = None, end: date | None = None,`);
 const fallback = name === 'overview' ? '3m' : '28d';
 s = s.replace(`f"seo-console:${name}:{site}:{custom or '${fallback}'}"`, `f"seo-console:${name}:{site}" + (f":{custom}" if custom else "")`);
}
fs.writeFileSync(path, s);
console.log('Background sync defaults and existing SEO snapshot keys preserved.');
