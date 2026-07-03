'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, File, AlertCircle, CheckCircle, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'not_started';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'queued' | 'error';
  progress: number;
  message: string;
  error?: string;
  policyId?: string;
  documentId?: string;
  extractionStatus?: ExtractionStatus;
  extractionError?: string;
}

interface BulkFileUploadProps {
  onUploadComplete?: (results: any[]) => void;
  onError?: (error: string) => void;
  customerId?: string;
}

export default function BulkFileUpload({ onUploadComplete, onError, customerId }: BulkFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'policy' | 'renewal'>('policy');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll extraction status for queued documents
  const pollExtractionStatus = useCallback(async (files: UploadFile[]) => {
    const queuedFiles = files.filter(f => f.documentId && f.extractionStatus !== 'completed' && f.extractionStatus !== 'failed');
    if (queuedFiles.length === 0) return;

    await Promise.allSettled(
      queuedFiles.map(async (file) => {
        try {
          const res = await fetch(`/api/extract/status/${file.documentId}`);
          if (!res.ok) return;
          const data = await res.json();
          const status: ExtractionStatus = data.status || 'pending';
          setUploadQueue(prev =>
            prev.map(f =>
              f.documentId === file.documentId
                ? {
                    ...f,
                    extractionStatus: status,
                    extractionError: data.error || undefined,
                    message:
                      status === 'completed'
                        ? '✅ Extraction complete — policy data updated'
                        : status === 'failed'
                        ? `❌ Extraction failed: ${data.error || 'unknown error'}`
                        : status === 'processing'
                        ? '⏳ Extracting data...'
                        : '🕐 Queued for extraction',
                  }
                : f
            )
          );
        } catch {
          // Silent fail — will retry on next poll
        }
      })
    );
  }, []);

  useEffect(() => {
    const hasQueuedFiles = uploadQueue.some(
      f => f.documentId && f.extractionStatus !== 'completed' && f.extractionStatus !== 'failed'
    );
    if (!hasQueuedFiles) return;

    const interval = setInterval(() => {
      pollExtractionStatus(uploadQueue);
    }, 6000); // Poll every 6 seconds

    return () => clearInterval(interval);
  }, [uploadQueue, pollExtractionStatus]);

  async function uploadAllFiles() {
    if (uploadQueue.length === 0) return;

    setIsUploading(true);

    try {
      // Mark all as uploading
      setUploadQueue(prev => prev.map(f => ({ ...f, status: 'uploading' as const, message: 'Uploading...', progress: 30 })));

      // Build a single FormData with ALL files for /api/upload/bulk
      const formData = new FormData();
      uploadQueue.forEach(f => formData.append('files', f.file));
      if (customerId) formData.append('customerId', customerId);
      formData.append('uploadType', uploadType);

      const response = await fetch('/api/upload/bulk', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Bulk upload failed');
      }

      // Map results back to individual files
      const uploadResults: Array<{ fileName: string; policyId: string; documentId: string; status: string }> = [];
      const serverResults: Array<{ fileName: string; policyId?: string; documentId?: string; status: string; error?: string }> =
        result.results || [];

      setUploadQueue(prev =>
        prev.map(f => {
          const serverResult = serverResults.find(r => r.fileName === f.file.name);
          if (!serverResult || serverResult.status === 'error') {
            return {
              ...f,
              status: 'error' as const,
              message: serverResult?.error || 'Upload failed',
              error: serverResult?.error || 'Upload failed',
              progress: 0,
            };
          }
          uploadResults.push({
            fileName: f.file.name,
            policyId: serverResult.policyId || '',
            documentId: serverResult.documentId || '',
            status: 'success',
          });
          return {
            ...f,
            status: 'queued' as const,
            message: '🕐 Queued for extraction',
            progress: 100,
            policyId: serverResult.policyId,
            documentId: serverResult.documentId,
            extractionStatus: 'pending' as ExtractionStatus,
          };
        })
      );

      const successCount = uploadResults.length;
      if (successCount > 0) {
        toast.success(`${successCount} file(s) uploaded!`, {
          description: 'Extraction is running in background. This card will update automatically.',
        });
        if (onUploadComplete) onUploadComplete(uploadResults);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Upload failed';
      setUploadQueue(prev => prev.map(f => ({ ...f, status: 'error' as const, message: msg, error: msg, progress: 0 })));
      toast.error('Upload failed', { description: msg });
    } finally {
      setIsUploading(false);
    }
  }


  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;

    const newFiles: UploadFile[] = Array.from(files)
      .filter(file => {
        const isValidType = ['application/pdf'].includes(file.type);
        const isValidSize = file.size <= 10 * 1024 * 1024;
        if (!isValidType) {
          toast.error(`Invalid file type: ${file.name}`);
          return false;
        }
        if (!isValidSize) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          return false;
        }
        return true;
      })
      .map(file => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: 'pending' as const,
        progress: 0,
        message: 'Ready to upload',
      }));

    setUploadQueue(prev => [...prev, ...newFiles]);
  }

  function removeFile(fileId: string) {
    setUploadQueue(prev => prev.filter(f => f.id !== fileId));
  }

  function retryFile(fileId: string) {
    setUploadQueue(prev =>
      prev.map(f =>
        f.id === fileId
          ? { ...f, status: 'pending', message: 'Ready to upload', progress: 0, error: undefined }
          : f
      )
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Upload Mode Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">What are you uploading?</Label>
        <RadioGroup 
          defaultValue="policy" 
          value={uploadType} 
          onValueChange={(val: any) => setUploadType(val)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="policy" id="bulk-type-policy" />
            <Label htmlFor="bulk-type-policy" className="cursor-pointer">Policy Documents</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="renewal" id="bulk-type-renewal" />
            <Label htmlFor="bulk-type-renewal" className="cursor-pointer">Renewal Receipts (Life)</Label>
          </div>
        </RadioGroup>
        {uploadType === 'renewal' && (
          <p className="text-xs text-muted-foreground">
            We'll extract the customer data and Life Insurance policy details from the receipts. The receipt documents will not be stored permanently.
          </p>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground/50'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isUploading}
          className="hidden"
          id="bulk-file-input"
          multiple
        />

        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">
          Upload Multiple {uploadType === 'policy' ? 'Policy Documents' : 'Renewal Receipts'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop multiple PDF files here or click to browse
        </p>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          variant="outline"
        >
          Select Files
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          Maximum file size: 10MB per file. Files will be processed sequentially.
        </p>
      </div>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <Card className="p-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold">
                Files to Upload ({uploadQueue.filter(f => f.status === 'queued').length}/{uploadQueue.length})
              </h4>
              {uploadQueue.length > 0 && uploadQueue.every(f => ['queued', 'error'].includes(f.status)) && (
                <Button
                  onClick={() => {
                    setUploadQueue([]);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Clear
                </Button>
              )}
            </div>

            {uploadQueue.map(file => (
              <div key={file.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    {/* Upload Status Icon */}
                    {file.status === 'uploading' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : file.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}

                    {/* Extraction Status Badge */}
                    {file.extractionStatus && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        file.extractionStatus === 'completed'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : file.extractionStatus === 'failed'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : file.extractionStatus === 'processing'
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {file.extractionStatus === 'completed'
                          ? '✓ Extracted'
                          : file.extractionStatus === 'failed'
                          ? '✗ Failed'
                          : file.extractionStatus === 'processing'
                          ? '⏳ Extracting'
                          : '⏱ Queued'}
                      </span>
                    )}

                    {file.status === 'queued' && !file.extractionStatus && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {file.extractionStatus === 'processing' && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {file.status !== 'pending' && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        file.status === 'error'
                          ? 'bg-red-500'
                          : file.extractionStatus === 'completed'
                          ? 'bg-emerald-500'
                          : file.extractionStatus === 'failed'
                          ? 'bg-red-400'
                          : file.status === 'queued'
                          ? 'bg-amber-400'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(file.progress, 100)}%` }}
                    />
                  </div>
                )}

                {/* Status Message */}
                <div className="flex justify-between items-start">
                  <p className={`text-xs font-medium ${
                    file.status === 'error' || file.extractionStatus === 'failed'
                      ? 'text-red-600'
                      : file.extractionStatus === 'completed'
                      ? 'text-emerald-600'
                      : file.extractionStatus === 'processing'
                      ? 'text-blue-600'
                      : file.status === 'queued'
                      ? 'text-amber-700'
                      : 'text-muted-foreground'
                  }`}>
                    {file.message}
                  </p>

                  {file.status === 'error' && (
                    <Button
                      onClick={() => retryFile(file.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto py-1 px-2"
                    >
                      Retry
                    </Button>
                  )}
                  {file.status === 'pending' && (
                    <Button
                      onClick={() => removeFile(file.id)}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto py-1 px-2"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                  {file.policyId && file.extractionStatus === 'completed' && (
                    <a
                      href={`/app/policies/${file.policyId}`}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      View Policy →
                    </a>
                  )}
                </div>

                {(file.error || file.extractionError) && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    {file.error || file.extractionError}
                  </p>
                )}
              </div>
            ))}


            {uploadQueue.some(f => f.status === 'pending') && (
              <Button
                onClick={uploadAllFiles}
                disabled={isUploading}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {uploadQueue.filter(f => f.status === 'pending').length} File(s)
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
