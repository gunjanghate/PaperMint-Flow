"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Preview() {
  const pathname = usePathname();
  const tokenId = pathname?.split("/").filter(Boolean).pop();
  console.log("[Preview] tokenId:", tokenId);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    console.log("[Preview] useEffect start for tokenId:", tokenId);

    // FINAL: READ FROM localStorage
    const storageKey = `decrypted:${tokenId}`;
    console.log("[Preview] Reading from localStorage key:", storageKey);

    const base64 = localStorage.getItem(storageKey);
    if (!base64) {
      console.warn("[Preview] No data found in localStorage for key:", storageKey);
      setError("Preview not available. Please decrypt first.");
      setLoading(false);
      return;
    }
    console.log("[Preview] Base64 retrieved. Length:", base64.length);

    try {
      console.time("[Preview] atob decode");
      const binaryString = atob(base64);
      console.timeEnd("[Preview] atob decode");
      console.log("[Preview] Binary string length:", binaryString.length);

      console.time("[Preview] binary -> Uint8Array");
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      console.timeEnd("[Preview] binary -> Uint8Array");
      console.log("[Preview] Uint8Array created. byteLength:", bytes.byteLength);

      console.log("[Preview] Creating Blob");
      const blob = new Blob([bytes], { type: "application/pdf" });
      console.log("[Preview] Blob created. size:", blob.size, "type:", blob.type);

      console.log("[Preview] Creating object URL");
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      console.log("[Preview] Object URL set:", url);
    } catch (err) {
      setError("Failed to load preview.");
      console.error("[Preview] Preview error:", err);
    } finally {
      setLoading(false);
      console.log("[Preview] Loading set to false");
    }

    return () => {
      console.log("[Preview] Cleanup. Revoking object URL if present.");
      if (pdfUrl) {
        try {
          URL.revokeObjectURL(pdfUrl);
          console.log("[Preview] Revoked URL:", pdfUrl);
        } catch (e) {
          console.warn("[Preview] Failed to revoke URL:", e);
        }
      }
    };
  }, [tokenId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading preview…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-50 px-6">
        <div className="bg-white/80 backdrop-blur p-8 rounded-2xl border border-red-200 shadow-sm max-w-md text-center">
          <h2 className="text-2xl font-semibold text-red-700 mb-2">Access denied</h2>
          <p className="text-sm text-slate-700">{error}</p>
          <Link
            href="/my-purchases"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Go to My Purchases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header: fixed height (4rem) for stable viewer sizing */}
      <div className="h-16 border-b border-slate-200 bg-white/70 backdrop-blur px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Research Paper Preview</h1>
          <p className="text-sm text-slate-600">Token #{tokenId} • View-only</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-green-700">Secure in-browser view</span>
        </div>
      </div>

      {/* Viewer: occupies viewport minus header (4rem) and footer (3rem) */}
      <div className="overflow-hidden h-[calc(100vh-4rem-3rem)]">
        <embed
          src={pdfUrl}
          type="application/pdf"
          className="block w-full h-full"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
      </div>

      {/* Footer: fixed height (3rem) */}
      <div className="fixed bottom-0 left-0 right-0 h-12 bg-white/80 backdrop-blur border-t border-slate-200 px-6 flex items-center justify-center">
        <p className="text-center text-xs text-slate-600">
          This content is <strong>encrypted</strong> and <strong>view-only</strong>. Downloading or copying is disabled.
        </p>
      </div>
    </div>
  );
}