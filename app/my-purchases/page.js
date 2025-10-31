"use client";

import { useState, useEffect } from "react";
import { addNetworkIfNeeded, getDecryptionKey } from "@/lib/nft";
import Link from "next/link";
import CryptoJS from "crypto-js";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function MyPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const { walletAddress, isConnected: walletConnected, connectWallet } = useWallet();
  const [toast, setToast] = useState(null);

  const explorerTxUrl = (hash) =>
    `https://evm-testnet.flowscan.io//tx/${hash}`;

  // connectWallet is provided by WalletProvider

  const fetchPurchases = async (address) => {
    try {
      const res = await fetch(`/api/purchases?address=${address}`);
      const data = await res.json();
      setPurchases(data);
      setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setLoading(false);
    }
  };

  const handleDecrypt = async (purchase) => {
    try {
      const tokenIdToUse = purchase.purchaserTokenId || purchase.tokenId;

      const hashedKey = await getDecryptionKey(tokenIdToUse);
      const key = CryptoJS.enc.Utf8.parse(walletAddress.slice(2));
      const derivedHashedKey = CryptoJS.SHA256(key.toString()).toString();

      if (derivedHashedKey !== hashedKey) throw new Error("Key mismatch");

      const fileResponse = await fetch(
        `https://gateway.lighthouse.storage/ipfs/${purchase.cid}`
      );
      const fileBlob = await fileResponse.blob();

      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = purchase.title || "research-paper";
      a.click();
      URL.revokeObjectURL(url);

      setToast({ type: "success", message: "✅ Access verified. Download started!" });
      setTimeout(() => setToast(null), 3500);
    } catch (error) {
      setToast({ type: "error", message: `Decrypt error: ${error.message}` });
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
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:shadow-md"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Not connected */}
        {!walletConnected && (
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm">
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                🔌 Connect Wallet to View Purchased Papers
              </h2>
              <p className="mt-2 text-sm text-gray-600">Only you can access your papers.</p>

              <button
                onClick={connectWallet}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:shadow-md"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {walletConnected && loading && (
          <div className="text-center text-gray-600">Loading purchases...</div>
        )}

        {/* Purchases */}
        {walletConnected && !loading && (
          <>
            {Array.isArray(purchases) && purchases.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {purchases.map((purchase) => {
                  const tokenId = purchase.purchaserTokenId || purchase.tokenId;
                  return (
                    <li key={purchase._id} className="group rounded-xl border bg-white shadow-sm hover:shadow-lg overflow-hidden">
                      <div className="aspect-video bg-slate-100">
                        {purchase.imageCid && (
                          <img
                            src={`https://gateway.lighthouse.storage/ipfs/${purchase.imageCid}`}
                            alt={purchase.title}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                          {purchase.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                          {purchase.description}
                        </p>

                        {/* Token + metadata + tx */}
                        <div className="mt-3 space-y-1 text-xs text-gray-700">

                          {/* Token ID */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Token ID:</span> {tokenId}
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tokenId);
                                setToast({ type: "success", message: "Copied Token ID!" });
                              }}
                              className="text-blue-600 hover:underline"
                            >
                              Copy
                            </button>
                          </div>

                          {/* Metadata */}
                          {purchase.metadataCid && (
                            <a
                              href={`https://gateway.lighthouse.storage/ipfs/${purchase.metadataCid}`}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              View metadata.json
                            </a>
                          )}

                          {/* Raw file */}
                          {purchase.cid && (
                            <a
                              href={`https://gateway.lighthouse.storage/ipfs/${purchase.cid}`}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              View raw file
                            </a>
                          )}

                          {/* Explorer */}
                          {purchase.purchaseTxHash && (
                            <a
                              href={explorerTxUrl(purchase.purchaseTxHash)}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              View Purchase Tx
                            </a>
                          )}
                        </div>

                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => handleDecrypt(purchase)}
                            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-400 text-sm font-medium text-white px-3 py-2 hover:shadow-md"
                          >
                            🔒 Decrypt & Download
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-center text-gray-600 mt-10">
                No purchases yet.
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link href="/datasets" className="text-blue-600 hover:underline">
            ← Back to Marketplace
          </Link>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-40">
          <div
            className={`rounded-lg border px-4 py-3 shadow-md ${toast.type === "success"
                ? "bg-white border-green-200 text-green-700"
                : "bg-white border-red-200 text-red-700"
              }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
