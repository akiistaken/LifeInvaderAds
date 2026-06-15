const fs = require('fs');
const file = 'web/src/app/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

txt = txt.replace(/border-slate-200/g, 'border-slate-300');
txt = txt.replace(/border-slate-300\/50/g, 'border-slate-400/50');
txt = txt.replace(/border-slate-300(?![\/\-])/g, 'border-slate-400');
txt = txt.replace(/text-slate-500/g, 'text-slate-600');
txt = txt.replace(/bg-slate-50(?![\/\-])/g, 'bg-slate-100'); // make backgrounds slightly darker so white inputs pop

fs.writeFileSync(file, txt);
console.log('Darkened Light Theme borders and text.');
