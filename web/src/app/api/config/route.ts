import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// The config file is located at the root beside fetch_data.js
const CONFIG_PATH = path.join(process.cwd(), '../config.json');

export async function GET() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        return NextResponse.json({ success: true, config: JSON.parse(data) });
    } catch (e: any) {
        // Fallback default config
        return NextResponse.json({ 
            success: true, 
            config: {
                doc1_url: '',
                templates_url: '',
                cars_url: '',
                last_updated: 'Never'
            }
        });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        await fs.writeFile(CONFIG_PATH, JSON.stringify(body, null, 2), 'utf8');
        return NextResponse.json({ success: true, config: body });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
