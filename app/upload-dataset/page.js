'use client';

import { useState, useEffect } from 'react';
import lighthouse from '@lighthouse-web3/sdk';
import { mintNFT, addNetworkIfNeeded } from '@/lib/nft';
import { ethers } from 'ethers';
import Link from 'next/link';
import CryptoJS from 'crypto-js';
import { useWallet } from '@/components/wallet/WalletProvider';

const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY;

export default function Home() {
    const [formData, setFormData] = useState({
        title: '',
        description: ''
    });
    const [file, setFile] = useState(null); // Research paper file
    const [imageFile, setImageFile] = useState(null); // NFT cover image
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const { walletAddress, isConnected: walletConnected, connectWallet } = useWallet();
    const [imagePreview, setImagePreview] = useState(null);
    const [dragImageOver, setDragImageOver] = useState(false);
    const [dragDatasetOver, setDragDatasetOver] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [stepText, setStepText] = useState('');

    // connectWallet is provided by wallet context

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'file') {
            setFile(files[0]);
            console.log('Debug: Research paper file selected:', files[0]?.name, 'Size:', files[0]?.size);
        } else if (name === 'imageFile') {
            setImageFile(files[0]);
            console.log('Debug: Image file selected:', files[0]?.name, 'Size:', files[0]?.size);
            if (files[0]) {
                const url = URL.createObjectURL(files[0]);
                setImagePreview(url);
            } else {
                setImagePreview(null);
            }
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    // Clean up object URL when image changes/unmounts
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const onDropImage = (e) => {
        e.preventDefault();
        setDragImageOver(false);
        const f = e.dataTransfer?.files?.[0];
        if (f) {
            setImageFile(f);
            const url = URL.createObjectURL(f);
            setImagePreview(url);
        }
    };

    const onDropDataset = (e) => {
        e.preventDefault();
        setDragDatasetOver(false);
        const f = e.dataTransfer?.files?.[0];
        if (f) {
            setFile(f);
        }
    };

    useEffect(() => {
        addNetworkIfNeeded();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log('Debug: Form submitted. Title:', formData.title, 'Research Paper:', file?.name, 'Image:', imageFile?.name, 'Wallet:', walletAddress);
        if (!file || !imageFile || !formData.title || !walletConnected) {
            alert('Connect wallet, title, research paper file, and image file are all required');
            return;
        }
        if (!apiKey) {
            alert('Missing API key');
            return;
        }

        setUploading(true);
        setStepText('Uploading the research paper to Lighthouse...');
        console.log('Debug: Starting upload/mint flow...');

        try {
            // Upload research paper file to Lighthouse
            console.log('Debug: Uploading research paper file to Lighthouse...');
            const uploadResponse = await lighthouse.upload([file], apiKey);
            console.log('Debug: Raw research paper upload response:', uploadResponse);
            let cid;
            if (uploadResponse && uploadResponse.data) {
                if (typeof uploadResponse.data.Hash === 'string') {
                    cid = uploadResponse.data.Hash;
                } else if (Array.isArray(uploadResponse.data) && uploadResponse.data[0] && uploadResponse.data[0].Hash) {
                    cid = uploadResponse.data[0].Hash;
                } else if (uploadResponse.data.Hashes && Array.isArray(uploadResponse.data.Hashes) && uploadResponse.data.Hashes[0]) {
                    cid = uploadResponse.data.Hashes[0];
                }
            }
            if (!cid) throw new Error('CID not found in Lighthouse upload response');

            // Upload image file to Lighthouse
            console.log('Debug: Uploading image file to Lighthouse...');
            setStepText('Uploading cover image...');
            const imageUploadResponse = await lighthouse.upload([imageFile], apiKey);
            console.log('Debug: Raw image upload response:', imageUploadResponse);
            let imageCid;
            if (imageUploadResponse && imageUploadResponse.data) {
                if (typeof imageUploadResponse.data.Hash === 'string') {
                    imageCid = imageUploadResponse.data.Hash;
                } else if (Array.isArray(imageUploadResponse.data) && imageUploadResponse.data[0] && imageUploadResponse.data[0].Hash) {
                    imageCid = imageUploadResponse.data[0].Hash;
                } else if (imageUploadResponse.data.Hashes && Array.isArray(imageUploadResponse.data.Hashes) && imageUploadResponse.data.Hashes[0]) {
                    imageCid = imageUploadResponse.data.Hashes[0];
                }
            }
            if (!imageCid) throw new Error('Image CID not found in Lighthouse upload response');
            console.log('Debug: Upload success! Research Paper CID:', cid, 'Image CID:', imageCid);


            // Generate random bytes and hash them
            const randomBytes = new Uint8Array(32);
            window.crypto.getRandomValues(randomBytes);
            const wordArray = CryptoJS.lib.WordArray.create(randomBytes);
            const hashedKey = CryptoJS.SHA256(wordArray).toString();
            console.log('Debug: Generated hashed key:', hashedKey);

            // Create a proper metadata JSON and upload it so wallets can show the image
            console.log('Debug: Creating on-chain metadata JSON...');
            setStepText('Preparing metadata...');

            // Use uploaded image CID for NFT display
            const nftImageUrl = `https://gateway.lighthouse.storage/ipfs/${imageCid}`;

            // ERC-721 metadata standard compliant JSON
            const metadata = {
                name: formData.title,
                description: formData.description || 'Research Paper NFT on Filecoin',
                image: nftImageUrl, // Primary field for image (required)
                external_url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
                attributes: [
                    {
                        trait_type: "Research Paper CID",
                        value: cid
                    },
                    {
                        trait_type: "File Type",
                        value: file.type || "application/octet-stream"
                    },
                    {
                        trait_type: "File Name",
                        value: file.name
                    }
                ]
            };

            console.log('Debug: Metadata JSON to be uploaded:', JSON.stringify(metadata, null, 2));

            const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
            const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
            console.log('Debug: Uploading metadata JSON to Lighthouse...');
            setStepText('Uploading metadata...');
            const metaUpload = await lighthouse.upload([metadataFile], apiKey);
            console.log('Debug: Raw metadata upload response:', metaUpload);
            let metadataCid;
            if (metaUpload && metaUpload.data) {
                if (typeof metaUpload.data.Hash === 'string') {
                    metadataCid = metaUpload.data.Hash;
                } else if (Array.isArray(metaUpload.data) && metaUpload.data[0] && metaUpload.data[0].Hash) {
                    metadataCid = metaUpload.data[0].Hash;
                } else if (metaUpload.data.Hashes && Array.isArray(metaUpload.data.Hashes) && metaUpload.data.Hashes[0]) {
                    metadataCid = metaUpload.data.Hashes[0];
                }
            }
            if (!metadataCid) throw new Error('Metadata CID not found in Lighthouse upload response');
            console.log('Debug: Metadata uploaded. CID:', metadataCid);

            // Mint NFT on Calibration using metadata JSON CID as tokenURI
            console.log('Debug: Starting mint...');
            setStepText('Minting NFT on Filecoin testnet...');
            const metadataUri = `https://gateway.lighthouse.storage/ipfs/${metadataCid}`;
            console.log('Debug: Using token URI:', metadataUri);
            const { txHash, tokenId } = await mintNFT(walletAddress, metadataUri, cid, hashedKey);
            console.log('Debug: Minted! Token ID:', tokenId, 'Tx Hash:', txHash);

            // Send metadata to server
            console.log('Debug: Sending metadata to server...');
            setStepText('Saving listing to server...');
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    description: formData.description,
                    cid,
                    imageCid, // Store the image CID
                    metadataCid: metadataCid || null,
                    authorAddress: walletAddress,
                    decryptionKey: hashedKey,
                    tokenId,
                    txHash,
                }),
            });
            const json = await res.json();
            console.log('Debug: Server response:', json);
            if (res.ok) {
                setResult({ ...json, cid, txHash, tokenId });
                setShowSuccess(true);
                // Try to fetch metadata JSON from gateway for quick verification in browser
                try {
                    const gatewayUrl = `https://gateway.lighthouse.storage/ipfs/${metadataCid}`;
                    console.log('Debug: Fetching metadata JSON from gateway:', gatewayUrl);
                    const metaRes = await fetch(gatewayUrl);
                    const metaJson = await metaRes.json();
                    console.log('Debug: Retrieved metadata JSON:', metaJson);
                } catch (metaErr) {
                    console.warn('Debug: Could not fetch metadata JSON from gateway:', metaErr);
                }
            } else {
                alert(`Metadata error: ${json.error}`);
            }
        } catch (error) {
            console.error('Debug: Overall error in handleSubmit:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setUploading(false);
            setStepText('');
            console.log('Debug: Upload/mint flow ended.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto max-w-3xl px-6 py-10">
                {/* Header / Status */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Publish a Research Paper</h1>
                        <p className="mt-1 text-gray-600">Upload your Research Paper, mint it, and store it on Filecoin.</p>
                    </div>
                    <div>
                        {walletConnected ? (
                            <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 border border-green-200">
                                ✅ Connected: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                            </span>
                        ) : (
                            <button
                                onClick={connectWallet}
                                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition [box-shadow:0_0_0_0_rgba(37,99,235,0.0)] hover:[box-shadow:0_0_0_8px_rgba(37,99,235,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>
                </div>

                {/* Form Card */}
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {/* Progress / State */}
                    {uploading && (
                        <div className="rounded-t-2xl bg-blue-50 border-b border-slate-200 px-6 py-3 text-sm text-blue-700">
                            {stepText || 'Processing...'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
                        {/* Title */}
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                            <input
                                id="title"
                                type="text"
                                name="title"
                                required
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="e.g. High-Resolution Satellite Imagery Dataset"
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                                <span className="text-xs text-gray-500">Max 300 chars</span>
                            </div>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={5}
                                maxLength={300}
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                                placeholder="Briefly describe the research paper: format, size, and intended research use."
                            />
                        </div>

                        {/* Uploads */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Cover Image */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Cover Image</label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragImageOver(true); }}
                                    onDragLeave={() => setDragImageOver(false)}
                                    onDrop={onDropImage}
                                    className={`mt-2 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragImageOver ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300 bg-slate-50/50'}`}
                                >
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Cover preview" className="h-40 w-full object-cover rounded-lg" />
                                    ) : (
                                        <>
                                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-200" />
                                            <p className="mt-3 text-sm text-gray-700">Drag & drop cover image</p>
                                            <p className="text-xs text-gray-500">PNG, JPG up to ~5MB</p>
                                        </>
                                    )}
                                    <input
                                        id="imageFile"
                                        name="imageFile"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleChange}
                                        required
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>

                            {/* Research Paper File */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Research Paper File</label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragDatasetOver(true); }}
                                    onDragLeave={() => setDragDatasetOver(false)}
                                    onDrop={onDropDataset}
                                    className={`mt-2 relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${dragDatasetOver ? 'border-blue-600 bg-blue-50/50' : 'border-slate-300 bg-slate-50/50'}`}
                                >
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-300 to-slate-200" />
                                    <p className="mt-3 text-sm text-gray-700">Drag & drop research paper file</p>
                                    <p className="text-xs text-gray-500">Any file type supported</p>
                                    {file && (
                                        <p className="mt-2 text-xs text-gray-600">
                                            Selected: <span className="font-medium text-gray-800">{file.name}</span>{' '}
                                            <span>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                                        </p>
                                    )}
                                    <input
                                        id="file"
                                        name="file"
                                        type="file"
                                        onChange={handleChange}
                                        required
                                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={uploading || !walletConnected}
                                className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                            >
                                {uploading ? 'Minting…' : 'Mint NFT'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="mt-6 flex justify-center">
                    <Link
                        href="/datasets"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50"
                    >
                        ← Back to Marketplace
                    </Link>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && result && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Mint Successful</h3>
                        <p className="mt-1 text-sm text-gray-600">Your research paper NFT has been minted and listed.</p>
                        <div className="mt-4 space-y-2 text-sm text-gray-700">
                            <p><span className="font-medium">CID:</span> {result.cid}</p>
                            <p><span className="font-medium">Token ID:</span> {result.tokenId ?? 'N/A'}</p>
                            <p><span className="font-medium">Tx Hash:</span> {result.txHash}</p>
                            <a
                                href={`https://gateway.lighthouse.storage/ipfs/${result.cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                View Research Paper on IPFS
                            </a>
                        </div>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Link href="/datasets" className="inline-flex items-center justify-center rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">Go to Marketplace</Link>
                            <button
                                onClick={() => setShowSuccess(false)}
                                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}