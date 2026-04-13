'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, FileType, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewPolicyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleUpload() {
    if (!uploadFile) return;
    setError(undefined);
    setLoading(true);

    try {
      // Upload Document directly without a predefined policy ID
      // The API will auto-provision a placeholder record
      const fileData = new FormData();
      fileData.append('file', uploadFile);
      fileData.append('autoExtract', 'true');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: fileData
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'File upload failed');
      }

      toast.success("Document Uploaded!", {
         description: "The AI is processing data in the background."
      });

      router.refresh();
      router.push('/app/policies');
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading');
      toast.error("Upload Error", {
         description: err.message || 'An error occurred while uploading'
      });
    } finally {
      setLoading(false);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto h-[80vh] flex flex-col justify-center">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-3 tracking-tight">Bulk Policy Upload</h1>
        <p className="text-muted-foreground text-lg">Upload policy documents (PDF, JPG, PNG). Our background AI worker will process the document, extract customer information, dates, and premiums, and structure the data automatically.</p>
      </div>

      <div 
        className={`relative flex flex-col items-center justify-center w-full h-[320px] rounded-xl border-2 border-dashed transition-all duration-200 ${
          dragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-card hover:bg-accent/50 hover:border-muted-foreground/50'
        } ${uploadFile ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          accept="application/pdf,image/jpeg,image/png"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
        />
        
        {!uploadFile ? (
          <>
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <UploadCloud className="w-10 h-10 text-primary" />
            </div>
            <p className="text-xl font-medium mb-1">Drag and drop your file here</p>
            <p className="text-sm text-muted-foreground mb-4">or click anywhere to browse</p>
            <div className="flex gap-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center"><FileType className="w-4 h-4 mr-1" /> PDF</span>
              <span className="flex items-center"><FileType className="w-4 h-4 mr-1" /> JPG</span>
              <span className="flex items-center"><FileType className="w-4 h-4 mr-1" /> PNG</span>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center z-20 pointer-events-none">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 mb-3 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">{uploadFile.name}</p>
            <p className="text-sm text-muted-foreground mb-6">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
            
            <p className="text-xs font-medium text-primary mb-2">Click to replace file</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium text-center shadow-sm">
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
        <Button variant="outline" size="lg" onClick={() => router.back()} disabled={loading} className="w-full sm:w-auto min-w-[140px]">
          Cancel
        </Button>
        <Button size="lg" onClick={handleUpload} disabled={loading || !uploadFile} className="w-full sm:w-auto min-w-[200px] shadow-md">
          {loading ? 'Processing Upload...' : 'Upload & Start Extraction'}
        </Button>
      </div>
    </div>
  );
}
