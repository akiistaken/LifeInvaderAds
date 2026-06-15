"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
// Data fetching will be handled dynamically from the server
// import parsedItems from '../../../parsed_items.json';
// import templatesRaw from '../../../templates.json';

const CATEGORIES = ['Car Ads', 'House Ads', 'Items & Clothing', 'Business Ads', 'Work Ads', 'Dating Ads', 'Others', 'Manager', 'Templates', 'Rejections'];
const CLIENT_API_VERSION = 3;

const GLOBAL_LOCATIONS = [
    'Amphitheatre №1/2', 'Auto Salon', 'Bahama Mamas', 'Banham Canyon', 'Business Center', 'Capitol', 'the Casino', 'Cayo Perico Island', 'Chumash', 'the Church', 'Del Perro', 'Diamond Bar', 'Downtown Vinewood', 'Eclipse Tower', 'El Burro Heights', 'Fight Club Bar', 'Hospital', 'Sandy Hospital', 'Legion Square', 'LifeInvader', 'Little Seoul', 'Mirror Park', 'Richards Majestic', 'Richman', 'Rockford Hills', 'Pacific Bluffs Country Club', 'Paleto Bay', 'Pillbox Hill', 'Postal', 'Rancho', 'Sandy Shores', 'Tequi-La-La bar', 'Vanilla Unicorn Bar', 'Vespucci Canals', 'Vinewood Hills', 'the Yacht', 'West Vinewood',
    'airport', 'the beach', 'beach market', 'city', 'fire station', 'ghetto', 'the mall', 'post office', 'residential complex', 'the stadium', 'train station'
];

function parseExpiration(dateStr: string) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
       const day = parseInt(parts[0], 10);
       const month = parseInt(parts[1], 10) - 1;
       const year = parseInt(parts[2], 10);
       const d = new Date(year, month, day);
       d.setHours(0,0,0,0);
       return d.getTime();
    }
    return null;
}

function extractAllTemplates(templateData: Record<string, unknown>) {
    let arr: { key: string; name: string; content: string; type: string; adCategory: string; expires: number | null; expireStr: string }[] = [];
    Object.keys(templateData).forEach(key => {
        let adCategory = key; // Use actual sheet name as category
        if (key.toLowerCase().includes('family') || key.toLowerCase().includes('families')) adCategory = 'Others';
        else if (key.toLowerCase().includes('office')) adCategory = 'Work';
        
        const matrix = templateData[key] as any;
        if (Array.isArray(matrix)) {
            matrix.forEach(row => {
                if (Array.isArray(row) && row.length >= 2 && typeof row[0] === 'string' && typeof row[1] === 'string' && row[0].trim() !== '') {
                    if (row[0].toLowerCase().includes('template') || row[1].length > 10) {
                        const rawCol2 = typeof row[2] === 'string' ? row[2].trim() : '';
                        let type = rawCol2;
                        let expires = null;
                        let expireStr = '';
                        
                        if (adCategory === 'Others' && rawCol2.includes('.')) {
                            expires = parseExpiration(rawCol2);
                            if (expires !== null) {
                                expireStr = rawCol2;
                                type = ''; // It was an expiration date, not a Service/Discount type
                            }
                        }

                        arr.push({
                           key,
                           name: row[0].trim(),
                           content: row[1].trim(),
                           type,
                           adCategory,
                           expires,
                           expireStr
                        });
                    }
                }
            });
        }
    });
    return arr;
}

// Removed global extractAllTemplates call
// const allTemplates = extractAllTemplates();


function getDot(str: string) {
    if (!str) return '';
    let l = str.trim();
    if (/[0-9.!?]$/.test(l)) return '';
    return '.';
}

function formatPrice(val: string, category: string, propType?: string, action: string = 'Selling') {
    let lower = val.toLowerCase().trim();
    if (!lower || lower === 'negotiable') return 'Negotiable';
    
    let multiplier = 1;
    if (lower.endsWith('m') || lower.endsWith('mil') || lower.endsWith('million')) multiplier = 1000000;
    else if (lower.endsWith('k')) multiplier = 1000;
    else if (lower.endsWith('b') || lower.endsWith('bil') || lower.endsWith('billion')) multiplier = 1000000000;

    const baseStr = lower.replace(/[^0-9.]/g, '');
    if (!baseStr) return val;

    const base = parseFloat(baseStr);
    if (isNaN(base)) return val;
    
    const num = Math.round(base * multiplier);

    // Real Estate & Business Negotiable Rules
    if (category === 'House Ads') {
       if (propType === 'house' && num < 1000000 && !action.toLowerCase().includes('rent')) return 'Negotiable';
       if (propType === 'apartment' && num < 2000000 && !action.toLowerCase().includes('rent')) return 'Negotiable';
    } else if (category !== 'Business Ads') {
       if (num >= 1000000000) return 'Negotiable';
    }
  
    // Format number
    if (num >= 1000000000 && (category === 'House Ads' || category === 'Business Ads')) {
        let bValue = num / 1000000000;
        return '$' + bValue + ' Billion';
    } else if (num >= 1000000 && category !== 'Work Ads') {
        let mValue = num / 1000000;
        return '$' + mValue + ' Million';
    } else {
        // Thousands separator as period (.)
        let str = num.toString();
        let res = '';
        for (let i = str.length - 1, j = 0; i >= 0; i--, j++) {
           if (j > 0 && j % 3 === 0) res = '.' + res;
           res = str[i] + res;
        }
        return '$' + res; 
    }
}

// Format quantity: expand k/m, add dot-separated thousands
function formatQty(val: string): string {
    let lower = val.toLowerCase().trim();
    if (!lower) return '';
    
    // Handle "a" / "an" literally
    if (lower === 'a' || lower === 'an') return lower;
    
    let multiplier = 1;
    if (lower.endsWith('m') || lower.endsWith('mil')) multiplier = 1000000;
    else if (lower.endsWith('k')) multiplier = 1000;
    
    const baseStr = lower.replace(/[^0-9.]/g, '');
    if (!baseStr) return val;
    
    const base = parseFloat(baseStr);
    if (isNaN(base)) return val;
    
    const num = Math.round(base * multiplier);
    
    // Format with dot separators
    let str = num.toString();
    let res = '';
    for (let i = str.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) res = '.' + res;
        res = str[i] + res;
    }
    return res;
}

function CopyBox({ text, tabName }: { text: string, tabName?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-6 flex flex-col gap-2">
      <h3 className="text-xs text-slate-600 uppercase tracking-widest font-bold">Transaction Preview</h3>
      <div className="relative group">
        <textarea
          readOnly
          value={text}
          className="w-full h-24 p-5 bg-slate-100 border border-slate-400 rounded-xl text-slate-900 font-mono text-sm resize-none focus:outline-none focus:border-sky-500 transition-colors"
        />
        <button
          onClick={handleCopy}
          disabled={!text}
          className="absolute bottom-4 right-4 bg-sky-500 hover:bg-sky-400 text-zinc-900 px-6 py-2 rounded-lg font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? "Copied!" : "Copy AD"}
        </button>
        {tabName && <p className="absolute bottom-[-20px] right-4 font-bold text-[10px] uppercase leading-tight" style={{ background: 'linear-gradient(90deg, #ef4444, #f97316, #ef4444, #f97316)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 1s linear infinite', filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.5))' }}>⚠ Change category to {tabName} before posting.</p>}
      </div>
    </div>
  );
}

function Autocomplete({ options, value, onChange, placeholder, stateValues }: { options: string[], value: string, onChange: (val: string) => void, placeholder: string, stateValues?: Record<string, string> }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value), [value]);

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 30);
    return options.filter(o => o.toLowerCase().includes(query.toLowerCase())).slice(0, 30);
  }, [query, options]);

  return (
    <div className="relative">
      <input type="text" value={query} onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder={placeholder} className="w-full bg-slate-100 border border-slate-400 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-sky-500" />
      {open && filtered.length > 0 && (
         <ul className="absolute z-10 w-full bg-slate-200 border border-slate-400 rounded-lg mt-1 max-h-60 overflow-y-auto shadow-2xl">
           {filtered.map((opt, i) => (
             <li key={i} className="p-3 hover:bg-sky-600/20 cursor-pointer text-slate-800 flex items-center justify-between" onMouseDown={(e) => { e.preventDefault(); onChange(opt); setQuery(opt); setOpen(false); }}>
               <span>{opt}</span>
               {stateValues?.[opt] && <span className="text-[10px] font-bold font-mono bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-2 shrink-0">💲 {stateValues[opt]}</span>}
             </li>
           ))}
         </ul>
      )}
    </div>
  );
}

// ------------- CARS -------------
function CarForm({ options, stateValues }: { options: string[], stateValues: Record<string, string> }) {
  const [type, setType] = useState('Selling');
  const [name, setName] = useState('');
  const [targetName, setTargetName] = useState('');
  const [config, setConfig] = useState('None');
  const [extras, setExtras] = useState({ vis: false, ins: false, tune: false, turbo: false, drift: false });
  const [price, setPrice] = useState('');

  const generatedAd = useMemo(() => {
    if (!name.trim()) return '';
    const xtras = [];
    if (extras.vis) xtras.push('visual upgrades');
    if (extras.ins) xtras.push('insurance');
    if (extras.tune) xtras.push('tuning parts');
    if (extras.turbo) xtras.push('turbo kit');
    if (extras.drift) xtras.push('drift kit');
    
    let extraStr = '';
    if (xtras.length > 0) {
       if (xtras.length === 1) {
           extraStr = ` with ${xtras[0]}`;
       } else {
           const last = xtras.pop();
           extraStr = ` with ${xtras.join(', ')} and ${last}`;
       }
    }
    
    let configStr = config !== 'None' ? ` in ${config.toLowerCase()} configuration` : '';
    let finalAction = type;
    const formattedPrice = formatPrice(price, 'Car Ads', '');
    let priceStr = '';
    
    if (type !== 'Trading' && type !== 'Trading for') {
        const label = type === 'Buying' ? 'Budget' : 'Price';
        priceStr = `. ${label}: ${formattedPrice}${getDot(formattedPrice)}`;
    } else if (type === 'Trading for' && price.trim()) {
        const label = 'Budget'; // Usually budget for the "plus money" part
        priceStr = `. ${label}: ${formattedPrice}${getDot(formattedPrice)}`;
    }

    const isGeneric = /^(a |an )/i.test(name.trim());
    const nameStr = isGeneric ? name.trim() : `"${name}"`;

    if (type === 'Trading for') {
        const targetStr = targetName.trim() ? ((/^(a |an )/i.test(targetName.trim())) ? ` for ${targetName.trim()}` : ` for "${targetName}"`) : '';
        const res = `Trading ${nameStr}${targetStr}${configStr}${extraStr}${priceStr}`;
        return res + (priceStr ? '' : '.');
    }

    const res = `${finalAction} ${nameStr}${configStr}${extraStr}${priceStr}`;
    return res + (priceStr ? '' : '.');
  }, [type, name, targetName, config, extras, price]);

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      <div>
        <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">Action</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-400">
          {['Selling', 'Buying', 'Selling or trading', 'Trading', 'Trading for'].map(t => <button key={t} onClick={() => setType(t)} className={`py-1.5 px-1 rounded font-medium text-[10px] sm:text-xs transition-colors ${type === t ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:bg-slate-200'}`}>{t}</button>)}
        </div>
      </div>
      <div className={type === 'Trading for' ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : ""}>
        <div>
          <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">{type === 'Trading for' ? 'Your Vehicle' : 'Vehicle Name (Search)'}</label>
          <Autocomplete options={options} value={name} onChange={setName} placeholder="e.g. Truffade Chiron" stateValues={stateValues} />
          {name.trim() && stateValues[name.trim()] && (
              <div className="flex items-center gap-2 mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                  <span className="text-emerald-600 text-sm">💲</span>
                  <span className="text-xs font-bold text-emerald-700">State Value</span>
                  <span className="text-xs font-mono font-bold text-emerald-800 ml-auto">{stateValues[name.trim()]}</span>
              </div>
          )}
        </div>
        {type === 'Trading for' && (
          <div>
            <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">Trading For</label>
            <Autocomplete options={options} value={targetName} onChange={setTargetName} placeholder="e.g. Grotti Italia" stateValues={stateValues} />
            {targetName.trim() && stateValues[targetName.trim()] && (
                <div className="flex items-center gap-2 mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-600 text-sm">💲</span>
                    <span className="text-xs font-bold text-emerald-700">State Value</span>
                    <span className="text-xs font-mono font-bold text-emerald-800 ml-auto">{stateValues[targetName.trim()]}</span>
                </div>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">Configuration</label>
        <div className="flex gap-4">
          {['Full', 'Partial', 'None'].map(c => (
            <label key={c} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={config === c} onChange={() => setConfig(c)} className="accent-sky-500 w-4 h-4" />
              <span className="text-slate-700">{c}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">Extras Order (Vis -&gt; Ins -&gt; Tune -&gt; Turbo -&gt; Drift)</label>
        <div className="grid grid-cols-3 gap-3">
          {[{ id: 'vis', label: 'Visual Upgrades' },{ id: 'ins', label: 'Insurance' },{ id: 'tune', label: 'Tuning Parts' },{ id: 'turbo', label: 'Turbo Kit' },{ id: 'drift', label: 'Drift Kit' }].map(ext => (
            <label key={ext.id} className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-400 rounded-lg cursor-pointer">
              <input type="checkbox" checked={extras[ext.id as keyof typeof extras]} onChange={e => setExtras({...extras, [ext.id]: e.target.checked})} className="accent-sky-500 w-4 h-4" />
              <span className="text-slate-700 text-sm">{ext.label}</span>
            </label>
          ))}
        </div>
      </div>
      {type !== 'Trading' && (
      <div>
        <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">{type === 'Buying' ? 'Budget' : 'Price'} (k/m supported)</label>
        <input type="text" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5m or 20k" className="w-full bg-slate-100 border border-slate-400 rounded-lg p-3 text-slate-900 focus:outline-none focus:border-sky-500 font-mono" />
      </div>
      )}
      <CopyBox text={generatedAd} tabName="CARS" />
    </div>
  );
}

// ------------- ITEMS -------------
const tryGroupArr = (arr: string[], addS: boolean = false) => {
    let tokens = arr[0].split(' ');
    let commonPrefix = [];
    for (let i = 0; i < tokens.length; i++) {
        let word = tokens[i].toLowerCase();
        let allMatch = arr.every(n => {
            let toks = n.toLowerCase().split(' ');
            return toks.length > i && toks[i] === word;
        });
        if (allMatch) commonPrefix.push(tokens[i]);
        else break;
    }

    let revTokens = arr[0].split(' ').reverse();
    let commonSuffix = [];
    for (let i = 0; i < revTokens.length; i++) {
        let word = revTokens[i].toLowerCase();
        let allMatch = arr.every(n => {
            let toks = n.toLowerCase().split(' ').reverse();
            return toks.length > i && toks[i] === word;
        });
        if (allMatch) commonSuffix.push(revTokens[i]);
        else break;
    }

    // Prefer suffix merge when addS is true (pluralization on suffix is more natural)
    // e.g. "10% attack juice" + "10% protection juice" → "10% attack and protection juices" (not "10%S attack juice and...")
    const hasSuffix = commonSuffix.length >= 1 && commonSuffix.length < revTokens.length;
    const hasPrefix = commonPrefix.length > 0 && commonPrefix.length < tokens.length;

    // Try suffix first when addS is true, prefix first otherwise
    const tryOrder = addS && hasSuffix ? ['suffix', 'prefix'] : ['prefix', 'suffix'];

    for (const mode of tryOrder) {
        if (mode === 'prefix' && hasPrefix) {
            const pfxStr = commonPrefix.join(' ');
            let pfxVals = arr.map(n => n.substring(pfxStr.length).trim());
            if (pfxVals.every(x => x.length > 0)) {
                const last = pfxVals.pop();
                const pStr = pfxVals.length > 0 ? `${pfxVals.join(', ')} and ${last}` : last;
                let realPfx = arr[0].substring(0, pfxStr.length);
                if (addS && !hasSuffix) realPfx = pluralizeItem(realPfx, true);
                return `${realPfx} ${pStr}`;
            }
        }
        if (mode === 'suffix' && hasSuffix) {
            const sfxReversed = [...commonSuffix].reverse();
            const sfxStr = sfxReversed.join(' ');
            let sfxVals = arr.map(n => n.substring(0, n.length - sfxStr.length).trim());
            if (sfxVals.every(x => x.length > 0)) {
                const last = sfxVals.pop();
                const sStr = sfxVals.length > 0 ? `${sfxVals.join(', ')} and ${last}` : last;
                let realSfx = arr[0].substring(arr[0].length - sfxStr.length);
                if (addS) realSfx = pluralizeItem(realSfx, true);
                return `${sStr} ${realSfx}`;
            }
        }
    }

    return null;
};

function pluralizeItem(name: string, addS: boolean) {
    if (!name) return '';
    let displayName = name.trim();
    
    // Check for slash notation: "singular/plural"
    if (displayName.includes('/')) {
        const parts = displayName.split('/');
        if (addS) {
            return parts[1] ? parts[1].trim() : parts[0].trim() + 's';
        } else {
            return parts[0].trim();
        }
    }
    
    if (!addS) return displayName;

    // Uncountable nouns — same in singular and plural
    const uncountableExact = ['fruit', 'salmon', 'trout', 'deer', 'sheep', 'fish', 'bass', 'cod', 'tuna', 'bait', 'ammo', 'ammunition', 'livestock', 'aluminum', 'steel', 'gold', 'silver', 'iron', 'copper', 'wood', 'lumber', 'timber', 'charcoal', 'gunpowder', 'rubber', 'leather', 'cloth', 'silk', 'wool', 'cotton', 'kevlar', 'carbon fiber', 'plastic', 'sugar', 'salt', 'flour', 'rice', 'corn', 'wheat', 'hay', 'grass', 'moss', 'sand', 'gravel', 'cement', 'concrete', 'asphalt', 'fuel', 'gasoline', 'diesel', 'oil', 'petroleum', 'equipment', 'furniture', 'luggage', 'clothing', 'jewelry', 'evidence', 'information', 'advice', 'feedback', 'research', 'homework', 'knowledge'];
    const uncountableSuffixes = ['metal', 'scrap', 'ore', 'dust', 'powder', 'meat', 'grass', 'fur'];
    const lastWord = displayName.split(' ').pop()?.toLowerCase() || '';
    if (uncountableExact.includes(lastWord) || uncountableSuffixes.some(s => lastWord.endsWith(s))) {
        return displayName;
    }
    
    // Handle "of type" case
    if (displayName.toLowerCase().includes(' of type ')) {
        return displayName.replace(/(\w+)(\s+of type\b)/i, (match, word, suffix) => {
            if (word.toLowerCase().endsWith('s')) return match; // Already plural
            const s = word === word.toUpperCase() ? 'S' : 's';
            return word + s + suffix;
        });
    }
    
    // Basic grammar rules for pluralization
    const lower = displayName.toLowerCase();
    
    // Keywords pluralization (container, ticket)
    // Special case: "ticket fragment" -> pluralize "fragment" not "ticket"
    if (lower.includes('ticket fragment')) {
        return displayName.replace(/fragment\b/i, (match) => {
            const isUpper = match === match.toUpperCase();
            return match + (isUpper ? 'S' : 's');
        });
    }
    if (lower.includes('container') || lower.includes('ticket')) {
        // Only pluralize if not already pluralized in that word
        return displayName.replace(/(container|ticket)\b/i, (match) => {
            if (lower.includes(match.toLowerCase() + 's')) return match; // Already s
            const isUpper = match === match.toUpperCase();
            return match + (isUpper ? 'S' : 's');
        });
    }

    // Already-plural words (end in 's' naturally) — don't add more
    const alreadyPlural = ['seeds', 'meds', 'binoculars', 'scissors', 'pants', 'jeans', 'shorts', 'glasses', 'pliers', 'tweezers', 'goods', 'clothes', 'belongings', 'savings', 'earnings', 'proceeds', 'remains', 'stairs', 'woods', 'cards', 'rims', 'headlights', 'wheels', 'boards', 'rounds', 'pills', 'herbs', 'pearls', 'diamonds', 'emeralds', 'rubies', 'crystals', 'materials', 'minerals', 'chemicals', 'supplies', 'fireworks', 'explosives'];
    if (alreadyPlural.includes(lastWord)) {
        return displayName;
    }

    // Rule: -y -> -ies (if consonant before y)
    if (lower.endsWith('y')) {
        const vowelBeforeY = /[aeiou]y$/i.test(lower);
        if (!vowelBeforeY) {
            const suffix = displayName.endsWith('Y') ? 'IES' : 'ies';
            return displayName.slice(0, -1) + suffix;
        }
    }
    
    // Rule: -ss, -sh, -ch, -x, -z -> -es (but NOT plain -s words like "seeds")
    if (/(ss|sh|ch|x|z)$/i.test(lower)) {
        const suffix = displayName === displayName.toUpperCase() ? 'ES' : 'es';
        return displayName + suffix;
    }
    
    // If word already ends with 's', assume it's already plural
    if (lower.endsWith('s')) {
        return displayName;
    }
    
    // Default: +s
    const suffix = displayName === displayName.toUpperCase() ? 'S' : 's';
    return displayName + suffix;
}

function ItemsClothingForm({ itemOptions, clothOptions, prefs }: { itemOptions: string[], clothOptions: string[], prefs: { autoEach?: boolean; autoS?: boolean; defaultS?: boolean; darkMode?: boolean; autoBulkSEach?: boolean; sidebarMode?: boolean } }) {
    const [items, setItems] = useState([{ type: 'item', name: '', qty: '1', color: '', gender: 'None', lum: false, brand: '', oftype: '', price: '', addS: prefs.defaultS || false, addA: false, addEach: false, noMerge: false }]);
    const [action, setAction] = useState('Selling');
    const [inBulk, setInBulk] = useState(false);
    const [tradeTarget, setTradeTarget] = useState('');
    const [tradePrep, setTradePrep] = useState<'none' | 'for' | 'with'>('none');

    // Auto-pluralization logic (mostly for items, but applies to simplified clothing too)
    useEffect(() => {
        let changed = false;
        const nextItems = items.map(i => ({...i}));
        const validItems = nextItems.map((item, origIdx) => ({ ...item, origIdx })).filter(i => i.name.trim() !== '');
        
        const groups: any[] = [];
        validItems.forEach(i => {
           // Group by similar metadata
           let found = groups.find(g => g.type === i.type && g.qty === i.qty && g.color === i.color && g.price === i.price && g.addA === i.addA && g.gender === i.gender && g.brand === i.brand && g.lum === i.lum && g.oftype === i.oftype && !i.noMerge);
           if (found) found.items.push(i);
           else groups.push({ type: i.type, qty: i.qty, color: i.color, price: i.price, addA: i.addA, gender: i.gender, brand: i.brand, lum: i.lum, oftype: i.oftype, items: [i] });
        });

        const mergedIndices = new Set<number>();
        groups.forEach(g => {
            const arr = g.items;
            const names = arr.map((x:any) => x.name.trim());
            if (arr.length >= 2) {
                if (tryGroupArr(names)) {
                    arr.forEach((x:any) => mergedIndices.add(x.origIdx));
                }
            }
        });

        nextItems.forEach((item, idx) => {
            if (mergedIndices.has(idx)) {
                if (!item.addS && !(item as any).userOffS) { 
                    item.addS = true; 
                    item.addA = false; 
                    (item as any).autoS = true; 
                    changed = true; 
                }
            } else {
                if ((item as any).autoS && item.addS) {
                    item.addS = false;
                    (item as any).autoS = false;
                    changed = true;
                }
            }
            
            // Auto-Each logic based on quantity (only if pref enabled)
            if (prefs.autoEach !== false) {
                const qtyNum = parseInt(item.qty) || 0;
                if (item.type === 'item' && qtyNum > 1) {
                    if (!item.addEach && !(item as any).userOffEach) {
                        item.addEach = true;
                        (item as any).autoEach = true;
                        changed = true;
                    }
                } else if (item.type === 'item' && qtyNum <= 1) {
                    if ((item as any).autoEach && item.addEach) {
                        item.addEach = false;
                        (item as any).autoEach = false;
                        changed = true;
                    }
                }
            }

            // Auto-S logic based on quantity (only if pref enabled)
            if (prefs.autoS) {
                const qtyNumS = parseInt(item.qty) || 0;
                if (qtyNumS > 1) {
                    if (!item.addS && !(item as any).userOffS) {
                        item.addS = true;
                        (item as any).autoSFlag = true;
                        changed = true;
                    }
                } else if (qtyNumS <= 1) {
                    if ((item as any).autoSFlag && item.addS) {
                        item.addS = false;
                        (item as any).autoSFlag = false;
                        changed = true;
                    }
                }
            }
        });

        if (changed) setItems(nextItems);
    }, [items]);

    const generatedAd = useMemo(() => {
        const validItems = items.filter(i => i.name.trim() !== '');
        if (validItems.length === 0) return '';
        
        const groups: any[] = [];
        validItems.forEach(i => {
           let found = groups.find(g => g.type === i.type && g.qty === i.qty && g.color === i.color && g.price === i.price && g.addA === i.addA && g.addS === i.addS && g.addEach === i.addEach && g.gender === i.gender && g.lum === i.lum && g.brand === i.brand && g.oftype === i.oftype && !i.noMerge);
           if (found) found.names.push(i.name.trim());
           else groups.push({ ...i, names: [i.name.trim()] });
        });

        const finalItemStrings: string[] = [];
        let totalOriginalCount = 0;
        groups.forEach(g => {
            let names = [...g.names];
            totalOriginalCount += names.length;
            const groupedName = names.length > 1 ? tryGroupArr(names, g.addS) : null;
            if (groupedName) names = [groupedName];

            names.forEach((nameStr: string) => {
               let q = g.type === 'item' ? formatQty(g.qty) : '';
               let qLower = q.toLowerCase();
               
               let displayName = groupedName ? nameStr : pluralizeItem(nameStr, g.addS);
               
               let parts = [];
               if (g.color?.trim()) parts.push(g.color.trim());
               if (g.type === 'clothing' && g.lum) parts.push('luminous');
               if (g.type === 'clothing' && g.brand?.trim()) parts.push(g.brand.trim());
               
               parts.push(displayName);
               
               if (g.oftype?.trim()) {
                   parts.push(`of type ${g.oftype.trim()}`);
               }
               if (g.type === 'clothing' && g.gender !== 'None') {
                   parts.push(g.gender === 'Male' ? 'for men' : 'for women');
               }
               
               let fullTitle = parts.join(' ');
               
               if ((g.addA && (q === '1' || !q)) || qLower === 'a' || qLower === 'an') {
                   const firstChar = fullTitle.charAt(0).toLowerCase();
                   q = ['a', 'e', 'i', 'o', 'u'].includes(firstChar) ? 'an' : 'a';
               } else if (!g.addA && q === '1') {
                   q = '';
               }
               
               let prefix = q ? `${q} ` : '';
               finalItemStrings.push(`${prefix}${fullTitle}`);
            });
        });
        
        let itemsList = '';
        if (finalItemStrings.length === 1) itemsList = finalItemStrings[0];
        else if (finalItemStrings.length > 1) {
            const last = finalItemStrings.pop()!;
            const hasMergedGroup = totalOriginalCount > finalItemStrings.length + 1;
            if (hasMergedGroup) {
                // A merged group exists: use comma before it
                // e.g. "transmission, 2 medium quality brakes and engines"
                itemsList = `${finalItemStrings.join(', ')}, ${last}`;
            } else {
                // No merge: standard "A, B and C"
                itemsList = `${finalItemStrings.join(', ')} and ${last}`;
            }
        }

        let suffix = '.';
        if (action !== 'Trading') {
            const priceTokens: {val: string, each: boolean}[] = [];
            let someMissing = false;
            
            items.forEach(i => {
                if (i.name.trim()) {
                    if (!i.price.trim()) someMissing = true;
                    else {
                        let fP = formatPrice(i.price, 'Items Ads', '');
                        if (fP && !fP.includes('Negotiable')) {
                            if (fP.endsWith('.')) fP = fP.slice(0, -1);
                            priceTokens.push({ val: fP, each: i.addEach });
                        } else someMissing = true;
                    }
                }
            });
            
            const namedCount = items.filter(i => i.name.trim()).length;
            if (someMissing && namedCount > 1) suffix = `. ${action.includes('Buying') ? 'Budget' : 'Price'}: Negotiable.`;
            else if (priceTokens.length === 0) suffix = `. ${action.includes('Buying') ? 'Budget' : 'Price'}: Negotiable.`;
            else {
                let pStr = '';
                if (priceTokens.length === 1) {
                    pStr = priceTokens[0].val + (priceTokens[0].each ? ' each' : '');
                } else {
                    const anyEach = priceTokens.some(p => p.each);
                    const lastP = priceTokens.pop();
                    if (anyEach) pStr = `${priceTokens.map(p => p.val).join(', ')} and ${lastP?.val} each respectively`;
                    else pStr = `${priceTokens.map(p => p.val).join(', ')} and ${lastP?.val} respectively`;
                }
                suffix = `. ${action.includes('Buying') ? 'Budget' : 'Price'}: ${pStr}${getDot(pStr)}`;
            }
        }
        
        const tradeStr = (action === 'Trading' || action === 'Selling or trading') && tradePrep !== 'none' && tradeTarget.trim() ? ` ${tradePrep} ${tradeTarget.trim()}` : '';
        return `${action} ${itemsList}${tradeStr}${inBulk ? ' in bulk' : ''}${suffix}`;
    }, [action, items, inBulk, tradeTarget, tradePrep]);

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300 relative">
             <div className="flex gap-1 bg-slate-100 p-1 rounded-md border border-slate-400">
                {['Selling', 'Buying', 'Selling or trading', 'Trading'].map(t => <button key={t} onClick={() => setAction(t)} className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${action === t ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-700'}`}>{t}</button>)}
                <label className={`flex items-center justify-center px-4 rounded text-xs font-bold font-mono tracking-widest cursor-pointer transition-all ${inBulk ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                    <input type="checkbox" checked={inBulk} onChange={e => {
                        const bulk = e.target.checked;
                        setInBulk(bulk);
                        if (bulk && prefs.autoBulkSEach !== false) {
                            setItems(items.map(i => ({ ...i, addS: true, addEach: i.type === 'item' ? true : i.addEach })));
                        }
                    }} className="hidden" />
                    IN BULK
                </label>
            </div>
            {(action === 'Trading' || action === 'Selling or trading') && (
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-400">
                        {(['none', 'for', 'with'] as const).map(p => (
                            <button key={p} onClick={() => setTradePrep(p)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tradePrep === p ? 'bg-slate-300 text-slate-900' : 'text-slate-600 hover:bg-slate-200'}`}>{p}</button>
                        ))}
                    </div>
                    {tradePrep !== 'none' && (
                        <div className="flex-1">
                            <Autocomplete options={[...itemOptions, ...clothOptions]} value={tradeTarget} onChange={setTradeTarget} placeholder={`Trading ${tradePrep}...`} />
                        </div>
                    )}
                </div>
            )}
            <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase flex justify-between items-center mb-1 tracking-wider">
                    <span>Items & Clothing (Max 3)</span>
                    <button onClick={() => { if(items.length < 3) setItems([...items, {type: 'item', name: '', qty: '1', color: '', gender: 'None', lum: false, brand: '', oftype: '', price: '', addS: prefs.defaultS || false, addA: false, addEach: false, noMerge: false} as any]) }} className="text-slate-600 hover:text-slate-900 transition-colors">+ Add Line</button>
                </label>
                <div className="flex flex-col gap-2">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex flex-col gap-2 bg-slate-50 border border-slate-300 p-3 rounded-xl relative group shadow-sm transition-all hover:border-slate-400">
                            {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 w-5 h-5 bg-white shadow-md hover:bg-red-500 hover:text-white text-slate-400 rounded-full flex items-center justify-center text-[10px] transition-colors border border-slate-200 z-10">✕</button>}
                            
                            {/* Row 1: Type & Shared Fields */}
                            <div className="flex gap-2 items-center">
                                <button onClick={() => { const ni = [...items]; ni[idx].type = ni[idx].type === 'item' ? 'clothing' : 'item'; setItems(ni); }} className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${item.type === 'clothing' ? 'bg-purple-500 text-white shadow-purple-200 shadow-lg' : 'bg-sky-500 text-white shadow-sky-200 shadow-lg'}`}>
                                    {item.type}
                                </button>
                                
                                {item.type === 'item' ? (
                                    <input type="text" value={item.qty} onChange={e => { const ni = [...items]; ni[idx].qty = e.target.value; setItems(ni); }} className="w-12 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-xs text-center outline-none focus:border-sky-500" placeholder="Qty" />
                                ) : (
                                    <select value={item.gender} onChange={e => { const ni = [...items]; ni[idx].gender = e.target.value; setItems(ni); }} className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-[10px] outline-none focus:border-purple-500">
                                        <option value="None">Unisex</option>
                                        <option value="Male">Men's</option>
                                        <option value="Female">Women's</option>
                                    </select>
                                )}
                                
                                <input type="text" value={item.color || ''} onChange={e => { const ni = [...items]; ni[idx].color = e.target.value; setItems(ni); }} placeholder="Color" className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-xs outline-none focus:border-sky-500" />
                                
                                {item.type === 'clothing' && (
                                    <label className="flex items-center gap-1 bg-white border border-slate-300 px-2 py-1.5 rounded-lg text-[10px] text-slate-600 cursor-pointer hover:bg-slate-50">
                                        <input type="checkbox" checked={item.lum} onChange={e => { const ni = [...items]; ni[idx].lum = e.target.checked; setItems(ni); }} className="accent-purple-500" />
                                        Lum.
                                    </label>
                                )}
                                
                                <div className="flex-1 min-w-[150px]">
                                    <Autocomplete options={item.type === 'item' ? itemOptions : clothOptions} value={item.name} onChange={val => { const ni = [...items]; ni[idx].name = val; setItems(ni); }} placeholder={item.type === 'item' ? "Item (e.g. GPU)" : "Clothing (e.g. Hoodie)"} />
                                </div>
                            </div>

                            {/* Row 2: Type-specific Fields & Price */}
                            <div className="flex gap-2 items-center border-t border-slate-200 pt-2">
                                {item.type === 'clothing' && (
                                    <>
                                        <input type="text" value={item.brand || ''} onChange={e => { const ni = [...items]; ni[idx].brand = e.target.value; setItems(ni); }} placeholder="Brand (e.g. Designer)" className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-purple-500" />
                                        <input type="text" value={item.oftype || ''} onChange={e => { const ni = [...items]; ni[idx].oftype = e.target.value; setItems(ni); }} placeholder="Type no." className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-purple-500" />
                                    </>
                                )}
                                {item.type === 'item' && (
                                    <input type="text" value={item.oftype || ''} onChange={e => { const ni = [...items]; ni[idx].oftype = e.target.value; setItems(ni); }} placeholder="Type no." className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none focus:border-sky-500" />
                                )}
                                
                                {action !== 'Trading' && <input type="text" value={item.price || ''} onChange={e => { const ni = [...items]; ni[idx].price = e.target.value; setItems(ni); }} placeholder={item.type === 'item' ? "Price each" : "Price"} className="w-24 bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-xs font-mono outline-none focus:border-sky-500" />}
                                
                                <div className="flex gap-1 ml-auto">
                                    <button title="Toggle A/An prefix" onClick={() => { const ni = [...items]; ni[idx].addA = !ni[idx].addA; if(ni[idx].addA) ni[idx].addS = false; setItems(ni); }} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${item.addA ? 'bg-red-500 text-white shadow-red-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>A</button>
                                    <button title="Toggle Plural (S)" onClick={() => { const ni = [...items]; ni[idx].addS = !ni[idx].addS; (ni[idx] as any).userOffS = !ni[idx].addS; if(ni[idx].addS) ni[idx].addA = false; setItems(ni); }} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${item.addS ? 'bg-red-500 text-white shadow-red-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>+S</button>
                                    {item.type === 'item' && (
                                        <button title="Toggle Price Each" onClick={() => { const ni = [...items]; ni[idx].addEach = !ni[idx].addEach; (ni[idx] as any).userOffEach = !ni[idx].addEach; setItems(ni); }} className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${item.addEach ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>EACH</button>
                                    )}
                                    <button title="Disable merge with other items" onClick={() => { const ni = [...items]; ni[idx].noMerge = !ni[idx].noMerge; setItems(ni); }} className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition-all ${item.noMerge ? 'bg-rose-500 text-white shadow-rose-200' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>{item.noMerge ? '⊘' : '⊕'}</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <CopyBox text={generatedAd} tabName="ITEMS/CLOTHING" />
        </div>
    );
}
// ------------- HOUSE -------------
function HouseForm() {
    const [action, setAction] = useState('Selling');
    const [propType, setPropType] = useState('house');
    const [numProp, setNumProp] = useState('1'); 
    const [number1, setNumber1] = useState('');
    const [number2, setNumber2] = useState('');
    const [garages, setGarages] = useState('None');
    const [warehouses, setWarehouses] = useState('None');
    
    // Policy order for extras: interior, insurance, then rest
    const [interior, setInterior] = useState(false);
    const [insurance, setInsurance] = useState(false);
    const [garden, setGarden] = useState(false);
    const [extras, setExtras] = useState({helipad: false, pool: false, tennis: false, driveway: false});
    const [view, setView] = useState('None');
    const [location, setLocation] = useState('');
    const [locType, setLocType] = useState<'in' | 'near'>('in');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('per week');

    const generatedAd = useMemo(() => {
        let propStr = '';
        const plural = numProp === '2';
        let pName = propType;
        if(plural) pName = propType === 'house' ? 'houses' : (propType==='apartment' ? 'apartments' : (propType==='mansion'?'mansions':'Casino penthouses'));

        if(number1 || number2) {
             let nums = [];
             if(number1) nums.push(`№${number1}`);
             if(number2) nums.push(`№${number2}`);
             propStr = `${pName} ${nums.join(' and ')}`;
        } else {
             propStr = `${plural ? '2 '+pName : (propType==='apartment'?'an':'a')+' '+pName}`;
        }

        let feats = [];
        if(garden) feats.push(plural ? 'gardens' : 'a garden');
        if(garages !== 'None') feats.push(`${garages} g.s.`);
        if(warehouses !== 'None') feats.push(`${warehouses} w.h.`);
        if(interior) feats.push('custom interior');
        if(insurance) feats.push('insurance');
        
        if(extras.helipad) feats.push(plural ? 'helipads' : 'helipad');
        if(extras.tennis) feats.push(plural ? 'tennis courts' : 'tennis court');
        if(extras.driveway) feats.push(plural ? 'long driveways' : 'long driveway');
        if(extras.pool) feats.push(plural ? 'swimming pools' : 'swimming pool');
        
        if(view !== 'None') feats.push(`${view} view`);

        let featsStr = '';
        if(feats.length === 1) featsStr = ` with ${feats[0]}`;
        else if(feats.length > 1) {
            const last = feats.pop();
            featsStr = ` with ${feats.join(', ')} and ${last}`;
        }
        
        const locStr = location.trim() ? ` ${locType} ${location.trim()}` : '';
        const formattedPrice = formatPrice(price, 'House Ads', propType, action);
        
        let baseStr = `${action} ${propStr}${featsStr}${locStr}`;
        let priceStr = '';
        if (formattedPrice) {
            let label = action === 'Buying' || action === 'Looking to rent' ? 'Budget' : (action === 'Renting out' ? 'Rent' : 'Price');
            // Only append duration when there's an actual price (not Negotiable)
            let durStr = (action.toLowerCase().includes('rent') && !formattedPrice.includes('Negotiable')) ? ` ${duration}` : '';
            let val = `${formattedPrice}${durStr}`;
            priceStr = `. ${label}: ${val}${getDot(val)}`;
            
            if (baseStr.endsWith('.')) {
                priceStr = ` ${priceStr.substring(2)}`;
            }
        }
        
        return baseStr + priceStr;
    }, [action, propType, numProp, number1, number2, garages, warehouses, interior, insurance, garden, extras, view, location, locType, price, duration]);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
           <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-400">
                {['Selling', 'Buying', 'Renting out', 'Looking to rent'].map(t => <button key={t} onClick={() => setAction(t)} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${action === t ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:bg-slate-200'}`}>{t}</button>)}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Property Type</label>
                  <select value={propType} onChange={e=>setPropType(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none">
                      <option value="house">House</option>
                      <option value="apartment">Apartment</option>
                      <option value="mansion">Mansion</option>
                      <option value="Casino penthouse">Casino Penthouse</option>
                  </select>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Prop. Numbers (Optional)</label>
                  <div className="flex gap-2">
                       <button onClick={() => setNumProp(numProp === '2' ? '1' : '2')} className={`px-3 rounded border font-bold text-[10px] transition-all uppercase tracking-tighter ${numProp === '2' ? 'bg-sky-500 text-white border-sky-600 shadow-sm' : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'}`}>2</button>
                       <input type="text" value={number1} onChange={e=> { setNumber1(e.target.value); if(e.target.value && number2) setNumProp('2'); else if(!e.target.value && !number2 && numProp !== '2') setNumProp('1'); }} placeholder="No. 1" className="flex-1 bg-slate-100 border border-slate-400 p-2 rounded text-sm text-slate-900 outline-none" />
                       <input type="text" value={number2} onChange={e=> { setNumber2(e.target.value); if(e.target.value) setNumProp('2'); else if(!number1 && numProp !== '2') setNumProp('1'); }} placeholder="No. 2" className="flex-1 bg-slate-100 border border-slate-400 p-2 rounded text-sm text-slate-900 outline-none" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Garage Spaces (g.s.)</label>
                  <select value={garages} onChange={e=>setGarages(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none">
                      {['None', '2', '5', '9', '25', '30'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                 </div>
                 <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Warehouse Spaces (w.h.)</label>
                  <select value={warehouses} onChange={e=>setWarehouses(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none">
                      {['None', '3', '4', '5'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                 </div>
            </div>

            <div>
                <label className="text-xs font-semibold text-slate-700 uppercase block mb-2">Amenities</label>
                <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={interior} onChange={e=>setInterior(e.target.checked)}/> Interior</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={insurance} onChange={e=>setInsurance(e.target.checked)}/> Insurance</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={garden} onChange={e=>setGarden(e.target.checked)}/> Garden</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={extras.helipad} onChange={e=>setExtras({...extras,helipad:e.target.checked})}/> Helipad</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={extras.pool} onChange={e=>setExtras({...extras,pool:e.target.checked})}/> Pool</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={extras.tennis} onChange={e=>setExtras({...extras,tennis:e.target.checked})}/> Tennis</label>
                    <label className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-400"><input type="checkbox" checked={extras.driveway} onChange={e=>setExtras({...extras,driveway:e.target.checked})}/> Driveway</label>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="relative flex gap-1">
                    <button 
                        onClick={() => setLocType(locType === 'in' ? 'near' : 'in')}
                        className={`px-3 rounded border font-bold text-[10px] transition-all uppercase tracking-tighter ${locType === 'near' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'}`}
                        title="Toggle: Location 'in' or 'near'"
                    >
                        {locType}
                    </button>
                    <div className="flex-1">
                        <Autocomplete options={GLOBAL_LOCATIONS} value={location} onChange={val => setLocation(val)} placeholder="Location (e.g. Vinewood Hills)" />
                    </div>
                </div>
                <select value={view} onChange={e=>setView(e.target.value)} className="bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none text-sm w-full h-full">
                    {['None', 'nice', 'beautiful', 'great', 'good'].map(v => <option key={v} value={v}>{v === 'None'?'No view': v + ' view'}</option>)}
                </select>
            </div>

             <div>
                 <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">
                     {action.includes('Buying') || action.includes('Looking to rent') ? 'Budget' : (action.includes('Renting out') ? 'Rent' : 'Price')} (k/m supported)
                 </label>
                 <div className="flex gap-4">
                     <input type="text" value={price} onChange={e=>setPrice(e.target.value)} placeholder={action.includes('Buying') ? 'e.g. 5m' : 'e.g. 15m'} className="flex-1 bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none font-mono" />
                     {action.toLowerCase().includes('rent') && (
                         <select value={duration} onChange={e=>setDuration(e.target.value)} className="w-[120px] bg-slate-100 border border-slate-400 p-2 rounded text-slate-900 outline-none text-sm">
                             <option value="per week">per week</option>
                             <option value="per day">per day</option>
                         </select>
                     )}
                 </div>
            </div>

            <CopyBox text={generatedAd} tabName="REAL ESTATE" />
        </div>
    );
}

// ------------- BUSINESS -------------
function BusinessForm() {
    const [action, setAction] = useState('Selling');
    const [bType, setBType] = useState('private business');
    const [num, setNum] = useState('');
    const [loc, setLoc] = useState('');
    const [locType, setLocType] = useState<'in' | 'near'>('in');
    const [price, setPrice] = useState('');
    
    // Plantation specific
    const [beds, setBeds] = useState('None');
    const [fruit, setFruit] = useState('None');

    const generatedAd = useMemo(() => {
        let typeStr = bType;
        if(bType === 'Burger Shop' && action === 'Selling') typeStr = 'Burger Shop';
        
        let bStr = num.trim() ? `${typeStr} №${num}` : `${typeStr} business`;
        if (bType === 'private business') bStr = 'a private business';
        if (bType === 'family business') bStr = 'a family business';
        if (bType === 'Plantation') {
            const bedStr = beds === 'None' ? '' : `${beds} `;
            const fruitStr = fruit === 'None' ? '' : `${fruit} `;
            bStr = `${bedStr}${fruitStr}Plantation business`;
        }
        
        const lStr = loc.trim() ? ` ${locType} ${loc.trim()}` : '';
        const fP = formatPrice(price, 'Business Ads', '');
        const pStr = fP ? `. ${action === 'Buying' ? 'Budget' : 'Price'}: ${fP}${getDot(fP)}` : '';
        return `${action} ${bStr}${lStr}${pStr}`;
    }, [action, bType, num, loc, locType, price, beds, fruit]);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
           <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-400 w-64">
                {['Selling', 'Buying'].map(t => <button key={t} onClick={() => setAction(t)} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${action === t ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:bg-slate-200'}`}>{t}</button>)}
            </div>
            
            <select value={bType} onChange={e=>setBType(e.target.value)} className="bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none">
                <option value="private business">Generic (Private Business)</option>
                <option value="family business">Family Business</option>
                <option value="Plantation">Plantation</option>
                <option value="24/7 Store">24/7 Store</option>
                <option value="Ammunition Store">Ammunition Store</option>
                <option value="ATM">ATM</option>
                <option value="Bar">Bar</option>
                <option value="Burger Shop">Burger Shop</option>
                <option value="Car Sharing">Car Sharing</option>
                <option value="Car Wash">Car Wash</option>
                <option value="Chip Tuning">Chip Tuning</option>
                <option value="Clothing Shop">Clothing Shop</option>
                <option value="Cowshed">Cowshed</option>
                <option value="Electric Charging Station">Electric Charging Station</option>
                <option value="Farm">Farm</option>
                <option value="Fight Club Bar">Fight Club Bar</option>
                <option value="Freight Train">Freight Train</option>
                <option value="Furniture Store">Furniture Store</option>
                <option value="Gas Station">Gas Station</option>
                <option value="Grand Elite Clothing Shop">Grand Elite Clothing Shop</option>
                <option value="Hair Salon">Hair Salon</option>
                <option value="Jewellery Store">Jewellery Store</option>
                <option value="Juice Shop">Juice Shop</option>
                <option value="Oil Well">Oil Well</option>
                <option value="Parking">Parking</option>
                <option value="Pet Shop">Pet Shop</option>
                <option value="Service Station">Service Station</option>
                <option value="State Object">State Object</option>
                <option value="Tattoo Studio">Tattoo Studio</option>
                <option value="Taxi Company">Taxi Company</option>
                <option value="Warehouse">Warehouse</option>
            </select>

            {bType === 'Plantation' && (
                <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-1 duration-200">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Property Category</label>
                        <select value={beds} onChange={e=>setBeds(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none">
                            <option value="None">None</option>
                            <option value="10-Bed">10-Bed</option>
                            <option value="15-Bed">15-Bed</option>
                            <option value="20-Bed">20-Bed</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Seed / Fruit Type</label>
                        <select value={fruit} onChange={e=>setFruit(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none">
                            <option value="None">None</option>
                            <option value="Cabbage">Cabbage</option>
                            <option value="Pineapple">Pineapple</option>
                            <option value="Pumpkin">Pumpkin</option>
                            <option value="Mandarin">Mandarin</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <input type="text" value={num} onChange={e=>setNum(e.target.value)} placeholder="Bus. Number (e.g. 27)" className="bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none" />
                <div className="relative flex gap-1 h-[46px]">
                    <button 
                        onClick={() => setLocType(locType === 'in' ? 'near' : 'in')}
                        className={`px-3 rounded border font-bold text-[10px] transition-all uppercase tracking-tighter ${locType === 'near' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-slate-200 text-slate-600 border-slate-300 hover:bg-slate-300'}`}
                        title="Toggle: Location 'in' or 'near'"
                    >
                        {locType}
                    </button>
                    <div className="flex-1">
                        <Autocomplete options={GLOBAL_LOCATIONS} value={loc} onChange={val => setLoc(val)} placeholder="Location (e.g. Sandy Shores)" />
                    </div>
                </div>
            </div>

            <div>
                 <label className="text-sm font-semibold text-slate-700 uppercase block mb-2">{action === 'Buying' ? 'Budget' : 'Price'} (k/m supported)</label>
                 <input type="text" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 10m" className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none font-mono" />
            </div>
            <CopyBox text={generatedAd} tabName="BUSINESS" />
        </div>
    );
}

// ------------- WORK -------------
function WorkForm() {
    const [action, setAction] = useState('Hiring');
    const [job, setJob] = useState('driver');
    const [addA, setAddA] = useState(false);
    const [exp, setExp] = useState('');
    const [site, setSite] = useState('');
    const [loc, setLoc] = useState('');
    const [salary, setSalary] = useState('');
    const [rate, setRate] = useState('None');

    const generatedAd = useMemo(() => {
        let j = job.trim();
        let jLow = j.toLowerCase();
        let aStr = addA ? 'a ' : '';
        let prefix = '';

        let xStr = exp.trim() ? ` with ${exp} years of experience` : '';
        let sStr = site.trim() ? ` at ${site}` : '';
        let lStr = loc.trim() ? ` in ${loc}` : '';

        if (action === 'Hiring') {
            prefix = `Hiring ${aStr}${j}`;
            if (jLow.startsWith('site')) {
                const map: any = {
                    'site1': 'construction site №1, on Vespucci Boulevard',
                    'site2': 'construction site №2, on Calais Avenue',
                    'site3': 'construction site №3, in Pillbox Hill',
                    'site4': 'construction site №4, in Mirror Park'
                };
                prefix = `Hiring workers at ${map[jLow] || 'the construction site'}`;
            } else if (jLow.includes('solar panel') || jLow.includes('plantation')) {
                prefix = `Hiring workers for solar panel plantation`;
            }
        } else {
            if (jLow.startsWith('site')) {
                prefix = `Looking for a job at the construction site`;
            } else if (jLow.includes('solar panel') || jLow.includes('plantation')) {
                prefix = `Looking for a job to plant a solar panel`;
            } else {
                let defaultA = aStr ? aStr : (jLow.match(/^[aeiou]/) ? 'an ' : 'a ');
                prefix = `Looking for work as ${defaultA}${j}`;
            }
        }

        if (jLow.startsWith('site') || jLow.includes('solar panel') || jLow.includes('plantation')) {
            xStr = ''; sStr = ''; lStr = ''; // Overrides external modifiers
        }
        
        const fP = formatPrice(salary, 'Work Ads', '');
        let pStr = '';
        if(fP) {
             const rt = rate === 'None' ? '' : ` ${rate}`; let val = `${fP}${rt}`; pStr = `. Salary: ${val}${getDot(val)}`;
        }
        return `${prefix}${xStr}${sStr}${lStr}${pStr}`;
    }, [action, job, addA, exp, site, loc, salary, rate]);

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
           <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-400">
                {['Hiring', 'Looking for a job'].map(t => <button key={t} onClick={() => setAction(t)} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${action === t ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:bg-slate-200'}`}>{t}</button>)}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                 <div className="flex justify-between items-center mb-1">
                     <label className="text-xs font-semibold text-slate-700 uppercase">Job Type / Role</label>
                     <label className="text-[10px] uppercase font-bold text-sky-600 flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={addA} onChange={e=>setAddA(e.target.checked)}/> +A</label>
                 </div>
                 <input list="work-roles" value={job} onChange={e=>setJob(e.target.value)} placeholder="e.g. professional dancers" className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none" />
                 <datalist id="work-roles">
                     <option value="site1">construction site №1</option>
                     <option value="site2">construction site №2</option>
                     <option value="site3">construction site №3</option>
                     <option value="site4">construction site №4</option>
                     <option value="driver">driver</option>
                     <option value="locksmith">locksmith</option>
                     <option value="electrician">electrician</option>
                     <option value="land worker">land worker</option>
                     <option value="surveyor">surveyor</option>
                     <option value="trucker">trucker</option>
                     <option value="lawyer">lawyer</option>
                     <option value="DJ">DJ</option>
                     <option value="photographer/cameraman">photographer/cameraman</option>
                     <option value="bodyguard">bodyguard</option>
                     <option value="professional dancer">professional dancer</option>
                     <option value="oil man">oil man</option>
                     <option value="gardener">gardener</option>
                     <option value="pilot">pilot</option>
                     <option value="collector">collector</option>
                     <option value="workers for collector job">workers for collector job</option>
                     <option value="workers for solar panel plantation">workers for solar panel plantation</option>
                     <option value="firefighter">firefighter</option>
                     <option value="personal assistant">personal assistant</option>
                     <option value="singer">singer</option>
                 </datalist>
               </div>
               <div>
                  <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Years of Exp (Level)</label>
                  <input type="text" value={exp} onChange={e=>setExp(e.target.value)} placeholder="e.g. 3" className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <input type="text" value={site} onChange={e=>setSite(e.target.value)} placeholder="Site (e.g. construction site №1)" className="bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none" />
                <input type="text" value={loc} onChange={e=>setLoc(e.target.value)} placeholder="Location (e.g. Vespucci Boulevard)" className="bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="flex-1">
                   <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Salary (k/m supported)</label>
                   <input type="text" value={salary} onChange={e=>setSalary(e.target.value)} placeholder="e.g. 50k" className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 font-mono outline-none" />
               </div>
               <div className="flex-1">
                   <label className="text-xs font-semibold text-slate-700 uppercase block mb-1">Rate</label>
                   <select value={rate} onChange={e=>setRate(e.target.value)} className="w-full bg-slate-100 border border-slate-400 p-3 rounded text-slate-900 outline-none">
                        <option value="None">Flat Rate (None)</option>
                        <option value="per hour">per hour</option>
                        <option value="per day">per day</option>
                   </select>
               </div>
            </div>
            <CopyBox text={generatedAd} tabName="WORK" />
        </div>
    );
}

// ------------- DATING -------------
function DatingForm({ options }: { options: string[] }) {
    const templates = [
        "Looking for a family.",
        "Looking for family members.",
        "Looking for family friends.",
        "Looking for friends.",
        "Looking for a friend.",
        "Looking for a wife.",
        "Looking for a husband.",
        "Looking for a girlfriend.",
        "Looking for a boyfriend.",
        "Looking for a date."
    ];
    const [search, setSearch] = useState('');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const filtered = templates.filter(t => t.toLowerCase().includes(search.toLowerCase()));

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dating templates..." className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {filtered.map((t, i) => (
                    <button key={i} onClick={() => handleCopy(t, i)} className={`text-left p-3 rounded-lg border transition-all text-sm ${copiedIdx === i ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-slate-300 hover:border-sky-400 hover:bg-sky-50 text-slate-800'}`}>
                        {copiedIdx === i ? '✓ Copied!' : t}
                    </button>
                ))}
                {filtered.length === 0 && <p className="text-slate-500 text-center py-6 font-mono text-sm">No templates found.</p>}
            </div>
        </div>
    );
}

// ------------- OTHERS -------------
function OthersForm({ allItemOptions }: { allItemOptions: string[] }) {
    const [category, setCategory] = useState('Racing');
    const [bet, setBet] = useState('');
    const [partyType, setPartyType] = useState('house');
    const [houseNum, setHouseNum] = useState('');
    const [location, setLocation] = useState('');
    // Beach Market Shop
    const [shopNum, setShopNum] = useState('');
    const [shopItem, setShopItem] = useState('a variety of items');
    const [shopGoodPrice, setShopGoodPrice] = useState(true);
    // License Plate
    const [plateNum, setPlateNum] = useState('');
    const [plateSpecial, setPlateSpecial] = useState(false);
    const [platePrice, setPlatePrice] = useState('');
    // Sim Cards
    const [sim1, setSim1] = useState('');
    const [sim2, setSim2] = useState('');
    const [simPrice, setSimPrice] = useState('');
    // Private Market Stall
    const [stallItem, setStallItem] = useState('a variety of items');
    const [stallGoodPrice, setStallGoodPrice] = useState(false);
    const [stallLocType, setStallLocType] = useState('location');
    const [stallLocation, setStallLocation] = useState('');
    const [stallHouseNum, setStallHouseNum] = useState('');

    const generatedAd = useMemo(() => {
        if (category === 'Racing') {
            const fP = formatPrice(bet, 'Others', '');
            const pStr = fP ? `. Bet: ${fP}${getDot(fP)}` : '';
            return `Looking to race${pStr}`;
        }
        if (category === 'Fight Club') {
            return `Looking for an opponent for Fight Club.`;
        }
        if (category === 'Arm Wrestle') {
            return `Looking to arm wrestle.`;
        }
        if (category === 'Poker') {
            const fP = formatPrice(bet, 'Others', '');
            const pStr = fP ? `. Bet: ${fP}${getDot(fP)}` : '. Bet: Negotiable.';
            return `Looking to play poker${pStr}`;
        }
        if (category === 'Party') {
            if (partyType === 'house') {
                return `Party at house №${houseNum || '???'}.`;
            } else {
                const loc = location.trim() || 'the beach';
                const needsThe = ['beach', 'pier', 'park', 'casino', 'airport', 'hospital', 'church', 'mall', 'harbor', 'docks', 'marina', 'club', 'bar', 'gym', 'studio', 'gallery', 'arena', 'stadium', 'market', 'boardwalk', 'rooftop', 'yacht club', 'country club'];
                const addThe = needsThe.some(w => loc.toLowerCase() === w) && !loc.toLowerCase().startsWith('the ');
                return `Party at ${addThe ? 'the ' : ''}${loc}.`;
            }
        }
        if (category === 'Beach Market') {
            const num = shopNum || '???';
            const priceStr = shopGoodPrice ? ' for good prices' : '';
            return `Selling ${shopItem}${priceStr} at beach market shop №${num}.`;
        }
        if (category === 'License Plate') {
            if (plateSpecial) {
                const fP = formatPrice(platePrice, 'Others', '');
                return `Selling a special license plate. Price: ${fP}${getDot(fP)}`;
            }
            const plateDisplay = plateNum.trim() ? `(${plateNum.trim()})` : '(???)';
            const fP = formatPrice(platePrice, 'Others', '');
            return `Selling license plate ${plateDisplay}. Price: ${fP}${getDot(fP)}`;
        }
        if (category === 'Sim Cards') {
            const s1 = sim1.trim();
            const s2 = sim2.trim();
            const fP = formatPrice(simPrice, 'Others', '');
            if (s1 && s2) {
                return `Selling sim-cards with numbers ${s1} and ${s2}. Price: ${fP}${getDot(fP)}`;
            }
            if (s1) {
                return `Selling a sim-card with number ${s1}. Price: ${fP}${getDot(fP)}`;
            }
            return `Selling a sim-card with number ??-??-???. Price: ${fP}${getDot(fP)}`;
        }
        if (category === 'Private Stall') {
            const priceStr = stallGoodPrice ? ' for good prices' : '';
            let locStr = '';
            if (stallLocType === 'house') {
                locStr = ` next to house №${stallHouseNum || '???'}`;
            } else {
                locStr = stallLocation.trim() ? ` next to ${stallLocation.trim()}` : '';
            }
            return `Selling ${stallItem}${priceStr} at private market stall${locStr}.`;
        }
        return '';
    }, [category, bet, partyType, houseNum, location, shopNum, shopItem, shopGoodPrice, plateNum, plateSpecial, platePrice, sim1, sim2, simPrice, stallItem, stallGoodPrice, stallLocType, stallLocation, stallHouseNum]);

    const allCategories = ['Racing', 'Fight Club', 'Party', 'Arm Wrestle', 'Poker', 'Beach Market', 'License Plate', 'Sim Cards', 'Private Stall'];

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex flex-col gap-1 bg-slate-100 p-1 rounded-lg border border-slate-400">
                <div className="flex flex-wrap gap-1">
                    {allCategories.slice(0, 5).map(t => (
                        <button key={t} onClick={() => setCategory(t)} className={`flex-1 py-2 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider ${category === t ? 'bg-sky-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1">
                    {allCategories.slice(5).map(t => (
                        <button key={t} onClick={() => setCategory(t)} className={`flex-1 py-2 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider ${category === t ? 'bg-sky-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {(category === 'Racing' || category === 'Poker') && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Bet Amount (k/m supported)</label>
                    <input type="text" value={bet} onChange={e => setBet(e.target.value)} placeholder="e.g. 50k" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
                </div>
            )}

            {category === 'Party' && (
                <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex gap-2">
                        {['house', 'location'].map(t => (
                            <button key={t} onClick={() => setPartyType(t)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${partyType === t ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                at {t}
                            </button>
                        ))}
                    </div>
                    {partyType === 'house' ? (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">House Number</label>
                            <input type="text" value={houseNum} onChange={e => setHouseNum(e.target.value)} placeholder="e.g. 562" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-amber-500 font-mono" />
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Specific Location</label>
                            <Autocomplete options={GLOBAL_LOCATIONS} value={location} onChange={val => setLocation(val)} placeholder="e.g. the beach" />
                        </div>
                    )}
                </div>
            )}

            {category === 'Beach Market' && (
                <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Shop Number</label>
                        <input type="text" value={shopNum} onChange={e => setShopNum(e.target.value)} placeholder="e.g. 27" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">What is being sold</label>
                        <Autocomplete options={['a variety of items', ...allItemOptions]} value={shopItem} onChange={val => setShopItem(val)} placeholder="e.g. juices" />
                    </div>
                    <label className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={shopGoodPrice} onChange={e => setShopGoodPrice(e.target.checked)} className="accent-sky-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">For good prices</span>
                    </label>
                </div>
            )}

            {category === 'License Plate' && (
                <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <label className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={plateSpecial} onChange={e => setPlateSpecial(e.target.checked)} className="accent-red-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">Special plate (hide number)</span>
                    </label>
                    {!plateSpecial && (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Plate Number</label>
                            <input type="text" value={plateNum} onChange={e => setPlateNum(e.target.value)} placeholder="e.g. 1ABC234" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono tracking-widest" />
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Price (k/m supported)</label>
                        <input type="text" value={platePrice} onChange={e => setPlatePrice(e.target.value)} placeholder="e.g. 500k" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
                    </div>
                </div>
            )}

            {category === 'Sim Cards' && (
                <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Sim Card 1 (XX-XX-XXX)</label>
                        <input type="text" value={sim1} onChange={e => setSim1(e.target.value)} placeholder="e.g. 11-11-111" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono tracking-widest" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Sim Card 2 (optional)</label>
                        <input type="text" value={sim2} onChange={e => setSim2(e.target.value)} placeholder="e.g. 22-22-222" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono tracking-widest" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Price (k/m supported)</label>
                        <input type="text" value={simPrice} onChange={e => setSimPrice(e.target.value)} placeholder="e.g. negotiable" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
                    </div>
                </div>
            )}

            {category === 'Private Stall' && (
                <div className="flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
                    <div>
                        <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">What is being sold</label>
                        <Autocomplete options={['a variety of items', ...allItemOptions]} value={stallItem} onChange={val => setStallItem(val)} placeholder="e.g. juices" />
                    </div>
                    <label className="flex items-center gap-2 bg-white border border-slate-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input type="checkbox" checked={stallGoodPrice} onChange={e => setStallGoodPrice(e.target.checked)} className="accent-sky-500" />
                        <span className="text-xs font-bold text-slate-600 uppercase">For good prices</span>
                    </label>
                    <div className="flex gap-2">
                        {['location', 'house'].map(t => (
                            <button key={t} onClick={() => setStallLocType(t)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${stallLocType === t ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                                next to {t}
                            </button>
                        ))}
                    </div>
                    {stallLocType === 'house' ? (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">House Number</label>
                            <input type="text" value={stallHouseNum} onChange={e => setStallHouseNum(e.target.value)} placeholder="e.g. 1332" className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-amber-500 font-mono" />
                        </div>
                    ) : (
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase mb-1.5 block">Location</label>
                            <Autocomplete options={GLOBAL_LOCATIONS} value={stallLocation} onChange={val => setStallLocation(val)} placeholder="e.g. Paleto Bay Parking" />
                        </div>
                    )}
                </div>
            )}

            <CopyBox text={generatedAd} tabName="OTHERS" />
        </div>
    );
}

// ------------- TEMPLATES -------------
function TemplatesForm({ templates }: { templates: any[] }) {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    const filtered = useMemo(() => {
        let results = templates;
        if (categoryFilter !== 'All') {
             results = results.filter(t => t.adCategory === categoryFilter);
        }
        
        if (search.trim()) {
            const norm = (s: string) => s.toLowerCase().replace(/№/g, ' ').replace(/no\.?\s*(?=\d)/g, ' ').replace(/[\s]+/g, ' ').trim();
            const tokens = norm(search).split(' ').filter(Boolean);
            results = results.filter(t => {
                const haystack = norm(t.name) + ' ' + norm(t.content) + ' ' + norm(t.key);
                return tokens.every(token => haystack.includes(token));
            });
        }
        // Show up to 100 items for performance
        return results.slice(0, 100);
    }, [search, categoryFilter]);

    const handleCopy = (e: React.MouseEvent, text: string, idx: number) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 2000);
    };

    const uniqueCategories = useMemo(() => {
        const cats = new Set(templates.map(t => t.adCategory));
        return Array.from(cats).sort();
    }, [templates]);

    return (
        <div className="flex flex-col gap-5 animate-in fade-in duration-300">
             <div className="flex flex-col gap-3">
                 <div className="flex flex-col md:flex-row gap-4 w-full">
                     <input 
                         type="text" 
                         value={search} 
                         onChange={e => setSearch(e.target.value)} 
                         placeholder="Search by number, name, or content (e.g. ATM 202, Family)..." 
                         className="flex-1 bg-slate-100 border border-slate-400 rounded-xl p-4 text-slate-900 font-mono focus:outline-none focus:border-sky-500 shadow-lg text-lg placeholder:text-slate-400"
                     />
                     <div className="relative shrink-0">
                         <select 
                             value={categoryFilter} 
                             onChange={e => setCategoryFilter(e.target.value)}
                             className="w-full md:w-auto appearance-none bg-slate-100 border border-slate-400 rounded-xl p-4 pr-10 text-sky-400 font-mono focus:outline-none focus:border-sky-500 shadow-lg text-lg outline-none cursor-pointer"
                         >
                             <option value="All">All Categories</option>
                             {uniqueCategories.map(cat => (
                                 <option key={cat} value={cat}>{cat}</option>
                             ))}
                         </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-sky-500">
                             <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                         </div>
                     </div>
                 </div>
                 <span className="text-xs text-slate-600 tracking-wide uppercase px-2 font-bold select-none">Showing {filtered.length} results limit 100</span>
             </div>
             
             <div className="block space-y-3 mt-2 h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar pr-2 pb-4">
                 {filtered.map((tmpl, idx) => {
                      const now = new Date();
                      now.setHours(0,0,0,0);
                      const todayTime = now.getTime();
                      const isExpiringToday = tmpl.expires !== null && tmpl.expires === todayTime;
                      const isExpired = tmpl.expires !== null && tmpl.expires < todayTime;

                      return (
                      <div key={idx} className="flex flex-col bg-slate-50/60 border border-slate-400 rounded-xl overflow-hidden shadow-md group transition-all duration-300">
                           <div onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)} className={`flex justify-between items-center p-4 cursor-pointer hover:bg-slate-200/80 transition-colors ${expandedIdx === idx ? 'bg-slate-200/50 border-b border-slate-300/80' : ''}`}>
                               <div className="flex items-center gap-3">
                                   <div className={`transform transition-transform duration-300 text-slate-600 group-hover:text-sky-500 ${expandedIdx === idx ? 'rotate-180' : ''}`}>
                                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                   </div>
                                   <h3 className={`font-bold text-sm tracking-wide leading-snug transition-colors ${expandedIdx === idx ? 'text-sky-400' : 'text-slate-700 group-hover:text-sky-400'}`}>{tmpl.name}</h3>
                               </div>
                               <div className="flex flex-wrap justify-end gap-2 shrink-0">
                                   {(isExpired || isExpiringToday) && (
                                       <span className={`text-[10px] px-2 py-1 rounded border uppercase tracking-widest shadow-sm whitespace-nowrap ${isExpired ? 'bg-red-900/80 text-red-100 border-red-500/50' : 'bg-orange-600/80 text-orange-100 border-orange-400/50'}`}>
                                           {isExpired ? 'EXPIRED' : 'EXPIRING TODAY'} ({tmpl.expireStr})
                                       </span>
                                   )}
                                   {tmpl.type && (
                                       <span className={`text-[10px] px-2 py-1 rounded border uppercase tracking-widest shadow-sm whitespace-nowrap ${
                                           tmpl.type.toLowerCase().includes('service') ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 
                                           tmpl.type.toLowerCase().includes('discount') ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                                           'bg-slate-200 text-slate-700 border-slate-400'
                                       }`}>{tmpl.type}</span>
                                   )}
                                   <span className={`text-[10px] px-2 py-1 rounded border uppercase tracking-widest shadow-sm whitespace-nowrap ${
                                        tmpl.adCategory.toLowerCase().includes('work') ? 'bg-zinc-500/30 text-zinc-300 border-zinc-400/50' : 
                                        tmpl.adCategory.toLowerCase().includes('others') ? 'bg-zinc-800/50 text-zinc-300 border-zinc-500' : 
                                        'bg-sky-900/30 text-sky-300 border-sky-800/50'
                                    }`}>{tmpl.adCategory}</span>
                               </div>
                           </div>
                           
                           <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedIdx === idx ? 'max-h-96 opacity-100 p-5 bg-white shadow-sm' : 'max-h-0 opacity-0 px-5 pt-0 pb-0'}`}>
                               <p className="text-slate-700 text-[15px] leading-relaxed mb-6 font-medium break-words whitespace-pre-wrap">"{tmpl.content}"</p>
                               <div className="flex justify-end border-t border-slate-400 pt-4">
                                   <button onClick={(e) => handleCopy(e, tmpl.content, idx)} className={`px-5 py-2 rounded text-xs font-bold font-mono transition-all ${copiedIdx === idx ? 'bg-sky-500 text-zinc-900 shadow-[0_0_15px_rgba(34,197,94,0.5)] scale-105' : 'bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-zinc-900 shadow-sm border border-sky-500/30 hover:border-sky-500'}`}>
                                       {copiedIdx === idx ? 'COPIED TO CLIPBOARD!' : 'COPY TEMPLATE'}
                                   </button>
                               </div>
                           </div>
                      </div>
                      );
                 })}
                 {filtered.length === 0 && (
                     <div className="col-span-full text-center p-12 text-slate-600 font-mono bg-white shadow-sm rounded-xl border border-dashed border-slate-400">
                         No templates found matching your search.
                     </div>
                 )}
             </div>
        </div>
    );
}

// ------------- MANAGER -------------
function ManagerForm({ data: managerSourceData }: { data: any }) {
    // Extreme safety: normalize input to a Record of arrays
    const isLegacyArray = Array.isArray(managerSourceData);
    const isObject = managerSourceData !== null && typeof managerSourceData === 'object' && !isLegacyArray;
    const normalizedManagerData: Record<string, any[]> = {};
    
    if (isLegacyArray) {
        normalizedManagerData["Available Services"] = managerSourceData;
    } else if (isObject) {
        Object.keys(managerSourceData).forEach(key => {
            const val = managerSourceData[key];
            if (Array.isArray(val)) normalizedManagerData[key] = val;
        });
    }

    const formatCategory = (name: string) => {
        if (!name) return '';
        if (name.toLowerCase() === 'businessoffices') return 'Business/Offices';
        return name.replace(/([A-Z])/g, ' $1').trim();
    };

    const managerCategories = Object.keys(normalizedManagerData);
    const [managerActiveCategory, setManagerActiveCategory] = useState<string>(managerCategories[0] || '');
    const [managerCart, setManagerCart] = useState<{ name: string, price: string, qty: number, category: string }[]>([]);
    const [managerBankAcc, setManagerBankAcc] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('manager_bank_account') : null) || '');
    const [freeCnnSlots, setFreeCnnSlots] = useState<number>(3);
    const [customerName, setCustomerName] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [employeeName, setEmployeeName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('manager_employee_name') : null) || '');
    const [managerSubTab, setManagerSubTab] = useState<'order' | 'invoice' | 'contract'>('order');
    const invoiceRef = useRef<HTMLDivElement>(null);
    const contractRef = useRef<HTMLDivElement>(null);

    const getCurrentDate = () => {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    useEffect(() => {
        localStorage.setItem('manager_bank_account', managerBankAcc);
        localStorage.setItem('manager_employee_name', employeeName);
    }, [managerBankAcc, employeeName]);

    useEffect(() => {
        if (!managerActiveCategory && managerCategories.length > 0) {
            setManagerActiveCategory(managerCategories[0]);
        }
    }, [managerCategories, managerActiveCategory]);

    const currentCategoryServices = Array.isArray(normalizedManagerData[managerActiveCategory]) ? normalizedManagerData[managerActiveCategory] : [];

    const addManagerService = (service: any, cat: string) => {
        setManagerCart(prev => {
            const existing = prev.find(s => s.name === service.name && s.category === cat);
            if (existing) {
                return prev.map(s => (s.name === service.name && s.category === cat) ? { ...s, qty: s.qty + 1 } : s);
            }
            return [...prev, { ...service, qty: 1, category: cat }];
        });
    };

    const removeManagerService = (name: string, cat: string) => {
        setManagerCart(prev => prev.filter(s => !(s.name === name && s.category === cat)));
    };

    const updateManagerQty = (name: string, cat: string, qty: number) => {
        if (qty < 1) return;
        setManagerCart(prev => prev.map(s => (s.name === name && s.category === cat) ? { ...s, qty } : s));
    };

    const getServiceSubtotal = (s: { name: string, price: string, qty: number, category: string }) => {
        const lowerName = (s.name || '').toLowerCase();
        const lowerCat = (s.category || '').toLowerCase();
        const isCnnShoutout = lowerName.includes('shoutout') && lowerName.includes('cnn') && (lowerName.includes('organisation') || lowerCat.includes('organisation'));
        
        if (isCnnShoutout) {
            if (s.qty <= freeCnnSlots) return 0;
            return (s.qty - freeCnnSlots) * 90000;
        }

        const basePrice = parseInt(s.price?.replace(/[^0-9]/g, '') || '0') || 0;
        return basePrice * s.qty;
    };

    const managerSubtotal = useMemo(() => {
        let sub = 0;
        if (Array.isArray(managerCart)) {
            managerCart.forEach(item => {
                sub += getServiceSubtotal(item);
            });
        }
        return sub;
    }, [managerCart, freeCnnSlots]);

    const managerTax = managerSubtotal * 0.03;
    const managerTotal = managerSubtotal + managerTax;

    const formatManagerPrice = (val: number) => {
        let str = Math.round(val).toString();
        let res = '';
        for (let i = str.length - 1, j = 0; i >= 0; i--, j++) {
            if (j > 0 && j % 3 === 0) res = '.' + res;
            res = str[i] + res;
        }
        return '$' + res;
    };

    const managerOutputAd = useMemo(() => {
        if (!Array.isArray(managerCart) || managerCart.length === 0) return '';
        const lines = managerCart.map(s => {
            const unitPrice = parseInt(s.price?.replace(/[^0-9]/g, '') || '0') || 0;
            return `- ${s.name}: ${formatManagerPrice(unitPrice)} x${s.qty}`;
        }).join('\n');
        return `Your Order:\n\n${lines}\n\n(Total with 3% Tax) = ${formatManagerPrice(managerTotal)}\n\nPlease make your payment to Bank Account **${managerBankAcc}** and post your payment proof here once completed.`;
    }, [managerCart, managerTotal, managerBankAcc]);

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center text-sky-600 text-xl shadow-inner shrink-0">💼</div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Manager Dashboard</h2>
                        <p className="text-[10px] font-mono text-slate-500">Service management & Tax calculation</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">CNN Free Slots</label>
                        <div className="relative">
                            <select 
                                value={3 - freeCnnSlots} 
                                onChange={e => setFreeCnnSlots(3 - Number(e.target.value))}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-all appearance-none cursor-pointer"
                            >
                                <option value={0}>0 Used (3 free)</option>
                                <option value={1}>1 Used (2 free)</option>
                                <option value={2}>2 Used (1 free)</option>
                                <option value={3}>3 Used (0 free)</option>
                            </select>
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs">▼</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Bank Account</label>
                        <div className="relative w-full">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-bold pointer-events-none">#</span>
                            <input 
                                type="text" 
                                value={managerBankAcc} 
                                onChange={e => setManagerBankAcc(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-sm font-bold text-white outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-all text-right"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Your Name</label>
                        <input 
                            type="text" 
                            value={employeeName} 
                            onChange={e => setEmployeeName(e.target.value)}
                            placeholder="Employee Name"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-600"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Client Name</label>
                        <input 
                            type="text" 
                            value={customerName} 
                            onChange={e => setCustomerName(e.target.value)}
                            placeholder="First Last Name"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-600"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Invoice #</label>
                        <input 
                            type="text" 
                            value={invoiceNumber} 
                            onChange={e => setInvoiceNumber(e.target.value)}
                            placeholder="XXXX"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-600 text-center"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Services */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Available Services</h3>
                    
                    {managerCategories.length > 0 && (
                        <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar">
                            {managerCategories.map(cat => (
                                <button 
                                    key={cat} 
                                    onClick={() => setManagerActiveCategory(cat)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm ${managerActiveCategory === cat ? 'bg-sky-500 text-white border-sky-600 shadow-sky-200' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-500'}`}
                                >
                                    {formatCategory(cat)}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {currentCategoryServices.map((service, i) => (
                            <button key={i} onClick={() => addManagerService(service, managerActiveCategory)} className="flex items-center justify-between p-4 bg-white border border-slate-300 rounded-2xl hover:border-sky-400 hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-bold text-slate-700 group-hover:text-sky-500 transition-colors">{service.name}</span>
                                    {(service.name || '').toLowerCase().includes('shoutout') && (service.name || '').toLowerCase().includes('cnn') && ((service.name || '').toLowerCase().includes('organisation') || (managerActiveCategory || '').toLowerCase().includes('organisation')) && (
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-50 px-1.5 py-0.5 rounded w-fit mt-1">First {freeCnnSlots} free, then 90k</span>
                                    )}
                                </div>
                                <span className="text-xs font-mono font-black bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl border border-slate-200 group-hover:bg-sky-50 group-hover:text-sky-600 group-hover:border-sky-200 transition-all">{service.price}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Cart */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Selected Services</h3>
                    <div className="flex flex-col gap-2 min-h-[150px] bg-slate-200/30 rounded-3xl border border-dashed border-slate-300 p-5">
                        {managerCart.map((s, i) => {
                            const itemSub = getServiceSubtotal(s);
                            return (
                                <div key={i} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-in zoom-in-95 duration-200 hover:shadow-md transition-shadow">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-xs font-bold text-slate-800 truncate">{s.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-slate-400">{s.price} each • <span className="text-sky-500 font-bold">{formatCategory(s.category)}</span></span>
                                            {itemSub === 0 && <span className="text-[9px] font-bold text-emerald-500 uppercase">FREE</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shadow-inner">
                                            <button onClick={() => updateManagerQty(s.name, s.category, s.qty - 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:text-sky-500 rounded-lg transition-all font-black">-</button>
                                            <span className="w-8 text-center text-xs font-black text-slate-800">{s.qty}</span>
                                            <button onClick={() => updateManagerQty(s.name, s.category, s.qty + 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:text-sky-500 rounded-lg transition-all font-black">+</button>
                                        </div>
                                        <button onClick={() => removeManagerService(s.name, s.category)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors hover:bg-red-50 rounded-lg">✕</button>
                                    </div>
                                </div>
                            );
                        })}
                        {managerCart.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 opacity-60">
                                <span className="text-5xl">🛍️</span>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Select services to begin</p>
                            </div>
                        )}
                    </div>
                    
                    {managerCart.length > 0 && (
                        <div className="mt-2 bg-[#0d0d12] border border-zinc-800/80 rounded-xl p-5 flex flex-col shadow-lg text-[13px] font-medium text-zinc-400">
                            <div className="flex justify-between items-center py-2">
                                <span>Subtotal</span>
                                <span>{formatManagerPrice(managerSubtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span>Tax (3%)</span>
                                <span>{formatManagerPrice(managerTax)}</span>
                            </div>
                            <div className="h-px bg-zinc-800/80 my-2 w-full"></div>
                            <div className="flex justify-between items-center py-2 text-white font-bold text-[15px]">
                                <span>Total with Tax</span>
                                <span>{formatManagerPrice(managerTotal)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-tabs: Order / Invoice / Contract */}
            <div className="flex flex-col gap-4">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
                    {(['order', 'invoice', 'contract'] as const).map(tab => (
                        <button key={tab} onClick={() => setManagerSubTab(tab)} className={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${managerSubTab === tab ? 'bg-white text-slate-800 shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}>
                            {tab === 'order' ? '📋 Order' : tab === 'invoice' ? '🧾 Invoice' : '📄 Contract'}
                        </button>
                    ))}
                </div>

                {/* ORDER TAB */}
                {managerSubTab === 'order' && <CopyBox text={managerOutputAd} tabName="Manager Order" />}

                {/* INVOICE TAB */}
                {managerSubTab === 'invoice' && managerCart.length > 0 && (
                    <div className="relative group no-print">
                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                            <button 
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/generate-pdf', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                type: 'invoice',
                                                customerName,
                                                employeeName,
                                                invoiceNumber,
                                                cart: managerCart.map(s => ({ name: s.name, qty: s.qty, price: s.price })),
                                                subtotal: managerSubtotal,
                                                tax: managerTax,
                                                total: managerTotal,
                                                date: getCurrentDate(),
                                            }),
                                        });
                                        if (!res.ok) throw new Error('PDF generation failed');
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = (customerName || 'Client') + ' Invoice.pdf';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    } catch (e) { alert('Failed to generate PDF: ' + (e as Error).message); }
                                }}
                                className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download PDF
                            </button>
                        </div>
                        <div style={{ background: '#e07070', padding: '40px', borderRadius: '12px' }}>
                        <div ref={invoiceRef} className="pdf-invoice-content print-area" style={{ background: '#ffffff', maxWidth: '700px', margin: '0 auto', fontFamily: 'Arial, sans-serif', color: '#000000', padding: '1px', position: 'relative' }}>
                            {/* PAID Stamp */}
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%) rotate(-30deg)',
                                border: '12px solid #ef4444',
                                color: '#ef4444',
                                fontSize: '100px',
                                fontWeight: 'black',
                                padding: '10px 40px',
                                opacity: '0.15',
                                borderRadius: '24px',
                                textTransform: 'uppercase',
                                pointerEvents: 'none',
                                zIndex: 5,
                                letterSpacing: '10px'
                            }}>PAID</div>

                            <style>{`
                                .pdf-invoice-content, .pdf-invoice-content * { color: #000000 !important; }
                                .pdf-invoice-content [data-red] { color: #c0392b !important; }
                            `}</style>
                            {/* Invoice Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '30px 30px 15px 30px' }}>
                                <div>
                                    <img src="/logo.png" alt="LifeInvader" style={{ height: '70px', objectFit: 'contain' }} />
                                </div>
                                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px', lineHeight: '1.7' }}>
                                    <div>LifeInvader</div>
                                    <div>Rockford Hills</div>
                                    <div>Los Santos</div>
                                    <div>USA</div>
                                </div>
                            </div>
                            {/* SERVICE INVOICE Title */}
                            <div style={{ padding: '0 30px' }}>
                                <hr data-red style={{ border: 'none', borderTop: '2px solid #c0392b', margin: '0' }} />
                                <h2 data-red style={{ color: '#c0392b', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', margin: '10px 0', letterSpacing: '3px' }}>SERVICE INVOICE</h2>
                                <hr data-red style={{ border: 'none', borderTop: '2px solid #c0392b', margin: '0' }} />
                            </div>
                            {/* Bill To */}
                            <div style={{ margin: '20px 30px', border: '1px solid #222', padding: '12px 15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline', marginBottom: '4px' }}>BILL TO:</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{customerName || 'Client Name'}</div>
                                        <div style={{ fontSize: '12px', marginTop: '2px' }}>Los Santos</div>
                                        <div style={{ fontSize: '12px' }}>USA</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>INVOICE {invoiceNumber || 'XXXX'}</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '4px' }}>{employeeName || 'Employee Name'}</div>
                                        <div style={{ fontSize: '12px' }}>{getCurrentDate()}</div>
                                    </div>
                                </div>
                            </div>
                            {/* Items Table */}
                            <div style={{ margin: '15px 30px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #222' }}>
                                            <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px' }}>DESCRIPTION</th>
                                            <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px' }}>QUANTITY</th>
                                            <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px' }}>PRICE</th>
                                            <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 'bold', textDecoration: 'underline', fontSize: '11px' }}>TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {managerCart.map((s, i) => {
                                            const unitPrice = parseInt(s.price?.replace(/[^0-9]/g, '') || '0') || 0;
                                            const lineTotal = unitPrice * s.qty;
                                            return (
                                                <tr key={i}>
                                                    <td style={{ padding: '6px 0', fontSize: '11px' }}>{s.name}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 0' }}>{s.qty}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 0' }}>{formatManagerPrice(unitPrice)}</td>
                                                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 'bold' }}>{formatManagerPrice(lineTotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div style={{ textAlign: 'right', borderTop: '1px solid #222', paddingTop: '8px', marginTop: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>SUBTOTAL</span>
                                        <span style={{ fontSize: '11px', minWidth: '80px' }}>{formatManagerPrice(managerSubtotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>TAX (3%)</span>
                                        <span style={{ fontSize: '11px', minWidth: '80px' }}>{formatManagerPrice(managerTax)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '12px' }}>TOTAL DUE</span>
                                        <span style={{ fontWeight: 'bold', fontSize: '16px', minWidth: '80px' }}>{formatManagerPrice(managerTotal)}</span>
                                    </div>
                                </div>
                            </div>
                            {/* Spacer */}
                            <div style={{ height: '30px' }}></div>
                            {/* Thank You Box */}
                            <div style={{ margin: '0 30px 30px 30px', border: '2px solid #222', padding: '18px 20px' }}>
                                <p style={{ fontWeight: 'bold', margin: '4px 0', fontSize: '13px' }}>Thank you for choosing LifeInvader for your services today!</p>
                                <p style={{ fontWeight: 'bold', margin: '4px 0', fontSize: '13px' }}>If you require any further help or information, do not hesitate to contact us!</p>
                                <p style={{ fontWeight: 'bold', margin: '4px 0', fontSize: '13px' }}>Have a wonderful day!</p>
                            </div>
                        </div>
                        </div>
                    </div>
                )}
                {managerSubTab === 'invoice' && managerCart.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <span className="text-5xl">🧾</span>
                        <p className="text-xs font-bold uppercase tracking-widest">Add services to generate invoice</p>
                    </div>
                )}

                {/* CONTRACT TAB */}
                {managerSubTab === 'contract' && managerCart.length > 0 && (
                    <div className="relative group no-print">
                        <div className="absolute top-4 right-4 z-10 flex gap-2">
                            <button 
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/generate-pdf', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                type: 'contract',
                                                customerName,
                                                employeeName,
                                                cart: managerCart.map(s => ({ name: s.name, qty: s.qty, price: s.price })),
                                                subtotal: managerSubtotal,
                                                date: getCurrentDate(),
                                            }),
                                        });
                                        if (!res.ok) throw new Error('PDF generation failed');
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = (customerName || 'Client') + ' Contract.pdf';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    } catch (e) { alert('Failed to generate PDF: ' + (e as Error).message); }
                                }}
                                className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download PDF
                            </button>
                        </div>
                        <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px' }}>
                            <div ref={contractRef} className="print-area" style={{ background: '#1e1e1e', color: '#ffffff', padding: '20px 30px', fontFamily: 'Arial, sans-serif', fontSize: '13px', lineHeight: '1.5' }}>
                            <h1 style={{ textAlign: 'center', fontSize: '26px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '10px' }}>GENERAL SERVICE AGREEMENT</h1>
                            <p style={{ textAlign: 'center', fontSize: '13px', marginBottom: '15px' }}>This General Service Agreement is dated {getCurrentDate().replace(/\./g, '-')}.</p>
                            {/* Client / Contractor Table */}
                            <div style={{ display: 'flex', border: '1px solid #555', marginBottom: '15px' }}>
                                <div style={{ flex: 1, padding: '10px', textAlign: 'center', borderRight: '1px solid #555' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>CLIENT</div>
                                    <div style={{ fontSize: '12px' }}>*{customerName || 'FIRST LAST NAME'}*</div>
                                    <div style={{ fontSize: '12px' }}>Los Santos</div>
                                    <div style={{ fontSize: '12px' }}>(the {"\u201C"}Client{"\u201D"})</div>
                                </div>
                                <div style={{ flex: 1, padding: '10px', textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>CONTRACTOR</div>
                                    <div style={{ fontSize: '12px', textDecoration: 'underline' }}>LifeInvader</div>
                                    <div style={{ fontSize: '12px' }}>Rockford Hills, Los Santos</div>
                                    <div style={{ fontSize: '12px' }}>(the {"\u201C"}Contractor{"\u201D"})</div>
                                </div>
                            </div>
                            {/* BACKGROUND */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '10px', marginBottom: '5px' }}>BACKGROUND:</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '5px' }}><strong>A.</strong>&nbsp;&nbsp;The Client is of the opinion that the Contractor has the necessary qualifications, experience, and abilities to provide services to the Client.</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px' }}><strong>B.</strong>&nbsp;&nbsp;The Contractor is agreeable to providing such services to the Client on the terms and conditions set out in this Agreement.</div>
                            <hr style={{ border: 'none', borderTop: '1px solid #555', margin: '15px 0' }} />
                            {/* IN CONSIDERATION */}
                            <p style={{ marginBottom: '15px', fontSize: '13px' }}><strong>IN CONSIDERATION OF</strong> the matters described above, and of the mutual benefits and obligations set forth in this Agreement, the receipt and sufficiency of which considerations is hereby acknowledged, the Client and the Contractor (individually the {"\u201C"}Party{"\u201D"} and collectively the {"\u201C"}parties{"\u201D"} to this Agreement) agree as follows:</p>
                            {/* SERVICES PROVIDED */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '15px', marginBottom: '5px' }}>SERVICES PROVIDED</h3>
                            <div style={{ paddingLeft: '30px', marginBottom: '5px', fontSize: '13px' }}><strong>1.</strong>&nbsp;&nbsp;The Client hereby agrees to engage the Contractor to provide the Client with the following services (the {"\u201C"}Services{"\u201D"}):</div>
                            <div style={{ paddingLeft: '70px', marginBottom: '5px' }}>
                                {managerCart.map((s, i) => (
                                    <div key={i} style={{ marginBottom: '3px' }}>{"\u2022"}&nbsp;&nbsp;{s.name}</div>
                                ))}
                            </div>
                            <div style={{ paddingLeft: '40px', marginBottom: '15px' }}><strong>2.</strong>&nbsp;&nbsp;The services will also include any other tasks which the Parties may agree on. The Contractor hereby agrees to provide such Services to the Client.</div>
                            {/* TERM OF AGREEMENT */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>TERM OF AGREEMENT</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '6px', fontSize: '12px' }}><strong>3.</strong>&nbsp;&nbsp;The term of this Agreement (the {"\u201C"}Term{"\u201D"}) will begin on the date of this Agreement and will remain in full force and effect until the completion of the Services, subject to earlier termination as provided in this Agreement.</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>4.</strong>&nbsp;&nbsp;In the event that either Party wishes to terminate this Agreement prior to the completion of the Services, that Party can do so only if the Term of this Agreement was not followed, by immediately serving written notice on the Party in breach of the Term of the Agreement.</div>
                            {/* PERFORMANCE */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>PERFORMANCE</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>5.</strong>&nbsp;&nbsp;The Parties agree to do everything necessary to ensure that the terms of this Agreement take effect.</div>
                            {/* CURRENCY */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>CURRENCY</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>6.</strong>&nbsp;&nbsp;Except as otherwise provided in this Agreement, all monetary amounts referred to in this Agreement are in USD (US Dollars).</div>
                            {/* COMPENSATION */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>COMPENSATION</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '6px', fontSize: '12px' }}><strong>7.</strong>&nbsp;&nbsp;The Contractor will charge the Client a flat fee of <strong>{formatManagerPrice(managerSubtotal)}</strong> for the Services (the {"\u201C"}Compensation{"\u201D"}).</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '6px', fontSize: '12px' }}><strong>8.</strong>&nbsp;&nbsp;The Client will pay before the Services are provided.</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>9.</strong>&nbsp;&nbsp;The Contractor will not be reimbursed for any expenses incurred in connection with providing the Services of this Agreement.</div>
                            {/* OWNERSHIP OF THE INTELLECTUAL PROPERTY */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>OWNERSHIP OF THE INTELLECTUAL PROPERTY</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '6px', fontSize: '12px' }}><strong>10.</strong>&nbsp;All intellectual property and related material (the {"\u201C"}Intellectual Property{"\u201D"}) that is developed or produced under this Agreement, will be the property of the Contractor. The Client is granted a non-exclusive limited-use license of this Intellectual Property.</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>11.</strong>&nbsp;Title, copyright, intellectual property rights and distribution rights of the Intellectual Property remain exclusively with the Contractor.</div>
                            {/* RETURN OF PROPERTY */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>RETURN OF PROPERTY</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>12.</strong>&nbsp;Upon the expiration or termination of this Agreement, the Client will return to the Client any Intellectual Property which is the Property of the Contractor.</div>
                            {/* CAPACITY/INDEPENDENT CONTRACTOR */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>CAPACITY/INDEPENDENT CONTRACTOR</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>13.</strong>&nbsp;In providing the Services under this Agreement it is expressly agreed that the Contractor is acting as an independent contractor and not as an employee. The Contractor and the Client acknowledge that this Agreement does not create a partnership or joint venture between them, and is exclusively a contract for service.</div>
                            {/* RIGHT OF SUBSTITUTION */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>RIGHT OF SUBSTITUTION</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '6px', fontSize: '12px' }}><strong>14.</strong>&nbsp;Except as otherwise provided in this Agreement, the Contractor may, at the Contractor{"\u2019"}s absolute discretion, engage a third party subcontractor to perform some of all the obligations of the Contractor under this Agreement and the Client will not hire or engage any third parties to assist with the provision of the Services.</div>
                            <div style={{ paddingLeft: '20px', marginBottom: '4px', fontSize: '12px' }}><strong>15.</strong>&nbsp;In the event that the Contractor hires a subcontractor:</div>
                            <div style={{ paddingLeft: '40px', marginBottom: '4px', fontSize: '12px' }}>{"\u2022"}&nbsp;&nbsp;The contractor will pay the subcontractor for its services and the Compensation will remain payable by the Client to the Contractor.</div>
                            <div style={{ paddingLeft: '40px', marginBottom: '10px', fontSize: '12px' }}>{"\u2022"}&nbsp;&nbsp;For the purposes of the indemnification clause of this Agreement, the sub-contractor is an agent of the Contractor.</div>
                            {/* AUTONOMY */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>AUTONOMY</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>16.</strong>&nbsp;Except as otherwise provided in this Agreement, the Contractor will have full control over working time, methods, and decision making in relation to provision of Services in accordance with the Agreement. The Contractor will work autonomously and not at the direction of the Client. However, the Contractor will be responsive to the reasonable needs and concerns of the Client.</div>
                            {/* MODIFICATION OF AGREEMENT */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>MODIFICATION OF AGREEMENT</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>17.</strong>&nbsp;Any amendment or modification of this Agreement or additional obligation assumed by either Party in connection with this Agreement will only be binding if evidenced in writing signed by each Party or an authorized representative of each Party.</div>
                            {/* ENUREMENT */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>ENUREMENT</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>18.</strong>&nbsp;This Agreement will ensure to the benefit of and be binding on the Parties and their respective heirs, executors, administrators and permitted successors and assigns.</div>
                            {/* GOVERNING LAW */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>GOVERNING LAW</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>19.</strong>&nbsp;This Agreement will be governed by and constructed in accordance with the laws of the State of Los Santos.</div>
                            {/* SEVERABILITY */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>SEVERABILITY</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>20.</strong>&nbsp;In the event that any of the provisions of this Agreement are held to be invalid or unenforceable in whole or in part, all other provisions will nevertheless continue to be valid and enforceable with the invalid or unenforceable parts severed from the remainder of this Agreement.</div>
                            {/* WAIVER */}
                            <h3 style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '12px', marginBottom: '4px' }}>WAIVER</h3>
                            <div style={{ paddingLeft: '20px', marginBottom: '10px', fontSize: '12px' }}><strong>21.</strong>&nbsp;The waiver by either Party of a breach, default, delay or omission of any of the provisions of this Agreement by the other Party will not be constructed as a waiver of any subsequent breach of the same or other provisions.</div>
                            <hr style={{ border: 'none', borderTop: '1px solid #555', margin: '30px 0' }} />
                            {/* IN WITNESS WHEREOF */}
                            <p style={{ marginBottom: '40px' }}><strong>IN WITNESS WHERE OF</strong> the parties have duly affixed their signatures under hand and seal on the {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).replace(/^(\d+)/, (_, d) => { const n = parseInt(d); const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); })}.</p>
                            <div style={{ textAlign: 'right', marginTop: '40px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <span style={{ textDecoration: 'underline', fontSize: '24px', fontFamily: 'Dancing Script, cursive', marginRight: '5px' }}>{customerName || 'Client Name Goes Here'}</span>
                                    <span>(Client)</span>
                                </div>
                                <div style={{ fontSize: '15px' }}>LifeInvader</div>
                                <div>
                                    <span style={{ fontSize: '24px', fontFamily: 'Dancing Script, cursive', marginRight: '5px' }}>{employeeName || 'A Name Goes Here'}</span>
                                    
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
                {managerSubTab === 'contract' && managerCart.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <span className="text-5xl">📄</span>
                        <p className="text-xs font-bold uppercase tracking-widest">Add services to generate contract</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ------------- REJECTIONS -------------
function RejectionsForm() {
    const rejections = [
        'Cannot advertise more than 2 properties at a time.',
        'Cannot advertise more than 1 vehicle at a time.',
        'Cannot advertise more than 1 business at a time.',
        'Cannot advertise more than 3 items at a time.',
        'Cannot advertise more than one item category at a time.',
        'Cannot promote illegal items.',
        'Cannot look for gods.',
        'Can not look for leaders/deputy leaders of state organisations.',
        'Improper AD format.',
        'Template not found. Please contact LI to create a template.',
        'Person not found in the database. Please submit proof of existence in the LI emails.',
        'Item not found in the database. Please submit proof of tradeability in the LI emails.',
        'Vehicle not found in the database. Please submit proof of tradeability in the LI emails.',
        'Please provide proof of being tradable.',
        'Technical issues with the template. Please open a ticket in the LI emails regarding this.',
        'Template expired. Please open a ticket in the LI emails regarding this.',
        'Improper or invalid trading advertisement.',
        'Technical issue, please request refund in LI emails.',
        'Spamming of templates is not allowed.',
    ];

    const blacklisted = [
        { item: 'Firearms / Weapons / Ammunition / Knives', duration: '7 days' },
        { item: 'Bulletproof vests / Armour plates', duration: '7 days' },
        { item: 'Weed / Cannabis seeds / Trees / Drugs / Cocaine', duration: '5 days' },
        { item: 'ORG items (Army uniform, balaclava, EMS medical masks, medkits, pills)', duration: '7 days' },
        { item: 'Vehicle / People scanners', duration: '5 days' },
        { item: 'Anti-radar / Engine blockers', duration: '5 days' },
        { item: 'Ropes / Head bags', duration: '5 days' },
        { item: 'USB with virus', duration: '5 days' },
        { item: 'Lockpicks', duration: '5 days' },
        { item: 'Bandit mask', duration: '5 days' },
        { item: 'Airhorn', duration: '5 days' },
        { item: 'Counterfeit money', duration: '5 days' },
        { item: 'Coloured cloth', duration: '5 days' },
        { item: 'Crowbars', duration: '5 days' },
        { item: 'Troll ADs (selling for ridiculous prices, etc)', duration: '3-7 days' },
        { item: 'ADs with sexual or racist references', duration: '3-7 days' },
        { item: 'ADs insulting LI employees', duration: '7 days' },
        { item: 'ADs involving the sale of people', duration: '3-7 days' },
        { item: 'ADs mentioning controversial figures (Hitler, Stalin, Epstein, etc)', duration: '7 days' },
        { item: 'Submodule / Main module (smuggling machine)', duration: '5 days' },
        { item: 'Bandit container', duration: '3 days' },
        { item: 'Poison darts', duration: '5 days' },
    ];

    const rejectedOnly = [
        'Specific family names',
        'Hype Body Armour',
        'Gangs',
        'Nationality',
        'Gods / Admins',
        'Leaders and deputy leaders of an organisation',
        'Food items (excluding fish)',
        'Birthday ADs',
        'ADs with improper format (selling 2 items of different category)',
        'Locations: Mega Mall, Gang HQs, Black Market',
        'Party at LifeInvader (excl. LI/Galaxy Rooftop), LSPD, FIB, SAHP, EMS, Government, NG base/FZ, Capitol, Aircraft Carrier, Power Plant, Farm, ghetto, or any business',
        'Grand coins',
        'Battle Pass',
        'Weapons case / container',
        'Defense case / container',
        'Dice or illegal gambling ADs',
        'Dangerous razor',
        'Tracking sensor',
        'Multiple spam of template/party ADs (more than 2 in a row)',
    ];

    const [search, setSearch] = useState('');
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [showBlacklist, setShowBlacklist] = useState(true);
    const [showRejectedOnly, setShowRejectedOnly] = useState(true);
    const filtered = rejections.filter(r => r.toLowerCase().includes(search.toLowerCase()));
    const filteredBlack = blacklisted.filter(b => b.item.toLowerCase().includes(search.toLowerCase()));
    const filteredRejOnly = rejectedOnly.filter(r => r.toLowerCase().includes(search.toLowerCase()));

    const handleCopy = (text: string, idx: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rejection reasons & illegal items..." className="w-full bg-white border border-slate-400 p-3 rounded-xl text-slate-900 outline-none focus:border-sky-500 font-mono" />
            
            {/* Quick Rejection Reasons */}
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {filtered.map((r, i) => (
                    <button key={i} onClick={() => handleCopy(r, i)} className={`text-left p-3 rounded-lg border transition-all text-sm ${copiedIdx === i ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-slate-300 hover:border-sky-400 hover:bg-sky-50 text-slate-800'}`}>
                        {copiedIdx === i ? '✓ Copied!' : r}
                    </button>
                ))}
                {filtered.length === 0 && <p className="text-slate-500 text-center py-4 font-mono text-sm">No rejections found.</p>}
            </div>

            {/* Blacklisted Items */}
            <div className="border border-red-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowBlacklist(!showBlacklist)} className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-left">
                    <span className="text-sm font-extrabold text-red-700 uppercase tracking-wider">🚫 Rejected &amp; Blacklisted ({filteredBlack.length})</span>
                    <span className="text-red-400 text-xs">{showBlacklist ? '▼' : '▶'}</span>
                </button>
                {showBlacklist && (
                    <div className="divide-y divide-red-100 max-h-[300px] overflow-y-auto">
                        {filteredBlack.map((b, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50/50 transition-colors">
                                <span className="text-sm text-slate-800 flex-1">{b.item}</span>
                                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0 ml-2">{b.duration}</span>
                            </div>
                        ))}
                        {filteredBlack.length === 0 && <p className="text-slate-400 text-center py-4 text-sm font-mono">No matches</p>}
                    </div>
                )}
            </div>

            {/* Rejected Only Items */}
            <div className="border border-amber-200 rounded-xl overflow-hidden">
                <button onClick={() => setShowRejectedOnly(!showRejectedOnly)} className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 text-left">
                    <span className="text-sm font-extrabold text-amber-700 uppercase tracking-wider">⛔ Rejected Only ({filteredRejOnly.length})</span>
                    <span className="text-amber-400 text-xs">{showRejectedOnly ? '▼' : '▶'}</span>
                </button>
                {showRejectedOnly && (
                    <div className="divide-y divide-amber-100 max-h-[300px] overflow-y-auto">
                        {filteredRejOnly.map((r, i) => (
                            <div key={i} className="px-4 py-2.5 text-sm text-slate-800 hover:bg-amber-50/50 transition-colors">{r}</div>
                        ))}
                        {filteredRejOnly.length === 0 && <p className="text-slate-400 text-center py-4 text-sm font-mono">No matches</p>}
                    </div>
                )}
            </div>
        </div>
    );
}

// ------------- AUTH SERVER CONFIG -------------
// Proxy through same-origin API route to avoid HTTPS→HTTP mixed content block
const AUTH_PROXY = '/api/auth';
const DIRECT_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4032';

async function authFetch(endpoint: string, options: RequestInit = {}) {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    // For direct ping on localhost, we can try to skip the proxy if it's just a health check
    // However, for consistency and avoiding CORS issues even on local, we stay with proxy
    // UNLESS it's a performance.now() ping where we want accuracy.
    const url = (isLocal && endpoint === '/health') ? `${DIRECT_URL}${endpoint}` : `${AUTH_PROXY}${endpoint}`;
    
    const res = await fetch(url, { ...options, headers });
    return res;
}

// ------------- LOGIN SCREEN -------------
function LoginScreen({ onLogin, onSwitchToRegister }: { onLogin: (token: string, name: string, role: string, suspended?: boolean, suspendReason?: string) => void, onSwitchToRegister: () => void }) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

    const handleDigit = (index: number, value: string) => {
        if (!/^\d?$/.test(value)) return;
        const newPin = pin.split('');
        newPin[index] = value;
        const joined = newPin.join('').slice(0, 4);
        setPin(joined);
        setError('');
        if (value && index < 3) inputRefs[index + 1].current?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !pin[index] && index > 0) {
            inputRefs[index - 1].current?.focus();
        }
    };

    const handleSubmit = async () => {
        if (pin.length !== 4) { setError('Enter all 4 digits'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await authFetch('/login', { method: 'POST', body: JSON.stringify({ pin }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('authName', data.name);
            localStorage.setItem('authRole', data.role);
            onLogin(data.token, data.name, data.role, data.suspended, data.suspendReason);
        } catch (e: any) {
            if (e.message?.includes('fetch')) setError('Auth server is offline. Please try again later.');
            else setError(e.message || 'Login failed');
        }
        setLoading(false);
    };

    useEffect(() => { inputRefs[0].current?.focus(); }, []);

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-sky-400 to-teal-500 bg-clip-text text-transparent">LifeInvaider</h1>
                    <p className="text-slate-500 mt-2 font-mono text-xs tracking-[0.3em] uppercase">Authentication Required</p>
                </div>
                <div className="bg-white border border-slate-300 rounded-2xl p-8 shadow-2xl">
                    <p className="text-slate-500 text-sm text-center mb-6 font-mono">Enter your 4-digit PIN</p>
                    <div className="flex justify-center gap-3 mb-6">
                        {[0, 1, 2, 3].map(i => (
                            <input key={i} ref={inputRefs[i]} type="password" inputMode="numeric" maxLength={1} value={pin[i] || ''} onChange={e => handleDigit(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
                                className="w-14 h-16 text-center text-2xl font-bold bg-slate-100 border-2 border-slate-300 rounded-xl text-slate-800 outline-none focus:border-sky-400 focus:shadow-[0_0_15px_rgba(56,189,248,0.2)] transition-all" />
                        ))}
                    </div>
                    {error && <p className="text-red-500 text-xs text-center mb-4 font-mono animate-in fade-in">{error}</p>}
                    <button onClick={handleSubmit} disabled={loading || pin.length !== 4}
                        className="w-full bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-bold py-3 rounded-xl uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20">
                        {loading ? 'Authenticating...' : 'Login'}
                    </button>
                    <div className="mt-6 text-center">
                        <button onClick={onSwitchToRegister} className="text-sky-500 hover:text-sky-600 text-xs font-mono tracking-wider transition-colors">
                            Don't have access? → Request Access
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ------------- REGISTER SCREEN -------------
function RegisterScreen({ onBack }: { onBack: () => void }) {
    const [discord, setDiscord] = useState('');
    const [howFound, setHowFound] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!discord.trim()) { setMsg('Discord username is required'); return; }
        setLoading(true);
        setMsg('');
        try {
            const res = await authFetch('/register', { method: 'POST', body: JSON.stringify({ discord_username: discord, how_found: howFound }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Registration failed');
            setSuccess(true);
            setMsg(data.message || 'Request sent!');
        } catch (e: any) {
            if (e.message?.includes('fetch')) setMsg('Auth server is offline. Please try again later.');
            else setMsg(e.message || 'Registration failed');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-sky-400 to-teal-500 bg-clip-text text-transparent">LifeInvaider</h1>
                    <p className="text-slate-500 mt-2 font-mono text-xs tracking-[0.3em] uppercase">Request Access</p>
                </div>
                <div className="bg-white border border-slate-300 rounded-2xl p-8 shadow-2xl">
                    {success ? (
                        <div className="text-center animate-in fade-in">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-green-600 font-mono text-sm mb-6">{msg}</p>
                            <button onClick={onBack} className="text-sky-500 hover:text-sky-600 text-xs font-mono tracking-wider">← Back to Login</button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-4 mb-6">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block tracking-wider">Discord Username</label>
                                    <input type="text" value={discord} onChange={e => setDiscord(e.target.value)} placeholder="e.g. galaxy338"
                                        className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl text-slate-800 outline-none focus:border-sky-400 font-mono text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block tracking-wider">How did you find this site?</label>
                                    <input type="text" value={howFound} onChange={e => setHowFound(e.target.value)} placeholder="e.g. From a friend"
                                        className="w-full bg-slate-100 border border-slate-300 p-3 rounded-xl text-slate-800 outline-none focus:border-sky-400 font-mono text-sm" />
                                </div>
                            </div>
                            {msg && <p className="text-red-500 text-xs text-center mb-4 font-mono animate-in fade-in">{msg}</p>}
                            <button onClick={handleSubmit} disabled={loading}
                                className="w-full bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-bold py-3 rounded-xl uppercase tracking-widest transition-all disabled:opacity-40 shadow-lg shadow-sky-500/20">
                                {loading ? 'Sending...' : 'Request Access'}
                            </button>
                            <div className="mt-6 text-center">
                                <button onClick={onBack} className="text-slate-400 hover:text-slate-600 text-xs font-mono tracking-wider transition-colors">← Back to Login</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ------------- MAIN APP -------------
export default function App() {
  const [clientStartTime] = useState(Date.now());
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [reloadInFlight, setReloadInFlight] = useState(false);

  // Auth state
  const [authState, setAuthState] = useState<'loading' | 'login' | 'register' | 'authenticated'>('loading');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [isSuspended, setIsSuspended] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [activeTab, setActiveTab] = useState('Car Ads');
  const [downloading, setDownloading] = useState(false);
  const [funnyMsg, setFunnyMsg] = useState('');
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [lastSyncRaw, setLastSyncRaw] = useState<string | null>(null);

  // Settings Modal States
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'config' | 'users' | 'sessions'>('config');
  const [config, setConfig] = useState({ doc1_url: '', templates_url: '', cars_url: '', manager_url: '', last_updated: 'Never' });
  const [configSaving, setConfigSaving] = useState(false);
  const [usersList, setUsersList] = useState<{ name: string; pin: string; role: string; suspended?: boolean; suspendReason?: string; currentLocation?: string; previousLocation?: string; lastLoginIP?: string }[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');
  const [usersMsg, setUsersMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [serverPing, setServerPing] = useState<number | null>(null);
  const [serverOnline, setServerOnline] = useState(true);
  const [syncCd, setSyncCd] = useState(0); // Cooldown in seconds
  const [logoutWarning, setLogoutWarning] = useState<string | null>(null);
  const [versionMismatch, setVersionMismatch] = useState<string | null>(null); // null = ok, string = error message
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  const [globalAlert, setGlobalAlert] = useState<{type: string; message: string; ts: number} | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [adminAlertType, setAdminAlertType] = useState('info');
  const [adminAlertMsg, setAdminAlertMsg] = useState('');
  const [adminAlertSending, setAdminAlertSending] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportMsg, setReportMsg] = useState('');
  const [reportType, setReportType] = useState('feedback');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportStatus, setReportStatus] = useState('');

  const [parsedData, setParsedData] = useState<any>(null);
  const [managerData, setManagerData] = useState<Record<string, any>>({});
  const [templateData, setTemplateData] = useState<Record<string, unknown>>({});
  const [policyData, setPolicyData] = useState<any>(null);
  const [itemsData, setItemsData] = useState<any>(null);

  // Notes panel
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const notesSaveTimer = useRef<any>(null);

  // Chat/Messaging
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const [chatSending, setChatSending] = useState(false);
  // Admin chat
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [chatSelectedUser, setChatSelectedUser] = useState<string | null>(null);
  const chatPollRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Preferences
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<{ autoEach?: boolean; autoS?: boolean; defaultS?: boolean; darkMode?: boolean; autoBulkSEach?: boolean; sidebarMode?: boolean }>({ autoEach: true, autoS: false, defaultS: false, darkMode: false, autoBulkSEach: true, sidebarMode: true });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<'accepted' | 'rejected' | null>(null);

  // Offline detection
  const [isOffline, setIsOffline] = useState(false);
  useEffect(() => {
      setIsOffline(!navigator.onLine);
      const goOffline = () => setIsOffline(true);
      const goOnline = () => setIsOffline(false);
      window.addEventListener('offline', goOffline);
      window.addEventListener('online', goOnline);
      return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // Cookie consent: check on mount
  useEffect(() => {
      const stored = localStorage.getItem('cookieConsent');
      if (stored === 'accepted' || stored === 'rejected') setCookieConsent(stored);
  }, []);

  // Chat polling
  useEffect(() => {
      if (authState !== 'authenticated') return;
      
      const poll = async () => {
          try {
              if (userRole === 'admin') {
                  // Admin: poll user list for unread counts
                  const r = await authFetch('/messages/users');
                  const d = await r.json();
                  if (d.users) {
                      setChatUsers(d.users);
                      const total = d.users.reduce((sum: number, u: any) => sum + u.unread, 0);
                      setChatUnread(total);
                  }
                  // If a user is selected and chat is open, load their thread
                  if (chatOpen && chatSelectedUser) {
                      const r2 = await authFetch(`/messages?user=${encodeURIComponent(chatSelectedUser)}`);
                      const d2 = await r2.json();
                      if (d2.messages) setChatMessages(d2.messages);
                  }
              } else {
                  // User: poll own messages
                  const r = await authFetch('/messages');
                  const d = await r.json();
                  if (d.messages) {
                      setChatMessages(d.messages);
                      if (!chatOpen) {
                          const unread = d.messages.filter((m: any) => m.to !== 'Admin' && !m.read).length;
                          setChatUnread(unread);
                      } else {
                          setChatUnread(0);
                      }
                  }
              }
          } catch {}
      };
      
      poll();
      chatPollRef.current = setInterval(poll, 5000);
      return () => clearInterval(chatPollRef.current);
  }, [authState, chatOpen, chatSelectedUser, userRole]);

  // Auto-scroll chat to bottom
  useEffect(() => {
      if (chatOpen && chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [chatMessages, chatOpen]);

  const sendChat = async () => {
      if (!chatInput.trim() || chatSending) return;
      setChatSending(true);
      try {
          const body: any = { text: chatInput.trim() };
          if (userRole === 'admin' && chatSelectedUser) body.to = chatSelectedUser;
          await authFetch('/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          setChatInput('');
          // Immediate refetch
          if (userRole === 'admin' && chatSelectedUser) {
              const r = await authFetch(`/messages?user=${encodeURIComponent(chatSelectedUser)}`);
              const d = await r.json();
              if (d.messages) setChatMessages(d.messages);
          } else if (userRole !== 'admin') {
              const r = await authFetch('/messages');
              const d = await r.json();
              if (d.messages) setChatMessages(d.messages);
          }
      } catch {}
      setChatSending(false);
  };


  const [syncReminderDismissed, setSyncReminderDismissed] = useState(false);
  const syncReminderVisible = useMemo(() => {
      if (syncReminderDismissed || !lastSyncRaw) return false;
      const elapsed = Date.now() - new Date(lastSyncRaw).getTime();
      return elapsed > 2 * 60 * 60 * 1000; // 2 hours
  }, [lastSyncRaw, syncReminderDismissed]);
  const syncAgoText = useMemo(() => {
      if (!lastSyncRaw) return '';
      const mins = Math.floor((Date.now() - new Date(lastSyncRaw).getTime()) / 60000);
      if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return remMins > 0 ? `${hrs}h ${remMins}m ago` : `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  }, [lastSyncRaw]);

  // Extract CEO from Policy
  const getCEO = () => {
    const text = policyData?.LifeInvader_Internal_Policy || '';
    const match = text.match(/Last edited .* by (.*)/i);
    return match ? match[1].trim() : null;
  };

  const carOptions = useMemo(() => parsedData?.cars || [], [parsedData]);
  const carStateValues = useMemo(() => parsedData?.carStateValues || {}, [parsedData]);
  const itemOptions = useMemo(() => {
      return (parsedData?.items || []).filter((i: string) => !i.includes('(of type'));
  }, [parsedData]);
  const clothOptions = useMemo(() => parsedData?.clothing || [], [parsedData]);

  const isAdmin = userRole === 'admin';

  // Fetch all data from server
  const fetchAllData = async (forceCache = false) => {
      // If version mismatch or maintenance mode, only load from cache — never hit server
      if (forceCache || versionMismatch || maintenanceMode) {
          console.warn('[Data] Version mismatch, maintenance, or forced cache — loading from cache only');
          const keys = ['parsedData', 'templateData', 'policyData', 'itemsData', 'managerData'];
          keys.forEach(key => {
              const cached = localStorage.getItem(`cache_${key}`);
              if (cached) {
                  const data = JSON.parse(cached);
                  if (key === 'parsedData') setParsedData(data || {});
                  if (key === 'templateData') setTemplateData(data || {});
                  if (key === 'policyData') setPolicyData(data);
                  if (key === 'itemsData') setItemsData(data);
                  if (key === 'managerData') setManagerData(data || {});
              } else if (key === 'parsedData') setParsedData({});
          });
          return;
      }

      try {
          const endpoints = {
              parsedData: '/data/parsed_items.json',
              templateData: '/data/templates.json',
              policyData: '/data/policy.json',
              itemsData: '/data/items.json',
              managerData: '/data/manager.json'
          };
          
          const fetchPromises = Object.entries(endpoints).map(async ([key, path]) => {
              try {
                  const res = await authFetch(path);
                  if (res.ok) {
                      const data = await res.json();
                      localStorage.setItem(`cache_${key}`, JSON.stringify(data));
                      return { key, data };
                  }
                  throw new Error(`Failed to fetch ${key}`);
              } catch (err: any) {
                  // Attempt recovery from cache
                  const cached = localStorage.getItem(`cache_${key}`);
                  if (cached) return { key, data: JSON.parse(cached), cached: true };
                  return { key, data: key === 'templateData' ? {} : null };
              }
          });

          const results = await Promise.all(fetchPromises);
          results.forEach(({ key, data }) => {
              if (key === 'parsedData') setParsedData(data || {});
              if (key === 'templateData') setTemplateData(data || {});
              if (key === 'policyData') setPolicyData(data);
              if (key === 'itemsData') setItemsData(data);
              if (key === 'managerData') setManagerData(data || {});
          });
      } catch (e: any) {
          console.error('Failed to fetch data:', e.message || e);
          // Last ditch effort for parsedData
          const cachedParsed = localStorage.getItem('cache_parsedData');
          if (cachedParsed) setParsedData(JSON.parse(cachedParsed));
          else setParsedData({});
      }
  };

  // Session validation and initial data load
  useEffect(() => {
      const token = localStorage.getItem('authToken');
      console.log('[Auth] Initializing. Token found:', !!token);
      if (!token) { 
          setAuthState('login'); 
          return; 
      }
      
      // Optimistic authentication: assume valid if token exists
      setAuthState('authenticated');
      console.log('[Auth] Optimistic auth active. Checking version then fetching data...');
      
      // Check API version before loading data
      (async () => {
          let mismatch = false;
          try {
              const healthRes = await fetch(`${DIRECT_URL}/health`, { method: 'GET', mode: 'cors' }).catch(() => authFetch('/health'));
              if (healthRes.ok) {
                  const h = await healthRes.json();
                  if (h.apiVersion !== undefined && h.apiVersion !== CLIENT_API_VERSION) {
                      mismatch = true;
                      if (h.apiVersion > CLIENT_API_VERSION) {
                          setVersionMismatch(`Client outdated (v${CLIENT_API_VERSION} vs server v${h.apiVersion}). Please ask admin to check Vercel deployments.`);
                      } else {
                          setVersionMismatch(`Server outdated (v${h.apiVersion} vs client v${CLIENT_API_VERSION}). Please ask admin to update the server.`);
                      }
                  }
              }
          } catch {}
          fetchAllData(mismatch);
      })();

      // Background validation
      authFetch('/validate').then(async res => {
          console.log('[Auth] Validation response status:', res.status);
          if (res.ok) {
              const d = await res.json();
              console.log('[Auth] Validation JSON:', d);
              if (d.valid) {
                  setUserName(d.name || 'User');
                  setUserRole(d.role || 'user');
                  setIsSuspended(!!d.suspended);
                  setSuspendReason(d.suspendReason || '');
              } else {
                  console.warn('[Auth] Session invalid. Logging out.');
                  handleLogout();
              }
          } else if (res.status === 401) {
              console.warn('[Auth] Unauthenticated (401). Logging out.');
              handleLogout();
          } else {
              console.error('[Auth] Server error during validation:', res.status);
              setServerOnline(false);
          }
      }).catch((err: any) => {
          console.error('[Auth] Network error during validation:', err.message || err);
          // Server offline? Stay authenticated but mark offline
          setServerOnline(false);
      });
  }, []);

  // Countdown for sync cooldown
  useEffect(() => {
      if (syncCd <= 0) return;
      const iv = setInterval(() => setSyncCd(prev => prev - 1), 1000);
      return () => clearInterval(iv);
  }, [syncCd]);

  // Heartbeat to detect multi-device logout
  useEffect(() => {
    if (authState !== 'authenticated') return;
    const heartbeat = async () => {
        try {
            const res = await authFetch('/validate');
            if (res.status === 401) {
                setLogoutWarning("Your session has expired. Please log in again.");
                handleLogout();
            } else {
                setServerOnline(true);
                try {
                    const data = await res.json();
                    setMaintenanceMode(!!data.maintenance);
                    if (data.alert && data.alert.message) {
                        setGlobalAlert(prev => {
                            // Only reset dismissed state if alert changed
                            if (!prev || prev.ts !== data.alert.ts) setAlertDismissed(false);
                            return data.alert;
                        });
                    } else {
                        setGlobalAlert(null);
                    }
                } catch {}
            }
        } catch { 
            // Network failure: Server is offline, but don't log out
            setServerOnline(false);
        }
    };
    const iv = setInterval(heartbeat, 5000); // 5 second heartbeat
    return () => clearInterval(iv);
  }, [authState]);

  // Live ping and sync status check every 10s
  useEffect(() => {
      if (authState !== 'authenticated') return;
      const checkStatus = async () => {
          const start = performance.now();
          try {
              // Direct ping bypasses the Vercel proxy for accuracy
              const pingUrl = `${DIRECT_URL}/sync/status`;
              const res = await fetch(pingUrl, { method: 'GET', mode: 'cors' }).catch(() => authFetch('/sync/status')); 
              
              if (!res.ok) {
                  throw new Error(`Server status ${res.status}`);
              }
              
              const d = await res.json();
              setServerPing(Math.round(performance.now() - start));
              setServerOnline(true);
              if (d.remaining !== undefined) setSyncCd(d.remaining);
              if (d.lastUpdated) {
                  setLastSyncDate(new Date(d.lastUpdated).toLocaleString(undefined, { timeZoneName: 'short' }));
                  setLastSyncRaw(d.lastUpdated);
              }
              
              // API Version check (only if apiVersion is in response — /sync/status may not have it)
              if (d.apiVersion !== undefined) {
                  if (d.apiVersion !== CLIENT_API_VERSION) {
                      if (d.apiVersion > CLIENT_API_VERSION) {
                          setVersionMismatch(`Client outdated (v${CLIENT_API_VERSION} vs server v${d.apiVersion}). Please ask admin to check Vercel deployments.`);
                      } else {
                          setVersionMismatch(`Server outdated (v${d.apiVersion} vs client v${CLIENT_API_VERSION}). Please ask admin to update the server.`);
                      }
                  } else {
                      setVersionMismatch(null); // versions match — clear any previous mismatch
                  }
              }
              
              // Global Reload Sync
              if (d.reloadTimestamp && d.reloadTimestamp > clientStartTime) {
                  console.warn('[Sync] Server requested global reload...');
                  setTimeout(() => window.location.reload(), 1000);
              }
          } catch (err: any) {
              console.warn('[Ping] Connection lost:', err.message || err);
              setServerOnline(false);
              setServerPing(null);
          }
      };
      checkStatus();
      const iv = setInterval(checkStatus, 10000);
      return () => clearInterval(iv);
  }, [authState]);

  // Progress bar animation
  useEffect(() => {
     let interval: any;
     let msgInterval: any;
     if (downloading) {
         interval = setInterval(() => {
             setProgress(prev => {
                 if (prev < 40) return prev + 10;
                 if (prev < 70) return prev + 5;
                 if (prev < 90) return prev + 2;
                 if (prev < 95) return prev + 1;
                 if (prev < 99) return prev + 0.1;
                 return prev;
             });
         }, 300);
         const msgs = [
             "Fetching fresh data from the Google gremlins... 👾",
             "Parsing the ancient scrolls of Los Santos... 📜",
             "Untangling the spaghetti code... 🍝",
             "Almost there! Just bribing the server... 💸"
         ];
         let i = 0;
         msgInterval = setInterval(() => { i = (i + 1) % msgs.length; setFunnyMsg(msgs[i]); }, 2500);
     }
     return () => { clearInterval(interval); clearInterval(msgInterval); };
  }, [downloading]);

  const handleLogout = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('authName');
      localStorage.removeItem('authRole');
      setAuthState('login');
      setUserName('');
      setUserRole('user');
  };

  // Notes: load on auth (server first, localStorage fallback)
  useEffect(() => {
      if (authState === 'authenticated' && !notesLoaded) {
          authFetch('/notes').then(r => r.json()).then(d => {
              const serverNotes = d.notes || '';
              setNotesContent(serverNotes);
              localStorage.setItem('cachedNotes', serverNotes);
              setNotesLoaded(true);
          }).catch(() => {
              // Fallback to cached notes
              setNotesContent(localStorage.getItem('cachedNotes') || '');
              setNotesLoaded(true);
          });
      }
  }, [authState, notesLoaded]);

  const handleNotesChange = (val: string) => {
      setNotesContent(val);
      localStorage.setItem('cachedNotes', val);
      if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
      notesSaveTimer.current = setTimeout(() => {
          setNotesSaving(true);
          authFetch('/notes', { method: 'POST', body: JSON.stringify({ notes: val }) })
              .then(() => setNotesSaving(false))
              .catch(() => setNotesSaving(false));
      }, 800);
  };

  // Preferences: load on auth
  useEffect(() => {
      if (authState === 'authenticated' && !prefsLoaded) {
          authFetch('/preferences').then(r => r.json()).then(d => {
              const serverPrefs = { autoEach: true, autoS: false, defaultS: false, darkMode: false, autoBulkSEach: true, sidebarMode: true, ...d.prefs };
              setPrefs(serverPrefs);
              localStorage.setItem('cachedPrefs', JSON.stringify(serverPrefs));
              setPrefsLoaded(true);
          }).catch(() => {
              try {
                  const cached = JSON.parse(localStorage.getItem('cachedPrefs') || '{}');
                  setPrefs({ autoEach: true, autoS: false, defaultS: false, darkMode: false, autoBulkSEach: true, sidebarMode: true, ...cached });
              } catch {}
              setPrefsLoaded(true);
          });
      }
  }, [authState, prefsLoaded]);

  const updatePref = (key: string, value: boolean) => {
      const next = { ...prefs, [key]: value };
      setPrefs(next);
      localStorage.setItem('cachedPrefs', JSON.stringify(next));
      authFetch('/preferences', { method: 'POST', body: JSON.stringify({ prefs: next }) })
          .then(r => { if (!r.ok) throw new Error('Server rejected'); })
          .catch(() => { setFunnyMsg('⚠ Pref saved locally but failed to sync to server.'); setTimeout(() => setFunnyMsg(''), 4000); });
  };

  const handleDownload = async () => {
      setProgress(0);
      setDownloading(true);
      setFunnyMsg("Fetching fresh data from the Google gremlins... 👾");
      try {
          const res = await authFetch('/sync', { method: 'POST' });
          const data = await res.json();
          
          if (res.status === 429) {
              setSyncCd(data.remaining || 300);
              throw new Error(data.error || 'Cooldown active');
          }
          if (!res.ok) throw new Error(data.error || 'Sync failed');
          
          setProgress(100);
          setLastSyncDate(new Date(data.lastUpdated).toLocaleString(undefined, { timeZoneName: 'short' }));
          setFunnyMsg("Sync complete! Data updated on the server. ✨");
          // Full page reload after sync to ensure all data is fresh
          setTimeout(() => window.location.reload(), 1500);
      } catch (e: any) {
          setProgress(0);
          setFunnyMsg(e.message || "Sync failed! 💥");
          setTimeout(() => setFunnyMsg(''), 6000);
      } finally {
          setDownloading(false);
      }
  };

  const renderForm = () => {
    if (authState === 'authenticated' && !parsedData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                <div className={`text-5xl mb-6 ${serverOnline ? 'animate-bounce' : 'grayscale opacity-50'}`}>{serverOnline ? '📥' : '📡'}</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{serverOnline ? 'Syncing with Server, Please refresh this page if you are stuck.' : 'Server Offline'}</h3>
                {!serverOnline && <p className="text-xs text-amber-600 font-bold mb-4 uppercase tracking-wider">Working in Offline Mode</p>}
                <div className="flex flex-col gap-2 w-72">
                    <div className={`p-2 rounded-lg border text-xs font-mono flex justify-between ${parsedData ? 'bg-green-50 border-green-200 text-green-700' : (localStorage.getItem('cache_parsedData') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                        <span>Core Data (Cars/Items):</span>
                        <span>{parsedData ? '✓ OK' : (localStorage.getItem('cache_parsedData') ? '✓ Cached' : 'Loading...')}</span>
                    </div>
                    <div className={`p-2 rounded-lg border text-xs font-mono flex justify-between ${Object.keys(templateData).length > 0 ? 'bg-green-50 border-green-200 text-green-700' : (localStorage.getItem('cache_templateData') ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500')}`}>
                        <span>Templates:</span>
                        <span>{Object.keys(templateData).length > 0 ? '✓ OK' : (localStorage.getItem('cache_templateData') ? '✓ Cached' : 'Loading...')}</span>
                    </div>
                </div>
                <p className="mt-8 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                    {serverOnline ? 'Please wait a few seconds' : 'Using previously synced data'}
                </p>
                <button 
                  onClick={() => {
                        const cached = localStorage.getItem('cache_parsedData');
                        if (cached) setParsedData(JSON.parse(cached));
                        else setParsedData({});
                  }} 
                  className="mt-4 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                >
                  {serverOnline ? 'Bypass & Use Cache' : 'Continue with Offline Data'}
                </button>
            </div>
        );
    }

    switch (activeTab) {
      case 'Car Ads': return <CarForm options={carOptions} stateValues={carStateValues} />;
      case 'Items & Clothing': return <ItemsClothingForm itemOptions={itemOptions} clothOptions={clothOptions} prefs={prefs} />;
      case 'House Ads': return <HouseForm />;
      case 'Business Ads': return <BusinessForm />;
      case 'Work Ads': return <WorkForm />;
      case 'Dating Ads': return <DatingForm options={carOptions} />;
      case 'Others': return <OthersForm allItemOptions={[...itemOptions, ...clothOptions]} />;
      case 'Templates': {
          const processedTemplates = extractAllTemplates(templateData);
          return <TemplatesForm templates={processedTemplates} />;
      }
      case 'Rejections': return <RejectionsForm />;
      case 'Manager': return <ManagerForm data={managerData} />;
      default: return <CarForm options={carOptions} stateValues={carStateValues} />;
    }
  };

  // Admin: load config from server
  const loadConfig = async () => {
      try {
          const r = await authFetch('/config');
          const d = await r.json();
          if (d.config) setConfig(d.config);
      } catch {}
  };

  const [configSavingMsg, setConfigSavingMsg] = useState('');
  const saveConfig = async () => {
      setConfigSaving(true);
      setConfigSavingMsg('');
      try {
          const payload = { ...config, last_updated: new Date().toLocaleString(undefined, { timeZoneName: 'short' }) };
          const res = await authFetch('/config', { method: 'POST', body: JSON.stringify(payload) });
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          setConfig(payload);
          setConfigSavingMsg('✓ Settings saved successfully');
          setTimeout(() => setConfigSavingMsg(''), 3000);
      } catch (e: any) {
          setConfigSavingMsg(`❌ Error: ${e.message}`);
      }
      setConfigSaving(false);
  };

  const loadUsers = async () => {
      try {
          const r = await authFetch('/users');
          const d = await r.json();
          if (d.users) setUsersList(d.users);
      } catch {}
  };


  const loadActiveSessions = async () => {
      setSessionsLoading(true);
      try {
          const r = await authFetch('/sessions/active');
          const d = await r.json();
          if (d.sessions) setActiveSessions(d.sessions.sort((a: any, b: any) => b.created - a.created));
      } catch {}
      setSessionsLoading(false);
  };

  const triggerGlobalReload = async () => {
      if (!confirm('This will force EVERY active user to reload their page. Continue?')) return;
      setReloadInFlight(true);
      try {
          const res = await authFetch('/admin/reload-all', { method: 'POST' });
          if (!res.ok) throw new Error('Failed to send reload command');
          alert('🚀 Global reload triggered. All active clients will refresh within 10 seconds.');
      } catch (e: any) { alert(`❌ Error: ${e.message}`); }
      setReloadInFlight(false);
  };

  const addUser = async () => {
      if (!newUserName.trim() || !newUserPin.trim()) { setUsersMsg('Name and PIN required'); return; }
      try {
          const r = await authFetch('/users/add', { method: 'POST', body: JSON.stringify({ name: newUserName, pin: newUserPin }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setNewUserName(''); setNewUserPin(''); setUsersMsg(`✓ ${newUserName} added`);
          loadUsers();
      } catch (e: any) { setUsersMsg(e.message); }
  };

  const deleteUser = async (pin: string) => {
      if (!confirm('Are you sure?')) return;
      try {
          await authFetch('/users/delete', { method: 'POST', body: JSON.stringify({ pin }) });
          loadUsers();
      } catch {}
  };

  const suspendUser = async (pin: string, name: string) => {
      const reason = prompt(`Suspend ${name}? Enter reason (or leave blank):`);
      if (reason === null) return; // cancelled
      try {
          const r = await authFetch('/users/suspend', { method: 'POST', body: JSON.stringify({ pin, reason }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          loadUsers();
      } catch (e: any) { alert(e.message); }
  };

  const unsuspendUser = async (pin: string) => {
      try {
          const r = await authFetch('/users/unsuspend', { method: 'POST', body: JSON.stringify({ pin }) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          loadUsers();
      } catch (e: any) { alert(e.message); }
  };

  const sendReport = async () => {
    if (!reportMsg.trim()) { setReportStatus('Message is required'); return; }
    setReportSaving(true);
    setReportStatus('');
    try {
        const res = await authFetch('/report', { 
            method: 'POST', 
            body: JSON.stringify({ title: reportTitle, message: reportMsg, type: reportType }) 
        });
        if (!res.ok) throw new Error('Failed to send');
        setReportStatus('✓ Report sent! Thank you.');
        setTimeout(() => { setShowReport(false); setReportMsg(''); setReportTitle(''); setReportStatus(''); }, 2000);
    } catch (e: any) {
        setReportStatus(`❌ Error: ${e.message}`);
    }
    setReportSaving(false);
  };

  useEffect(() => {
      if (showSettings && isAdmin) { loadConfig(); loadUsers(); }
  }, [showSettings]);

  // ── Auth Screens ──
  if (authState === 'loading') {
      return (
          <div className="min-h-screen bg-slate-100 flex items-center justify-center">
              <div className="text-center">
                  <h1 className="text-3xl font-extrabold bg-gradient-to-r from-sky-400 to-teal-500 bg-clip-text text-transparent mb-4">LifeInvaider</h1>
                  <p className="text-slate-500 font-mono text-sm animate-pulse">Connecting to auth server...</p>
              </div>
          </div>
      );
  }

  if (authState === 'login') {
      return (
        <>
          {logoutWarning && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <span className="text-2xl">⚠️</span>
                <div>
                    <p className="text-sm font-bold text-amber-800">Session Warning</p>
                    <p className="text-[11px] text-amber-600">{logoutWarning}</p>
                </div>
                <button onClick={() => setLogoutWarning(null)} className="ml-4 text-amber-400 hover:text-amber-600 font-bold">✕</button>
            </div>
          )}
          <LoginScreen 
            onLogin={(token, name, role, suspended, suspendRsn) => { 
                setLogoutWarning(null);
                setUserName(name); 
                setUserRole(role); 
                setIsSuspended(!!suspended);
                setSuspendReason(suspendRsn || '');
                setAuthState('authenticated'); 
            }} 
            onSwitchToRegister={() => setAuthState('register')} 
          />
        </>
      );
  }

  if (authState === 'register') {
      return <RegisterScreen onBack={() => setAuthState('login')} />;
  }
  // ── Suspended User Screen ──
  if (isSuspended) {
      return (
          <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col items-center justify-center p-6">
              <div className="max-w-md w-full text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  </div>
                  <h1 className="text-2xl font-extrabold text-red-400 mb-2">Account Suspended</h1>
                  {suspendReason && (
                      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-6">
                          <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Reason</p>
                          <p className="text-sm text-zinc-300">{suspendReason}</p>
                      </div>
                  )}
                  <p className="text-xs text-zinc-500 mb-6">You can still contact admin via chat or submit a bug report.</p>
                  
                  <div className="flex gap-3 justify-center mb-8">
                      <button onClick={() => setChatOpen(true)} className="px-5 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-sky-400 transition-colors flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          Chat with Admin
                      </button>
                      <button onClick={() => setShowReport(true)} className="px-5 py-2.5 bg-zinc-700 text-zinc-200 rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-zinc-600 transition-colors border border-zinc-600 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Bug Report
                      </button>
                  </div>
                  <button onClick={handleLogout} className="text-xs text-zinc-600 hover:text-zinc-400 font-mono transition-colors">Log Out</button>
              </div>

              {/* Chat Panel for suspended users */}
              {chatOpen && (
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 sm:w-96 rounded-2xl shadow-2xl border bg-zinc-800 border-zinc-600 flex flex-col overflow-hidden animate-in fade-in duration-300" style={{ maxHeight: '70vh' }}>
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-600 bg-zinc-900">
                          <span className="text-sm font-extrabold uppercase tracking-wider text-zinc-100">Chat with Admin</span>
                          <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors">✕</button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '45vh' }}>
                          {chatMessages.length === 0 ? (
                              <div className="p-8 text-center text-zinc-500"><p className="text-sm font-mono">No messages yet. Say hi!</p></div>
                          ) : chatMessages.map((m: any, i: number) => {
                              const isMine = m.from === userName;
                              return (
                                  <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${isMine ? 'bg-sky-500 text-white rounded-br-sm' : 'bg-zinc-700 text-zinc-200 rounded-bl-sm'}`}>
                                          <p className="break-words">{m.text}</p>
                                          <p className={`text-[8px] mt-0.5 ${isMine ? 'text-sky-200' : 'text-zinc-500'}`}>{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                      </div>
                                  </div>
                              );
                          })}
                          <div ref={chatEndRef} />
                      </div>
                      <div className="flex gap-2 p-3 border-t border-zinc-600">
                          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }} placeholder="Type a message..." className="flex-1 px-3 py-2 rounded-xl text-sm outline-none border bg-zinc-700 border-zinc-600 text-zinc-100 placeholder:text-zinc-500" />
                          <button onClick={sendChat} disabled={chatSending || !chatInput.trim()} className="px-3 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                          </button>
                      </div>
                  </div>
              )}

              {/* Bug Report Modal for suspended users */}
              {showReport && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-zinc-800 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-600">
                          <div className="flex justify-between items-center mb-4">
                              <h2 className="text-lg font-extrabold text-zinc-100 uppercase tracking-widest">Bug Report</h2>
                              <button onClick={() => setShowReport(false)} className="text-zinc-400 hover:text-red-500 font-bold text-lg">✕</button>
                          </div>
                          <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="Title (optional)" className="w-full bg-zinc-700 border border-zinc-600 p-3 rounded-xl text-zinc-100 outline-none mb-3 text-sm" />
                          <textarea value={reportMsg} onChange={e => setReportMsg(e.target.value)} placeholder="Describe the issue..." className="w-full bg-zinc-700 border border-zinc-600 p-3 rounded-xl text-zinc-100 outline-none text-sm h-24 resize-none mb-3" />
                          {reportStatus && <p className="text-xs text-amber-400 mb-2">{reportStatus}</p>}
                          <button onClick={sendReport} disabled={reportSaving} className="w-full py-2.5 bg-sky-500 text-white rounded-xl font-bold uppercase text-sm hover:bg-sky-400 transition-colors disabled:opacity-50">
                              {reportSaving ? 'Sending...' : 'Send Report'}
                          </button>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // ── Authenticated App ──
  return (
    <div className={`min-h-screen p-4 sm:p-6 lg:p-8 flex flex-col items-center relative transition-colors duration-300 ${prefs.darkMode ? 'dark-mode bg-zinc-900 text-zinc-100' : 'bg-slate-100 text-slate-800'}`}>

      {/* Sync reminder notification */}
      {syncReminderVisible && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${prefs.darkMode ? 'bg-zinc-800 border-amber-600/50' : 'bg-white border-amber-300'}`}>
                  <span className="text-lg">⏰</span>
                  <p className={`text-sm font-medium ${prefs.darkMode ? 'text-zinc-200' : 'text-slate-700'}`}>
                      Database has not been updated since <span className="font-bold text-amber-500">{syncAgoText}</span>. Press <span className="font-bold text-sky-500">⟳ Sync DB</span> to refresh.
                  </p>
                  <button onClick={() => setSyncReminderDismissed(true)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors ml-2">✕</button>
              </div>
          </div>
      )}
      
      {/* Offline Banner */}
      {isOffline && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[101] animate-in fade-in slide-in-from-top-4 duration-300">
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${prefs.darkMode ? 'bg-red-900/90 border-red-700' : 'bg-red-50 border-red-300'}`}>
                  <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01M8.464 8.464a5 5 0 010 7.072M15.536 8.464a5 5 0 000 7.072" /><line x1="1" y1="1" x2="23" y2="23" strokeWidth="2" /></svg>
                  <p className={`text-sm font-bold ${prefs.darkMode ? 'text-red-200' : 'text-red-800'}`}>You are offline</p>
                  <span className={`text-[10px] font-mono ${prefs.darkMode ? 'text-red-300' : 'text-red-600'}`}>Using cached data</span>
                  <button onClick={() => window.location.reload()} className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-red-500 text-white hover:bg-red-400 transition-colors ml-1">Retry</button>
              </div>
          </div>
      )}

      {/* Version Mismatch Banner */}
      {versionMismatch && (
          <div className={`fixed z-[101] animate-in fade-in slide-in-from-top-4 duration-300 ${isOffline ? 'top-20' : 'top-4'} left-1/2 -translate-x-1/2`}>
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${prefs.darkMode ? 'bg-amber-900/90 border-amber-700' : 'bg-amber-50 border-amber-300'}`}>
                  <span className="text-lg">⚠️</span>
                  <div>
                      <p className={`text-sm font-bold ${prefs.darkMode ? 'text-amber-200' : 'text-amber-800'}`}>Version Mismatch</p>
                      <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-amber-300' : 'text-amber-600'}`}>{versionMismatch}</p>
                  </div>
                  <span className={`text-[9px] font-mono ${prefs.darkMode ? 'text-amber-400' : 'text-amber-600'}`}>Using cache</span>
                  <button onClick={() => setShowReport(true)} className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase bg-amber-500 text-white hover:bg-amber-400 transition-colors ml-1">Report</button>
              </div>
          </div>
      )}

      {/* Maintenance Banner */}
      {maintenanceMode && !maintenanceDismissed && (
          <div className={`fixed z-[102] animate-in fade-in slide-in-from-top-4 duration-300 ${isOffline || versionMismatch ? 'top-20' : 'top-4'} left-1/2 -translate-x-1/2`}>
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${prefs.darkMode ? 'bg-orange-900/90 border-orange-700' : 'bg-orange-50 border-orange-300'}`}>
                  <span className="text-lg">🔧</span>
                  <div>
                      <p className={`text-sm font-bold ${prefs.darkMode ? 'text-orange-200' : 'text-orange-800'}`}>Server Maintenance</p>
                      <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-orange-300' : 'text-orange-600'}`}>Working from cached data. Some features may be limited.</p>
                  </div>
                  <button onClick={() => setMaintenanceDismissed(true)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors ml-2">✕</button>
              </div>
          </div>
      )}

      {/* Global Alert Banner */}
      {globalAlert && !alertDismissed && (
          <div className={`fixed z-[103] animate-in fade-in slide-in-from-top-4 duration-300 top-4 left-1/2 -translate-x-1/2 max-w-lg w-[calc(100%-2rem)]`}>
              <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${
                  globalAlert.type === 'success' ? (prefs.darkMode ? 'bg-emerald-900/90 border-emerald-700' : 'bg-emerald-50 border-emerald-300') :
                  globalAlert.type === 'danger' ? (prefs.darkMode ? 'bg-red-900/90 border-red-700' : 'bg-red-50 border-red-300') :
                  globalAlert.type === 'warning' ? (prefs.darkMode ? 'bg-amber-900/90 border-amber-700' : 'bg-amber-50 border-amber-300') :
                  (prefs.darkMode ? 'bg-sky-900/90 border-sky-700' : 'bg-sky-50 border-sky-300')
              }`}>
                  <span className="text-lg shrink-0">{globalAlert.type === 'success' ? '✅' : globalAlert.type === 'danger' ? '🚨' : globalAlert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                  <p className={`text-sm font-medium flex-1 ${
                      globalAlert.type === 'success' ? (prefs.darkMode ? 'text-emerald-200' : 'text-emerald-800') :
                      globalAlert.type === 'danger' ? (prefs.darkMode ? 'text-red-200' : 'text-red-800') :
                      globalAlert.type === 'warning' ? (prefs.darkMode ? 'text-amber-200' : 'text-amber-800') :
                      (prefs.darkMode ? 'text-sky-200' : 'text-sky-800')
                  }`}>{globalAlert.message}</p>
                  <button onClick={() => setAlertDismissed(true)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors shrink-0">✕</button>
              </div>
          </div>
      )}

      {/* Admin Settings Modal */}
      {showSettings && isAdmin && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-300 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-extrabold text-slate-800 uppercase tracking-widest">Admin Panel</h2>
                      <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">✕</button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-4 border border-slate-300">
                      <button onClick={() => setSettingsTab('config')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${settingsTab === 'config' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Configuration</button>
                      <button onClick={() => setSettingsTab('users')} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${settingsTab === 'users' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Users</button>
                      <button onClick={() => { setSettingsTab('sessions'); loadActiveSessions(); }} className={`flex-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${settingsTab === 'sessions' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sessions</button>
                  </div>

                  {settingsTab === 'config' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                          <div>
                              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Policy Doc URL</label>
                              <input type="text" value={config.doc1_url} onChange={e => setConfig({...config, doc1_url: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-2 text-xs font-mono rounded-md text-slate-800 outline-none focus:border-sky-500" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Templates Sheet URL</label>
                              <input type="text" value={config.templates_url} onChange={e => setConfig({...config, templates_url: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-2 text-xs font-mono rounded-md text-slate-800 outline-none focus:border-sky-500" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Cars/Items Sheet URL</label>
                              <input type="text" value={config.cars_url} onChange={e => setConfig({...config, cars_url: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-2 text-xs font-mono rounded-md text-slate-800 outline-none focus:border-sky-500" />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-600 uppercase mb-1 block">Manager Prices Sheet URL</label>
                              <input type="text" value={config.manager_url} onChange={e => setConfig({...config, manager_url: e.target.value})} className="w-full bg-slate-50 border border-slate-300 p-2 text-xs font-mono rounded-md text-slate-800 outline-none focus:border-sky-500" />
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono text-right">Last: {config.last_updated}</p>
                          {configSavingMsg && <p className={`text-[10px] font-mono text-center ${configSavingMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{configSavingMsg}</p>}
                          <button onClick={saveConfig} disabled={configSaving} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg uppercase tracking-widest transition-colors disabled:opacity-50">
                              {configSaving ? 'Saving...' : 'Save Configuration'}
                          </button>
                      </div>
                  )}

                  {settingsTab === 'users' && (
                      <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                          {/* Add User */}
                          <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Name</label>
                                  <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Username" className="w-full bg-slate-50 border border-slate-300 p-2 text-sm rounded-md text-slate-800 outline-none focus:border-sky-500" />
                              </div>
                              <div className="w-24">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">PIN</label>
                                  <input type="text" value={newUserPin} onChange={e => setNewUserPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 digits" maxLength={4} className="w-full bg-slate-50 border border-slate-300 p-2 text-sm rounded-md text-slate-800 outline-none focus:border-sky-500 font-mono text-center" />
                              </div>
                              <button onClick={addUser} className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-md text-xs font-bold uppercase transition-colors">Add</button>
                          </div>
                          {usersMsg && <p className={`text-xs font-mono ${usersMsg.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{usersMsg}</p>}
                          
                          {/* Users List */}
                          <div className="border-t border-slate-200 pt-3 mt-1">
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-wider">Registered Users ({usersList.length})</p>
                              <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto">
                                  {usersList.map(u => (
                                      <div key={u.pin} className={`flex items-center justify-between border rounded-lg px-3 py-2 ${u.suspended ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                          <div className="flex-1 min-w-0">
                                              <span className="text-sm font-bold text-slate-800">{u.name}</span>
                                              <span className="text-[10px] text-slate-400 font-mono ml-2">PIN: {u.pin}</span>
                                              {u.role === 'admin' && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold uppercase px-1.5 py-0.5 rounded ml-2">Admin</span>}
                                              {u.suspended && <span className="text-[9px] bg-red-100 text-red-600 font-bold uppercase px-1.5 py-0.5 rounded ml-2" title={u.suspendReason || 'No reason'}>⛔ Suspended</span>}
                                              {u.previousLocation && u.currentLocation && u.previousLocation !== u.currentLocation && (
                                                  <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded ml-2" title={`Previous: ${u.previousLocation}\nCurrent: ${u.currentLocation}`}>⚠️ Location Changed</span>
                                              )}
                                              {u.suspended && u.suspendReason && <p className="text-[9px] text-red-400 font-mono mt-0.5 truncate">Reason: {u.suspendReason}</p>}
                                              {u.currentLocation && (
                                                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                      📍 {u.currentLocation}
                                                      {u.previousLocation && u.previousLocation !== u.currentLocation && (
                                                          <span className="text-amber-500 ml-1">← was: {u.previousLocation}</span>
                                                      )}
                                                      {u.lastLoginIP && <span className="text-slate-300 ml-1">({u.lastLoginIP})</span>}
                                                  </p>
                                              )}
                                          </div>
                                          {u.role !== 'admin' && (
                                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                  {u.suspended ? (
                                                      <button onClick={() => unsuspendUser(u.pin)} className="text-emerald-500 hover:text-emerald-600 text-[10px] font-bold transition-colors">Unsuspend</button>
                                                  ) : (
                                                      <button onClick={() => suspendUser(u.pin, u.name)} className="text-amber-500 hover:text-amber-600 text-[10px] font-bold transition-colors">Suspend</button>
                                                  )}
                                                  <button onClick={() => deleteUser(u.pin)} className="text-red-400 hover:text-red-600 text-[10px] font-bold transition-colors">Remove</button>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}

                  {settingsTab === 'sessions' && (
                      <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                          {/* Maintenance Mode Toggle */}
                          <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm">
                              <div>
                                  <p className="text-xs font-bold text-orange-800 uppercase tracking-wider">🔧 Maintenance Mode</p>
                                  <p className="text-[10px] text-orange-600 font-mono">Registration, sync & data retrieval disabled</p>
                              </div>
                              <div 
                                  className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${maintenanceMode ? 'bg-orange-500' : 'bg-slate-300'}`} 
                                  onClick={async () => {
                                      try {
                                          const r = await authFetch('/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled: !maintenanceMode }) });
                                          const d = await r.json();
                                          if (d.success) setMaintenanceMode(d.maintenance);
                                      } catch { alert('Failed to toggle maintenance mode'); }
                                  }}
                              >
                                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${maintenanceMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                              </div>
                          </div>

                          {/* Admin Alert Broadcast */}
                          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 shadow-sm">
                              <p className="text-xs font-bold text-sky-800 uppercase tracking-wider mb-2">📢 Broadcast Alert</p>
                              <div className="flex gap-1 mb-2">
                                  {['info', 'success', 'warning', 'danger'].map(t => (
                                      <button key={t} onClick={() => setAdminAlertType(t)} className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-colors border ${
                                          adminAlertType === t 
                                              ? (t === 'success' ? 'bg-emerald-500 text-white border-emerald-600' : t === 'danger' ? 'bg-red-500 text-white border-red-600' : t === 'warning' ? 'bg-amber-500 text-white border-amber-600' : 'bg-sky-500 text-white border-sky-600')
                                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                      }`}>{t}</button>
                                  ))}
                              </div>
                              <input type="text" value={adminAlertMsg} onChange={e => setAdminAlertMsg(e.target.value)} placeholder="Alert message for all users..." className="w-full bg-white border border-slate-300 p-2 text-sm rounded-lg outline-none focus:border-sky-500 mb-2" />
                              <div className="flex gap-2">
                                  <button 
                                      onClick={async () => {
                                          if (!adminAlertMsg.trim()) return;
                                          setAdminAlertSending(true);
                                          try {
                                              const r = await authFetch('/admin/alert', { method: 'POST', body: JSON.stringify({ type: adminAlertType, message: adminAlertMsg.trim() }) });
                                              const d = await r.json();
                                              if (d.success) { setGlobalAlert(d.alert); setAlertDismissed(false); setAdminAlertMsg(''); }
                                          } catch { alert('Failed to send alert'); }
                                          setAdminAlertSending(false);
                                      }}
                                      disabled={adminAlertSending || !adminAlertMsg.trim()}
                                      className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2 rounded-lg text-[10px] font-bold uppercase transition-all"
                                  >{adminAlertSending ? 'Sending...' : '📢 Send Alert'}</button>
                                  {globalAlert && (
                                      <button 
                                          onClick={async () => {
                                              try {
                                                  const r = await authFetch('/admin/alert', { method: 'POST', body: JSON.stringify({ clear: true }) });
                                                  const d = await r.json();
                                                  if (d.success) setGlobalAlert(null);
                                              } catch { alert('Failed to clear alert'); }
                                          }}
                                          className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all"
                                      >✕ Clear</button>
                                  )}
                              </div>
                              {globalAlert && (
                                  <p className="text-[9px] text-slate-500 font-mono mt-2">Active: [{globalAlert.type}] {globalAlert.message}</p>
                              )}
                          </div>

                          <div className="flex justify-between items-center bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                              <div>
                                  <p className="text-xs font-bold text-red-800 uppercase tracking-wider">Emergency Protocol</p>
                                  <p className="text-[10px] text-red-600 font-mono">Force all active browsers to refresh</p>
                              </div>
                              <button 
                                  onClick={triggerGlobalReload} 
                                  disabled={reloadInFlight}
                                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-md"
                              >
                                  {reloadInFlight ? 'Sending...' : '⚡ Reload All'}
                              </button>
                          </div>

                          <div className="flex justify-between items-center bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                              <div>
                                  <p className="text-sm font-bold text-amber-800">🔒 Force Logout All</p>
                                  <p className="text-[10px] text-amber-600 font-mono">Log out every user except you</p>
                              </div>
                              <button 
                                  onClick={async () => {
                                      if (!confirm('Log out ALL users (except you)?')) return;
                                      try {
                                          const r = await authFetch('/admin/logout-all', { method: 'POST' });
                                          const d = await r.json();
                                          alert(d.message || 'Done');
                                          loadActiveSessions();
                                      } catch { alert('Failed'); }
                                  }}
                                  className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-md"
                              >
                                  🔒 Logout All
                              </button>
                          </div>

                          <div className="border-t border-slate-200 pt-3">
                              <div className="flex justify-between items-end mb-3">
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Sessions ({activeSessions.length})</p>
                                  <button onClick={loadActiveSessions} disabled={sessionsLoading} className="text-sky-500 hover:text-sky-600 text-[10px] font-bold uppercase transition-all">
                                      {sessionsLoading ? 'Refreshing...' : '🔄 Refresh List'}
                                  </button>
                              </div>

                              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                                  {activeSessions.length === 0 ? (
                                      <p className="text-center py-10 text-slate-400 text-xs font-mono uppercase tracking-widest">No active sessions found</p>
                                  ) : (
                                      activeSessions.map((s, idx) => (
                                          <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:border-slate-300 transition-all">
                                              <div className="flex flex-col">
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-sm font-extrabold text-slate-800">{s.name}</span>
                                                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${s.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                          {s.role}
                                                      </span>
                                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                  </div>
                                                  <div className="flex gap-3 mt-0.5">
                                                      <span className="text-[9px] text-slate-400 font-mono">IP: {s.ip}</span>
                                                      <span className="text-[9px] text-slate-400 font-mono">Since: {new Date(s.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                  </div>
                                              </div>
                                              <div className="text-slate-300 text-lg">👤</div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      </div>
                  )}
               </div>
          </div>
      )}

      {/* Bug Report Modal */}
      {showReport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-300 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                      <h2 className="text-lg font-extrabold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                          <span className="text-2xl">🛠️</span> Bug Report
                      </h2>
                      <button onClick={() => setShowReport(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl transition-colors">✕</button>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Issue Type</label>
                          <div className="flex gap-2">
                              {['feedback', 'critical'].map(t => (
                                  <button key={t} onClick={() => setReportType(t)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${reportType === t ? 'bg-sky-500 text-white border-sky-600 shadow-md' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Title (Optional)</label>
                          <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="What's wrong?" className="w-full bg-slate-50 border border-slate-200 p-2 text-sm rounded-lg outline-none focus:border-sky-500 transition-all" />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Detailed Message</label>
                          <textarea value={reportMsg} onChange={e => setReportMsg(e.target.value)} rows={4} placeholder="Describe the bug..." className="w-full bg-slate-50 border border-slate-200 p-2 text-sm rounded-lg outline-none focus:border-sky-500 transition-all resize-none" />
                      </div>
                  </div>

                  {reportStatus && <p className={`text-[10px] font-bold text-center animate-pulse ${reportStatus.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>{reportStatus}</p>}

                  <button 
                      onClick={sendReport} 
                      disabled={reportSaving || !reportMsg.trim()} 
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg"
                  >
                      {reportSaving ? 'Submitting...' : 'Send Report'}
                  </button>
              </div>
          </div>
      )}

      {/* Preferences Modal */}
      {showPrefs && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
              <div className={`p-6 rounded-2xl shadow-2xl w-full max-w-sm border flex flex-col gap-5 ${prefs.darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}`}>
                  <div className="flex justify-between items-center">
                      <h2 className={`text-lg font-extrabold uppercase tracking-widest flex items-center gap-2 ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>
                          ⚙ Preferences
                      </h2>
                      <button onClick={() => setShowPrefs(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl transition-colors">✕</button>
                  </div>

                  <div className="flex flex-col gap-3">
                      {/* Auto-Each */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Auto-Each</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Auto-enable &quot;each&quot; when qty &gt; 1</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.autoEach ? 'bg-sky-500' : (prefs.darkMode ? 'bg-zinc-600' : 'bg-slate-300')}`} onClick={() => updatePref('autoEach', !prefs.autoEach)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.autoEach ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>

                      {/* Auto-S */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Auto-S</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Auto-enable plural (+S) when qty &gt; 1</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.autoS ? 'bg-sky-500' : (prefs.darkMode ? 'bg-zinc-600' : 'bg-slate-300')}`} onClick={() => updatePref('autoS', !prefs.autoS)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.autoS ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>

                      {/* Default +S */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Default +S</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>New items start with plural (+S) on</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.defaultS ? 'bg-sky-500' : (prefs.darkMode ? 'bg-zinc-600' : 'bg-slate-300')}`} onClick={() => updatePref('defaultS', !prefs.defaultS)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.defaultS ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>

                      {/* Bulk Auto S+Each */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Bulk Auto S+Each</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Auto-enable +S &amp; each when &quot;in bulk&quot;</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.autoBulkSEach ? 'bg-sky-500' : (prefs.darkMode ? 'bg-zinc-600' : 'bg-slate-300')}`} onClick={() => updatePref('autoBulkSEach', !prefs.autoBulkSEach)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.autoBulkSEach ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>

                      {/* Dark Mode */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Dark Mode</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Switch to dark background</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.darkMode ? 'bg-sky-500' : 'bg-slate-300'}`} onClick={() => updatePref('darkMode', !prefs.darkMode)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.darkMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>

                      {/* Sidebar Mode */}
                      <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 hover:border-zinc-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                          <div>
                              <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>Sidebar Tabs</p>
                              <p className={`text-[10px] font-mono ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>Move tabs to a left sidebar</p>
                          </div>
                          <div className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${prefs.sidebarMode ? 'bg-sky-500' : (prefs.darkMode ? 'bg-zinc-600' : 'bg-slate-300')}`} onClick={() => updatePref('sidebarMode', !prefs.sidebarMode)}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.sidebarMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                          </div>
                      </label>
                  </div>

                  <p className={`text-[9px] font-mono text-center ${prefs.darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>Preferences sync across devices via your account.</p>
              </div>
          </div>
      )}

      {/* Server Ping Banner */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${!serverOnline ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]' : versionMismatch ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'} animate-pulse`} />
              <span className="text-[10px] font-mono text-slate-500">
                  {!serverOnline ? 'Server Offline' : versionMismatch ? 'Version Mismatch' : 'Server Online'}
                  {serverPing !== null && <span className={`ml-1 font-bold ${serverPing < 100 ? 'text-green-600' : serverPing < 300 ? 'text-amber-600' : 'text-red-600'}`}>{serverPing}ms</span>}
              </span>
          </div>
      </div>

      <header className="w-full max-w-4xl mb-6 border-b border-slate-400 pb-6 relative flex justify-between items-start">
        <div className="flex-1 text-left">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-sky-400 to-teal-500 bg-clip-text text-transparent inline-block" style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}>
            LifeInvaider
            </h1>
            <p className="text-slate-600 mt-1 font-mono text-[10px] tracking-[0.2em] uppercase font-bold">Manual Advertisement Generator</p>
            {getCEO() && (
                <p className="text-sky-600 mt-1 font-mono text-[10px] tracking-tight font-bold">
                    Current Chief Executive Officer: <span className="text-teal-600 underline decoration-sky-300 underline-offset-2">{getCEO()}</span>
                </p>
            )}
        </div>
        
        <div className="absolute right-0 top-0 flex flex-col items-end z-20">
            <div className="flex items-center gap-2">
                {/* User badge */}
                <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-300 shadow-sm transition-all hover:bg-white uppercase tracking-wider font-bold">
                    Welcome, {userName} {isAdmin && '⭐'}
                </span>
                <button onClick={handleLogout} title="Logout" className="bg-slate-100 border border-slate-400 hover:border-red-400 hover:bg-red-50 text-slate-500 hover:text-red-500 px-2 py-1.5 rounded-lg text-xs font-bold transition-all">
                    ↪ Out
                </button>

                <button onClick={() => setShowReport(true)} title="Report a Bug" className={`border hover:border-amber-500 hover:bg-amber-50 hover:text-amber-500 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${prefs.darkMode ? 'bg-zinc-800 border-zinc-600 text-zinc-400' : 'bg-slate-100 border-slate-400 text-slate-500'}`}>
                    🛠️ Bug
                </button>

                <button onClick={() => setShowPrefs(true)} title="Preferences" className={`border hover:border-purple-500 hover:bg-purple-50 hover:text-purple-500 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${prefs.darkMode ? 'bg-zinc-800 border-zinc-600 text-zinc-400' : 'bg-slate-100 border-slate-400 text-slate-500'}`}>
                    ⚙ Prefs
                </button>
                
                <button 
                    onClick={handleDownload} 
                    disabled={downloading || progress === 100 || (!isAdmin && syncCd > 0)} 
                    className="bg-slate-100 border border-slate-400 hover:border-sky-500 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl relative overflow-hidden"
                >
                    <div className="relative z-10">
                        {downloading ? `Syncing ${Math.round(progress)}%...` : ((!isAdmin && syncCd > 0) ? `Wait ${syncCd}s` : '⟳ Sync DB')}
                    </div>
                </button>

                {isAdmin && (
                    <>
                        <button onClick={() => setShowSettings(true)} title="Admin Panel" className="bg-slate-100 border border-slate-400 hover:border-sky-500 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-lg transition-all shadow-sm">
                            ⚙️
                        </button>
                    </>
                )}
            </div>
            {lastSyncDate && <p className="text-slate-500 text-[10px] mt-1.5 font-mono font-bold tracking-wider">LATEST DB: {lastSyncDate}</p>}
            {funnyMsg && <p className={`text-[10px] mt-1 max-w-[250px] text-right font-mono animate-in slide-in-from-top-2 ${funnyMsg.includes('Failed') || funnyMsg.includes('offline') ? 'text-red-600 font-bold' : 'text-sky-600'}`}>{funnyMsg}</p>}
        </div>
      </header>
      
      {/* Progress Bar */}
      {(progress > 0 && progress <= 100) && (
          <div className="w-full max-w-4xl mb-4 bg-slate-200 rounded-full h-3 overflow-hidden border border-slate-300 relative shadow-inner animate-in fade-in slide-in-from-top-2">
              <div 
                  className={`h-full transition-all duration-300 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-sky-400 to-teal-500'}`}
                  style={{ width: `${progress}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-800 tracking-widest drop-shadow-md">
                  {Math.round(progress)}%
              </span>
          </div>
      )}
      <main className={`w-full ${prefs.sidebarMode ? 'max-w-6xl' : 'max-w-4xl'} bg-slate-100/50 backdrop-blur-md border border-slate-300/80 rounded-2xl shadow-2xl overflow-hidden shadow-sky-900/10 mt-4`}>
        {prefs.sidebarMode ? (
          <div className="flex min-h-[600px]">
            <div className="w-48 shrink-0 border-r border-slate-400 bg-slate-50/80 overflow-y-auto custom-scrollbar flex flex-col py-2">
              {CATEGORIES.map(category => (
                <button key={category} onClick={() => setActiveTab(category)} className={`px-4 py-3 text-left font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all ${activeTab === category ? 'text-sky-400 border-l-2 border-sky-400 bg-sky-500/5' : 'text-slate-600 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  {category}
                </button>
              ))}
            </div>
            <div className="flex-1 p-8 overflow-y-auto">
                {renderForm()}
            </div>
          </div>
        ) : (
          <>
            <div className="flex border-b border-slate-400 bg-slate-50/80 overflow-x-auto custom-scrollbar">
              {CATEGORIES.map(category => (
                <button key={category} onClick={() => setActiveTab(category)} className={`px-6 py-4 font-bold text-sm uppercase tracking-wider whitespace-nowrap transition-all flex-1 ${activeTab === category ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/5' : 'text-slate-600 hover:text-slate-700 hover:bg-slate-200/50'}`}>
                  {category}
                </button>
              ))}
            </div>
            <div className="p-8">
                {renderForm()}
            </div>
          </>
        )}
      </main>

      {/* Chat Toggle Button */}
      <button
          onClick={() => { setChatOpen(!chatOpen); if (!chatOpen) setChatUnread(0); }}
          className={`fixed left-4 bottom-4 z-40 w-12 h-12 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${chatOpen ? 'bg-sky-500 text-white scale-110' : (prefs.darkMode ? 'bg-zinc-700 text-zinc-200 hover:bg-zinc-600' : 'bg-slate-800 text-white hover:bg-slate-700')}`}
          title="Messages"
      >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {chatUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">{chatUnread}</span>
          )}
      </button>

      {/* Chat Panel */}
      {chatOpen && (
          <div className={`fixed left-4 bottom-20 z-40 w-80 sm:w-96 rounded-2xl shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300 ${prefs.darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}`} style={{ maxHeight: '70vh' }}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${prefs.darkMode ? 'border-zinc-600 bg-zinc-900' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center gap-2">
                      {isAdmin && chatSelectedUser && (
                          <button onClick={() => { setChatSelectedUser(null); setChatMessages([]); }} className="text-sky-500 hover:text-sky-400 mr-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          </button>
                      )}
                      <span className={`text-sm font-extrabold uppercase tracking-wider ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>
                          {isAdmin ? (chatSelectedUser || 'Messages') : 'Chat with Admin'}
                      </span>
                  </div>
                  <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors">✕</button>
              </div>

              {/* Body */}
              {isAdmin && !chatSelectedUser ? (
                  /* Admin: User List + New Message */
                  <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ maxHeight: '50vh' }}>
                      {/* New Message: show all registered non-admin users */}
                      {(() => {
                          const existingNames = new Set(chatUsers.map((u: any) => u.name));
                          const allNonAdmin = usersList.filter((u: any) => u.role !== 'admin');
                          const combined = [
                              ...chatUsers,
                              ...allNonAdmin.filter((u: any) => !existingNames.has(u.name)).map((u: any) => ({ name: u.name, unread: 0, lastMessage: '', lastTs: 0, isNew: true }))
                          ];
                          if (combined.length === 0) return (
                              <div className={`p-8 text-center ${prefs.darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                                  <p className="text-sm font-mono">No users available</p>
                              </div>
                          );
                          return combined.map((u: any) => (
                              <button key={u.name} onClick={() => setChatSelectedUser(u.name)} className={`w-full text-left px-4 py-3 border-b transition-colors flex items-center gap-3 ${prefs.darkMode ? 'border-zinc-700 hover:bg-zinc-700' : 'border-slate-100 hover:bg-slate-50'}`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${prefs.darkMode ? 'bg-sky-900 text-sky-300' : 'bg-sky-100 text-sky-600'}`}>
                                      {u.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="flex justify-between items-center">
                                          <span className={`text-sm font-bold truncate ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>{u.name}</span>
                                          <div className="flex items-center gap-1">
                                              {u.isNew && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${prefs.darkMode ? 'bg-emerald-900 text-emerald-300' : 'bg-emerald-100 text-emerald-600'}`}>NEW</span>}
                                              {u.unread > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{u.unread}</span>}
                                          </div>
                                      </div>
                                      <p className={`text-[10px] truncate font-mono ${prefs.darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>{u.lastMessage || (u.isNew ? 'Start a conversation' : 'No messages')}</p>
                                  </div>
                              </button>
                          ));
                      })()}
                  </div>
              ) : (
                  /* Message Thread */
                  <>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2" style={{ maxHeight: '45vh' }}>
                          {chatMessages.length === 0 ? (
                              <div className={`p-8 text-center ${prefs.darkMode ? 'text-zinc-500' : 'text-slate-400'}`}>
                                  <p className="text-sm font-mono">No messages yet. Say hi!</p>
                              </div>
                          ) : chatMessages.map((m: any, i: number) => {
                              const isMine = m.from === (isAdmin ? 'Admin' : userName);
                              return (
                                  <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${isMine ? 'bg-sky-500 text-white rounded-br-sm' : (prefs.darkMode ? 'bg-zinc-700 text-zinc-200 rounded-bl-sm' : 'bg-slate-200 text-slate-800 rounded-bl-sm')}`}>
                                          <p className="break-words">{m.text}</p>
                                          <p className={`text-[8px] mt-0.5 flex items-center gap-1 ${isMine ? 'text-sky-200' : (prefs.darkMode ? 'text-zinc-500' : 'text-slate-400')}`}>
                                              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              {isAdmin && isMine && (
                                                  <span className={`ml-0.5 ${m.read ? 'text-sky-100' : 'text-sky-300/50'}`} title={m.read ? 'Seen' : 'Delivered'}>
                                                      {m.read ? '✓✓' : '✓'}
                                                  </span>
                                              )}
                                          </p>
                                      </div>
                                  </div>
                              );
                          })}
                          <div ref={chatEndRef} />
                      </div>
                      {/* Input */}
                      <div className={`flex gap-2 p-3 border-t ${prefs.darkMode ? 'border-zinc-600' : 'border-slate-200'}`}>
                          <input
                              type="text"
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                              placeholder="Type a message..."
                              className={`flex-1 px-3 py-2 rounded-xl text-sm outline-none border ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 text-zinc-100 placeholder:text-zinc-500' : 'bg-slate-100 border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                          />
                          <button onClick={sendChat} disabled={chatSending || !chatInput.trim()} className="px-3 py-2 bg-sky-500 text-white rounded-xl hover:bg-sky-400 transition-colors disabled:opacity-50">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                          </button>
                      </div>
                  </>
              )}
          </div>
      )}

      {/* Notes Toggle Button */}
      <button
          onClick={() => setNotesOpen(!notesOpen)}
          className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 px-1.5 py-4 rounded-l-lg shadow-lg transition-all duration-300 ${notesOpen ? 'bg-sky-500 text-white translate-x-0' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          title="Toggle Notes"
      >
          <span className="text-[10px] font-bold uppercase tracking-widest">📝 Notes</span>
      </button>

      {/* Notes Panel */}
      <div className={`fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-300 shadow-2xl z-30 transition-transform duration-300 ease-in-out flex flex-col ${notesOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">📝 My Notes</span>
                  {notesSaving && <span className="text-[9px] text-sky-500 font-mono animate-pulse">Saving...</span>}
                  {!notesSaving && notesLoaded && <span className="text-[9px] text-green-500 font-mono">✓ Saved</span>}
              </div>
              <button onClick={() => setNotesOpen(false)} className="text-slate-400 hover:text-red-500 font-bold text-lg transition-colors">✕</button>
          </div>
          <textarea
              value={notesContent}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="Paste recurring ads, notes, reminders here...&#10;&#10;Auto-saves as you type."
              className="flex-1 p-4 text-sm text-slate-800 font-mono resize-none outline-none bg-white placeholder:text-slate-400"
              spellCheck={false}
          />
          <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
              <p className="text-[9px] text-slate-400 font-mono text-center">Your notes are saved per account and sync across devices.</p>
          </div>
      </div>

      {/* Powered by Detriot Cloud Footer */}
      <footer className="w-full flex justify-center py-4 mt-8">
          <a
              href="https://detriot.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-5 py-2 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-105"
              style={{
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.05) inset',
              }}
          >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60 group-hover:opacity-100 transition-opacity duration-300">
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" fill="url(#cloud-grad)" />
                  <defs>
                      <linearGradient id="cloud-grad" x1="0" y1="4" x2="24" y2="20" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#38BDF8" />
                          <stop offset="1" stopColor="#818CF8" />
                      </linearGradient>
                  </defs>
              </svg>
              <span className="text-[11px] font-semibold tracking-wide" style={{
                  background: 'linear-gradient(90deg, #94A3B8, #E2E8F0)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
              }}>
                  Powered by
              </span>
              <span className="text-[11px] font-extrabold tracking-wide" style={{
                  background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
              }}>
                  Detriot Cloud
              </span>
          </a>
      </footer>

      {/* Cookie Consent Banner */}
      {cookieConsent === null && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className={`max-w-2xl mx-auto rounded-2xl shadow-2xl border p-5 flex flex-col sm:flex-row items-center gap-4 ${prefs.darkMode ? 'bg-zinc-800 border-zinc-600' : 'bg-white border-slate-300'}`}>
                  <div className="flex-1">
                      <p className={`text-sm font-bold ${prefs.darkMode ? 'text-zinc-100' : 'text-slate-800'}`}>🍪 Cookie Notice</p>
                      <p className={`text-[11px] mt-1 ${prefs.darkMode ? 'text-zinc-400' : 'text-slate-500'}`}>We use cookies and localStorage to save your preferences, session, and notes.</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => { setCookieConsent('rejected'); localStorage.setItem('cookieConsent', 'rejected'); }} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${prefs.darkMode ? 'bg-zinc-700 border-zinc-600 text-zinc-300 hover:bg-zinc-600' : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'}`}>
                          Reject
                      </button>
                      <button onClick={() => { setCookieConsent('accepted'); localStorage.setItem('cookieConsent', 'accepted'); }} className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-sky-500 text-white hover:bg-sky-400 transition-all shadow-lg">
                          Accept
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
