const fs = require('node:fs');
const path = 'D:/.openclaw/PMO/Product_Management_dashboard_db/frontend/src/pages/ProductivityPage.tsx';
const source = fs.readFileSync(path, 'utf8');
fs.writeFileSync(path, source.replace(/^[ \t]+(?=\r?$)/gm, ''));
