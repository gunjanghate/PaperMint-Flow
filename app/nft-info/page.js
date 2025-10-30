'use client';

import { useState } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
import ABIhere from "@/lib/ABI.json"
export default function NFTInfo() {
  const [tokenId, setTokenId] = useState('');
  const [nftData, setNftData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const ABI = ABIhere;

  const fetchNFTInfo = async () => {
    if (!tokenId) {
      setError('Please enter a token ID');
      return;
    }

    setLoading(true);
    setError(null);
    setNftData(null);

    try {
      // Connect to contract
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_FVM_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

      // Get token URI
      const uri = await contract.tokenURI(tokenId);
      console.log('Token URI:', uri);

      // Get owner
      let owner = 'Unknown';
      try {
        owner = await contract.ownerOf(tokenId);
      } catch (e) {
        console.warn('Could not fetch owner:', e);
      }

      // Fetch metadata JSON
      let metadata = null;
      let metadataError = null;
      try {
        const response = await fetch(uri);
        if (response.ok) {
          metadata = await response.json();
        } else {
          metadataError = `HTTP ${response.status}: ${response.statusText}`;
        }
      } catch (e) {
        metadataError = e.message;
      }

      setNftData({
        tokenId,
        tokenURI: uri,
        owner,
        metadata,
        metadataError
      });

    } catch (err) {
      console.error('Error fetching NFT info:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Back link */}
        <div className="mb-4">
          <Link href="/datasets" className="text-blue-600 hover:underline">← Back to Marketplace</Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-400 to-blue-200 flex items-center justify-center text-xl">🔍</div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Check NFT Metadata</h1>
            <p className="text-gray-600">Inspect token metadata from this contract quickly and securely.</p>
          </div>
        </div>

        {/* Contract Card */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-gray-700">Contract Address</p>
          <p className="mt-1 break-all text-sm text-gray-800">{CONTRACT_ADDRESS}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <strong className="font-semibold">Error: </strong>{error}
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <label htmlFor="tokenId" className="block text-sm font-medium text-gray-700">Token ID</label>
            <input
              id="tokenId"
              type="number"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="Enter token ID (e.g., 19)"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
            <p className="mt-1 text-xs text-gray-500">Supports ERC-721 / ERC-1155 tokens.</p>
          </div>

          <button
            onClick={fetchNFTInfo}
            disabled={loading}
            className="w-full inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-[#0070F3] to-[#00A3FF] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-105 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Fetch NFT Info'}
          </button>
        </div>

        {/* Idle/Empty hint */}
        {!nftData && !loading && !error && (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-gray-500">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-200" />
            <p className="mt-4">🪪 Enter a contract and token ID to retrieve metadata…</p>
          </div>
        )}

        {/* Result Card */}
        {nftData && (
          <div className="mt-8 space-y-6">
            {/* Basic Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">NFT Details</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700">
                <div>
                  <span className="font-medium">Token ID:</span> {nftData.tokenId}
                </div>
                <div className="break-all">
                  <span className="font-medium">Owner:</span> <code className="text-gray-800">{nftData.owner}</code>
                </div>
                <div className="break-all">
                  <span className="font-medium">Token URI:</span>{' '}
                  <a href={nftData.tokenURI} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {nftData.tokenURI}
                  </a>
                </div>
                <div className="break-all">
                  <span className="font-medium">View on Explorer:</span>{' '}
                  <a href={`https://calibration.filscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Filscan Contract
                  </a>
                </div>
              </div>
            </div>

            {/* Metadata Section */}
            {nftData.metadataError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
                <h3 className="font-semibold">⚠️ Metadata Fetch Error</h3>
                <p className="mt-1 text-sm">{nftData.metadataError}</p>
                <ul className="mt-3 list-disc pl-5 text-sm">
                  <li>The metadata URI is not accessible</li>
                  <li>CORS issues with the gateway</li>
                  <li>The file hasn't propagated to IPFS yet</li>
                </ul>
              </div>
            ) : nftData.metadata ? (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
                  <h3 className="font-semibold text-emerald-900">✅ Metadata</h3>
                  <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-700">
                    <div><span className="font-medium text-gray-800">Name:</span> {nftData.metadata.name || 'N/A'}</div>
                    <div><span className="font-medium text-gray-800">Description:</span> {nftData.metadata.description || 'N/A'}</div>
                    {nftData.metadata.image && (
                      <div>
                        <p className="font-medium text-gray-800">Image URL:</p>
                        <a href={nftData.metadata.image} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                          {nftData.metadata.image}
                        </a>
                        <div className="mt-2">
                          <img
                            src={nftData.metadata.image}
                            alt={nftData.metadata.name}
                            className="max-h-72 w-auto rounded-lg border border-slate-200"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      </div>
                    )}

                    {Array.isArray(nftData.metadata.attributes) && nftData.metadata.attributes.length > 0 && (
                      <div>
                        <p className="font-medium text-gray-800">Attributes:</p>
                        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {nftData.metadata.attributes.map((attr, idx) => (
                            <li key={idx} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                              <span className="font-medium text-gray-800">{attr.trait_type || 'Trait'}:</span>{' '}
                              <span className="text-gray-700">{String(attr.value)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900">Raw Metadata JSON</h3>
                  <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-gray-800">
                    {JSON.stringify(nftData.metadata, null, 2)}
                  </pre>
                  <div className="mt-3">
                    <a href={nftData.tokenURI} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Metadata JSON</a>
                  </div>
                </div>
              </>
            ) : null}

            {/* Troubleshooting */}
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 shadow-sm">
              <h3 className="font-semibold text-yellow-900">🔧 MetaMask Troubleshooting</h3>
              <ol className="mt-2 list-decimal pl-5 text-sm text-gray-700 space-y-1">
                <li>Wait 1-2 minutes for MetaMask's cache to refresh</li>
                <li>In MetaMask, go to NFTs tab → Click "Refresh list"</li>
                <li>Click on the NFT to view its details</li>
                <li>Check if the Token URI above is accessible in your browser</li>
                <li>Verify the image URL is accessible</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
