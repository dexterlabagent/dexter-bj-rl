import { PublicKey } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';
import { createWalletChallenge } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { walletAddress } = await request.json();

        if (!walletAddress || typeof walletAddress !== 'string') {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
        }

        new PublicKey(walletAddress);

        const challenge = await createWalletChallenge(request, walletAddress);

        return NextResponse.json(challenge);
    } catch (error) {
        console.error('Failed to create wallet auth challenge:', error);

        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }
}
