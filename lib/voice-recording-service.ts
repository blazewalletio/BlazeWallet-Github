/**
 * 🎙️ VOICE RECORDING SERVICE
 * 
 * Handles voice recording in the browser using MediaRecorder API
 * Converts audio to blob and transcribes via Whisper API
 */

export interface VoiceRecordingResult {
  success: boolean;
  text?: string;
  error?: string;
}

class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  /**
   * Check if browser supports voice recording
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request microphone permission and start recording
   */
  async startRecording(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🎙️ [Voice] Requesting microphone permission...');

      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });

      // Determine audio format (prefer webm, fallback to other formats)
      const mimeType = this.getSupportedMimeType();
      
      if (!mimeType) {
        throw new Error('No supported audio format available');
      }

      console.log(`🎙️ [Voice] Using format: ${mimeType}`);

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      // Collect audio chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Start recording
      this.mediaRecorder.start();
      console.log('🎙️ [Voice] Recording started');

      return { success: true };
    } catch (error: any) {
      console.error('❌ [Voice] Failed to start recording:', error);
      
      let errorMessage = 'Failed to start recording';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone permission denied. Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is already in use by another application.';
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Stop recording and return audio blob
   */
  async stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder!.mimeType });
        console.log(`🎙️ [Voice] Recording stopped (${(audioBlob.size / 1024).toFixed(1)}KB)`);
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Get supported MIME type for audio recording
   */
  private getSupportedMimeType(): string | null {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Transcribe audio blob using Whisper API
   */
  async transcribe(audioBlob: Blob): Promise<VoiceRecordingResult> {
    try {
      console.log('📤 [Voice] Uploading audio for transcription...', {
        size: `${(audioBlob.size / 1024).toFixed(1)}KB`,
        type: audioBlob.type
      });

      // Get user ID for tracking
      const userId = typeof window !== 'undefined' 
        ? localStorage.getItem('supabase_user_id') || localStorage.getItem('wallet_email') || 'anonymous'
        : 'anonymous';

      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('userId', userId);

      console.log('📤 [Voice] Sending to API...');

      // Call transcription API
      const response = await fetch('/api/ai-assistant/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 [Voice] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [Voice] API error:', errorData);
        throw new Error(errorData.message || errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      
      console.log('✅ [Voice] Transcription successful:', data.text);

      return {
        success: true,
        text: data.text,
      };
    } catch (error: any) {
      console.error('❌ [Voice] Transcription error:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // More user-friendly error messages
      let userMessage = error.message || 'Failed to transcribe audio';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('API key')) {
        userMessage = 'Voice transcription is not configured. Please contact support.';
      } else if (error.message?.includes('rate limit')) {
        userMessage = 'Too many transcription requests. Please wait a moment and try again.';
      }
      
      return {
        success: false,
        error: userMessage,
      };
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.audioChunks = [];
    console.log('🎙️ [Voice] Recording cancelled');
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export const voiceRecordingService = new VoiceRecordingService();

