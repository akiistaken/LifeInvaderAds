const fs = require('fs');
const file = 'web/src/app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Global Dark-to-Light Theme Replacements
content = content.replace(/bg-\[\#09090b\]/g, 'bg-slate-50');
content = content.replace(/bg-zinc-950\/50/g, 'bg-slate-100/50');
content = content.replace(/bg-zinc-950/g, 'bg-white');
content = content.replace(/bg-zinc-900\/40/g, 'bg-white shadow-sm');
content = content.replace(/bg-zinc-900\/50/g, 'bg-slate-100/50');
content = content.replace(/bg-zinc-900/g, 'bg-slate-50');
content = content.replace(/bg-zinc-800\/50/g, 'bg-slate-200/50');
content = content.replace(/bg-zinc-800/g, 'bg-slate-200');
content = content.replace(/bg-zinc-700/g, 'bg-slate-300');
content = content.replace(/bg-\[\#020617\]/g, 'bg-slate-50');

content = content.replace(/border-zinc-800\/50/g, 'border-slate-200');
content = content.replace(/border-zinc-800/g, 'border-slate-200');
content = content.replace(/border-zinc-700/g, 'border-slate-300');
content = content.replace(/border-zinc-500/g, 'border-slate-400');

content = content.replace(/text-zinc-100/g, 'text-slate-900');
content = content.replace(/text-zinc-200/g, 'text-slate-800');
content = content.replace(/text-zinc-300/g, 'text-slate-700');
content = content.replace(/text-zinc-400/g, 'text-slate-500'); // Flipped 400->500 for legibility
content = content.replace(/text-zinc-500/g, 'text-slate-500'); // Kept standard UI muted text
content = content.replace(/text-zinc-600/g, 'text-slate-400');

// Hover states flip
content = content.replace(/hover:bg-zinc-800/g, 'hover:bg-slate-200');
content = content.replace(/hover:bg-zinc-700/g, 'hover:bg-slate-300');
content = content.replace(/hover:text-zinc-100/g, 'hover:text-slate-900');
content = content.replace(/hover:text-zinc-300/g, 'hover:text-slate-900');

// Make specific adjustments for grammar toggles (Red was on dark, needs to pop on light)
// 'bg-red-500 text-white border-red-600' is fine on Light mode.

fs.writeFileSync(file, content);
console.log("Converted UI to strictly Light Theme");
