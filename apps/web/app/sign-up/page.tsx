import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Sign up',
    description: 'Subscription service coming soon — Delph',
};

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
                <h1 className="text-3xl font-bold tracking-tight">Sign up</h1>
                <p className="text-muted-foreground mt-4 text-lg">
                    Subscription service coming soon.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <Link
                        href="/"
                        className="text-primary hover:underline"
                    >
                        Back to home
                    </Link>
                    <span className="text-muted-foreground hidden sm:inline" aria-hidden>
                        ·
                    </span>
                    <Link
                        href="/sign-in"
                        className="text-primary hover:underline"
                    >
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}
