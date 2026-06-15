import { NextResponse } from 'next/server';

const AUTH_SERVER = 'http://140.245.20.237:4032';

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    try {
        const body = await req.text();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        const authHeader = req.headers.get('Authorization');
        if (authHeader) headers['Authorization'] = authHeader;

        // Forward client IP
        const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0';
        headers['X-Forwarded-For'] = clientIP;

        const res = await fetch(`${AUTH_SERVER}${endpoint}`, {
            method: 'POST',
            headers,
            body: body || undefined,
        });

        const data = await res.text();
        return new NextResponse(data, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Auth server is unreachable. Please try again later.' },
            { status: 503 }
        );
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const endpoint = '/' + path.join('/');

    try {
        const headers: Record<string, string> = {};
        const authHeader = req.headers.get('Authorization');
        if (authHeader) headers['Authorization'] = authHeader;

        const url = new URL(req.url);
        const qs = url.search || '';
        const res = await fetch(`${AUTH_SERVER}${endpoint}${qs}`, { headers });

        const data = await res.text();
        return new NextResponse(data, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (e: any) {
        return NextResponse.json(
            { error: 'Auth server is unreachable. Please try again later.' },
            { status: 503 }
        );
    }
}
