'use client';

import { useState, useRef } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onSuccess: () => void;
  target: 'todo' | 'followup';
}

export function VoiceRecorder({ onSuccess, target }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const toastId = toast.loading('Processing voice command...');
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('target', target);

      const res = await fetch('/api/voice-command', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to process voice command');
      }

      toast.success(result.message || 'Action completed successfully', { id: toastId });
      onSuccess();
    } catch (error: any) {
      console.error('Voice processing error:', error);
      toast.error(error.message || 'Failed to process voice command', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <Button variant="outline" size="icon" disabled className="h-10 w-10">
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <Button 
        variant="destructive" 
        size="icon" 
        onClick={stopRecording} 
        className="h-10 w-10 animate-pulse bg-red-600 hover:bg-red-700 shadow-md shadow-red-500/20"
        title="Stop Recording"
      >
        <Square className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={startRecording}
      className="h-10 w-10 bg-card hover:bg-accent border-border shadow-sm text-muted-foreground hover:text-foreground"
      title="Voice Command (AI)"
    >
      <Mic className="w-5 h-5" />
    </Button>
  );
}
