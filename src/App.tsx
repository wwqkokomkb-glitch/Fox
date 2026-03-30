import React, { useState, useCallback, useRef, useEffect } from "react";
import { Upload, File, Copy, Check, X, ExternalLink, Shield, Clock, Zap, Eye, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UploadedFile {
  id: string;
  originalName: string;
  size: number;
  directLink: string;
  expiresAt: string;
  mimeType: string;
}

const Countdown = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono text-orange-600 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">
      <Clock size={12} />
      {timeLeft}
    </div>
  );
};

const PreviewModal = ({ file, onClose }: { file: UploadedFile; onClose: () => void }) => {
  const isImage = file.mimeType.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";
  const isText = file.mimeType.startsWith("text/") || file.mimeType === "application/json";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
              <File size={18} />
            </div>
            <h3 className="font-bold truncate max-w-[200px] md:max-w-md">{file.originalName}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 p-4 flex items-center justify-center min-h-[300px]">
          {isImage ? (
            <img 
              src={file.directLink} 
              alt={file.originalName} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : isPDF ? (
            <iframe 
              src={file.directLink} 
              className="w-full h-full min-h-[600px] rounded-lg border border-gray-200"
              title="PDF Preview"
            />
          ) : isText ? (
            <iframe 
              src={file.directLink} 
              className="w-full h-full min-h-[400px] bg-white rounded-lg border border-gray-200 p-4 font-mono text-sm"
              title="Text Preview"
            />
          ) : (
            <div className="text-center p-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-4">
                <File size={32} />
              </div>
              <p className="text-gray-500 font-medium">Preview not available for this file type.</p>
              <p className="text-sm text-gray-400 mt-1">{file.mimeType}</p>
              <a 
                href={file.directLink} 
                className="mt-6 inline-flex items-center gap-2 bg-[#1a1a1a] text-white px-6 py-2 rounded-xl font-medium hover:bg-black transition-colors"
              >
                Download File
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      setUploadedFiles((prev) => [...result.files, ...prev]);
      setFiles([]);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith("image/") || 
           mimeType === "application/pdf" || 
           mimeType.startsWith("text/") || 
           mimeType === "application/json";
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-orange-100">
      {/* Header */}
      <header className="max-w-4xl mx-auto pt-12 pb-8 px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
            <Zap size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">FoxShare</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Direct, obfuscated links. Valid for 24 hours. No tracking.
        </p>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-24 space-y-8">
        {/* Upload Section */}
        <section 
          className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-all group"
          >
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-orange-100 group-hover:text-orange-500 transition-colors">
              <Upload size={32} />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-400">Any file up to 50MB</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              multiple 
              className="hidden" 
            />
          </div>

          {/* Selected Files List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8 space-y-3"
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 px-2">Selected Files</h3>
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <File size={20} className="text-gray-400 shrink-0" />
                      <div className="truncate">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFile(idx)}
                      className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={uploadFiles}
                  disabled={uploading}
                  className="w-full bg-[#1a1a1a] text-white py-4 rounded-2xl font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      Generate Direct Links
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Uploaded Files Section */}
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xl font-bold">Recent Links</h2>
              </div>
              
              <div className="grid gap-4">
                {uploadedFiles.map((file) => (
                  <motion.div 
                    layout
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    key={file.id} 
                    className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 shrink-0">
                          <File size={24} />
                        </div>
                        <div className="overflow-hidden">
                          <h3 className="font-bold text-lg truncate">{file.originalName}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-gray-400">{formatSize(file.size)}</p>
                            <Countdown expiresAt={file.expiresAt} />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canPreview(file.mimeType) && (
                          <button 
                            onClick={() => setPreviewFile(file)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-100 text-gray-600 font-medium transition-colors"
                          >
                            <Eye size={18} />
                            Preview
                          </button>
                        )}
                        <button 
                          onClick={() => copyToClipboard(file.directLink, file.id)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-medium transition-colors relative overflow-hidden"
                        >
                          {copiedId === file.id ? (
                            <>
                              <Check size={18} />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Share2 size={18} />
                              Share
                            </>
                          )}
                        </button>
                        <a 
                          href={file.directLink} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-100 text-gray-600 transition-colors"
                          title="Open direct link"
                        >
                          <ExternalLink size={20} />
                        </a>
                      </div>
                    </div>

                    <div className="bg-gray-50 px-4 py-3 rounded-xl border border-gray-100 font-mono text-sm text-gray-500 truncate">
                      {file.directLink}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Features Info */}
        <section className="grid md:grid-cols-3 gap-6 pt-12">
          <div className="p-6 rounded-2xl bg-white/50 border border-gray-100">
            <Shield size={24} className="text-orange-500 mb-4" />
            <h4 className="font-bold mb-2">Obfuscated</h4>
            <p className="text-sm text-gray-500">Links are generated with random IDs. No one can guess your file names.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/50 border border-gray-100">
            <Clock size={24} className="text-orange-500 mb-4" />
            <h4 className="font-bold mb-2">Auto-Expiry</h4>
            <p className="text-sm text-gray-500">Files are automatically inaccessible after 24 hours for your privacy.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/50 border border-gray-100">
            <Zap size={24} className="text-orange-500 mb-4" />
            <h4 className="font-bold mb-2">Direct Access</h4>
            <p className="text-sm text-gray-500">No landing pages or ads. Just a direct stream of your file content.</p>
          </div>
        </section>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <PreviewModal 
            file={previewFile} 
            onClose={() => setPreviewFile(null)} 
          />
        )}
      </AnimatePresence>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-gray-200 text-center text-gray-400 text-sm">
        <p>© 2026 FoxShare • Simple & Secure File Sharing</p>
      </footer>
    </div>
  );
}
