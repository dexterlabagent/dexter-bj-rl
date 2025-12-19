import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
    const session = await getAuthSession(request);

    return NextResponse.json({
        authenticated: !!session.userId,
        userId: session.userId ?? null,
        walletAddress: session.walletAddress ?? null,
        displayName: session.displayName ?? null,
    });
}
