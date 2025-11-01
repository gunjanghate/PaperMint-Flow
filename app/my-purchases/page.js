"use client";

import { useState, useEffect } from "react";
import { addNetworkIfNeeded } from "@/lib/nft";
import Link from "next/link";
import CryptoJS from "crypto-js";
import { useWallet } from "@/components/wallet/WalletProvider";

export default function MyPurchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(new Set());
  const [decrypted, setDecrypted] = useState(new Set());
  const { walletAddress, isConnected: walletConnected, connectWallet } = useWallet();
  const [toast, setToast] = useState(null);

  const explorerTxUrl = (hash) =>
    `https://evm-testnet.flowscan.io/tx/${hash}`;

  const fetchPurchases = async (address) => {
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      setToast({ type: "error", message: "Invalid wallet address" });
      return;
    }

    try {
      setLoading(true);

      console.log("Fetching purchases for:", address);

      // 1. Fetch purchases from DB
      const res = await fetch(`/api/purchases?address=${address.toLowerCase()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        console.warn("Invalid response format:", data);
        setPurchases([]);
        return;
      }

      console.log("Raw purchases:", data);

      // 2. Enrich each purchase with dataset info
      const enriched = await Promise.all(
        data.map(async (p) => {
          const datasetId = p.datasetId || p._id;
          if (!datasetId) {
            console.warn("Missing datasetId in purchase:", p);
            return p;
          }

          try {
            const infoRes = await fetch(`/api/datasets/info?id=${datasetId}`);
            if (infoRes.ok) {
              const dataset = await infoRes.json();
              return {
                _id: p._id?.toString() || p.id,
                datasetId,
                purchaserTokenId: p.purchaserTokenId,
                txHash: p.txHash,
                cid: p.cid || dataset.cid,
                decryptionKey: p.decryptionKey || dataset.decryptionKey,
                fileType: p.fileType || dataset.fileType || "application/pdf",
                title: dataset.title || p.title || "Untitled Research",
                description: dataset.description || p.description || "",
                imageCid: dataset.imageCid || p.imageCid,
                metadataCid: dataset.metadataCid || p.metadataCid,
                purchasedAt: p.purchasedAt,
              };
            } else {
              console.warn(`Dataset info failed for ${datasetId}: ${infoRes.status}`);
            }
          } catch (e) {
            console.warn("Enrich failed:", datasetId, e);
          }

          // Fallback: return what we have
          return {
            ...p,
            _id: p._id?.toString() || p.id,
            title: p.title || "Untitled",
            decryptionKey: p.decryptionKey || null,
          };
        })
      );

      console.log("Enriched purchases:", enriched);
      setPurchases(enriched);

    } catch (error) {
      console.error("Fetch purchases error:", error);
      setToast({ type: "error", message: `Failed to load purchases: ${error.message}` });
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (purchase) => {
    const id = purchase._id;
    if (decrypting.has(id) || decrypted.has(id)) return;

    setDecrypting((prev) => new Set(prev).add(id));

    try {
      console.log("Decrypting purchase:", purchase);

      const keyHex = purchase.decryptionKey;
      if (!keyHex) throw new Error("Missing decryption key");

      // FETCH METADATA
      const metadataUrl = `https://gateway.lighthouse.storage/ipfs/${purchase.metadataCid}`;
      const metaResp = await fetch(metadataUrl);
      if (!metaResp.ok) throw new Error(`Metadata fetch failed: ${metaResp.status}`);
      const metadata = await metaResp.json();

      // EXTRACT ENCRYPTED CID
      let encryptedCid = metadata.external_url?.split('/').pop();
      if (!encryptedCid) {
        const attr = metadata.attributes?.find(a =>
          a.trait_type === "Encrypted CID" || a.trait_type === "Encrypted File CID"
        );
        encryptedCid = attr?.value;
      }
      if (!encryptedCid) throw new Error("Encrypted CID not found");

      // FETCH ENCRYPTED FILE
      const ipfsUrl = `https://gateway.lighthouse.storage/ipfs/${encryptedCid}`;
      const resp = await fetch(ipfsUrl);
      if (!resp.ok) throw new Error(`IPFS failed: ${resp.status}`);
      const encBuffer = await resp.arrayBuffer();
      if (!encBuffer || encBuffer.byteLength === 0) throw new Error("Empty file");

      const encUint8 = new Uint8Array(encBuffer);

      // DECRYPT
      const encWordArray = CryptoJS.lib.WordArray.create(encUint8);
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: encWordArray },
        CryptoJS.enc.Hex.parse(keyHex),
        { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
      );

      if (decrypted.sigBytes === 0) throw new Error("Decryption failed");

      const decryptedBytes = new Uint8Array(decrypted.sigBytes);
      const words = decrypted.words;
      for (let i = 0; i < decrypted.sigBytes; i++) {
        decryptedBytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      }

      // FIXED: FileReader + await → base64
      const blob = new Blob([decryptedBytes], { type: "application/pdf" });
      const decryptedBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result.split(',')[1]);
          } else {
            reject(new Error("Invalid FileReader result"));
          }
        };
        reader.onerror = () => reject(new Error("Base64 conversion failed"));
        reader.readAsDataURL(blob);
      });

      // FINAL: STORE IN localStorage (WORKS ACROSS TABS)
      localStorage.setItem(`decrypted:${purchase.purchaserTokenId}`, decryptedBase64);

      setDecrypted((prev) => new Set(prev).add(id));

      setToast({ type: "success", message: "Decrypted! Preview unlocked." });
      setTimeout(() => setToast(null), 4000);

    } catch (err) {
      console.error("Decrypt error:", err);
      setToast({ type: "error", message: `Failed: ${err.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDecrypting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  useEffect(() => {
    addNetworkIfNeeded();
    if (walletConnected && walletAddress) {
      fetchPurchases(walletAddress);
    }
  }, [walletConnected, walletAddress]);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-white to-gray-50">
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
                  Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </span>
                <button
                  onClick={() => walletAddress && fetchPurchases(walletAddress)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:shadow-sm"
                >
                  Refresh
                </button>
                <Link
                  href="/marketplace"
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
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">Lock</div>
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
                  const id = purchase._id;
                  const tokenId = purchase.purchaserTokenId;
                  const isDecrypting = decrypting.has(id);
                  const isDecrypted = decrypted.has(id);
                  // console.log(purchase)

                  return (
                    <li
                      key={id}
                      className="group rounded-xl border bg-white shadow-sm hover:shadow-lg overflow-hidden transition-shadow"
                    >
                      <div className="relative aspect-video bg-slate-100">
                        {purchase.imageCid ? (
                          <img
                            src={`https://gateway.lighthouse.storage/ipfs/${purchase.imageCid}`}
                            alt={purchase.title}
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

                        <div className="mt-3 space-y-2 text-xs text-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Token ID:</span>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 border border-slate-200">
                              {tokenId}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(tokenId);
                                setToast({ type: "success", message: "Copied!" });
                                setTimeout(() => setToast(null), 1500);
                              }}
                              className="text-blue-600 hover:underline"
                              title="Copy Token ID"
                            >
                              Copy
                            </button>
                          </div>

                          {purchase.metadataCid && (
                            <a
                              href={`https://gateway.lighthouse.storage/ipfs/${purchase.metadataCid}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              rel="noreferrer"
                            >
                              View metadata.json
                            </a>
                          )}

                          {purchase.purchaseTxHash && (
                            <a
                              href={explorerTxUrl(purchase.purchaseTxHash)}
                              target="_blank"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                              rel="noreferrer"
                            >
                              View Purchase Tx
                            </a>
                          )}
                        </div>

                        <div className="mt-4">
                          {isDecrypted ? (
                            <Link
                              href={`/preview/${tokenId}`}
                              className="block w-full text-center rounded-lg bg-gradient-to-r from-green-600 to-green-500 text-sm font-medium text-white px-3 py-2 hover:shadow-md"
                            >
                              Preview Dataset
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleDecrypt(purchase)}
                              disabled={isDecrypting}
                              className={`w-full rounded-lg text-sm font-medium px-3 py-2 transition-all ${isDecrypting
                                ? "bg-gray-400 text-white cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-md"
                                }`}
                            >
                              {isDecrypting ? "Decrypting..." : "Decrypt & Preview"}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-10 rounded-2xl border bg-white p-10 text-center shadow-sm">
                <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-500">
                  Folder
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">No purchases yet</h3>
                <p className="mt-1 text-sm text-gray-600">When you purchase datasets, they will appear here.</p>
                <Link
                  href="/marketplace"
                  className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:shadow-md"
                >
                  Browse Marketplace
                </Link>
              </div>
            )}
          </>
        )}

        <div className="mt-10">
          <Link href="/marketplace" className="text-blue-600 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md">
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 shadow-lg break-words whitespace-pre-line transition-all ${toast.type === "success"
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