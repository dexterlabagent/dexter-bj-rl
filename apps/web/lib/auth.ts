import {
    AUTH_COOKIE_NAME,
    AUTH_NONCE_PREFIX,
    AUTH_NONCE_TTL_SECONDS,
    AUTH_SESSION_TTL_SECONDS,
    buildWalletSignInMessage,
    createWalletSessionToken,
    formatWalletAddress,
    normalizeWalletAddress,
    verifyWalletSessionToken,
    type WalletAuthChallenge,
} from '@repo/shared/auth';
import { PublicKey } from '@solana/web3.js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import nacl from 'tweetnacl';
import { kv } from './redis';

export type AuthSession = {
    userId?: string;
    walletAddress?: string;
    displayName?: string;
};

type CreateWalletChallengeResult = WalletAuthChallenge & {
    expiresIn: number;
};

function getSessionSecret() {
    const sessionSecret =
        process.env.AUTH_SESSION_SECRET ||
        (process.env.NODE_ENV !== 'production' ? 'dev-wallet-auth-session-secret' : undefined);

    if (!sessionSecret) {
        throw new Error('AUTH_SESSION_SECRET is not set');
    }

    return sessionSecret;
}

function getChallengeKey(walletAddress: string) {
    return `${AUTH_NONCE_PREFIX}${normalizeWalletAddress(walletAddress)}`;
}

function getCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: AUTH_SESSION_TTL_SECONDS,
    };
}

function getDomain(request: NextRequest) {
    return process.env.NEXT_PUBLIC_BASE_URL
        ? new URL(process.env.NEXT_PUBLIC_BASE_URL).host
        : request.nextUrl.host;
}

export async function createWalletChallenge(
    request: NextRequest,
    walletAddress: string
): Promise<CreateWalletChallengeResult> {
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
    const nonce = randomBytes(18).toString('base64url');
    const issuedAt = new Date().toISOString();
    const message = buildWalletSignInMessage({
        domain: getDomain(request),
        walletAddress: normalizedWalletAddress,
        nonce,
        issuedAt,
    });

    const challenge: WalletAuthChallenge = {
        walletAddress: normalizedWalletAddress,
        nonce,
        message,
        issuedAt,
    };

    await kv.setex(
        getChallengeKey(normalizedWalletAddress),
        AUTH_NONCE_TTL_SECONDS,
        JSON.stringify(challenge)
    );

    return {
        ...challenge,
        expiresIn: AUTH_NONCE_TTL_SECONDS,
    };
}

export async function getWalletChallenge(walletAddress: string) {
    const challenge = await kv.get(getChallengeKey(walletAddress));

    if (!challenge || typeof challenge !== 'string') {
        return null;
    }

    try {
        return JSON.parse(challenge) as WalletAuthChallenge;
    } catch {
        return null;
    }
}

export async function clearWalletChallenge(walletAddress: string) {
    await kv.del(getChallengeKey(walletAddress));
}

export function verifyWalletSignature({
    walletAddress,
    message,
    signature,
}: {
    walletAddress: string;
    message: string;
    signature: Uint8Array;
}) {
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
    const publicKeyBytes = new PublicKey(normalizedWalletAddress).toBytes();
    const messageBytes = new TextEncoder().encode(message);

    return nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes);
}

export function createAuthSession(walletAddress: string) {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + AUTH_SESSION_TTL_SECONDS * 1000);

    return createWalletSessionToken(
        {
            walletAddress: normalizeWalletAddress(walletAddress),
            issuedAt: issuedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
        },
        getSessionSecret()
    );
}

export function setAuthCookie(response: NextResponse, walletAddress: string) {
    const token = createAuthSession(walletAddress);

    response.cookies.set(AUTH_COOKIE_NAME, token, getCookieOptions());
}

export function clearAuthCookie(response: NextResponse) {
    response.cookies.set(AUTH_COOKIE_NAME, '', {
        ...getCookieOptions(),
        maxAge: 0,
    });
}

export function readAuthSessionFromToken(token?: string | null): AuthSession {
    if (!token) {
        return {};
    }

    const payload = verifyWalletSessionToken(token, getSessionSecret());

    if (!payload) {
        return {};
    }

    return {
        userId: payload.walletAddress,
        walletAddress: payload.walletAddress,
        displayName: formatWalletAddress(payload.walletAddress),
    };
}

export async function getAuthSession(request?: NextRequest): Promise<AuthSession> {
    const token = request
        ? request.cookies.get(AUTH_COOKIE_NAME)?.value
        : cookies().get(AUTH_COOKIE_NAME)?.value;

    return readAuthSessionFromToken(token);
}
