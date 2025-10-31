"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import mammoth from "mammoth";
import { decryptAES } from "@/lib/crypto";
import {
  getDatasetCID,
  getDecryptionKey,
  ownerOfToken,
} from "@/lib/nft";

export default function PreviewPage({ params }) {
  const tokenId = params?.tokenId;

  const [isOwner, setIsOwner] = useState(false);
  const [htmlData, setHtmlData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenId) return;
    loadFile();
  }, [tokenId]);

  async function loadFile() {
    try {
      setStatus("loading");

      // Connect wallet
      if (!window?.ethereum) {
        setError("No wallet found");
        setStatus("error");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const wallet = await signer.getAddress();

      // ✅ Verify owner
      const owner = await ownerOfToken(tokenId);
      if (!owner) {
        setError("Invalid token");
        setStatus("error");
        return;
      }

      if (owner.toLowerCase() !== wallet.toLowerCase()) {
        setIsOwner(false);
        setError("You do not own this NFT. Access denied.");
        setStatus("error");
        return;
      }

      setIsOwner(true);

      // ✅ Get encrypted key
      const encryptedKey = await getDecryptionKey(tokenId);
      if (!encryptedKey) {
        setError("No decryption key found");
        setStatus("error");
        return;
      }

      // ✅ Decrypt file-key
      const fileKey = decryptAES(
        encryptedKey,
        process.env.NEXT_PUBLIC_MASTER_KEY
      );

      if (!fileKey) {
        setError("Key decryption failed");
        setStatus("error");
        return;
      }

      // ✅ Get CID
      const cid = await getDatasetCID(tokenId);
      if (!cid) {
        setError("CID missing");
        setStatus("error");
        return;
      }

      const ipfsURL = `https://gateway.lighthouse.storage/ipfs/${cid}`;
      const res = await fetch(ipfsURL);
      const encryptedBuffer = await res.arrayBuffer();
      const encryptedString = new Uint8Array(encryptedBuffer);

      // ✅ Decrypt file
      const decrypted = decryptAES(
        new TextDecoder().decode(encryptedString),
        fileKey
      );

      // ✅ Convert DOCX → HTML
      const docxBuf = new Uint8Array(
        decrypted.split("").map((c) => c.charCodeAt(0))
      );

      const result = await mammoth.convertToHtml({ arrayBuffer: docxBuf });
      setHtmlData(result.value);

      setStatus("ready");
    } catch (err) {
      console.error(err);
      setError(err.message ?? "Unknown error");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="animate-spin border-t-2 border-white rounded-full w-10 h-10"></div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-red-400">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white px-5 py-8">
      <div className="max-w-4xl mx-auto bg-zinc-800 p-6 rounded-2xl shadow-lg">
        <h1 className="text-xl font-bold mb-4 text-purple-400">
          Dataset Preview (Token #{tokenId})
        </h1>

        <div className="prose prose-invert max-w-none">
          <div
            className="docx-content"
            dangerouslySetInnerHTML={{ __html: htmlData }}
          />
        </div>
      </div>
    </div>
  );
}
