const fs = require('fs');

const pageFile = 'web/src/app/page.tsx';
let content = fs.readFileSync(pageFile, 'utf8');

// 1. Replace ItemsForm block entirely
const itemsFormRegex = /\/\/ ------------- ITEMS -------------\s+function ItemsForm\(\) \{[\s\S]*?(?=\/\/ ------------- HOUSE -------------)/;

const newItemsForm = `// ------------- ITEMS -------------
function ItemsForm() {
    const [items, setItems] = useState([{ name: '', qty: '1', color: '', price: '', addS: false, addA: true }]);
    const [action, setAction] = useState('Selling');

    const generatedAd = useMemo(() => {
        const validItems = items.filter(i => i.name.trim() !== '');
        if (validItems.length === 0) return '';
        
        const itemStrings = validItems.map(i => {
           let q = i.qty.trim();
           let qLower = q.toLowerCase();
           
           let displayName = i.name.trim();
           if (i.addS) displayName += 's';
           
           let bgParts = [];
           if (i.color?.trim()) bgParts.push(i.color.trim());
           bgParts.push(displayName);
           let nameStr = bgParts.join(' ');
           
           if ((i.addA && q === '1') || qLower === 'a' || qLower === 'an') {
               const firstChar = nameStr.charAt(0).toLowerCase();
               q = ['a', 'e', 'i', 'o', 'u'].includes(firstChar) ? 'an' : 'a';
           } else if (!i.addA && q === '1') {
               q = '';
           }
           
           let prefix = q ? \`\${q} \` : '';
           let finalName = \`\${prefix}\${nameStr}\`;
           
           if (action !== 'Trading' && i.price.trim()) {
               const formattedPrice = formatPrice(i.price, 'Items Ads', '');
               if (formattedPrice && !formattedPrice.includes('Negotiable')) {
                   finalName += \` for \${formattedPrice}\`;
               }
           }
           return finalName;
        });
        
        let itemsList = '';
        if (itemStrings.length === 1) itemsList = itemStrings[0];
        else if (itemStrings.length > 1) {
            const last = itemStrings.pop();
            itemsList = \`\${itemStrings.join(', ')} and \${last}\`;
        }
        
        return \`\${action} \${itemsList}.\`;
    }, [action, items]);

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300 relative">
             <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                {['Selling', 'Buying', 'Selling or trading', 'Trading'].map(t => <button key={t} onClick={() => setAction(t)} className={\`flex-1 py-1 rounded text-xs font-medium transition-colors \${action === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}\`}>{t}</button>)}
            </div>
            <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center mb-1 tracking-wider">
                    <span>Items List (Max 3)</span>
                    <button onClick={() => { if(items.length < 3) setItems([...items, {name: '', qty: '1', color: '', price: '', addS: false, addA: true}]) }} className="text-slate-400 hover:text-slate-100 transition-colors">+ Add Item</button>
                </label>
                <div className="flex flex-col gap-2">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-1 items-center bg-slate-900 border border-slate-800 p-1.5 rounded-lg relative">
                            {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-colors border border-slate-700">✕</button>}
                            
                            <input type="text" value={item.qty} onChange={e => { const newItems = [...items]; newItems[idx].qty = e.target.value; setItems(newItems); }} className="w-10 bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 text-xs text-center outline-none" placeholder="Qty" title="Quantity" />
                            <input type="text" value={item.color || ''} onChange={e => { const newItems = [...items]; newItems[idx].color = e.target.value; setItems(newItems); }} placeholder="Color" className="w-16 bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 text-xs outline-none" />
                            <div className="flex-1 min-w-[120px]"><Autocomplete options={itemOptions} value={item.name} onChange={val => { const newItems = [...items]; newItems[idx].name = val; setItems(newItems); }} placeholder="Item Name" /></div>
                            {action !== 'Trading' && <input type="text" value={item.price || ''} onChange={e => { const newItems = [...items]; newItems[idx].price = e.target.value; setItems(newItems); }} placeholder="Price e.g 5m" className="w-20 bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 text-xs font-mono outline-none" />}
                            
                            <div className="flex gap-0.5 ml-1">
                                <button title="Toggle A/An prefix" onClick={() => { const newItems = [...items]; newItems[idx].addA = !newItems[idx].addA; if(newItems[idx].addA) newItems[idx].addS = false; setItems(newItems); }} className={\`px-1.5 py-1 rounded text-[10px] font-bold font-mono transition-colors \${item.addA ? 'bg-red-500 text-white border border-red-600' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}\`}>A</button>
                                <button title="Toggle Plural (S)" onClick={() => { const newItems = [...items]; newItems[idx].addS = !newItems[idx].addS; if(newItems[idx].addS) newItems[idx].addA = false; setItems(newItems); }} className={\`px-1.5 py-1 rounded text-[10px] font-bold font-mono transition-colors \${item.addS ? 'bg-red-500 text-white border border-red-600' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}\`}>+S</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <CopyBox text={generatedAd} />
        </div>
    );
}
`;
content = content.replace(itemsFormRegex, newItemsForm);

// 2. Replace ClothingForm block entirely
const clothingFormRegex = /\/\/ ------------- CLOTHING -------------\s+function ClothingForm\(\) \{[\s\S]*?(?=\/\/ ------------- TEMPLATES -------------)/;

const newClothingForm = `// ------------- CLOTHING -------------
function ClothingForm() {
    const [clothes, setClothes] = useState([{ color: '', lum: false, brand: '', name: '', gender: 'Male', adj: '', price: '', addS: false, addA: true }]);
    const [action, setAction] = useState('Selling');

    const generatedAd = useMemo(() => {
        const validClothes = clothes.filter(c => c.name.trim() !== '');
        if (validClothes.length === 0) return '';

        const itemStrings = validClothes.map(c => {
             let parts = [];
             if (c.gender && c.gender !== 'None') parts.push(c.gender.trim() === 'Male' ? "men's" : "women's");
             if (c.adj) parts.push(c.adj.trim());
             if (c.color) parts.push(c.color.trim());
             if (c.lum) parts.push('luminous');
             if (c.brand) parts.push(c.brand.trim());

             let itemName = c.name.trim();
             if (c.addS) itemName += 's';
             parts.push(itemName);

             let fullString = parts.join(' ');
             
             let prefix = '';
             if (c.addA && !c.addS) {
                const firstChar = fullString.charAt(0).toLowerCase();
                prefix = ['a', 'e', 'i', 'o', 'u'].includes(firstChar) ? 'an ' : 'a ';
             }
             
             let finalName = \`\${prefix}\${fullString}\`;

             if (action !== 'Trading' && c.price.trim()) {
                 const formattedPrice = formatPrice(c.price, 'Clothing Ads', '');
                 if (formattedPrice && !formattedPrice.includes('Negotiable')) {
                     finalName += \` for \${formattedPrice}\`;
                 }
             }
             return finalName;
        });

        let clothesList = '';
        if(itemStrings.length === 1) clothesList = itemStrings[0];
        else if (itemStrings.length > 1) {
            const last = itemStrings.pop();
            clothesList = \`\${itemStrings.join(', ')} and \${last}\`;
        }
        
        return \`\${action} \${clothesList}.\`;
    }, [action, clothes]);

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-300">
            <div className="flex gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                {['Selling', 'Buying', 'Trading', 'Selling or trading'].map(t => <button key={t} onClick={() => setAction(t)} className={\`flex-1 py-1 rounded text-xs font-medium transition-colors \${action === t ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}\`}>{t}</button>)}
            </div>
             <label className="text-[10px] font-bold text-slate-500 uppercase flex justify-between items-center mb-[-4px] tracking-wider">
                  <span>Clothing Items</span>
                  <button onClick={() => { if(clothes.length < 3) setClothes([...clothes, { color: '', lum: false, brand: '', name: '', gender: 'Male', adj: '', price: '', addS: false, addA: true }]) }} className="text-slate-400 hover:text-slate-100 transition-colors">+ Add Item</button>
             </label>
            <div className="flex flex-col gap-2">
                {clothes.map((c, idx) => (
                    <div key={idx} className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 relative group">
                        {clothes.length > 1 && <button onClick={() => setClothes(clothes.filter((_, i) => i !== idx))} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-800 hover:bg-red-500 hover:text-white text-slate-400 rounded-full flex items-center justify-center text-[10px] shadow-lg transition-colors border border-slate-700 z-10">✕</button>}
                        <div className="flex gap-2 items-center">
                            <select value={c.gender} onChange={e => { const nc = [...clothes]; nc[idx].gender = e.target.value; setClothes(nc); }} className="w-16 bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 text-[10px] outline-none">
                                <option value="None">None</option>
                                <option value="Male">Men's</option>
                                <option value="Female">Women's</option>
                            </select>
                            <input type="text" value={c.adj} onChange={e => { const nc = [...clothes]; nc[idx].adj = e.target.value; setClothes(nc); }} placeholder="Adj (e.g. Rare)" className="w-20 bg-slate-950 border border-slate-800 p-1.5 text-xs rounded text-slate-200 outline-none" />
                            <input type="text" value={c.color} onChange={e => { const nc = [...clothes]; nc[idx].color = e.target.value; setClothes(nc); }} placeholder="Color" className="w-16 bg-slate-950 border border-slate-800 p-1.5 text-xs rounded text-slate-200 outline-none" />
                            <label className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2 py-1.5 rounded text-[10px] text-slate-300 cursor-pointer">
                                <input type="checkbox" checked={c.lum} onChange={e => { const nc = [...clothes]; nc[idx].lum = e.target.checked; setClothes(nc); }} className="accent-slate-500" />
                                Lum.
                            </label>
                            <input type="text" value={c.brand} onChange={e => { const nc = [...clothes]; nc[idx].brand = e.target.value; setClothes(nc); }} placeholder="Brand" className="w-20 bg-slate-950 border border-slate-800 p-1.5 text-xs rounded text-slate-200 outline-none" />
                        </div>
                        <div className="flex gap-2 items-center w-full">
                            <div className="flex-1 min-w-[120px]"><Autocomplete options={clothOptions} value={c.name} onChange={val => { const nc = [...clothes]; nc[idx].name = val; setClothes(nc); }} placeholder="Clothing (e.g. Designer T-Shirt)" /></div>
                            {action !== 'Trading' && <input type="text" value={c.price} onChange={e => { const nc = [...clothes]; nc[idx].price = e.target.value; setClothes(nc); }} placeholder="Price e.g 5m" className="w-20 bg-slate-950 border border-slate-800 p-1 text-xs rounded text-slate-200 font-mono outline-none" />}
                            <div className="flex gap-0.5 ml-1">
                                <button title="Toggle A/An prefix" onClick={() => { const nc = [...clothes]; nc[idx].addA = !nc[idx].addA; if(nc[idx].addA) nc[idx].addS = false; setClothes(nc); }} className={\`px-1.5 py-1 rounded text-[10px] font-bold font-mono transition-colors \${c.addA ? 'bg-red-500 text-white border border-red-600' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}\`}>A</button>
                                <button title="Toggle Plural (S)" onClick={() => { const nc = [...clothes]; nc[idx].addS = !nc[idx].addS; if(nc[idx].addS) nc[idx].addA = false; setClothes(nc); }} className={\`px-1.5 py-1 rounded text-[10px] font-bold font-mono transition-colors \${c.addS ? 'bg-red-500 text-white border border-red-600' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}\`}>+S</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <CopyBox text={generatedAd} />
        </div>
    );
}
`;
content = content.replace(clothingFormRegex, newClothingForm);

// 3. UI Theme Replacement
content = content.replace(/slate-/g, 'zinc-');
content = content.replace(/emerald-/g, 'sky-');
// Clean up main container padding slightly
content = content.replace(/className="min-h-screen p-8/g, 'className="min-h-screen p-4 sm:p-6 lg:p-8');
content = content.replace(/border border-slate-800\/80 rounded-[^\s]+ shadow-[^\s]+/g, 'border border-zinc-800 rounded-xl shadow-2xl');
content = content.replace(/bg-\[\#0B1121\]/g, 'bg-[#09090b]'); // zinc-950

fs.writeFileSync(pageFile, content, 'utf8');
console.log('Successfully re-architected page.tsx!');
