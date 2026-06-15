const fs = require('fs');
const file = 'web/src/app/page.tsx';
let txt = fs.readFileSync(file, 'utf8');

// 1. Fix formatPrice dropping the hardcoded dot
txt = txt.replace(/return '\$' \+ bValue \+ ' Billion\.';/g, "return '$' + bValue + ' Billion';");
txt = txt.replace(/return '\$' \+ mValue \+ ' Million\.';/g, "return '$' + mValue + ' Million';");
txt = txt.replace(/return 'Negotiable\.';/g, "return 'Negotiable';");

// 2. Fix the copy box component to support tabName and display the Red text
txt = txt.replace(/function CopyBox\(\{ text \}: \{ text: string \}\) \{/g, "function CopyBox({ text, tabName }: { text: string, tabName?: string }) {");
txt = txt.replace(
    /className="absolute right-4 top-4 bg-sky-500/g,
    'className="bg-sky-500 shadow-md'
);
txt = txt.replace(
    /<button onClick=\{.*?\} className="bg-sky-500 shadow-md[\s\S]*?<\/button>/g,
    `<div className="absolute right-4 top-4 flex flex-col items-end gap-1.5 w-1/3">
                <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="bg-sky-500 shadow-md hover:bg-sky-600 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">{copied ? 'COPIED!' : 'COPY AD'}</button>
                {tabName && <p className="text-red-500 font-bold text-[10px] sm:text-[11px] text-right uppercase mt-1 leading-tight">Make sure to CHANGE category to {tabName} before posting AD.</p>}
            </div>`
);

// 3. Add tabName strings to every CopyBox instance dynamically based on the parent component
txt = txt.replace(/function CarForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function CarForm() {$1<CopyBox text={generatedAd} tabName="CARS" />');
txt = txt.replace(/function ItemsForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function ItemsForm() {$1<CopyBox text={generatedAd} tabName="ITEMS" />');
txt = txt.replace(/function HouseForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function HouseForm() {$1<CopyBox text={generatedAd} tabName="REAL ESTATE" />');
txt = txt.replace(/function BusinessForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function BusinessForm() {$1<CopyBox text={generatedAd} tabName="BUSINESS" />');
txt = txt.replace(/function WorkForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function WorkForm() {$1<CopyBox text={generatedAd} tabName="WORK" />');
txt = txt.replace(/function ClothingForm\(\) \{([\s\S]*?)<CopyBox text=\{generatedAd\} \/>/g, 'function ClothingForm() {$1<CopyBox text={generatedAd} tabName="CLOTHING" />');
txt = txt.replace(/<CopyBox text=\{template\} \/>/g, '<CopyBox text={template} />'); // Dating/Templates skip

// 4. Update the actual suffix logic in forms to implement the exact dot rule
// We just define a helper in the file to determine trailing dot
const DOT_HELPER = `
function getDot(str: string) {
    if (!str) return '';
    let l = str.toLowerCase().trim();
    if (l.endsWith('each') || l.endsWith('respectively') || l === 'negotiable') return '.';
    return '';
}

`;
if (!txt.includes('function getDot')) {
    txt = txt.replace('function formatPrice', DOT_HELPER + 'function formatPrice');
}

// CarForm Price logic update
txt = txt.replace(
    /let fPrice = formatPrice\(price, 'Car Ads', ''\);\s*if \(fPrice\.endsWith\('\.'\)\) fPrice = fPrice\.slice\(0, -1\);\s*suffix = `\. Price: \$\{fPrice\}\.`;/g,
    "let fPrice = formatPrice(price, 'Car Ads', ''); suffix = `. Price: ${fPrice}${getDot(fPrice)}`;"
);
txt = txt.replace(/suffix = `\. Price: Negotiable\.`;/g, "suffix = `. Price: Negotiable.`;"); 

// BusinessForm update
txt = txt.replace(
    /let fPrice = formatPrice\(price, 'Business Ads', ''\);\s*if \(fPrice\.endsWith\('\.'\)\) fPrice = fPrice\.slice\(0, -1\);\s*suffix = `\. Price: \$\{fPrice\}\.`;/g,
    "let fPrice = formatPrice(price, 'Business Ads', ''); suffix = `. Price: ${fPrice}${getDot(fPrice)}`;"
);

// HouseForm update
txt = txt.replace(
    /let formattedPrice = formatPrice\(price, 'House Ads', propType, action\);[\s\S]*?if \(formattedPrice\) \{[\s\S]*?let label = .*?;[\s\S]*?let durStr = .*?;[\s\S]*?priceStr = `\. \$\{label\}: \$\{formattedPrice\}\$\{durStr\}`;[\s\S]*?if \(baseStr\.endsWith\('\.'\)\) \{[\s\S]*?priceStr = ` \$\{priceStr\.substring\(2\)\}`;[\s\S]*?\}[\s\S]*?\}/g,
    `let formattedPrice = formatPrice(price, 'House Ads', propType, action);
        let baseStr = \`\${action} \${propStr}\${featsStr}\${locStr}\`;
        let priceStr = '';
        if (formattedPrice) {
            let label = action === 'Buying' || action === 'Looking to rent' ? 'Budget' : (action === 'Renting out' ? 'Rent' : 'Price');
            let durStr = action.includes('rent') ? \` \${duration}\` : '';
            let val = \`\${formattedPrice}\${durStr}\`;
            priceStr = \`. \${label}: \${val}\${getDot(val)}\`;
            
            if (baseStr.endsWith('.')) {
                priceStr = \` \${priceStr.substring(2)}\`;
            }
        }`
);

// WorkForm update
txt = txt.replace(
    /const rt = rate === 'None' \? '' : ` \$\{rate\}`;\s*pStr = `\. Salary: \$\{fP\}\$\{rt\}`;/g,
    `const rt = rate === 'None' ? '' : \` \${rate}\`; let val = \`\${fP}\${rt}\`; pStr = \`. Salary: \${val}\${getDot(val)}\`;`
);
txt = txt.replace(
    /const rt = rate === 'None' \? '' : ` \$\{rate\}`;\s*let val = `\$\{fP\}\$\{rt\}`;\s*pStr = `\. Salary: \$\{val\}\$\{getDot\(val\)\}`;/g,
    `const rt = rate === 'None' ? '' : \` \${rate}\`; let val = \`\${fP}\${rt}\`; pStr = \`. Salary: \${val}\${getDot(val)}\`;`
); // duplicate execution guard

// ItemsForm update
txt = txt.replace(
    /suffix = `\. \$\{action\.includes\('Buying'\) \? 'Budget' : 'Price'\}\: \$\{pStr\}\.`;/g,
    "suffix = `. ${action.includes('Buying') ? 'Budget' : 'Price'}: ${pStr}${getDot(pStr)}`;"
);

// ClothingForm update
txt = txt.replace(
    /suffix = `\. \$\{action\.includes\('Buying'\) \? 'Budget' : 'Price'\}: \$\{pStr\}\.`;/g,
    "suffix = `. ${action.includes('Buying') ? 'Budget' : 'Price'}: ${pStr}${getDot(pStr)}`;"
);


// Final explicit catch for multiple Negotiables that might drop dots
// If it evaluates to just `Negotiable`, getDot returns `.`
txt = txt.replace(/Negotiable\./g, 'Negotiable');
txt = txt.replace(/Negotiable`/g, 'Negotiable.`');
txt = txt.replace(/Negotiable\.\./g, 'Negotiable.');

fs.writeFileSync(file, txt);
console.log('Fixed period format rules globally and added CopyBox banners.');
