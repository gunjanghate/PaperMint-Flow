"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function Preview() {
  const pathname = usePathname();
  const tokenId = pathname?.split("/").filter(Boolean).pop();
  
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [scale, setScale] = useState(1.5);
  const [pdfjsLib, setPdfjsLib] = useState(null);
  
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF.js library dynamically (client-side only)
  useEffect(() => {
    // Load PDF.js from CDN to avoid server bundling issues (pdfjs-dist requires optional
    // native 'canvas' which breaks Next.js build). This also ensures the module is only
    // requested at runtime in the browser.
    const loadPdfJsFromCdn = () => {
      return new Promise((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('Not in browser'));
        if (window.pdfjsLib) return resolve(window.pdfjsLib);

        const version = '2.16.105'; // stable browser build known to work with PDF.js API
        const script = document.createElement('script');
        script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.min.js`;
        script.async = true;
        script.onload = () => {
          try {
            const lib = window.pdfjsLib;
            if (lib) {
              lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;
              resolve(lib);
            } else {
              reject(new Error('pdfjsLib not available after load'));
            }
          } catch (e) {
            reject(e);
          }
        };
        script.onerror = (e) => reject(new Error('Failed to load PDF.js from CDN'));
        document.head.appendChild(script);
      });
    };

    let mounted = true;
    loadPdfJsFromCdn()
      .then((lib) => {
        if (!mounted) return;
        setPdfjsLib(lib);
      })
      .catch((err) => {
        console.error('[Preview] Failed to load PDF.js:', err);
        setError('Failed to load PDF viewer library.');
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  // Load PDF from localStorage
  useEffect(() => {
    if (!pdfjsLib) return;

    console.log("[Preview] Loading tokenId:", tokenId);

    const loadPDF = async () => {
      try {
        const storageKey = `decrypted:${tokenId}`;
        const base64 = localStorage.getItem(storageKey);

        if (!base64) {
          console.warn("[Preview] No data found in localStorage");
          setError("Preview not available. Please decrypt first.");
          setLoading(false);
          return;
        }

        console.log("[Preview] Base64 found, converting to bytes...");

        // Convert base64 to Uint8Array
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log("[Preview] Loading PDF document...");

        // Load PDF with PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdfDoc = await loadingTask.promise;
        
        console.log("[Preview] PDF loaded successfully. Pages:", pdfDoc.numPages);

        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setLoading(false);
      } catch (err) {
        console.error("[Preview] Load error:", err);
        setError("Failed to load PDF. The file may be corrupted.");
        setLoading(false);
      }
    };

    loadPDF();

    // Cleanup
    return () => {
      try {
        if (renderTaskRef.current && typeof renderTaskRef.current.cancel === 'function') {
          renderTaskRef.current.cancel();
        }
      } catch (e) {
        // ignore
      }
      try {
        if (pdf && typeof pdf.destroy === 'function') {
          pdf.destroy();
        }
      } catch (e) {
        // ignore
      }
    };
  }, [tokenId, pdfjsLib]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        setRendering(true);

        // Cancel any ongoing render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        console.log(`[Preview] Rendering page ${currentPage}...`);

        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) {
          console.warn('[Preview] No canvas available to render');
          setRendering(false);
          return;
        }
        const context = canvas.getContext('2d');
        if (!context) {
          console.warn('[Preview] Canvas has no 2D context');
          setRendering(false);
          return;
        }

        // Resize canvas to match PDF page viewport
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = { canvasContext: context, viewport };

        // Start render and keep reference so we can cancel if needed
        renderTaskRef.current = page.render(renderContext);
        if (renderTaskRef.current && renderTaskRef.current.promise) {
          await renderTaskRef.current.promise;
        } else {
          // older builds may return a plain promise
          await renderTaskRef.current;
        }

        // Add watermark
        addWatermark(context, canvas.width, canvas.height, tokenId);

        console.log(`[Preview] Page ${currentPage} rendered successfully`);
        setRendering(false);
      } catch (err) {
        if (err.name === "RenderingCancelledException") {
          console.log("[Preview] Render cancelled");
        } else {
          console.error("[Preview] Render error:", err);
        }
        setRendering(false);
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, tokenId]);

  // Add watermark to canvas
  const addWatermark = (ctx, width, height, tokenId) => {
    ctx.save();
    
    // Semi-transparent watermark
    ctx.globalAlpha = 0.15;
    ctx.font = "bold 48px Arial";
    ctx.fillStyle = "#3b82f6";
    ctx.textAlign = "center";
    
    // Rotate and position
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-45 * Math.PI / 180);
    
    ctx.fillText(`TOKEN #${tokenId}`, 0, -30);
    ctx.fillText("VIEW ONLY", 0, 30);
    
    ctx.restore();
  };

  // Navigation helpers
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPage = (page) => {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= numPages) {
      setCurrentPage(pageNum);
    }
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  // Prevent context menu and drag
  const preventAction = (e) => {
    e.preventDefault();
    return false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-6 text-slate-700 font-medium text-lg">Loading secure viewer...</p>
          <p className="mt-2 text-slate-500 text-sm">Decrypting your document</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white to-gray-50 px-6">
        <div className="bg-white/80 backdrop-blur p-8 rounded-2xl border-2 border-red-200 shadow-xl max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-red-700 mb-3">Access Denied</h2>
          <p className="text-slate-700 mb-6">{error}</p>
          <Link
            href="/my-purchases"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
          >
            Go to My Purchases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Research Paper Preview</h1>
              <p className="text-sm text-slate-600">Token #{tokenId} • Secure View</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-200">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-medium text-green-700">Protected</span>
              </div>
              <Link
                href="/my-purchases"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* PDF Canvas */}
          <div 
            className="bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 mb-6 relative"
            onContextMenu={preventAction}
            onDragStart={preventAction}
            style={{ userSelect: "none" }}
          >
            <div className="flex items-center justify-center p-4 bg-slate-50 min-h-[600px]">
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600"></div>
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto shadow-lg"
                onContextMenu={preventAction}
                onDragStart={preventAction}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Page Navigation */}
              <div className="flex items-center gap-3">
                <button
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                >
                  ← Previous
                </button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700 font-medium">Page</span>
                  <input
                    type="number"
                    min="1"
                    max={numPages}
                    value={currentPage}
                    onChange={(e) => goToPage(e.target.value)}
                    className="w-16 px-2 py-1 text-sm text-center border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 font-medium">of {numPages}</span>
                </div>

                <button
                  onClick={goToNextPage}
                  disabled={currentPage === numPages}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 0.5}
                  className="px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Zoom Out"
                >
                  −
                </button>
                <span className="text-sm font-medium text-slate-700 min-w-[60px] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 3}
                  className="px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Zoom In"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">View-Only Protection Active</h3>
                <p className="text-sm text-blue-800">
                  This document is encrypted and rendered securely in your browser. Right-click, downloading, copying, and printing are disabled to protect intellectual property.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disable Print */}
      <style jsx global>{`
        @media print {
          body {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}