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
    const [toast, setToast] = useState(null); // unified toast UI

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

        if (!file || !imageFile || !formData.title || !walletConnected) {
            alert("Connect wallet, title, research paper, and image are required");
            return;
        }
        if (!apiKey) {
            alert("Lighthouse API key missing");
            return;
        }

        setUploading(true);
        setStepText("Encrypting research paper...");
        setShowSuccess(false);
        setResult(null);

        try {
            // -------------------------------------------------
            // 1. Read PDF as binary
            // -------------------------------------------------
            const pdfArrayBuffer = await file.arrayBuffer();
            const pdfUint8 = new Uint8Array(pdfArrayBuffer);
            console.log("[Upload] Original PDF size:", pdfUint8.length, "bytes");

            // -------------------------------------------------
            // 2. Generate 256-bit AES key (64-char hex)
            // -------------------------------------------------
            const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
            const keyHex = Array.from(rawKey)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            console.log("[Upload] AES-256 key (hex):", keyHex);

            // -------------------------------------------------
            // 3. Encrypt with AES-256-ECB + PKCS7
            // -------------------------------------------------
            setStepText("Encrypting file with AES-256...");
            const wordArray = CryptoJS.lib.WordArray.create(pdfUint8);
            const encrypted = CryptoJS.AES.encrypt(wordArray, CryptoJS.enc.Hex.parse(keyHex), {
                mode: CryptoJS.mode.ECB,
                padding: CryptoJS.pad.Pkcs7,
            });

            const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
            const ciphertextBytes = new Uint8Array(
                (ciphertextHex.match(/.{2}/g) || []).map((b) => parseInt(b, 16))
            );
            console.log("[Upload] Encrypted size:", ciphertextBytes.length, "bytes");

            const encryptedFile = new File([ciphertextBytes], `${file.name}.enc`, {
                type: "application/octet-stream",
            });

            // -------------------------------------------------
            // 4. Upload encrypted file to IPFS
            // -------------------------------------------------
            setStepText("Uploading encrypted file to IPFS...");
            const encUpload = await lighthouse.upload([encryptedFile], apiKey);
            const cid = encUpload.data?.Hash ?? encUpload.data?.[0]?.Hash ?? encUpload.data?.Hashes?.[0];
            if (!cid) throw new Error("Failed to get encrypted CID");
            console.log("[Upload] Encrypted CID:", cid);

            // -------------------------------------------------
            // 5. Upload cover image
            // -------------------------------------------------
            setStepText("Uploading cover image...");
            const imgUpload = await lighthouse.upload([imageFile], apiKey);
            const imageCid = imgUpload.data?.Hash ?? imgUpload.data?.[0]?.Hash ?? imgUpload.data?.Hashes?.[0];
            if (!imageCid) throw new Error("Failed to get image CID");
            console.log("[Upload] Image CID:", imageCid);

            // -------------------------------------------------
            // 6. Upload metadata JSON
            // -------------------------------------------------
            setStepText("Preparing metadata...");
            const metadata = {
                name: formData.title,
                description: formData.description || "Encrypted Research Paper NFT",
                image: `https://gateway.lighthouse.storage/ipfs/${imageCid}`,
                external_url: `https://gateway.lighthouse.storage/ipfs/${cid}`,
                attributes: [
                    { trait_type: "Encrypted CID", value: cid },
                    { trait_type: "Original File", value: file.name },
                    { trait_type: "File Type", value: file.type || "application/pdf" },
                ],
            };

            const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
            const metaFile = new File([metaBlob], "metadata.json");

            setStepText("Uploading metadata...");
            const metaUp = await lighthouse.upload([metaFile], apiKey);
            const metadataCid = metaUp.data?.Hash ?? metaUp.data?.[0]?.Hash ?? metaUp.data?.Hashes?.[0];
            if (!metadataCid) throw new Error("Failed to get metadata CID");
            console.log("[Upload] Metadata CID:", metadataCid);

            // -------------------------------------------------
            // 7. Mint NFT (pass keyHex)
            // -------------------------------------------------
            setStepText("Minting NFT...");
            const tokenUri = `https://gateway.lighthouse.storage/ipfs/${metadataCid}`;
            const { txHash, tokenId } = await mintNFT(walletAddress, tokenUri, cid, keyHex);
            console.log("[Upload] Minted! Token ID:", tokenId, "Tx:", txHash);

            // -------------------------------------------------
            // 8. Save to backend — FINAL PAYLOAD
            // -------------------------------------------------
            setStepText("Saving to database...");
            const dbPayload = {
                title: formData.title,
                description: formData.description,
                cid,                    // encrypted file
                imageCid,
                metadataCid,
                authorAddress: walletAddress,
                decryptionKey: keyHex,  // ← 64-char hex
                tokenId: parseInt(tokenId),
                txHash,
                fileType: file.type || "application/pdf",
                originalFileName: file.name,
            };

            console.log("[Upload] Saving to DB:", dbPayload);

            const res = await fetch("/api/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dbPayload),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Server error");

            // -------------------------------------------------
            // 9. Success
            // -------------------------------------------------
            setResult({ ...json, cid, txHash, tokenId });
            setShowSuccess(true);
            setToast({ type: "success", message: "PDF encrypted, uploaded, and NFT minted!" });
            setTimeout(() => setToast(null), 4000);

        } catch (error) {
            console.error("[Upload] Error:", error);
            setToast({ type: "error", message: `Error: ${error.message}` });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setUploading(false);
            setStepText("");
        }
    };

    return (
        <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-white to-gray-50">
            <div className="mx-auto max-w-3xl px-6 py-10">
                {/* Header / Status */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Publish a Research Paper</h1>
                        <p className="mt-1 text-gray-600">Upload your Research Paper, mint it, and store it on Blockchain.</p>
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
                        href="/marketplace"
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
                            <p className="break-all"><span className="font-medium">CID:</span> {result.cid}</p>
                            <p><span className="font-medium">Token ID:</span> {result.tokenId ?? 'N/A'}</p>
                            <p className="break-all"><span className="font-medium">Tx Hash:</span> {result.txHash}</p>
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
                            <Link href="/marketplace" className="inline-flex items-center justify-center rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50">Go to Marketplace</Link>
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

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md">
                    <div
                        role="status"
                        aria-live="polite"
                        className={`rounded-lg border px-4 py-3 shadow-lg break-words whitespace-pre-line ${toast.type === 'success'
                            ? 'bg-white border-green-200 text-green-700'
                            : 'bg-white border-red-200 text-red-700'
                            }`}
                    >
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}