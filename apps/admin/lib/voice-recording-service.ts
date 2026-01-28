/**
 * 🎙️ VOICE RECORDING SERVICE
 * 
 * Handles voice recording in the browser using MediaRecorder API
 * Converts audio to blob and transcribes via Whisper API
 */

import { logger } from '@/lib/logger';

export interface VoiceRecordingResult {
  success: boolean;
  text?: string;
  error?: string;
}

class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private lastTranscriptionTime: number = 0;
  private readonly MIN_INTERVAL_MS = 3000; // Min 3 seconds between transcriptions

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
      logger.log('🎙️ [Voice] Requesting microphone permission...');

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

      logger.log(`🎙️ [Voice] Using format: ${mimeType}`);

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
      logger.log('🎙️ [Voice] Recording started');

      return { success: true };
    } catch (error: any) {
      logger.error('❌ [Voice] Failed to start recording:', error);
      
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
        logger.log(`🎙️ [Voice] Recording stopped (${(audioBlob.size / 1024).toFixed(1)}KB)`);
        
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
      // ✅ Rate limit protection: Min 3 seconds between transcriptions
      const now = Date.now();
      const timeSinceLastTranscription = now - this.lastTranscriptionTime;
      
      if (timeSinceLastTranscription < this.MIN_INTERVAL_MS) {
        const waitTime = Math.ceil((this.MIN_INTERVAL_MS - timeSinceLastTranscription) / 1000);
        logger.warn(`⏰ [Voice] Rate limit protection: Please wait ${waitTime} seconds`);
        return {
          success: false,
          error: `Please wait ${waitTime} seconds before next transcription to avoid rate limits.`,
        };
      }

      logger.log('📤 [Voice] Uploading audio for transcription...', {
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

      logger.log('📤 [Voice] Sending to API...');

      // Update last transcription time
      this.lastTranscriptionTime = now;

      // Call transcription API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch('/api/ai-assistant/transcribe', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        logger.log('📡 [Voice] API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json();
          logger.error('❌ [Voice] API error:', errorData);
          
          // Handle 429 specifically
          if (response.status === 429) {
            return {
              success: false,
              error: 'Too many requests. OpenAI Whisper API has rate limits. Please wait 30 seconds and try again, or type your command instead.',
            };
          }
          
          throw new Error(errorData.message || errorData.error || 'Transcription failed');
        }

        const data = await response.json();
        
        logger.log('✅ [Voice] Transcription successful:', data.text);

        return {
          success: true,
          text: data.text,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      logger.error('❌ [Voice] Transcription error:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      
      // More user-friendly error messages
      let userMessage = error.message || 'Failed to transcribe audio';
      
      if (error.name === 'AbortError') {
        userMessage = 'Transcription timeout (30s). Please try a shorter voice command.';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        userMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('API key')) {
        userMessage = 'Voice transcription is not configured. Please contact support.';
      } else if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        userMessage = 'OpenAI rate limit reached. Please wait 30 seconds or type your command instead.';
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
    logger.log('🎙️ [Voice] Recording cancelled');
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }
}

export const voiceRecordingService = new VoiceRecordingService();

