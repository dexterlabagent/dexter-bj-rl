'use server';

import { AUTH_COOKIE_NAME, verifyWalletSessionToken } from '@repo/shared/auth';
import { cookies } from 'next/headers';

const getSessionSecret = () => {
    const sessionSecret =
        process.env.AUTH_SESSION_SECRET ||
        (process.env.NODE_ENV !== 'production' ? 'dev-wallet-auth-session-secret' : undefined);

    if (!sessionSecret) {
        throw new Error('AUTH_SESSION_SECRET is not set');
    }

    return sessionSecret;
};

export const submitFeedback = async (feedback: string) => {
    const token = cookies().get(AUTH_COOKIE_NAME)?.value;
    const session = token ? verifyWalletSessionToken(token, getSessionSecret()) : null;
    const userId = session?.walletAddress;

    if (!userId) {
        return { error: 'Unauthorized' };
    }

    return feedback;
};
