'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, RefreshCw, X, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  failed?: boolean;
  fileObject?: File;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function NewPolicyPage() {
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File, id: string) => {
    const updateProgress = (progress: number) => {
      setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
    };

    try {
      // Simulate progress during upload
      updateProgress(10);
      const fileData = new FormData();
      fileData.append('file', file);
      fileData.append('autoExtract', 'true');

      updateProgress(30);
      const res = await fetch('/api/upload', { method: 'POST', body: fileData });
      updateProgress(80);

      if (!res.ok) throw new Error('Upload failed');

      updateProgress(100);
      return true;
    } catch (err) {
      setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, failed: true, progress: 0 } : f));
      return false;
    }
  };

  const handleDropFiles = useCallback(async (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(f => 
      f.type === 'application/pdf' || f.type.startsWith('image/')
    );
    
    if (newFiles.length === 0) {
      toast.error('Only PDF, JPG, PNG files are accepted');
      return;
    }

    const newEntries: UploadedFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.name.split('.').pop() || 'pdf',
      progress: 0,
      fileObject: file,
    }));

    setUploadedFiles(prev => [...newEntries, ...prev]);
    setUploading(true);

    let successCount = 0;
    for (const entry of newEntries) {
      const success = await uploadFile(entry.fileObject!, entry.id);
      if (success) successCount++;
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} document(s) uploaded!`, {
        description: 'AI extraction is processing in the background.'
      });
    }
  }, []);

  const handleDeleteFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleRetryFile = async (id: string) => {
    const file = uploadedFiles.find(f => f.id === id);
    if (!file || !file.fileObject) return;
    
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, failed: false, progress: 0 } : f));
    await uploadFile(file.fileObject, id);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) handleDropFiles(e.dataTransfer.files);
  };

  const allDone = uploadedFiles.length > 0 && uploadedFiles.every(f => f.progress === 100 || f.failed);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <Link href="/app/policies" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </Link>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Upload Policy Documents</h1>
        <p className="text-slate-500 mt-1 text-sm">Drag & drop PDFs, JPGs, or PNGs. AI will extract policy data automatically.</p>
      </div>

      {/* Dropzone */}
      <div
        className={`relative flex flex-col items-center justify-center w-full min-h-[200px] rounded-xl border-2 border-dashed transition-all duration-200 p-8 cursor-pointer ${
          dragActive
            ? 'border-blue-400 bg-blue-50/50 scale-[1.01]'
            : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={(e) => e.target.files && handleDropFiles(e.target.files)}
        />
        <div className="p-3 rounded-full bg-blue-50 mb-3">
          <UploadCloud className="w-8 h-8 text-blue-500" />
        </div>
        <p className="text-base font-semibold text-slate-700 mb-1">Click to upload or drag & drop</p>
        <p className="text-xs text-slate-500">PDF, JPG or PNG (max 20MB)</p>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-6 space-y-2">
          {uploadedFiles.map(file => (
            <div
              key={file.id}
              className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all overflow-hidden ${
                file.failed ? 'border-red-200 bg-red-50/30' :
                file.progress === 100 ? 'border-emerald-200 bg-emerald-50/30' :
                'border-slate-200 bg-white'
              }`}
            >
              {/* Progress fill background */}
              {!file.failed && file.progress < 100 && (
                <div
                  className="absolute inset-y-0 left-0 bg-blue-50 transition-all duration-500 ease-out"
                  style={{ width: `${file.progress}%` }}
                />
              )}

              {/* File icon */}
              <div className={`relative z-10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                file.failed ? 'bg-red-100' :
                file.progress === 100 ? 'bg-emerald-100' :
                'bg-blue-100'
              }`}>
                {file.failed ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : file.progress === 100 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-500" />
                )}
              </div>

              {/* File info */}
              <div className="relative z-10 flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="uppercase font-semibold text-[10px]">{file.type}</span>
                  <span>·</span>
                  <span>{formatSize(file.size)}</span>
                  {!file.failed && file.progress < 100 && (
                    <>
                      <span>·</span>
                      <span className="text-blue-600 font-semibold">{file.progress}%</span>
                    </>
                  )}
                  {file.failed && (
                    <>
                      <span>·</span>
                      <span className="text-red-600 font-semibold">Upload Failed</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="relative z-10 flex items-center gap-1 shrink-0">
                {file.failed && (
                  <button
                    onClick={() => handleRetryFile(file.id)}
                    className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                    title="Retry upload"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()} disabled={uploading} className="w-full sm:w-auto">
          Cancel
        </Button>
        {allDone && (
          <Link href="/app/policies" className="w-full sm:w-auto">
            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md">
              Go to Policies →
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
