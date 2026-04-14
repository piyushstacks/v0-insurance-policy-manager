'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, File, AlertCircle, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'queued' | 'error';
  progress: number;
  message: string;
  error?: string;
  policyId?: string;
  documentId?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadAllFiles() {
    if (uploadQueue.length === 0) return;

    setIsUploading(true);
    const uploadResults: Array<{ fileName: string; policyId: string; documentId: string; status: string }> = [];
    let successCount = 0;

    // Upload ALL files at once (in parallel)
    const uploadPromises = uploadQueue.map(async (file) => {
      try {
        setUploadQueue(prev =>
          prev.map(f =>
            f.id === file.id ? { ...f, status: 'uploading', message: 'Uploading...', progress: 30 } : f
          )
        );

        const formData = new FormData();
        formData.append('file', file.file);
        formData.append('customerId', customerId || '');
        formData.append('autoExtract', 'false'); // Don't extract on upload, queue it instead

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        const policyId = result.policyId || result.policy_id;

        setUploadQueue(prev =>
          prev.map(f =>
            f.id === file.id
              ? {
                  ...f,
                  status: 'queued',
                  message: 'Queued for extraction (processing in background)',
                  progress: 100,
                  policyId,
                  documentId: result.documentId,
                }
              : f
          )
        );

        uploadResults.push({
          fileName: file.file.name,
          policyId,
          documentId: result.documentId,
          status: 'success',
        });
        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Upload failed';
        setUploadQueue(prev =>
          prev.map(f =>
            f.id === file.id
              ? { ...f, status: 'error', message: errorMsg, error: errorMsg, progress: 0 }
              : f
          )
        );
      }
    });

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded!`, {
        description: `Extraction processing started. Check back soon for updated data.`
      });
      if (onUploadComplete) {
        onUploadComplete(uploadResults);
      }
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
        const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
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
    <div className="w-full space-y-4">
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
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileSelect(e.target.files)}
          disabled={isUploading}
          className="hidden"
          id="bulk-file-input"
          multiple
        />

        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Upload Multiple Policy Documents</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Drag and drop multiple PDF, JPG, or PNG files here or click to browse
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
                    {file.status === 'uploading' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : file.status === 'queued' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : file.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                  </div>
                </div>

                {/* Progress Bar */}
                {file.status !== 'pending' && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        file.status === 'error'
                          ? 'bg-red-500'
                          : file.status === 'queued'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(file.progress, 100)}%` }}
                    />
                  </div>
                )}

                {/* Status Message */}
                <div className="flex justify-between items-start">
                  <p className={`text-xs font-medium ${
                    file.status === 'error'
                      ? 'text-red-600'
                      : file.status === 'queued'
                        ? 'text-green-600'
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
                </div>

                {file.error && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{file.error}</p>
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
