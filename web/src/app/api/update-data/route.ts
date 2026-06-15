import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
    try {
        if (process.env.VERCEL) {
            return NextResponse.json({ 
                success: false, 
                error: 'Vercel is read-only. Please click Sync DB locally on your computer, then commit and push to GitHub to update the live site.' 
            }, { status: 403 });
        }

        const { stdout, stderr } = await execAsync('npm run refresh --prefix ../');
        return NextResponse.json({ 
            success: true, 
            logs: stdout,
            message: 'Data synced successfully. Please restart your Next.js dev server to see the changes.'
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
