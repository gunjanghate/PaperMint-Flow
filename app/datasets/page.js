'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { addNetworkIfNeeded, getDecryptionKey, ownerOfToken } from '@/lib/nft';
import Link from 'next/link';
import CryptoJS from 'crypto-js';
import { useWallet } from '@/components/wallet/WalletProvider';

export default function Datasets() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accessing, setAccessing] = useState(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest'); // latest | popular | price
  const [toast, setToast] = useState(null); // { type: 'success'|'error'|'info', message: string }

  const { walletAddress, isConnected: walletConnected, connectWallet, disconnectWallet, truncate: truncateFromCtx } = useWallet();

  const truncateAddress = (addr) => truncateFromCtx(addr);

  // connectWallet / disconnectWallet come from context

  useEffect(() => {
    addNetworkIfNeeded();
    fetch('/api/datasets')
      .then((res) => res.json())
      .then((data) => {
        // Coerce API response to an array to avoid runtime errors
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.datasets)
            ? data.datasets
            : Array.isArray(data?.data)
              ? data.data
              : [];
        setDatasets(arr);
      })
      .catch(() => setDatasets([]))
      .finally(() => setLoading(false));
  }, []);

  // Wallet state is handled globally in WalletProvider

  console.log('Debug: datasets state:', datasets);

  const RAW_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
  const CHAIN_ID_INT = RAW_CHAIN_ID ? parseInt(RAW_CHAIN_ID, 10) : 545;                // default 545 for Flow Testnet
  const CHAIN_ID_HEX = "0x" + CHAIN_ID_INT.toString(16);

  const RPC_URL = process.env.NEXT_PUBLIC_FVM_RPC; // expect this to be https://testnet.evm.nodes.onflow.org
  const CHAIN_NAME = "Flow EVM Testnet";
  const NATIVE_CURRENCY = { name: "FLOW", symbol: "FLOW", decimals: 18 };
  const EXPLORER_URL = "https://evm-testnet.flowscan.io";

  const handleAccess = async (dataset) => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }
    setAccessing(dataset._id);
    console.log(dataset.decryptionKey)

    try {
      console.log("Debug: handleAccess start", { datasetId: dataset._id, tokenId: dataset.tokenId, cid: dataset.cid });

      if (!dataset.tokenId) {
        throw new Error("Dataset missing tokenId. Was mint completed?");
      }

      // Resolve the decryption key, fetching full dataset info if needed
      const isValidKey = (k) => typeof k === 'string' && /^[0-9a-fA-F]{64}$/.test(k);
      let decryptionKeyHex = dataset.decryptionKey;
      if (!isValidKey(decryptionKeyHex)) {
        try {
          const idForInfo = typeof dataset._id === 'object' ? dataset._id.$oid || dataset._id.toString() : dataset._id;
          const infoRes = await fetch(`/api/datasets/info?id=${idForInfo}`);
          if (infoRes.ok) {
            const info = await infoRes.json();
            if (isValidKey(info?.decryptionKey)) {
              decryptionKeyHex = info.decryptionKey;
            }
          }
        } catch { }
      }
      if (!isValidKey(decryptionKeyHex)) {
        throw new Error("Missing or invalid decryption key in dataset");
      }

      // 1. Calculate dynamic price
      const views = dataset.views || 0;
      const priceInFLOW = 0.01 + views * 0.001;
      const price = ethers.parseUnits(priceInFLOW.toFixed(18), "ether");

      // 2. Switch network
      const provider = new ethers.BrowserProvider(window.ethereum);
      await addNetworkIfNeeded();
      try {
        await provider.send("wallet_switchEthereumChain", [{ chainId: CHAIN_ID_HEX }]);
      } catch (err) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX,
              chainName: CHAIN_NAME,
              rpcUrls: [RPC_URL],
              nativeCurrency: NATIVE_CURRENCY,
              blockExplorerUrls: [EXPLORER_URL],
            }],
          });
          await provider.send("wallet_switchEthereumChain", [{ chainId: CHAIN_ID_HEX }]);
        } else throw err;
      }

      const signer = await provider.getSigner();

      // 3. Pay author
      const tx = await signer.sendTransaction({
        to: dataset.authorAddress,
        value: price,
      });
      await tx.wait();

      // 4. Check if user already owns a token
      let purchaserTokenId = null;
      try {
        const owner = await ownerOfToken(dataset.tokenId);
        if (owner.toLowerCase() === walletAddress.toLowerCase()) {
          purchaserTokenId = dataset.tokenId;
        }
      } catch (e) {
        console.warn("Original token not owned or doesn't exist");
      }

      // 5. Mint new NFT for purchaser (only if not owner)
      let mintResult = null;
      if (!purchaserTokenId) {
        console.log("Minting new NFT for purchaser...");

        const metadataUri = dataset.metadataCid
          ? `https://gateway.lighthouse.storage/ipfs/${dataset.metadataCid}`
          : `https://gateway.lighthouse.storage/ipfs/${dataset.cid}`;

        const { mintNFT } = await import('@/lib/nft');
        mintResult = await mintNFT(walletAddress, metadataUri, dataset.cid, decryptionKeyHex); // ← PASS REAL KEY
        purchaserTokenId = mintResult.tokenId;

        setToast({ type: 'success', message: `NFT Minted: #${purchaserTokenId}` });
        setTimeout(() => setToast(null), 4000);

        // Suggest to MetaMask
        try {
          await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC721',
              options: {
                address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
                tokenId: purchaserTokenId.toString(),
              },
            },
          });
        } catch (e) { /* ignore */ }

        await new Promise(r => setTimeout(r, 3000));
      }

      // 6. Use the resolved decryption key (validated above)
      const keyFromDB = decryptionKeyHex;

      // 7. Store purchase record
      await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: dataset._id,
          purchaserAddress: walletAddress,
          purchaserTokenId,
          txHash: tx.hash || null,
          decryptionKey: keyFromDB, // required by API; server verifies and stores
        }),
      });

      // 8. Download & decrypt (client-side)
      console.log("Fetching encrypted file...");
      const resp = await fetch(`https://gateway.lighthouse.storage/ipfs/${dataset.cid}`);
      if (!resp.ok) throw new Error("Failed to fetch file");

      const encBuffer = await resp.arrayBuffer();
      const encUint8 = new Uint8Array(encBuffer);

      const encWordArray = CryptoJS.lib.WordArray.create(encUint8);
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: encWordArray },
        CryptoJS.enc.Hex.parse(keyFromDB),
        { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
      );

      if (decrypted.sigBytes === 0) {
        throw new Error("Decryption failed");
      }

      const decryptedBytes = new Uint8Array(decrypted.sigBytes);
      const words = decrypted.words;
      for (let i = 0; i < decrypted.sigBytes; i++) {
        decryptedBytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      }

      const blob = new Blob([decryptedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      // const a = document.createElement("a");
      // a.href = url;
      // a.download = `${dataset.title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
      // a.click();
      // URL.revokeObjectURL(url);

      // 9. Update views & purchaser list
      setDatasets(prev => prev.map(d =>
        d._id === dataset._id ? { ...d, views: (d.views || 0) + 1 } : d
      ));

      const idString = typeof dataset._id === 'object' ? dataset._id.$oid || dataset._id.toString() : dataset._id;
      await fetch('/api/datasets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idString, purchaser: walletAddress }),
      });

      setToast({ type: 'success', message: `Paid ${priceInFLOW.toFixed(4)} FLOW. PDF downloaded!` });
      setTimeout(() => setToast(null), 4000);

    } catch (error) {
      console.error('Payment error:', error);
      setToast({ type: 'error', message: `Error: ${error.message}` });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setAccessing(null);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-10 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">NFT-Gated Research Papers on Blockchain</h1>
        </div>
        {/* Mobile actions */}
        <div className="sm:hidden mb-8 flex items-center justify-between">
          {walletConnected ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {truncateAddress(walletAddress)}
              </span>
              <button
                onClick={disconnectWallet}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              Connect Wallet
            </button>
          )}
          <Link
            href="/upload-dataset"
            className="inline-flex items-center justify-center rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600"
          >
            Upload Research Paper
          </Link>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 border rounded-lg p-4 bg-white shadow-sm animate-pulse">
              <div className="w-36 h-36 bg-gray-200 rounded" />
              <div className="flex-1 space-y-3">
                <div className="h-5 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-9 bg-gray-200 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasDatasets = Array.isArray(datasets) && datasets.length > 0;
  // Compute filtered/sorted list on the client to avoid changing backend behavior
  const displayDatasets = (hasDatasets ? [...datasets] : [])
    .filter((d) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        (d.title || '').toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'popular') {
        return (b.views || 0) - (a.views || 0);
      }
      if (sortBy === 'price') {
        const priceA = 0.01 + (a.views || 0) * 0.001;
        const priceB = 0.01 + (b.views || 0) * 0.001;
        return priceA - priceB;
      }
      // latest by uploadedAt desc
      const ta = new Date(a.uploadedAt).getTime();
      const tb = new Date(b.uploadedAt).getTime();
      return tb - ta;
    });

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-white to-gray-50 relative">
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute -top-20 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_60%)] blur-2xl overflow-hidden" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.10),_transparent_60%)] blur-2xl overflow-hidden" />
      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Section heading */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Marketplace</h1>
            <p className="mt-1 text-gray-600">Premium AI/ML research papers stored on Blockchain.</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            {walletConnected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  {truncateAddress(walletAddress)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Connect Wallet
              </button>
            )}
            <Link
              href="/upload-dataset"
              className="inline-flex items-center justify-center rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              Upload Research Paper
            </Link>
          </div>
        </div>

        {/* Toolbar: Search + Sort */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search papers by title or description…"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">Showing {displayDatasets.length} of {datasets.length} items</p>
          </div>
          <div>
            <label className="sr-only" htmlFor="sortBy">Sort by</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="latest">Latest</option>
              <option value="popular">Most viewed</option>
              <option value="price">Lowest price</option>
            </select>
          </div>
        </div>

        {/* Empty-state Hero */}
        {!hasDatasets && (
          <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-sm">
            <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_0%,_rgba(59,130,246,0.12),_transparent)]" />
            <div className="relative px-8 py-16 text-center">
              <div className="mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-200 shadow-inner" />
              <h2 className="mt-6 text-2xl sm:text-3xl font-semibold text-gray-900">No research papers yet</h2>
              <p className="mt-2 text-gray-600">Be the first to upload a high-value research paper to the marketplace.</p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <Link
                  href="/upload-dataset"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  Upload Research Paper
                </Link>
                <Link href="/nft-info" className="text-sm font-medium text-blue-600 hover:underline">Learn more</Link>
              </div>
            </div>
          </section>
        )}

        {/* Dataset Grid */}
        {hasDatasets && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayDatasets.map((dataset) => {
              const views = dataset.views || 0;
              const priceLabel = (0.01 + views * 0.001).toFixed(4) + ' flow';
              const accessType = 'NFT-Gated • Paid';
              const hasImage = Boolean(dataset.imageCid);
            
              return (
                <li
                  key={dataset._id}
                  className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 backdrop-blur-sm shadow-sm transition hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200"
                >
                  {/* Thumbnail */}
                  <div className="relative">
                    {hasImage ? (
                      <img
                        src={`https://gateway.lighthouse.storage/ipfs/${dataset.imageCid}`}
                        alt={dataset.title}
                        className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="h-40 w-full bg-gradient-to-br from-gray-100 to-gray-200" />
                    )}
                    <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 backdrop-blur">
                      Stored on IPFS
                    </div>
                    {/* Price badge */}
                    <div className="absolute right-3 top-3 rounded-full bg-blue-600/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                      {priceLabel}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="line-clamp-1 text-base font-semibold text-gray-900">{dataset.title}</h3>
                    <p className="mt-1 line-clamp-1 text-sm text-gray-600">{dataset.description}</p>

                    <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">{accessType}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium text-gray-700">Views:</span> {views}
                      </span>
                    </div>

                    {/* Meta line 2 */}
                    <div className="mt-1 text-xs text-gray-600 flex items-center justify-between min-w-0">
                      <span className="truncate max-w-[70%]"><span className="font-medium text-gray-700">Author:</span> {truncateAddress(dataset.authorAddress || '')}</span>
                      <span className="text-gray-500">v{dataset.version || 1}</span>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <button
                        onClick={() => handleAccess(dataset)}
                        disabled={accessing === dataset._id}
                        className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                      >
                        {accessing === dataset._id
                          ? 'Processing…'
                          : walletConnected
                            ? 'Purchase & Access'
                            : 'Connect Wallet · Access'}
                      </button>

                      {dataset.metadataCid && (
                        <a
                          href={`https://gateway.lighthouse.storage/ipfs/${dataset.metadataCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Metadata
                        </a>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium text-gray-700">Version:</span> {dataset.version}
                      </div>
                      {dataset.tokenId != null && (
                        <div>
                          <span className="font-medium text-gray-700">Token ID:</span> {dataset.tokenId}
                        </div>
                      )}
                      {dataset.previousCID && (
                        <div className="col-span-2 min-w-0">
                          <span className="font-medium text-gray-700">Prev CID:</span>{' '}
                          <span className="truncate inline-block align-bottom max-w-full" title={dataset.previousCID}>{dataset.previousCID}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700">Uploaded:</span>{' '}
                        {(() => {
                          try {
                            const d = new Date(dataset.uploadedAt);
                            return d.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
                          } catch {
                            return String(dataset.uploadedAt || 'Unknown');
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer quick links */}
        {/* <div className="mt-10 flex items-center gap-4 flex-wrap text-sm">
          <Link href="/my-purchases" className="text-blue-600 hover:underline">My Purchases</Link>
          <span className="text-gray-300">|</span>
          <Link href="/nft-info" className="text-blue-600 hover:underline">🔍 Check NFT Info</Link>
        </div> */}
      </main>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md">
          <div
            role="status"
            aria-live="polite"
            className={`rounded-lg border px-4 py-3 shadow-lg break-words whitespace-pre-line pointer-events-auto ${toast.type === 'success'
              ? 'bg-white border-green-200 text-green-700'
              : toast.type === 'error'
                ? 'bg-white border-red-200 text-red-700'
                : 'bg-white border-blue-200 text-blue-700'
              }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}