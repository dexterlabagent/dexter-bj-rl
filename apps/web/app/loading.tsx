import Image from 'next/image';

export default function Loading() {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#2d2d2d]">
            <div
                className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(217,189,114,0.16),_transparent_38%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.06),_transparent_42%)]"
                aria-hidden
            />

            <div className="relative flex flex-col items-center gap-6 px-6">
                <div className="absolute inset-0 rounded-full bg-[#d9bd72]/10 blur-3xl" aria-hidden />

                <div className="relative flex h-28 w-28 items-center justify-center">
                    <div
                        className="absolute -inset-3 animate-spin rounded-[2.4rem] border border-[#8c7f66]/20 border-t-[#d9bd72]"
                        aria-hidden
                    />
                    <div className="absolute inset-[10px]" />
                    <div className="relative flex h-full w-full animate-pulse items-center justify-center rounded-[2rem]">
                        <Image
                            src="/delph-logo.png"
                            alt="Delph"
                            width={70}
                            height={70}
                            priority
                            className="h-[70px] w-auto object-contain"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
