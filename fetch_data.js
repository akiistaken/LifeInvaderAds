const fs = require('fs');
const https = require('https');
const xlsx = require('xlsx');

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode >= 400) {
                return reject(new Error(`HTTP Error ${res.statusCode} while downloading ${url}`));
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', reject);
        }).on('error', reject);
    });
}

async function downloadText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadText(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode >= 400) {
                return reject(new Error(`HTTP Error ${res.statusCode} while downloading text from ${url}`));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// Expand bracketed items like "fabric (red/blue/yellow/green/purple)" into individual entries
function expandBracketedItems(items) {
    const expanded = [];
    for (const item of items) {
        const match = item.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
        if (match) {
            const base = match[1].trim();
            const variants = match[2].replace(' and ', ', ').replace('&', ', ');
            
            expanded.push(base);

            if (variants.includes('quality')) {
                // Known quality levels to detect when not comma-separated
                const knownQualities = ['low', 'medium', 'high', 'standard', 'premium', 'basic'];
                // Normalize: replace '&' and 'and' with commas, then split
                let cleaned = variants.replace('quality', '').replace(/\band\b/g, ',').replace(/&/g, ',');
                let parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
                // Check each part for multiple embedded quality words (e.g. "low medium" -> "low", "medium")
                const finalParts = [];
                for (const p of parts) {
                    const words = p.split(/\s+/);
                    const found = words.filter(w => knownQualities.includes(w.toLowerCase()));
                    if (found.length > 1) finalParts.push(...found);
                    else finalParts.push(p);
                }
                for (const part of finalParts) {
                    expanded.push(`${part} quality ${base}`);
                }
            } else if (variants.includes('%')) {
                const parts = variants.split(',').map(s => s.trim()).filter(Boolean);
                for (const part of parts) {
                    expanded.push(`${part} ${base}`);
                }
            } else if (variants.includes('/')) {
                const parts = variants.split('/').map(s => s.trim()).filter(Boolean);
                for (const part of parts) {
                    expanded.push(`${part} ${base}`);
                }
            } else if (variants.includes('of type')) {
                // Check for range notation: "of type X-Y" where X and Y are numbers
                const rangeMatch = variants.match(/of type\s+(\d+)\s*-\s*(\d+)/);
                if (rangeMatch) {
                    const start = parseInt(rangeMatch[1]);
                    const end = parseInt(rangeMatch[2]);
                    for (let n = start; n <= end; n++) expanded.push(`${base} of type ${n}`);
                } else if (variants.includes('-')) {
                    // Non-numeric dash (e.g. "V.1-?"), keep as-is
                    expanded.push(item);
                } else {
                    const numsStr = variants.replace('of type', '').replace(/or/g, ',').replace(/and/g, ',').trim();
                    const nums = numsStr.split(',').map(s => s.trim()).filter(Boolean);
                    for (const n of nums) {
                        expanded.push(`${base} of type ${n}`);
                    }
                }
            } else if (variants.match(/V\.\d+-/)) {
                expanded.push(item);
            } else {
                expanded.push(item);
            }
        } else {
            expanded.push(item);
        }
    }
    return [...new Set(expanded)].sort();
}

async function main() {
    console.log(); fs.writeFileSync('sync_progress.txt', String());
    
    // Read config
    let configStr = '{}';
    try { configStr = fs.readFileSync('config.json', 'utf8'); } catch(e) {}
    const conf = JSON.parse(configStr);

    const doc1_url = conf.doc1_url || "https://docs.google.com/document/d/1P-q01QXzwQvz5zkNqngKiJrQUVXkJx1B6Rg8rOXsJxA/export?format=txt";
    const templates_url = conf.templates_url || "https://docs.google.com/spreadsheets/d/1jtNsrDClzDFAEWkTi2xgzuCHKOWy5Rw0tt0XS1gy6PY/export?format=xlsx";
    const cars_url = conf.cars_url || "https://docs.google.com/spreadsheets/d/16EmEoyqlrmxRuPMSwWkxw80oEifwjjpe5AOqYhb70Yc/export?format=xlsx";
    const manager_url = conf.manager_url || "https://docs.google.com/spreadsheets/d/18-GQo3-KdcVHGJwlwa0TrmwkxLPmDDTHxDz4HR8FUAc/export?format=xlsx";

    await Promise.all([
        downloadText(doc1_url).then(text => {
            fs.writeFileSync('policy.json', JSON.stringify({ "LifeInvader_Internal_Policy": text }, null, 2));
            console.log(); fs.writeFileSync('sync_progress.txt', String());
        }),
        download(templates_url, '_templates.xlsx').then(() => console.log("[SYNC] Templates sheet downloaded.")),
        download(cars_url, '_cars.xlsx').then(() => console.log("[SYNC] Cars/Items sheet downloaded.")),
        download(manager_url, '_manager.xlsx').then(() => console.log("[SYNC] Manager prices sheet downloaded."))
    ]);

    // Parse manager xlsx — each sheet tab is a category
    const managerResult = {};
    let wbManager;
    try {
        wbManager = xlsx.readFile('_manager.xlsx');
    } catch (e) {
        throw new Error(`Failed to parse manager prices file. Google Docs might have returned an HTML error or login page instead of the file. Original error: ${e.message}`);
    }
    for (const sheetName of wbManager.SheetNames) {
        const rows = xlsx.utils.sheet_to_json(wbManager.Sheets[sheetName], { header: 1, raw: false });
        const services = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (Array.isArray(row) && row.length >= 2 && row[0]) {
                services.push({ name: String(row[0]).trim(), price: String(row[1]).trim() });
            }
        }
        if (services.length > 0) managerResult[sheetName] = services;
    }
    fs.writeFileSync('manager.json', JSON.stringify(managerResult, null, 2));
    console.log("[SYNC] Manager prices parsed.");

    console.log(); fs.writeFileSync('sync_progress.txt', String());

    const templatesData = {};
    let wbTemplates;
    try {
        wbTemplates = xlsx.readFile('_templates.xlsx');
    } catch (e) {
        throw new Error(`Failed to parse templates file. Google Docs might have returned an HTML error or login page instead of the file. Original error: ${e.message}`);
    }
    for (const sheetName of wbTemplates.SheetNames) {
        templatesData[sheetName] = xlsx.utils.sheet_to_json(wbTemplates.Sheets[sheetName], { header: 1 });
    }
    fs.writeFileSync('templates.json', JSON.stringify(templatesData, null, 2));
    console.log(); fs.writeFileSync('sync_progress.txt', String());

    const itemsData = {};
    let wbCars;
    try {
        wbCars = xlsx.readFile('_cars.xlsx');
    } catch (e) {
        throw new Error(`Failed to parse cars/items file. Google Docs might have returned an HTML error or login page instead of the file. Original error: ${e.message}`);
    }
    for (const sheetName of wbCars.SheetNames) {
        itemsData[sheetName] = xlsx.utils.sheet_to_json(wbCars.Sheets[sheetName], { header: 1 });
    }
    fs.writeFileSync('items.json', JSON.stringify(itemsData, null, 2));
    console.log(); fs.writeFileSync('sync_progress.txt', String());

    const extractFlat = (keys, skipFirst = true, checkEveryColumn = false) => {
        let opts = [];
        keys.forEach(key => {
            const matrix = itemsData[key];
            if (Array.isArray(matrix)) {
                matrix.forEach((row, idx) => {
                    if (skipFirst && idx === 0) return;
                    if (Array.isArray(row)) {
                        const increment = checkEveryColumn ? 1 : 2;
                        for (let i = 0; i < row.length; i += increment) {
                            const cell = row[i];
                            if (cell && cell !== "----" && typeof cell === 'string') {
                                opts.push(cell.trim());
                            }
                        }
                    }
                });
            }
        });
        return [...new Set(opts)];
    };

    const extractClothing = () => {
        let opts = [];
        const matrix = itemsData['CLOTHING LIST'];
        if (Array.isArray(matrix)) {
            matrix.forEach((row, idx) => {
                if (idx === 0) return;
                if (Array.isArray(row)) {
                    for (let i = 0; i < row.length; i++) {
                        const cell = row[i];
                        if (cell && cell !== "----" && typeof cell === 'string') {
                            opts.push(cell.trim());
                        }
                    }
                }
            });
        }
        return [...new Set(opts)];
    };


    // Extract state values (price beside each car/vehicle name)
    const extractStateValues = (keys) => {
        const map = {};
        keys.forEach(key => {
            const matrix = itemsData[key];
            if (Array.isArray(matrix)) {
                matrix.forEach((row, idx) => {
                    if (idx === 0) return; // skip header
                    if (Array.isArray(row)) {
                        for (let i = 0; i < row.length; i += 2) {
                            const name = row[i];
                            const stateVal = row[i + 1];
                            if (name && name !== '----' && typeof name === 'string' && stateVal && stateVal !== '----' && typeof stateVal === 'string') {
                                map[name.trim()] = stateVal.trim();
                            }
                        }
                    }
                });
            }
        });
        return map;
    };

    const cars = extractFlat(['CARS', 'BOATSPLANESHELICOPTERS', 'MOTORCYCLES'], true, false);
    const rawItems = extractFlat(['ITEMS'], true, true); // True flag = iterate every column
    const items = expandBracketedItems(rawItems);
    const clothing = extractClothing();
    const carStateValues = extractStateValues(['CARS', 'BOATSPLANESHELICOPTERS', 'MOTORCYCLES']);

    const parsed = { 
        cars: cars.sort(), 
        carStateValues,
        items: items.sort(), 
        clothing: clothing.sort(),
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync('parsed_items.json', JSON.stringify(parsed, null, 2));
    console.log(); fs.writeFileSync('sync_progress.txt', String());
    console.log(); fs.writeFileSync('sync_progress.txt', String());

    // Clean up temp files
    if (fs.existsSync('_templates.xlsx')) fs.unlinkSync('_templates.xlsx');
    if (fs.existsSync('_cars.xlsx')) fs.unlinkSync('_cars.xlsx');
    if (fs.existsSync('items.xlsx')) fs.unlinkSync('items.xlsx');
    if (fs.existsSync('templates.xlsx')) fs.unlinkSync('templates.xlsx');
    if (fs.existsSync('cars.xlsx')) fs.unlinkSync('cars.xlsx');

    console.log(); fs.writeFileSync('sync_progress.txt', String());
}

main().catch(err => {
    console.error("[SYNC] ❌ Error:", err);
    process.exit(1);
});
