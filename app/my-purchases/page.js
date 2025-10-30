'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { addNetworkIfNeeded, getDecryptionKey } from '@/lib/nft';
import Link from 'next/link';
import CryptoJS from 'crypto-js';

export default function MyPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await addNetworkIfNeeded();
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
        fetchPurchases(accounts[0]);
      } catch (error) {
        alert(`Connection error: ${error.message}`);
      }
    } else {
      alert('MetaMask not installed');
    }
  };

  const fetchPurchases = async (address) => {
    try {
      const res = await fetch(`/api/purchases?address=${address}`);
      const data = await res.json();
      setPurchases(data);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const handleDecrypt = async (purchase) => {
    try {
      // Use purchaserTokenId (the token YOU own), not the original uploader's tokenId
      const tokenIdToUse = purchase.purchaserTokenId || purchase.tokenId;
      console.log('Debug: Fetching key for purchaser tokenId:', tokenIdToUse);

      const hashedKey = await getDecryptionKey(tokenIdToUse);
      const key = CryptoJS.enc.Utf8.parse(walletAddress.slice(2));
      const derivedHashedKey = CryptoJS.SHA256(key.toString()).toString();

      console.log('Debug: Derived key:', derivedHashedKey, 'Expected key:', hashedKey);
      if (derivedHashedKey !== hashedKey) throw new Error('Key mismatch');

      console.log('Debug: Key verified! Downloading file...');

      // NOTE: Files are currently uploaded unencrypted to Lighthouse.
      // For demo, we skip decryption and download directly.
      // TODO: Implement client-side encryption on upload + decryption here for real security.
      const fileResponse = await fetch(`https://gateway.lighthouse.storage/ipfs/${purchase.cid}`);
      const fileBlob = await fileResponse.blob();

      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = purchase.title || 'research-paper';
      a.click();
      URL.revokeObjectURL(url);
      setToast({ type: 'success', message: '✅ Access verified. Download started!' });
      setTimeout(() => setToast(null), 3500);
    } catch (error) {
      setToast({ type: 'error', message: `Decrypt error: ${error.message}` });
      setTimeout(() => setToast(null), 4000);
    }
  };

  useEffect(() => {
    addNetworkIfNeeded();
    if (walletConnected && walletAddress) {
      fetchPurchases(walletAddress);
    }
  }, [walletConnected, walletAddress]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">My Purchased Papers</h1>
            <p className="mt-1 text-gray-600">Secure access to Research Papers you own.</p>
          </div>
          <div>
            {walletConnected ? (
              <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 border border-green-200">
                ✅ Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </span>
            ) : (
              <button
                onClick={connectWallet}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition [box-shadow:0_0_0_0_rgba(0,112,243,0.0)] hover:[box-shadow:0_0_0_8px_rgba(0,112,243,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Not connected state */}
        {!walletConnected && (
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-200" />
              <h2 className="mt-4 text-xl font-semibold text-gray-900">🔌 Connect Wallet to View Your Purchased Research Papers</h2>
              <p className="mt-2 text-sm text-gray-600">Only you can access your research papers.</p>
              <button
                onClick={connectWallet}
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Connect Wallet
              </button>
              <div className="mt-4">
                <Link href="/datasets" className="text-blue-600 hover:underline">← Back to Marketplace</Link>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {walletConnected && loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="aspect-video bg-slate-100 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-slate-100 rounded w-2/3 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
                  <div className="h-9 bg-slate-100 rounded w-full animate-pulse mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Purchases grid */}
        {walletConnected && !loading && (
          <>
            {Array.isArray(purchases) && purchases.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {purchases.map((purchase) => (
                  <li key={purchase._id} className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition hover:shadow-lg">
                    {/* Image */}
                    <div className="aspect-video bg-slate-100">
                      {purchase.imageCid ? (
                        <img
                          src={`https://gateway.lighthouse.storage/ipfs/${purchase.imageCid}`}
                          alt={purchase.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{purchase.title}</h3>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{purchase.description}</p>
                      <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                        <span className="font-medium text-gray-700">Version:</span> {purchase.version}
                        <span className="text-gray-300">•</span>
                        <span className="font-medium text-gray-700">Uploaded:</span> {new Date(purchase.uploadedAt).toLocaleString()}
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => handleDecrypt(purchase)}
                          title="Only token holders can decrypt this research paper"
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0070F3] to-[#00A3FF] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <span>🔒</span>
                          <span>Decrypt & Download</span>
                        </button>
                        {purchase.purchaseTxHash && (
                          <a
                            href={`https://calibration.filscan.io/search?value=${purchase.purchaseTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50"
                          >
                            View Tx
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-10 flex justify-center">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-200" />
                  <h2 className="mt-4 text-xl font-semibold text-gray-900">You haven’t purchased any research papers yet</h2>
                  <p className="mt-2 text-sm text-gray-600">Browse the marketplace to discover premium AI/ML research papers.</p>
                  <Link
                    href="/datasets"
                    className="mt-5 inline-flex items-center justify-center rounded-lg border border-blue-600 px-5 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    Browse Marketplace
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer link */}
        <div className="mt-10">
          <Link href="/datasets" className="text-blue-600 hover:underline">← Back to Marketplace</Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-40">
          <div className={`rounded-lg border px-4 py-3 shadow-md ${toast.type === 'success' ? 'bg-white border-green-200 text-green-700' : 'bg-white border-red-200 text-red-700'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}