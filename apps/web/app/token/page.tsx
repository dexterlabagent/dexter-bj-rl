'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@repo/ui';
import { ExternalLink, Flame, ArrowRight } from 'lucide-react';
import Image from 'next/image';

const TOTAL_SUPPLY = 1_000_000_000;

type TokenPair = {
    priceUsd: string;
    priceChange: { m5: number; h1: number; h6: number; h24: number };
    marketCap: number;
    url: string;
    baseToken: { address: string; symbol: string };
};

function formatUsd(n: number) {
    if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
}

function formatPrice(n: number) {
    if (n < 0.0001) return `$${n.toFixed(8)}`;
    if (n < 1) return `$${n.toFixed(6)}`;
    if (n < 100) return `$${n.toFixed(4)}`;
    return `$${n.toFixed(2)}`;
}

function PriceChange({ value }: { value: number }) {
    const isPositive = value >= 0;
    return (
        <span className={`text-lg font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{value.toFixed(2)}%
        </span>
    );
}

// Fake chart SVG that gets blurred
function BlurredChart() {
    const bars = [
        38, 42, 35, 50, 46, 52, 48, 55, 60, 53, 58, 62, 56, 64, 59, 67, 63, 70, 65, 72,
        68, 60, 55, 62, 58, 65, 70, 74, 68, 72,
    ];
    return (
        <div className="relative">
            <div className="blur-[6px] pointer-events-none select-none">
                <svg viewBox="0 0 600 200" className="w-full h-48" preserveAspectRatio="none">
                    {bars.map((h, i) => (
                        <rect
                            key={i}
                            x={i * 20 + 2}
                            y={200 - h * 2.5}
                            width={16}
                            height={h * 2.5}
                            rx={2}
                            fill="hsl(39, 16%, 47%)"
                            opacity={0.6}
                        />
                    ))}
                </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-muted-foreground text-sm font-medium bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-border">
                    Chart coming soon
                </span>
            </div>
        </div>
    );
}

// Fake bar chart for buy & burn section
function BurnChart() {
    const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
    const values = [45, 52, 48, 78, 0, 0];
    const max = Math.max(...values);
    return (
        <div className="flex items-end gap-3 h-40">
            {months.map((m, i) => (
                <div key={m} className="flex flex-col items-center gap-2 flex-1">
                    {values[i] > 0 ? (
                        <div
                            className="w-full rounded-md bg-brand transition-all"
                            style={{ height: `${(values[i] / max) * 120}px` }}
                        />
                    ) : (
                        <div className="w-full rounded-md border border-dashed border-border" style={{ height: '20px' }} />
                    )}
                    <span className="text-muted-foreground text-xs">{m}</span>
                </div>
            ))}
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-2xl px-6 py-16 space-y-10">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="h-8 w-40" />
                </div>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        </div>
    );
}

export default function TokenDashboardPage() {
    const { data: token, isLoading, error } = useQuery<TokenPair>({
        queryKey: ['token-data'],
        queryFn: async () => {
            const res = await fetch('/api/token');
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json();
        },
        refetchInterval: 30_000,
    });

    if (isLoading) return <DashboardSkeleton />;

    if (error || !token) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-2">
                    <p className="text-foreground text-lg font-medium">Failed to load token data</p>
                    <p className="text-muted-foreground text-sm">Check that the token address is configured.</p>
                </div>
            </div>
        );
    }

    const price = parseFloat(token.priceUsd);
    const change24h = token.priceChange.h24;

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-2xl px-6 py-16 space-y-10">
                {/* Header */}
                <div className="bg-secondary rounded-2xl border border-border p-6 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <Image
                                src="/delph-logo.png"
                                alt="DELPH"
                                width={48}
                                height={48}
                                className="h-12 w-auto object-contain"
                            />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="font-clash text-2xl font-bold text-foreground">DELPH</h1>
                                    <a
                                        href={token.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    The utility token powering Delph AI.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Price + Market Cap */}
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-muted-foreground text-xs mb-1">DELPH Price</p>
                            <div className="flex items-baseline gap-3">
                                <span className="text-3xl font-bold text-foreground">
                                    {formatPrice(price)}
                                </span>
                                <PriceChange value={change24h} />
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-muted-foreground text-xs mb-1">Market Cap</p>
                            <span className="text-2xl font-bold text-foreground">
                                {formatUsd(token.marketCap)}
                            </span>
                        </div>
                    </div>

                    {/* Supply bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-xs">Token Supply</p>
                            <p className="text-foreground text-sm font-medium">
                                Total Supply: <span className="font-bold">1B</span>
                            </p>
                        </div>
                        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-brand/70"
                                style={{
                                    width: `${Math.min(100, (token.marketCap / (price * TOTAL_SUPPLY)) * 100)}%`,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Blurred chart */}
                <div className="bg-secondary rounded-2xl border border-border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-foreground font-semibold">Price Chart</h2>
                        <div className="flex items-center gap-1">
                            {['1D', '1W', '1M', '3M', '6M'].map((tf, i) => (
                                <button
                                    key={tf}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        i === 2
                                            ? 'bg-brand text-brand-foreground'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                    <BlurredChart />
                </div>

                {/* Buy and Burn */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/20">
                            <Flame size={20} className="text-brand" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">DELPH Buy and Burn</h2>
                    </div>

                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Buy and burn is funded by user subscriptions and API credits.
                        40% of the API and user revenue is used to buy back and burn the token.
                    </p>

                    <div className="bg-secondary rounded-2xl border border-border p-6 relative">
                        <div className="blur-[6px] pointer-events-none select-none">
                            <BurnChart />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-muted-foreground text-sm font-medium bg-background/80 backdrop-blur-sm px-4 py-2 rounded-lg border border-border">
                                Coming soon
                            </span>
                        </div>
                    </div>

                    <a
                        href={`https://solscan.io/token/${token.baseToken.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-brand text-sm font-medium hover:underline"
                    >
                        View Transactions <ArrowRight size={14} />
                    </a>
                </div>

                {/* About */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-foreground">About Delph</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        Delph is an AI-powered research platform with agentic workflows and access to a wide variety
                        of models. It enables deep, multi-step research with web search, document analysis, and
                        intelligent conversations — all in one place. The DELPH token powers the platform economy,
                        giving holders access to premium features, API credits, and governance over the protocol.
                    </p>
                </div>
            </div>
        </div>
    );
}
