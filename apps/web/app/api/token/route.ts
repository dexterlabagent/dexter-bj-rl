import { NextResponse } from 'next/server';

const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;

export async function GET() {
    if (!TOKEN_ADDRESS) {
        return NextResponse.json({ error: 'Token address not configured' }, { status: 500 });
    }

    try {
        const res = await fetch(
            `https://api.dexscreener.com/tokens/v1/solana/${TOKEN_ADDRESS}`,
            { next: { revalidate: 30 } }
        );

        if (!res.ok) {
            return NextResponse.json({ error: 'Failed to fetch token data' }, { status: 502 });
        }

        const data = await res.json();
        const pairs = Array.isArray(data) ? data : data?.pairs ?? data;

        if (!pairs?.length) {
            return NextResponse.json({ error: 'No pairs found' }, { status: 404 });
        }

        // Use the pair with highest liquidity
        const pair = pairs.reduce((best: any, p: any) =>
            (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best
        , pairs[0]);

        return NextResponse.json(pair);
    } catch {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
