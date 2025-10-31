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
      console.log("Fetched purchases:", data);
      console.log("dec key", data[0].decryptionKey)
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
      const decKey = purchase.decryption;
      console.log("Using decryption key:", decKey);

      

     

      const fileResponse = await fetch(
        `https://gateway.lighthouse.storage/ipfs/${purchase.cid}`
      );
      if(!fileResponse){
        throw new Error("File fetch failed from ipfs");

      }
      const encText = await fileResponse.text(); 
      const decrypted = CryptoJS.AES.decrypt(encText, decKey);

      const decryptedBytes = decrypted.sigBytes;

      if (!decryptedBytes) throw new Error("Decryption failed — invalid key or file");

      const decryptedWordArray = decrypted;
      const typedArray = new Uint8Array(decryptedWordArray.sigBytes);
      const words = decryptedWordArray.words;
      for (let i = 0; i < decryptedWordArray.sigBytes; i++) {
        typedArray[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      }

      // STEP 4: Convert back to original Blob
      const blob = new Blob([typedArray], { type: purchase.fileType || "application/octet-stream" });

      // STEP 5: Download decrypted file
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = purchase.title || "decrypted_file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({ type: "success", message: "✅ File decrypted and downloaded successfully!" });
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">My Purchased Papers</h1>
            <p className="mt-1 text-gray-600">
              Secure access to Research Papers you own{walletConnected && !loading ? ` • ${purchases?.length || 0} item(s)` : ""}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {walletConnected ? (
              <>
                <span
                  className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 border border-green-200"
                  title={walletAddress}
                >
                  ✅ Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </span>
                <button
                  onClick={() => walletAddress && fetchPurchases(walletAddress)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:shadow-sm"
                >
                  ↻ Refresh
                </button>
                <Link
                  href="/datasets"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:shadow-md"
                >
                  Explore Market
                </Link>
              </>
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
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">🔐</div>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">
                Connect Wallet to View Purchased Papers
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
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="rounded-xl border bg-white shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-video bg-slate-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 bg-slate-200 rounded" />
                  <div className="h-3 w-full bg-slate-200 rounded" />
                  <div className="h-3 w-5/6 bg-slate-200 rounded" />
                  <div className="mt-2 h-9 w-full bg-slate-200 rounded" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Purchases */}
        {walletConnected && !loading && (
          <>
            {Array.isArray(purchases) && purchases.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {purchases.map((purchase) => {
                  console.log("purchase in map", purchase);
                  const tokenId = purchase.purchaserTokenId || purchase.tokenId;
                  return (
                    <li
                      key={purchase._id}
                      className="group rounded-xl border bg-white shadow-sm hover:shadow-lg overflow-hidden transition-shadow"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {purchase.imageCid ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://gateway.lighthouse.storage/ipfs/${purchase.imageCid}`}
                            alt={purchase.title || "Dataset cover"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='%23f1f5f9'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-family='sans-serif' font-size='18'>No preview</text></svg>";
                            }}
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            No preview
                          </div>
                        )}
                        <div className="absolute top-3 left-3">
                          <span className="rounded-full bg-white/90 backdrop-blur px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
                            Encrypted
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="text-base font-semibold text-gray-900 line-clamp-1" title={purchase.title}>
                          {purchase.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-600 line-clamp-2" title={purchase.description}>
                          {purchase.description}
                        </p>

                        {/* Token + metadata + tx */}
                        <div className="mt-3 space-y-2 text-xs text-gray-700">
                          {/* Token ID */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Token ID:</span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                              {tokenId}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tokenId);
                                setToast({ type: "success", message: "Copied Token ID!" });
                                setTimeout(() => setToast(null), 1500);
                              }}
                              className="text-blue-600 hover:underline"
                              title="Copy Token ID"
                            >
                              Copy
                            </button>
                          </div>

                          {/* Metadata */}
                          {purchase.metadataCid && (
                            <a
                              href={`https://gateway.lighthouse.storage/ipfs/${purchase.metadataCid}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              rel="noreferrer"
                              title="Open metadata.json"
                            >
                              🧩 View metadata.json
                            </a>
                          )}

                          {/* Raw file */}
                          {purchase.cid && (
                            <a
                              href={`https://gateway.lighthouse.storage/ipfs/${purchase.cid}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              rel="noreferrer"
                              title="Open raw file preview"
                            >
                              👁️ Preview Dataset
                            </a>
                          )}

                          {/* Explorer */}
                          {purchase.purchaseTxHash && (
                            <a
                              href={explorerTxUrl(purchase.purchaseTxHash)}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              rel="noreferrer"
                              title="View transaction on explorer"
                            >
                              🔗 View Purchase Tx
                            </a>
                          )}
                        </div>

                        <div className="mt-4 flex gap-3">
                          <button
                            onClick={() => handleDecrypt(purchase)}
                            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-sm font-medium text-white px-3 py-2 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                            title="Verify access and download the encrypted file"
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
              <div className="mt-10 rounded-2xl border bg-white p-10 text-center shadow-sm">
                <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  📂
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">No purchases yet</h3>
                <p className="mt-1 text-sm text-gray-600">When you purchase datasets, they will appear here.</p>
                <Link
                  href="/datasets"
                  className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:shadow-md"
                >
                  Browse Marketplace
                </Link>
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
        <div className="fixed bottom-5 right-5 z-40 transition-all duration-300 ease-out translate-y-0">
          <div
            className={`rounded-lg border px-4 py-3 shadow-md ${
              toast.type === "success"
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
