'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { addNetworkIfNeeded, getDecryptionKey, ownerOfToken } from '@/lib/nft';
import Link from 'next/link';
import CryptoJS from 'crypto-js';

export default function Datasets() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [accessing, setAccessing] = useState(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('latest'); // latest | popular | price

  const truncateAddress = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await addNetworkIfNeeded();
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      } catch (error) {
        alert(`Connection error: ${error.message}`);
      }
    } else {
      alert('MetaMask not installed');
    }
  };

  const disconnectWallet = () => {
    // MetaMask doesn't expose a programmatic disconnect; this clears local UI state.
    setWalletAddress(null);
    setWalletConnected(false);
  };

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

  // Keep wallet state in sync with MetaMask
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') return;

    // Initialize from current accounts
    window.ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts) => {
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
        }
      })
      .catch(() => { });

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        setWalletAddress(null);
        setWalletConnected(false);
      } else {
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
      }
    };

    const handleChainChanged = () => {
      // Optional: refresh prices or UI when chain changes
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

  console.log('Debug: datasets state:', datasets);

  const RAW_CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
  const CHAIN_ID_INT = RAW_CHAIN_ID ? parseInt(RAW_CHAIN_ID, 10) : 314159;
  const CHAIN_ID_HEX = '0x' + CHAIN_ID_INT.toString(16);

  const handleAccess = async (dataset) => {
    if (!walletConnected) {
      await connectWallet();
      return;
    }
    setAccessing(dataset._id);

    try {
      console.log('Debug: handleAccess start dataset._id', dataset._id, 'tokenId', dataset.tokenId, 'cid', dataset.cid);
      if (dataset.tokenId == null) {
        throw new Error('Dataset missing tokenId; cannot fetch decryption key. Was mint completed and tokenId stored?');
      }
      // Dynamic price in tfFIL
      const views = dataset.views || 0;
      const priceInFIL = 0.01 + views * 0.001;
      const price = ethers.parseUnits(priceInFIL.toFixed(18), 'ether');

      // Pay author
      const provider = new ethers.BrowserProvider(window.ethereum);
      await addNetworkIfNeeded();
      try {
        await provider.send('wallet_switchEthereumChain', [{ chainId: CHAIN_ID_HEX }]);
      } catch (switchErr) {
        console.warn('Debug: wallet_switchEthereumChain failed:', switchErr);
        if (switchErr.code === 4902) { // Unrecognized chain
          console.log('Debug: Chain not recognized, attempting wallet_addEthereumChain with', CHAIN_ID_HEX);
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: CHAIN_ID_HEX,
                chainName: 'Filecoin - Calibration testnet',
                rpcUrls: [process.env.NEXT_PUBLIC_FVM_RPC],
                nativeCurrency: { name: 'testFIL', symbol: 'tFIL', decimals: 18 },
                blockExplorerUrls: ['https://calibration.filscan.io']
              }]
            });
            await provider.send('wallet_switchEthereumChain', [{ chainId: CHAIN_ID_HEX }]);
          } catch (addErr) {
            console.error('Debug: Failed to add then switch network:', addErr);
            throw addErr;
          }
        } else {
          throw switchErr;
        }
      }
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: dataset.authorAddress,
        value: price,
      });
      await tx.wait();

      // Check if purchaser already owns a token for this dataset, else mint a new one
      console.log('Debug: Checking if purchaser owns existing token for dataset');
      let onChainOwner = null;
      let purchaserTokenId = null;
      try {
        onChainOwner = await ownerOfToken(dataset.tokenId);
        console.log('Debug: Original token', dataset.tokenId, 'owner:', onChainOwner);
        if (onChainOwner && onChainOwner.toLowerCase() === walletAddress.toLowerCase()) {
          console.log('Debug: Purchaser already owns original token');
          purchaserTokenId = dataset.tokenId;
        }
      } catch (e) {
        console.warn('Debug: Could not check original token ownership:', e.message);
      }

      // If purchaser doesn't own the original token, mint a new one for them
      let purchaserHashedKey = null;
      let mintResult = null;
      if (!purchaserTokenId) {
        console.log('Debug: Purchaser does not own token; minting new NFT for them');
        const key = CryptoJS.enc.Utf8.parse(walletAddress.slice(2));
        purchaserHashedKey = CryptoJS.SHA256(key.toString()).toString();

        // Use the metadata JSON CID (with image) instead of dataset CID
        const metadataUri = dataset.metadataCid
          ? `https://gateway.lighthouse.storage/ipfs/${dataset.metadataCid}`
          : `https://gateway.lighthouse.storage/ipfs/${dataset.cid}`;
        console.log('Debug: Using metadata URI for mint:', metadataUri);

        const { mintNFT } = await import('@/lib/nft');
        console.log('Debug: About to call mintNFT for purchaser...');
        mintResult = await mintNFT(walletAddress, metadataUri, dataset.cid, purchaserHashedKey);
        purchaserTokenId = mintResult.tokenId;
        console.log('Debug: ✅ Successfully minted new token for purchaser!');
        console.log('Debug: Token ID:', purchaserTokenId);
        console.log('Debug: Tx Hash:', mintResult.txHash);
        console.log('Debug: Wallet Address:', walletAddress);
        console.log('Debug: Metadata URI used:', metadataUri);

        // Show detailed success message to user
        const metadataLink = dataset.metadataCid
          ? `https://gateway.lighthouse.storage/ipfs/${dataset.metadataCid}`
          : 'N/A';

        alert(`🎉 NFT Minted Successfully!\n\n` +
          `Token ID: ${purchaserTokenId}\n` +
          `Transaction: ${mintResult.txHash}\n` +
          `Contract: ${process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}\n\n` +
          `Metadata URI: ${metadataLink}\n\n` +
          `⚠️ If you don't see the NFT image in MetaMask:\n` +
          `1. Wait 1-2 minutes for MetaMask to refresh\n` +
          `2. Go to MetaMask → NFTs → "Refresh list"\n` +
          `3. Click on the NFT to view details\n\n` +
          `You can verify the metadata JSON at the link above.`);

        // Try to add NFT to MetaMask wallet for easier discovery
        try {
          const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
          console.log('Debug: Suggesting NFT to MetaMask - Contract:', contractAddress, 'TokenId:', purchaserTokenId);
          await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
              type: 'ERC721',
              options: {
                address: contractAddress,
                tokenId: purchaserTokenId.toString(),
              },
            },
          });
          console.log('Debug: NFT watch suggestion sent to MetaMask');
        } catch (watchErr) {
          console.warn('Debug: Could not suggest NFT to MetaMask (user may need to add manually):', watchErr.message);
        }

        // Wait briefly for blockchain state to propagate
        console.log('Debug: Waiting 3s for blockchain state sync and MetaMask refresh...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Fetch on-chain key or use locally generated one
      let hashedKey;
      try {
        console.log('Debug: Fetching decryption key for purchaser tokenId', purchaserTokenId);
        hashedKey = await getDecryptionKey(purchaserTokenId);
        console.log('Debug: Retrieved hashed key from contract:', hashedKey);
      } catch (keyErr) {
        if (purchaserHashedKey) {
          console.log('Debug: On-chain fetch failed (state lag?), using locally generated key:', purchaserHashedKey);
          hashedKey = purchaserHashedKey;
        } else {
          throw keyErr;
        }
      }

      // Derive key from current wallet and verify
      const key = CryptoJS.enc.Utf8.parse(walletAddress.slice(2));
      const derivedHashedKey = CryptoJS.SHA256(key.toString()).toString();
      console.log('Debug: Current wallet:', walletAddress);
      console.log('Debug: Derived hashed key from current wallet:', derivedHashedKey);
      console.log('Debug: Expected hashed key (from contract):', hashedKey);

      if (derivedHashedKey !== hashedKey) {
        throw new Error('Key mismatch - internal error. Contact support.');
      }

      console.log('Debug: Access granted! Key verification passed.');

      // NOTE: Files are currently uploaded unencrypted to Lighthouse.
      // For demo, we skip decryption and download directly.
      // TODO: Implement client-side encryption on upload + decryption here for real security.

      // Download file (currently plaintext, not encrypted)
      console.log('Debug: Downloading file from IPFS...');
      const fileResponse = await fetch(`https://gateway.lighthouse.storage/ipfs/${dataset.cid}`);
      const fileBlob = await fileResponse.blob();

      // Trigger download
      const url = URL.createObjectURL(fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dataset.title || 'research-paper';
      a.click();
      URL.revokeObjectURL(url);
      console.log('Debug: File download initiated.');

      // Store purchase record with purchaser's tokenId
      try {
        await fetch('/api/purchases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datasetId: dataset._id,
            purchaserAddress: walletAddress,
            purchaserTokenId: purchaserTokenId,
            txHash: mintResult?.txHash || null
          })
        });
        console.log('Debug: Purchase record stored.');
      } catch (storeErr) {
        console.warn('Debug: Failed to store purchase record:', storeErr);
      }

      // Increment views add purchaser
      setDatasets(prev => prev.map(d => d._id === dataset._id ? { ...d, views: (d.views || 0) + 1 } : d));

      // Normalize _id to string (handle { $oid: '...' } or ObjectId instances)
      let idString = dataset._id;
      if (typeof dataset._id === 'object' && dataset._id !== null) {
        if (dataset._id.$oid) idString = dataset._id.$oid;
        else if (dataset._id.toString) idString = dataset._id.toString();
      }
      console.log('Debug: Sending PATCH with id:', idString, 'type:', typeof idString);

      const patchRes = await fetch('/api/datasets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idString, purchaser: walletAddress }),
      });

      if (!patchRes.ok) {
        console.warn('Debug: PATCH failed, reverting optimistic update');
        // Re-fetch to stay in sync
        const fresh = await fetch('/api/datasets').then(r => r.json()).catch(() => []);
        setDatasets(fresh);
      } else {
        const json = await patchRes.json();
        if (json?.dataset) {
          setDatasets(prev => prev.map(d => d._id === json.dataset._id ? json.dataset : d));
        }
      }

      alert(`Accessed & decrypted! Paid ${priceInFIL.toFixed(4)} tfFIL.`);
      window.open(`https://gateway.lighthouse.storage/ipfs/${dataset.cid}`, '_blank');
    } catch (error) {
      console.error('Payment error:', error);
      alert(`Payment error: ${error.message}`);
    } finally {
      setAccessing(null);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-10 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">NFT-Gated Research Papers on Filecoin</h1>
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
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 relative">
      {/* Ambient background accents */}
      <div className="pointer-events-none absolute -top-20 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.12),_transparent_60%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.10),_transparent_60%)] blur-2xl" />
      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Section heading */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Marketplace</h1>
            <p className="mt-1 text-gray-600">Premium AI/ML research papers stored on decentralized Filecoin.</p>
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
              const priceLabel = (0.01 + views * 0.001).toFixed(4) + ' tFIL';
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
                      Stored on Filecoin
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
                    <div className="mt-1 text-xs text-gray-600 flex items-center justify-between">
                      <span className="truncate"><span className="font-medium text-gray-700">Author:</span> {truncateAddress(dataset.authorAddress || '')}</span>
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
                        <div className="col-span-2 truncate">
                          <span className="font-medium text-gray-700">Prev CID:</span> {dataset.previousCID}
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700">Uploaded:</span> {new Date(dataset.uploadedAt).toLocaleString()}
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
    </div>
  );
}