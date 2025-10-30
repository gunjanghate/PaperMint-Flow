'use client';

// Install animations: npm i framer-motion

import Link from 'next/link';
import { motion } from 'framer-motion';

export default function Hero() {
    return (
        <section className="relative min-h-[88vh] overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 isolate">
            {/* /* Subtle grid background with radial mask */} 
                        <div className="pointer-events-none absolute inset-0 -z-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] [background-image:linear-gradient(to_right,rgba(100,116,139,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,116,139,0.15)_1px,transparent_1px)] bg-[size:24px_24px]" />

                        {/* Ambient radial lights */}
            <div className="pointer-events-none absolute -top-24 -right-24 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.18),_transparent_90%)] blur-3xl -z-10" />
            <div className="pointer-events-none absolute -bottom-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.14),_transparent_60%)] blur-3xl -z-10" />

            {/* Floating gradient orbs */}
            <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-24 h-32 w-32 -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 opacity-50 blur-2xl"
                initial={{ y: 0, opacity: 0.45 }}
                animate={{ y: [0, -12, 0], opacity: [0.45, 0.6, 0.45] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
                aria-hidden
                className="pointer-events-none absolute right-12 top-1/3 h-24 w-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-300 opacity-40 blur-2xl"
                initial={{ y: 0, opacity: 0.4 }}
                animate={{ y: [0, 10, 0], opacity: [0.35, 0.5, 0.35] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
            />

            <div className="mx-auto max-w-6xl px-6 py-12">
                {/* Centered content card with subtle border glow */}
                <div className="relative mx-auto max-w-3xl rounded-3xl border border-slate-200/70 bg-white/70 p-8 sm:p-10 text-center shadow-sm backdrop-blur">
                    <div className="pointer-events-none absolute inset-0 rounded-3xl [background:radial-gradient(60%_60%_at_50%_0%,_rgba(59,130,246,0.08),_transparent)]" />

                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="relative inline-flex items-center justify-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                        Filecoin‑powered Research Marketplace
                    </motion.div>

                    {/* Heading */}
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.05 }}
                        className="mt-4 text-4xl sm:text-5xl font-semibold tracking-tight"
                    >
                        <span className="bg-gradient-to-b from-slate-900 to-slate-700 bg-clip-text text-transparent">
                            Advance Research with Transparent, Incentivized Peer Review
                        </span>
                    </motion.h1>

                    {/* Subheading */}
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.12 }}
                        className="mx-auto mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600"
                    >
                        Publish datasets and papers, earn rewards, and verify results on an open network.
                        NFT‑gated access ensures creators are rewarded while keeping science transparent.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.18 }}
                        className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link
                            href="/upload-dataset"
                            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0070F3] to-[#00A3FF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0070F3] focus-visible:ring-offset-2"
                        >
                            Upload Dataset
                            <span className="ml-2">↗</span>
                        </Link>
                        <Link
                            href="/datasets"
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                        >
                            Browse Marketplace
                        </Link>
                    </motion.div>

                    {/* Trust bar */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="mt-6 text-xs sm:text-sm text-slate-500"
                    >
                        <span>Powered by Filecoin</span>
                        <span className="mx-2">•</span>
                        <span>Incentivized Peer Review</span>
                        <span className="mx-2">•</span>
                        <span>Open & Verifiable</span>
                    </motion.p>
                </div>

                {/* Quick stats */}
                <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3 text-center">
                    <div className="rounded-xl border border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
                        <div className="text-2xl font-semibold text-slate-900">NFT‑Gated</div>
                        <div className="mt-1 text-xs text-slate-600">Secure access with on‑chain keys</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
                        <div className="text-2xl font-semibold text-slate-900">IPFS + Filecoin</div>
                        <div className="mt-1 text-xs text-slate-600">Decentralized storage by default</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white/70 px-6 py-4 backdrop-blur">
                        <div className="text-2xl font-semibold text-slate-900">Creator Rewards</div>
                        <div className="mt-1 text-xs text-slate-600">Transparent incentives for sharing</div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Sample usage (app/page.js)
// -------------------------------------------------
// import Hero from '@/components/hero/Hero';
//
// export default function Page() {
//   return (
//     <main>
//       <Hero />
//       {/* rest of your page */}
//     </main>
//   );
// }
