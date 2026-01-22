'use client';

import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

type AuthUser = {
    id: string;
    fullName: string;
    hasImage: false;
    imageUrl: null;
    walletAddress: string;
};

type SessionResponse = {
    authenticated: boolean;
    userId: string | null;
    walletAddress: string | null;
    displayName: string | null;
};

type AuthContextValue = {
    isLoaded: boolean;
    isSignedIn: boolean;
    userId: string | null;
    walletAddress: string | null;
    user: AuthUser | null;
    refreshSession: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const formatWalletAddress = (walletAddress: string) => {
    if (walletAddress.length <= 8) {
        return walletAddress;
    }

    return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
};

const WalletAuthSessionProvider = ({ children }: { children: ReactNode }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [session, setSession] = useState<SessionResponse | null>(null);
    const { disconnect } = useWallet();

    const refreshSession = useCallback(async () => {
        try {
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                credentials: 'include',
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch wallet session');
            }

            const nextSession = (await response.json()) as SessionResponse;
            setSession(nextSession);
        } catch (error) {
            console.error('Failed to refresh wallet session:', error);
            setSession({
                authenticated: false,
                userId: null,
                walletAddress: null,
                displayName: null,
            });
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const signOut = useCallback(async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } finally {
            try {
                await disconnect();
            } catch (error) {
                console.warn('Failed to disconnect wallet after sign out:', error);
            }

            setSession({
                authenticated: false,
                userId: null,
                walletAddress: null,
                displayName: null,
            });
        }
    }, [disconnect]);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    const user = useMemo(() => {
        if (!session?.authenticated || !session.userId || !session.walletAddress) {
            return null;
        }

        return {
            id: session.userId,
            fullName: session.displayName || formatWalletAddress(session.walletAddress),
            hasImage: false as const,
            imageUrl: null,
            walletAddress: session.walletAddress,
        };
    }, [session]);

    const value = useMemo<AuthContextValue>(
        () => ({
            isLoaded,
            isSignedIn: !!session?.authenticated && !!session.userId,
            userId: session?.userId ?? null,
            walletAddress: session?.walletAddress ?? null,
            user,
            refreshSession,
            signOut,
        }),
        [isLoaded, refreshSession, session, signOut, user]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const WalletAuthProvider = ({ children }: { children: ReactNode }) => {
    const network =
        (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'testnet' | 'mainnet-beta' | undefined) ||
        'mainnet-beta';
    const endpoint = useMemo(
        () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network),
        [network]
    );
    const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as typeof window & { Buffer?: typeof Buffer }).Buffer) {
            (window as typeof window & { Buffer?: typeof Buffer }).Buffer = Buffer;
        }
    }, []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect={false}>
                <WalletAuthSessionProvider>{children}</WalletAuthSessionProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within a WalletAuthProvider');
    }

    return context;
};

export const useUser = () => {
    const auth = useAuth();

    return {
        isLoaded: auth.isLoaded,
        isSignedIn: auth.isSignedIn,
        user: auth.user,
    };
};
