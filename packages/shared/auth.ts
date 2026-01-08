import { createHmac, timingSafeEqual } from 'crypto';

export const AUTH_COOKIE_NAME = 'delph_wallet_session';
export const AUTH_NONCE_PREFIX = 'llmchat:wallet_auth:nonce:';
export const AUTH_NONCE_TTL_SECONDS = 60 * 5;
export const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type WalletAuthChallenge = {
    walletAddress: string;
    nonce: string;
    message: string;
    issuedAt: string;
};

export type WalletSessionPayload = {
    walletAddress: string;
    issuedAt: string;
    expiresAt: string;
};

export function normalizeWalletAddress(walletAddress: string) {
    return walletAddress.trim();
}

export function formatWalletAddress(walletAddress: string, visibleChars: number = 4) {
    if (walletAddress.length <= visibleChars * 2) {
        return walletAddress;
    }

    return `${walletAddress.slice(0, visibleChars)}...${walletAddress.slice(-visibleChars)}`;
}

export function buildWalletSignInMessage({
    domain,
    walletAddress,
    nonce,
    issuedAt,
}: {
    domain: string;
    walletAddress: string;
    nonce: string;
    issuedAt: string;
}) {
    return [
        `${domain} wants you to sign in with your Solana account:`,
        walletAddress,
        '',
        'Sign this message to confirm you own this wallet and sign in to Delph.',
        '',
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
    ].join('\n');
}

function toBase64Url(value: string | Buffer) {
    return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

export function createWalletSessionToken(payload: WalletSessionPayload, secret: string) {
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');

    return `${encodedPayload}.${signature}`;
}

export function verifyWalletSessionToken(token: string, secret: string) {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
        return null;
    }

    const expectedSignature = createHmac('sha256', secret).update(encodedPayload).digest('base64url');
    const providedSignature = Buffer.from(signature);
    const computedSignature = Buffer.from(expectedSignature);

    if (providedSignature.length !== computedSignature.length) {
        return null;
    }

    if (!timingSafeEqual(providedSignature, computedSignature)) {
        return null;
    }

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload)) as WalletSessionPayload;

        if (!payload.walletAddress || !payload.issuedAt || !payload.expiresAt) {
            return null;
        }

        if (new Date(payload.expiresAt).getTime() <= Date.now()) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}
