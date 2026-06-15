const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ─── Config ───
const SERVER_API_VERSION = 3;
const PORT = 4032;
const USERS_FILE = path.join(__dirname, 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const NOTES_FILE = path.join(__dirname, 'notes.json');
const PREFS_FILE = path.join(__dirname, 'preferences.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');
const DATA_DIR = path.join(__dirname, 'data');
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1486052979764236460/vypxQrjdcJqLuNAaqRcDcBox7fiV4OV3mkcRI_inrCTe7fpmveRNz5FCSQcR97vfZ_tu';
const IP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const ALLOWED_ORIGINS = [
    'http://localhost:3000', 
    'http://localhost:3001', 
    'https://li-web-jet.vercel.app', 
    'https://li-auto-ads.vercel.app',
    'https://li-auto-ads-git-main-galaxy338s-projects.vercel.app',
    'https://li-auto-ads-galaxy338s-projects.vercel.app',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
];

// ─── In-Memory State ───
let sessions = new Map();       // token -> { pin, role, name, ip, created }
const ipRegisterLog = new Map();  // ip -> timestamp of last register
const ipLoginLog = new Map();     // ip -> timestamp of last login
const loginFailures = new Map();  // ip -> { count, blockExpiry, nextBlockDurationMs }
let globalSyncLastTimestamp = 0;  // Global timestamp of last successful sync
let globalReloadTimestamp = Date.now(); // Global timestamp for forced client reloads
let allPreferences = {};            // name -> { prefs object }
let maintenanceMode = false;        // When true: registration, sync, data retrieval are blocked
let globalAlert = null;             // { type: 'success'|'warning'|'danger'|'info', message: string } or null

// ─── Persistence Helpers ───
function loadSessions() {
    try {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        sessions = new Map(Object.entries(data));
    } catch { sessions = new Map(); }
}
function saveSessions() {
    try {
        const obj = Object.fromEntries(sessions);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (e) { console.error('Error saving sessions:', e.message); }
}
function loadPreferences() {
    try {
        allPreferences = JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8'));
        console.log(`[Boot] Loaded preferences for ${Object.keys(allPreferences).length} user(s)`);
    } catch { allPreferences = {}; }
}
function savePreferences() {
    try {
        fs.writeFileSync(PREFS_FILE, JSON.stringify(allPreferences, null, 2), 'utf8');
    } catch (e) { console.error('[Prefs] Error saving preferences:', e.message); }
}

// ─── Helpers ───
function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch { return { users: [{ name: 'Admin', pin: '7978', role: 'admin' }] }; }
}
function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function genToken() { return crypto.randomBytes(32).toString('hex'); }

// IP Geolocation (free, no key needed) — also detects VPN/datacenter IPs
function geolocateIP(ip) {
    return new Promise((resolve) => {
        // Skip private/local IPs
        if (!ip || ip === '0.0.0.0' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '::1') {
            return resolve('Local');
        }
        const url = `http://ip-api.com/json/${ip}?fields=city,regionName,countryCode,status,proxy,hosting`;
        const http_mod = require('http');
        http_mod.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.status === 'success') {
                        const loc = `${j.city || '?'}, ${j.regionName || '?'}, ${j.countryCode || '?'}`;
                        const isVPN = j.proxy === true || j.hosting === true;
                        resolve(isVPN ? `🔒 VPN: ${loc}` : loc);
                    } else resolve('Unknown');
                } catch { resolve('Unknown'); }
            });
        }).on('error', () => resolve('Unknown'));
        // Timeout after 3s
        setTimeout(() => resolve('Unknown'), 3000);
    });
}

function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '0.0.0.0';
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
        req.on('error', reject);
    });
}

function send(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body);
}

function cors(req, res) {
    const origin = req.headers.origin || '';
    // Allow any origin that matches our list, or any for dev
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
}

function getSession(req) {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const token = auth.replace(/^Bearer /i, ''); // Case-insensitive Bearer
    const s = sessions.get(token);
    if (s) {
        s.lastSeen = Date.now();
        // Skip periodic saving on every request to avoid disk IO stress
    }
    return s || null;
}

function isAdmin(req) {
    const s = getSession(req);
    return s && s.role === 'admin';
}

// ─── Discord Webhook ───
function sendDiscordPayload(payloadObj) {
    const payload = JSON.stringify(payloadObj);
    const url = new URL(DISCORD_WEBHOOK);

    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            if (res.statusCode >= 400) console.error('[Discord] Webhook error:', res.statusCode, data);
            else console.log('[Discord] Payload sent successfully');
        });
    });
    req.on('error', e => console.error('[Discord] Request error:', e.message));
    req.write(payload);
    req.end();
}

function sendDiscordEmbed(username, howFound, ip) {
    sendDiscordPayload({
        embeds: [{
            title: '🔔 New Registration Request',
            color: 0x5865F2,
            fields: [
                { name: '👤 Discord Username', value: username, inline: true },
                { name: '🔍 How they found the site', value: howFound || 'Not specified', inline: true },
                { name: '🌐 IP Address', value: `\`${ip}\``, inline: true },
                { name: '⏰ Timestamp', value: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', timeZoneName: 'short' }), inline: false }
            ],
            footer: { text: 'LifeInvaider Auth System' },
            timestamp: new Date().toISOString()
        }]
    });
}

// ─── Data Sync (fetch_data logic) ───
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', reject);
        }).on('error', reject);
    });
}

function downloadText(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return downloadText(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function expandBracketedItems(items) {
    const expanded = [];
    for (const item of items) {
        // 1. Bracketed expansion (existing)
        let match = item.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
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
                for (const part of finalParts) expanded.push(`${part} quality ${base}`);
            } else if (variants.includes('%')) {
                const parts = variants.split(',').map(s => s.trim()).filter(Boolean);
                for (const part of parts) expanded.push(`${part} ${base}`);
            } else if (variants.includes('/')) {
                const parts = variants.split('/').map(s => s.trim()).filter(Boolean);
                for (const part of parts) expanded.push(`${part} ${base}`);
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
                    for (const n of nums) expanded.push(`${base} of type ${n}`);
                }
            } else if (variants.match(/V\.\d+-/)) { expanded.push(item); }
            else { expanded.push(item); }
            continue;
        }

        // 2. Slash expansion for numeric variants (e.g., container for racers 1/2/3)
        // Match: something + trailing space + numbers with slashes (e.g. 1/2/3)
        match = item.match(/^(.+?)\s+(\d+(?:\/\d+)+)$/);
        if (match) {
            const base = match[1].trim();
            const variants = match[2].split('/');
            expanded.push(base);
            for (const v of variants) {
                expanded.push(`${base} ${v}`);
            }
            continue;
        }

        expanded.push(item);
    }
    return [...new Set(expanded)].sort();
}

async function runSync() {
    const xlsx = require('xlsx');
    
    // Read config
    let conf = {};
    const confPath = path.join(DATA_DIR, 'config.json');
    try { conf = JSON.parse(fs.readFileSync(confPath, 'utf8')); } catch {}

    const formatUrl = (url, type) => {
        if (!url || typeof url !== 'string' || !url.includes('docs.google.com')) return url;
        if (url.includes('/export?')) return url;
        let base = url.split(/[?#]/)[0];
        if (base.endsWith('/')) base = base.slice(0, -1);
        if (base.endsWith('/edit')) base = base.slice(0, -5);
        return `${base}/export?format=${type}`;
    };

    const doc1_url = formatUrl(conf.doc1_url, 'txt') || "https://docs.google.com/document/d/1P-q01QXzwQvz5zkNqngKiJrQUVXkJx1B6Rg8rOXsJxA/export?format=txt";
    const templates_url = formatUrl(conf.templates_url, 'xlsx') || "https://docs.google.com/spreadsheets/d/1jtNsrDClzDFAEWkTi2xgzuCHKOWy5Rw0tt0XS1gy6PY/export?format=xlsx";
    const cars_url = formatUrl(conf.cars_url, 'xlsx') || "https://docs.google.com/spreadsheets/d/16EmEoyqlrmxRuPMSwWkxw80oEifwjjpe5AOqYhb70Yc/export?format=xlsx";
    const manager_url = formatUrl(conf.manager_url, 'xlsx') || "https://docs.google.com/spreadsheets/d/18-GQo3-KdcVHGJwlwa0TrmwkxLPmDDTHxDz4HR8FUAc/export?format=xlsx";

    const tempDir = path.join(DATA_DIR, '_temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    await Promise.all([
        downloadText(doc1_url).then(text => {
            fs.writeFileSync(path.join(DATA_DIR, 'policy.json'), JSON.stringify({ "LifeInvader_Internal_Policy": text }, null, 2));
        }),
        downloadFile(templates_url, path.join(tempDir, '_templates.xlsx')),
        downloadFile(cars_url, path.join(tempDir, '_cars.xlsx')),
        downloadFile(manager_url, path.join(tempDir, '_manager.xlsx'))
    ]);

    // Parse manager xlsx — each sheet tab is a category
    const managerResult = {};
    const wbManager = xlsx.readFile(path.join(tempDir, '_manager.xlsx'));
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
    fs.writeFileSync(path.join(DATA_DIR, 'manager.json'), JSON.stringify(managerResult, null, 2));

    const templatesData = {};
    const wbTemplates = xlsx.readFile(path.join(tempDir, '_templates.xlsx'));
    for (const sheetName of wbTemplates.SheetNames) {
        templatesData[sheetName] = xlsx.utils.sheet_to_json(wbTemplates.Sheets[sheetName], { header: 1 });
    }
    fs.writeFileSync(path.join(DATA_DIR, 'templates.json'), JSON.stringify(templatesData, null, 2));

    const itemsData = {};
    const wbCars = xlsx.readFile(path.join(tempDir, '_cars.xlsx'));
    for (const sheetName of wbCars.SheetNames) {
        itemsData[sheetName] = xlsx.utils.sheet_to_json(wbCars.Sheets[sheetName], { header: 1 });
    }
    fs.writeFileSync(path.join(DATA_DIR, 'items.json'), JSON.stringify(itemsData, null, 2));

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
                            if (cell && cell !== "----" && typeof cell === 'string') opts.push(cell.trim());
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
                    for (let i = 0; i <= 7; i++) {
                        const cell = row[i];
                        if (cell && cell !== "----" && typeof cell === 'string') opts.push(cell.trim());
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
                    if (idx === 0) return;
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
    const rawItems = extractFlat(['ITEMS'], true, true);
    const items = expandBracketedItems(rawItems);
    const clothing = extractClothing();
    const carStateValues = extractStateValues(['CARS', 'BOATSPLANESHELICOPTERS', 'MOTORCYCLES']);

    // Add generic vehicle types (policy: "Selling a car/motorbike/bike/motorcycle/plane/helicopter/boat")
    const genericVehicles = ['a car', 'a motorbike', 'a bike', 'a motorcycle', 'a plane', 'a helicopter', 'a boat', 'an electric car'];
    genericVehicles.forEach(v => { if (!cars.includes(v)) cars.push(v); });

    // Add common items that should always be available
    const staticItems = ['seeds'];
    staticItems.forEach(v => { if (!items.includes(v)) items.push(v); });

    const parsed = {
        cars: cars.sort(),
        carStateValues,
        items: items.sort(),
        clothing: clothing.sort(),
        lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(path.join(DATA_DIR, 'parsed_items.json'), JSON.stringify(parsed, null, 2));

    // Cleanup temp
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}

    return parsed;
}

// ─── Route Handler ───
async function handleRequest(req, res) {
    cors(req, res);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    const url = req.url.split('?')[0];
    const ip = getIP(req);

    // Logging
    console.log(`[${new Date().toISOString()}] ${req.method} ${url} from ${ip}`);

    // Helper to log status and send
    const logSend = (status, data) => {
        console.log(`  └─> ${status}`);
        return send(res, status, data);
    };

    // ── GET /health ──
    if (url === '/health' && req.method === 'GET') {
        return send(res, 200, { ok: true, time: Date.now(), apiVersion: SERVER_API_VERSION, maintenance: maintenanceMode });
    }

    // ── POST /login ──
    if (url === '/login' && req.method === 'POST') {
        const body = await readBody(req);
        const pin = String(body.pin || '').trim();
        if (!pin || pin.length !== 4) return send(res, 400, { error: 'PIN must be 4 digits' });

        // Rate Limit / Block Check
        const failData = loginFailures.get(ip) || { count: 0, blockExpiry: 0, nextBlockDurationMs: 60000 };
        const now = Date.now();
        
        if (failData.blockExpiry > now) {
            const diff = Math.ceil((failData.blockExpiry - now) / 1000);
            return send(res, 429, { error: `Too many attempts. Blocked for ${diff}s.` });
            return logSend(429, { error: `Too many attempts. Blocked for ${diff}s.` });
        }

        const data = loadUsers();
        const user = data.users.find(u => u.pin === pin);

        if (user) {
            // Note: suspended users CAN log in but will see restricted UI
            // Single Session Rule: Invalidate existing sessions for this PIN
            let kicked = false;
            for (const [t, s] of sessions) {
                if (s.pin === user.pin) {
                    sessions.delete(t);
                    kicked = true;
                }
            }
            if (kicked) saveSessions();

            // Success: Reset failures
            loginFailures.delete(ip);

            const token = genToken();
            sessions.set(token, { pin: user.pin, role: user.role || 'user', name: user.name, ip, created: now, lastSeen: now, suspended: !!user.suspended, suspendReason: user.suspendReason || '' });
            saveSessions(); // Persist immediately
            ipLoginLog.set(ip, now);

            // Geolocate IP (non-blocking, updates user record after)
            geolocateIP(ip).then(loc => {
                const freshData = loadUsers();
                const freshUser = freshData.users.find(u => u.pin === pin);
                if (freshUser) {
                    // Shift current → previous
                    if (freshUser.currentLocation && freshUser.currentLocation !== loc) {
                        freshUser.previousLocation = freshUser.currentLocation;
                    }
                    freshUser.currentLocation = loc;
                    freshUser.lastLoginIP = ip;
                    saveUsers(freshData);
                }
            }).catch(() => {});

            return logSend(200, { token, name: user.name, role: user.role || 'user', suspended: !!user.suspended, suspendReason: user.suspendReason || '' });
        } else {
            // Failure: Increment counter and apply block if needed
            failData.count++;
            let errorMsg = 'Invalid PIN';
            
            if (failData.count >= 5) {
                // Progression: 1m, then 5m, then +5m each time
                // count 5 -> 1min (60000)
                // count 6 -> 5min (300000)
                // count 7 -> 10min (600000)
                
                failData.blockExpiry = now + failData.nextBlockDurationMs;
                const blockedMins = failData.nextBlockDurationMs / 60000;
                errorMsg = `Too many failed attempts. Blocked for ${blockedMins}m.`;
                
                // Prepare next duration
                if (failData.count === 5) {
                    failData.nextBlockDurationMs = 5 * 60 * 1000; // Next is 5 min
                } else {
                    failData.nextBlockDurationMs += (5 * 60 * 1000); // Subsequent +5 min
                }
            }
            
            loginFailures.set(ip, failData);
            return send(res, 401, { error: errorMsg });
        }
    }

    // ── POST /register ──
    if (url === '/register' && req.method === 'POST') {
        if (maintenanceMode) return send(res, 503, { error: 'Registration is temporarily closed for maintenance.' });
        const body = await readBody(req);
        const { discord_username, how_found } = body;
        if (!discord_username?.trim()) return send(res, 400, { error: 'Discord username is required' });

        // Check if this IP logged in recently (6hr block)
        const lastLogin = ipLoginLog.get(ip);
        if (lastLogin && Date.now() - lastLogin < IP_COOLDOWN_MS) {
            return send(res, 429, { error: 'This device recently logged in. Registration is locked for 6 hours.' });
        }

        // Check IP registration cooldown
        const lastReg = ipRegisterLog.get(ip);
        if (lastReg && Date.now() - lastReg < IP_COOLDOWN_MS) {
            const remainMin = Math.ceil((IP_COOLDOWN_MS - (Date.now() - lastReg)) / 60000);
            return send(res, 429, { error: `Registration cooldown active. Try again in ${remainMin} minutes.` });
        }

        // Log IP and send webhook
        ipRegisterLog.set(ip, Date.now());
        sendDiscordEmbed(discord_username.trim(), how_found?.trim() || 'Not specified', ip);

        return send(res, 200, { success: true, message: 'Registration request sent! An admin will review your request shortly.' });
    }

    // ── GET /validate ──
    if (url === '/validate' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Invalid session' });
        return send(res, 200, { valid: true, name: session.name, role: session.role, suspended: !!session.suspended, suspendReason: session.suspendReason || '', maintenance: maintenanceMode, alert: globalAlert });
    }

    // ── GET /users (admin) ──
    if (url === '/users' && req.method === 'GET') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const data = loadUsers();
        return send(res, 200, { users: data.users.map(u => ({ name: u.name, pin: u.pin, role: u.role || 'user', suspended: !!u.suspended, suspendReason: u.suspendReason || '', currentLocation: u.currentLocation || '', previousLocation: u.previousLocation || '', lastLoginIP: u.lastLoginIP || '' })) });
    }

    // ── POST /users/add (admin) ──
    if (url === '/users/add' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        const { name, pin } = body;
        if (!name?.trim() || !pin?.trim()) return send(res, 400, { error: 'Name and PIN required' });
        if (pin.length !== 4 || !/^\d{4}$/.test(pin)) return send(res, 400, { error: 'PIN must be exactly 4 digits' });

        const data = loadUsers();
        if (data.users.find(u => u.pin === pin)) return send(res, 409, { error: 'PIN already in use' });
        data.users.push({ name: name.trim(), pin: pin.trim(), role: 'user' });
        saveUsers(data);
        return send(res, 200, { success: true, message: `User "${name}" added.` });
    }


    // ── GET /sessions/active (admin) ──
    if (url === '/sessions/active' && req.method === 'GET') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const list = [];
        const now = Date.now();
        const threshold = 15 * 60 * 1000; // 15 minutes

        for (const [token, s] of sessions) {
            const lastActive = s.lastSeen || s.created;
            if (now - lastActive < threshold) {
                list.push({ name: s.name, pin: s.pin, role: s.role, ip: s.ip, created: s.created, lastSeen: lastActive });
            }
        }
        return send(res, 200, { sessions: list });
    }

    // ── POST /admin/maintenance (admin) ──
    if (url === '/admin/maintenance' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        maintenanceMode = !!body.enabled;
        // Persist to config.json
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8')); } catch {}
        cfg.maintenance = maintenanceMode;
        fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify(cfg, null, 2), 'utf8');
        console.log(`[Admin] Maintenance mode ${maintenanceMode ? 'ENABLED' : 'DISABLED'}`);
        return send(res, 200, { success: true, maintenance: maintenanceMode });
    }

    // ── POST /admin/alert (admin) ──
    if (url === '/admin/alert' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        if (body.clear) {
            globalAlert = null;
        } else {
            const type = ['success', 'warning', 'danger', 'info'].includes(body.type) ? body.type : 'info';
            const message = String(body.message || '').trim();
            if (!message) return send(res, 400, { error: 'Alert message is required' });
            globalAlert = { type, message, ts: Date.now() };
        }
        // Persist to config.json
        let cfg = {};
        try { cfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8')); } catch {}
        cfg.globalAlert = globalAlert;
        fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify(cfg, null, 2), 'utf8');
        console.log(`[Admin] Alert ${globalAlert ? 'SET: ' + globalAlert.type + ' — ' + globalAlert.message : 'CLEARED'}`);
        return send(res, 200, { success: true, alert: globalAlert });
    }

    // ── POST /admin/reload-all (admin) ──
    if (url === '/admin/reload-all' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        globalReloadTimestamp = Date.now();
        return send(res, 200, { success: true, timestamp: globalReloadTimestamp });
    }

    // ── POST /admin/logout-all (admin) ──
    if (url === '/admin/logout-all' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const adminToken = (req.headers.authorization || '').replace(/^Bearer /i, '');
        let count = 0;
        for (const [token, s] of sessions) {
            if (token !== adminToken) { sessions.delete(token); count++; }
        }
        saveSessions();
        return send(res, 200, { success: true, message: `Logged out ${count} session(s).` });
    }

    // ── POST /users/delete (admin) ──
    if (url === '/users/delete' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        const { pin } = body;
        if (pin === '7978') return send(res, 400, { error: 'Cannot delete admin' });
        const data = loadUsers();
        const idx = data.users.findIndex(u => u.pin === pin);
        if (idx === -1) return send(res, 404, { error: 'User not found' });
        data.users.splice(idx, 1);
        saveUsers(data);
        // Also kill any sessions with that pin
        for (const [token, sess] of sessions) {
            if (sess.pin === pin) sessions.delete(token);
        }
        return send(res, 200, { success: true });
    }

    // ── POST /users/suspend (admin) ──
    if (url === '/users/suspend' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        const { pin, reason } = body;
        if (!pin) return send(res, 400, { error: 'PIN required' });
        if (pin === '7978') return send(res, 400, { error: 'Cannot suspend admin' });
        const data = loadUsers();
        const user = data.users.find(u => u.pin === pin);
        if (!user) return send(res, 404, { error: 'User not found' });
        user.suspended = true;
        user.suspendReason = reason?.trim() || '';
        saveUsers(data);
        // Kill their active sessions
        for (const [token, sess] of sessions) {
            if (sess.pin === pin) sessions.delete(token);
        }
        saveSessions();
        return send(res, 200, { success: true, message: `${user.name} has been suspended.` });
    }

    // ── POST /users/unsuspend (admin) ──
    if (url === '/users/unsuspend' && req.method === 'POST') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        const body = await readBody(req);
        const { pin } = body;
        if (!pin) return send(res, 400, { error: 'PIN required' });
        const data = loadUsers();
        const user = data.users.find(u => u.pin === pin);
        if (!user) return send(res, 404, { error: 'User not found' });
        user.suspended = false;
        user.suspendReason = '';
        saveUsers(data);
        return send(res, 200, { success: true, message: `${user.name} has been unsuspended.` });
    }

    // ── POST /sync (All Auth Users) ──
    if (url === '/sync' && req.method === 'POST') {
        if (maintenanceMode) return logSend(503, { error: 'Sync is disabled during maintenance.', maintenance: true });
        const session = getSession(req);
        if (!session) return logSend(401, { error: 'Login required' });

        // Global Cooldown for non-admins (5 min)
        if (session.role !== 'admin') {
            const now = Date.now();
            if (now - globalSyncLastTimestamp < 5 * 60 * 1000) {
                const remaining = Math.ceil((5 * 60 * 1000 - (now - globalSyncLastTimestamp)) / 1000);
                return logSend(429, { error: `Global cooldown active. Wait ${remaining}s.`, remaining });
            }
        }

        try {
            const parsed = await runSync();
            globalSyncLastTimestamp = Date.now();
            return logSend(200, { success: true, lastUpdated: parsed.lastUpdated });
        } catch (e) {
            console.error('[Sync] Error:', e);
            return logSend(500, { error: 'Sync failed: ' + e.message });
        }
    }

    // ── POST /report (All Auth Users) ──
    if (url === '/report' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) return logSend(401, { error: 'Login required' });
        const body = await readBody(req);
        const { message, title, type } = body;
        
        if (!message?.trim()) return logSend(400, { error: 'Message is required' });

        const embed = {
            author: { name: `Reporter: ${session.name}` },
            title: `🛠️ Bug Report: ${title || 'General Feedback'}`,
            description: message,
            color: type === 'critical' ? 15158332 : 3066993, // Red for critical, Green for feedback
            fields: [
                { name: 'Reporter PIN', value: session.pin, inline: true },
                { name: 'Role', value: session.role || 'user', inline: true },
            ],
            timestamp: new Date().toISOString()
        };

        try {
            sendDiscordPayload({ embeds: [embed] });
            return logSend(200, { success: true });
        } catch (e) {
            console.error('[Report] Error:', e);
            return logSend(500, { error: 'Failed to send report' });
        }
    }
    
    // ── GET /sync/status (Global) ──
    if (url === '/sync/status' && req.method === 'GET') {
        try {
            const p = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'parsed_items.json'), 'utf8'));
            const now = Date.now();
            const diff = now - globalSyncLastTimestamp;
            const remaining = diff < 5 * 60 * 1000 ? Math.ceil((5 * 60 * 1000 - diff) / 1000) : 0;
            
            return send(res, 200, { 
                lastUpdated: p.lastUpdated || null,
                remaining: remaining,
                reloadTimestamp: globalReloadTimestamp
            });
        } catch {
            return send(res, 200, { 
                lastUpdated: null, 
                remaining: 0,
                reloadTimestamp: globalReloadTimestamp
            });
        }
    }

    // ── GET /data/:file ──
    if (url.startsWith('/data/') && req.method === 'GET') {
        if (maintenanceMode) return send(res, 503, { error: 'Server is under maintenance. Please use cached data.', maintenance: true });
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        const filename = url.slice(6); // strip /data/
        const safeName = path.basename(filename);
        const filePath = path.join(DATA_DIR, safeName);
        if (!fs.existsSync(filePath)) return send(res, 404, { error: 'File not found' });
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(content);
        } catch {
            return send(res, 500, { error: 'Read error' });
        }
    }

    // ── POST /config (admin) ──
    if (url === '/config' && req.method === 'POST') {
        if (!isAdmin(req)) return logSend(403, { error: 'Admin access required' });
        const body = await readBody(req);
        fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify(body, null, 2), 'utf8');
        return logSend(200, { success: true });
    }

    // ── GET /config (admin) ──
    if (url === '/config' && req.method === 'GET') {
        if (!isAdmin(req)) return logSend(403, { error: 'Admin access required' });
        try {
            const c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'));
            return logSend(200, { config: c });
        } catch {
            return logSend(200, { config: { doc1_url: '', templates_url: '', cars_url: '', last_updated: 'Never' } });
        }
    }

    // ── GET /notes ──
    if (url === '/notes' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        try {
            const allNotes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
            const userNotes = allNotes[session.name] || '';
            return send(res, 200, { notes: userNotes });
        } catch {
            return send(res, 200, { notes: '' });
        }
    }

    // ── POST /notes ──
    if (url === '/notes' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        const body = await readBody(req);
        let allNotes = {};
        try { allNotes = JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8')); } catch {}
        allNotes[session.name] = String(body.notes || '');
        try {
            fs.writeFileSync(NOTES_FILE, JSON.stringify(allNotes, null, 2), 'utf8');
            return send(res, 200, { success: true });
        } catch (e) {
            return send(res, 500, { error: 'Failed to save notes' });
        }
    }

    // ── GET /preferences ──
    if (url === '/preferences' && req.method === 'GET') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        return send(res, 200, { prefs: allPreferences[session.name] || {} });
    }

    // ── POST /preferences ──
    if (url === '/preferences' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        const body = await readBody(req);
        if (!body.prefs || typeof body.prefs !== 'object') return send(res, 400, { error: 'Invalid prefs payload' });
        allPreferences[session.name] = body.prefs;
        savePreferences();
        return send(res, 200, { success: true });
    }

    // ── GET /messages ──
    // Users: get their thread with admin. Admin: ?user=Name to get specific thread
    if (url.startsWith('/messages') && req.method === 'GET' && !url.includes('/messages/users')) {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });

        let allMsgs = {};
        try { allMsgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}

        // Parse query string for ?user=
        const qIdx = req.url.indexOf('?');
        const params = qIdx >= 0 ? new URLSearchParams(req.url.slice(qIdx)) : new URLSearchParams();
        
        let threadUser;
        if (session.role === 'admin') {
            threadUser = params.get('user');
            if (!threadUser) return send(res, 400, { error: 'Specify ?user=Name' });
        } else {
            threadUser = session.name;
        }
        
        const thread = allMsgs[threadUser] || [];
        
        // Mark messages TO this session user as read
        let dirty = false;
        thread.forEach(m => {
            if (m.to === session.name && !m.read) { m.read = true; dirty = true; }
        });
        if (dirty) {
            allMsgs[threadUser] = thread;
            try { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(allMsgs, null, 2), 'utf8'); } catch {}
        }
        
        return send(res, 200, { messages: thread });
    }

    // ── GET /messages/users (admin) ──
    // Returns list of users who have threads + unread counts for admin
    if (url === '/messages/users' && req.method === 'GET') {
        if (!isAdmin(req)) return send(res, 403, { error: 'Admin access required' });
        
        let allMsgs = {};
        try { allMsgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
        
        const adminSession = getSession(req);
        const usersList = Object.keys(allMsgs).map(userName => {
            const thread = allMsgs[userName] || [];
            const unread = thread.filter(m => m.to === adminSession.name && !m.read).length;
            const lastMsg = thread.length > 0 ? thread[thread.length - 1] : null;
            return { name: userName, unread, lastMessage: lastMsg?.text || '', lastTs: lastMsg?.ts || 0 };
        });
        
        // Sort by most recent message
        usersList.sort((a, b) => b.lastTs - a.lastTs);
        return send(res, 200, { users: usersList });
    }

    // ── POST /messages/send ──
    if (url === '/messages/send' && req.method === 'POST') {
        const session = getSession(req);
        if (!session) return send(res, 401, { error: 'Login required' });
        const body = await readBody(req);
        const { to, text } = body;
        
        if (!text?.trim()) return send(res, 400, { error: 'Message text required' });
        
        let allMsgs = {};
        try { allMsgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch {}
        
        // Determine the thread key (always the non-admin user's name)
        let threadKey;
        if (session.role === 'admin') {
            if (!to?.trim()) return send(res, 400, { error: 'Recipient required' });
            threadKey = to.trim();
        } else {
            threadKey = session.name;
        }
        
        if (!allMsgs[threadKey]) allMsgs[threadKey] = [];
        
        const msg = {
            from: session.name,
            to: session.role === 'admin' ? threadKey : 'Admin',
            text: text.trim(),
            ts: Date.now(),
            read: false
        };
        
        allMsgs[threadKey].push(msg);
        
        // Keep max 200 messages per thread
        if (allMsgs[threadKey].length > 200) {
            allMsgs[threadKey] = allMsgs[threadKey].slice(-200);
        }
        
        try {
            fs.writeFileSync(MESSAGES_FILE, JSON.stringify(allMsgs, null, 2), 'utf8');
            return send(res, 200, { success: true, message: msg });
        } catch (e) {
            return send(res, 500, { error: 'Failed to save message' });
        }
    }

    // ── 404 ──
    send(res, 404, { error: 'Not found' });
}

// ─── Boot ───
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) saveUsers({ users: [{ name: 'Admin', pin: '7978', role: 'admin' }] });
loadSessions();
loadPreferences();
// Load maintenance mode and alerts from config
try {
    const bootCfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8'));
    maintenanceMode = !!bootCfg.maintenance;
    if (maintenanceMode) console.log('[Boot] ⚠ Maintenance mode is ACTIVE');
    if (bootCfg.globalAlert && bootCfg.globalAlert.message) {
        globalAlert = bootCfg.globalAlert;
        console.log(`[Boot] ⚠ Active alert: ${globalAlert.type} — ${globalAlert.message}`);
    }
} catch {}
// Immediate stale cleanup on boot
const bootNow = Date.now();
for (const [t, s] of sessions) {
    if (bootNow - (s.lastSeen || s.created) > 24 * 60 * 60 * 1000) sessions.delete(t);
}
saveSessions();

// Set interval to save sessions every 1 min
setInterval(saveSessions, 60000);

// Cleanup expired IPs every 30 min
setInterval(() => {
    const now = Date.now();
    for (const [ip, ts] of ipRegisterLog) { if (now - ts > IP_COOLDOWN_MS) ipRegisterLog.delete(ip); }
    for (const [ip, ts] of ipLoginLog) { if (now - ts > IP_COOLDOWN_MS) ipLoginLog.delete(ip); }
    
    // Also clean stale sessions (older than 24h OR inactive for 2h)
    let shifted = false;
    for (const [token, sess] of sessions) {
        const isOld = (now - sess.created > 24 * 60 * 60 * 1000);
        const isInactive = sess.lastSeen && (now - sess.lastSeen > 2 * 60 * 60 * 1000);
        if (isOld || isInactive) {
            sessions.delete(token);
            shifted = true;
        }
    }
    if (shifted) saveSessions();
}, 30 * 60 * 1000);

const server = http.createServer(handleRequest);
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🚀 LifeInvaider Auth Server running on port ${PORT}`);
    console.log(`  📁 Data directory: ${DATA_DIR}`);
    console.log(`  👤 Users file: ${USERS_FILE}\n`);
});
