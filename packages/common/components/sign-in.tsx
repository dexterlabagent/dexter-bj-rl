import { useAuth } from '@repo/common/context';
import { Button } from '@repo/ui';
import { IconX } from '@tabler/icons-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
type CustomSignInProps = {
    onClose?: () => void;
};

const encodeSignature = (signature: Uint8Array) => {
    return window.btoa(String.fromCharCode(...Array.from(signature)));
};

const formatWalletAddress = (walletAddress: string) => {
    if (walletAddress.length <= 8) {
        return walletAddress;
    }

    return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
};

export const CustomSignIn = ({ onClose }: CustomSignInProps) => {
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);
    const { isSignedIn, isLoaded, refreshSession, walletAddress } = useAuth();
    const { wallets, wallet, publicKey, connected, connect, disconnect, select, signMessage } =
        useWallet();
    const router = useRouter();
    const availableWallets = useMemo(
        () => wallets.filter(item => item.readyState !== 'Unsupported'),
        [wallets]
    );

    const handleConnect = async () => {
        if (!selectedWalletName) {
            setError('Choose a wallet to continue.');
            return;
        }

        setIsLoading('connect');
        setError('');

        try {
            select(selectedWalletName as Parameters<typeof select>[0]);
            await connect();
        } catch (connectError) {
            console.error('Wallet connection error:', connectError);
            setError('Unable to connect that wallet. Please try again.');
        } finally {
            setIsLoading(null);
        }
    };

    const handleSignIn = async () => {
        if (!publicKey) {
            setError('Connect your wallet before signing in.');
            return;
        }

        if (!signMessage) {
            setError('This wallet does not support message signing.');
            return;
        }

        setIsLoading('sign');
        setError('');

        try {
            const address = publicKey.toBase58();
            const nonceResponse = await fetch('/api/auth/nonce', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ walletAddress: address }),
            });

            const noncePayload = await nonceResponse.json();

            if (!nonceResponse.ok || !noncePayload.message) {
                throw new Error(noncePayload.error || 'Failed to create sign-in challenge');
            }

            const signatureBytes = await signMessage(
                new TextEncoder().encode(noncePayload.message as string)
            );

            const verifyResponse = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    walletAddress: address,
                    message: noncePayload.message,
                    signature: encodeSignature(signatureBytes),
                }),
            });

            const verifyPayload = await verifyResponse.json();

            if (!verifyResponse.ok) {
                throw new Error(verifyPayload.error || 'Failed to verify wallet ownership');
            }

            await refreshSession();
            onClose?.();
            router.push('/chat');
        } catch (signInError) {
            console.error('Wallet sign-in error:', signInError);
            setError(
                signInError instanceof Error
                    ? signInError.message
                    : 'Unable to sign you in with that wallet.'
            );
        } finally {
            setIsLoading(null);
        }
    };

    if (!isLoaded) {
        return null;
    }

    return (
        <>
            <Button
                onClick={() => {
                    onClose?.();
                }}
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2"
            >
                <IconX className="h-4 w-4" />
            </Button>
            <div className="flex w-[320px] flex-col items-center gap-8">
                <h2 className="text-muted-foreground/70 text-center text-[24px] font-semibold leading-tight">
                    Connect a Solana wallet <br /> to unlock advanced research tools
                </h2>

                <div className="flex w-[300px] flex-col space-y-1.5">
                    {isSignedIn && walletAddress ? (
                        <div className="border-border/60 bg-secondary flex flex-col gap-3 rounded-2xl border p-4 text-sm">
                            <div className="text-center">
                                <p className="font-medium">Wallet connected</p>
                                <p className="text-muted-foreground">{formatWalletAddress(walletAddress)}</p>
                            </div>
                            <Button
                                onClick={() => {
                                    onClose?.();
                                    router.push('/chat');
                                }}
                            >
                                Continue to chat
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                {availableWallets.map(walletOption => (
                                    <Button
                                        key={walletOption.adapter.name}
                                        variant={
                                            selectedWalletName === walletOption.adapter.name
                                                ? 'default'
                                                : 'bordered'
                                        }
                                        onClick={() => {
                                            setSelectedWalletName(walletOption.adapter.name);
                                            setError('');
                                            select(walletOption.adapter.name);
                                        }}
                                    >
                                        {walletOption.adapter.name}
                                    </Button>
                                ))}
                            </div>

                            <div className="border-border/60 bg-secondary flex w-full flex-col gap-3 rounded-2xl border p-4 text-sm">
                                <div className="text-center">
                                    <p className="font-medium">
                                        {connected && publicKey
                                            ? `Connected: ${formatWalletAddress(publicKey.toBase58())}`
                                            : selectedWalletName
                                              ? `Selected wallet: ${selectedWalletName}`
                                              : 'Choose a wallet to continue'}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        You will be asked to sign a one-time message to confirm wallet
                                        ownership.
                                    </p>
                                </div>

                                {!connected ? (
                                    <Button
                                        onClick={handleConnect}
                                        disabled={!selectedWalletName || isLoading === 'connect'}
                                    >
                                        {isLoading === 'connect'
                                            ? 'Connecting...'
                                            : selectedWalletName
                                              ? `Connect ${selectedWalletName}`
                                              : 'Select a wallet first'}
                                    </Button>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <Button onClick={handleSignIn} disabled={isLoading === 'sign'}>
                                            {isLoading === 'sign'
                                                ? 'Waiting for signature...'
                                                : 'Sign message to continue'}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            onClick={async () => {
                                                await disconnect();
                                            }}
                                        >
                                            Disconnect wallet
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
                {error && <p className="text-center text-sm text-rose-400">{error}</p>}
                <div className="text-muted-foreground/50 w-full text-center text-xs">
                    <span className="text-muted-foreground/50">
                        By using this app, you agree to the{' '}
                    </span>
                    <a href="/terms" className="hover:text-foreground underline">
                        Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" className="hover:text-foreground underline">
                        Privacy Policy
                    </a>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
                    Close
                </Button>
            </div>
        </>
    );
};
