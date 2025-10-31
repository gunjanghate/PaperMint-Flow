'use client';

import { useWallet } from './WalletProvider';

export default function WalletButton({ size = 'md' }) {
    const { walletAddress, isConnected, connectWallet, disconnectWallet, truncate } = useWallet();

    const base = size === 'sm'
        ? 'px-3 py-2 text-sm'
        : 'px-4 py-2 text-sm';

    if (isConnected) {
        return (
            <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 border border-green-200">
                    {truncate(walletAddress)}
                </span>
                <button
                    onClick={disconnectWallet}
                    className={`inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white ${base} font-medium text-slate-700 hover:bg-slate-50`}
                >
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={connectWallet}
            className={`inline-flex items-center justify-center rounded-xl bg-blue-600 ${base} font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}
        >
            Connect Wallet
        </button>
    );
}
