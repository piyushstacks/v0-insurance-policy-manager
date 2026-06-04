'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, File, AlertCircle, CheckCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface FileUploadProps {
  policyId: string;
  onUploadComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

export default function FileUpload({ policyId, onUploadComplete, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [uploadType, setUploadType] = useState<'policy' | 'renewal'>('policy');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setUploadStatus('uploading');
    setStatusMessage('Uploading document...');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('policyId', policyId);
      formData.append('autoExtract', 'true');
      formData.append('uploadType', uploadType);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      setUploadStatus('success');
      setStatusMessage(`Document uploaded successfully. Processing...`);
      setUploadProgress(100);

      if (onUploadComplete) {
        onUploadComplete(result);
      }

      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Clear status after 3 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setStatusMessage('');
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setUploadStatus('error');
      setStatusMessage(message);

      if (onError) {
        onError(message);
      }
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
    handleUpload(e.dataTransfer.files);
  }

  return (
    <div className="w-full space-y-6">
      {uploadStatus === 'idle' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">What are you uploading?</Label>
          <RadioGroup 
            defaultValue="policy" 
            value={uploadType} 
            onValueChange={(val: any) => setUploadType(val)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="policy" id="type-policy" />
              <Label htmlFor="type-policy" className="cursor-pointer">Policy Document</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="renewal" id="type-renewal" />
              <Label htmlFor="type-renewal" className="cursor-pointer">Renewal Receipt (Life)</Label>
            </div>
          </RadioGroup>
          {uploadType === 'renewal' && (
            <p className="text-xs text-muted-foreground">
              We'll extract the customer data and Life Insurance policy details from the receipt. The receipt document will not be stored permanently.
            </p>
          )}
        </div>
      )}

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}
          ${uploadStatus === 'success' ? 'bg-green-50 border-green-300' : ''}
          ${uploadStatus === 'error' ? 'bg-red-50 border-red-300' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={isUploading}
          className="hidden"
          id="file-input"
        />

        {uploadStatus === 'idle' && (
          <>
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Upload {uploadType === 'policy' ? 'Policy Document' : 'Renewal Receipt'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop your PDF, JPG, or PNG file here or click to browse
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              variant="outline"
            >
              Select File
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Maximum file size: 10MB
            </p>
          </>
        )}

        {uploadStatus === 'uploading' && (
          <>
            <div className="mb-4">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <p className="text-sm font-medium">{statusMessage}</p>
          </>
        )}

        {uploadStatus === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-600" />
            <p className="text-sm font-medium text-green-700">{statusMessage}</p>
          </>
        )}

        {uploadStatus === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
            <p className="text-sm font-medium text-red-700">{statusMessage}</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4"
              variant="outline"
            >
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
