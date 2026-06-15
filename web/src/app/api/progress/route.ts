import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const rootPath = path.join(process.cwd(), '..', '..', '..', 'sync_progress.txt');
        let prog = "Starting...";
        if (fs.existsSync(rootPath)) {
            prog = fs.readFileSync(rootPath, 'utf8');
        } else {
            // fallback if running from web root directly
            const altPath = path.join(process.cwd(), 'sync_progress.txt');
            if (fs.existsSync(altPath)) {
                prog = fs.readFileSync(altPath, 'utf8');
            }
        }
        return NextResponse.json({ progress: prog });
    } catch(e) {
        return NextResponse.json({ progress: "Syncing..." });
    }
}
