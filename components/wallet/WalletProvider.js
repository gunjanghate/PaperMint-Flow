'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { addNetworkIfNeeded } from '@/lib/nft';

const WalletContext = createContext({
    walletAddress: null,
    isConnected: false,
    connectWallet: async () => { },
    disconnectWallet: () => { },
});

function truncate(addr) {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
}

export function WalletProvider({ children }) {
    const [walletAddress, setWalletAddress] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const connectWallet = async () => {
        if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
            alert('MetaMask not installed');
            return;
        }
        try {
            await addNetworkIfNeeded();
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setWalletAddress(accounts[0]);
            setIsConnected(true);
        } catch (error) {
            alert(`Connection error: ${error.message}`);
        }
    };

    const disconnectWallet = () => {
        // Clear local UI state; MetaMask doesn't support programmatic disconnect
        setWalletAddress(null);
        setIsConnected(false);
    };

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') return;

        // Initialize from current accounts
        window.ethereum
            .request({ method: 'eth_accounts' })
            .then((accounts) => {
                if (accounts && accounts.length > 0) {
                    setWalletAddress(accounts[0]);
                    setIsConnected(true);
                }
            })
            .catch(() => { });

        const handleAccountsChanged = (accounts) => {
            if (!accounts || accounts.length === 0) {
                setWalletAddress(null);
                setIsConnected(false);
            } else {
                setWalletAddress(accounts[0]);
                setIsConnected(true);
            }
        };

        const handleChainChanged = () => {
            // Optional: refresh UI on chain change
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            try {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            } catch { }
        };
    }, []);

    const value = useMemo(() => ({
        walletAddress,
        isConnected,
        connectWallet,
        disconnectWallet,
        truncate,
    }), [walletAddress, isConnected]);

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
    return useContext(WalletContext);
}
