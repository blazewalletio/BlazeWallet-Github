import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ✅ Next.js 14: Route segment config for max body size
export const maxDuration = 60; // Max 60 seconds for transcription

/**
 * 🎙️ VOICE INPUT API - WHISPER TRANSCRIPTION
 * 
 * Converts audio to text using OpenAI Whisper API
 * Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
 * Max file size: 25MB (Whisper limit)
 */

function getOpenAI() {
  // ✅ Use dedicated Whisper API key if available, fallback to main OpenAI key
  const whisperApiKey = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;
  const usingDedicatedKey = !!process.env.WHISPER_API_KEY;
  
  console.log(`🔑 [Whisper API] Using ${usingDedicatedKey ? 'dedicated WHISPER_API_KEY' : 'fallback OPENAI_API_KEY'}`);
  
  return new OpenAI({
    apiKey: whisperApiKey,
  });
}

export async function POST(req: NextRequest) {
  try {
    console.log('🎙️ [Whisper API] Receiving audio transcription request...');

    // Parse form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const userId = formData.get('userId') as string;

    if (!audioFile) {
      console.error('❌ [Whisper API] No audio file provided');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log(`🎙️ [Whisper API] Received file:`, {
      name: audioFile.name,
      type: audioFile.type,
      size: `${(audioFile.size / 1024).toFixed(1)}KB`
    });

    // Validate file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      console.error('❌ [Whisper API] File too large:', audioFile.size);
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }

    // ✅ FIXED: Accept all common audio formats (including webm with codecs)
    const allowedTypes = [
      'audio/mpeg', 
      'audio/mp3',
      'audio/mp4', 
      'audio/wav', 
      'audio/webm', 
      'audio/webm;codecs=opus',
      'audio/ogg',
      'audio/ogg;codecs=opus',
      'audio/m4a'
    ];
    
    // Check if type starts with any allowed type (handles codec variations)
    const isValidType = allowedTypes.some(type => audioFile.type.startsWith(type.split(';')[0]));
    
    if (!isValidType) {
      console.error('❌ [Whisper API] Invalid audio format:', audioFile.type);
      return NextResponse.json(
        { error: `Invalid audio format: ${audioFile.type}. Supported: webm, mp3, wav, ogg` },
        { status: 400 }
      );
    }

    console.log(`🎙️ [Whisper API] Transcribing audio: ${audioFile.name} (${(audioFile.size / 1024).toFixed(1)}KB, ${audioFile.type})`);

    // Convert File to Buffer for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ✅ FIXED: Determine correct file extension based on MIME type
    let extension = 'webm';
    if (audioFile.type.includes('mp3') || audioFile.type.includes('mpeg')) {
      extension = 'mp3';
    } else if (audioFile.type.includes('wav')) {
      extension = 'wav';
    } else if (audioFile.type.includes('ogg')) {
      extension = 'ogg';
    } else if (audioFile.type.includes('mp4') || audioFile.type.includes('m4a')) {
      extension = 'm4a';
    }

    // Create a File object that OpenAI expects with correct extension
    const fileName = `recording.${extension}`;
    const file = new File([buffer], fileName, { type: audioFile.type.split(';')[0] });

    console.log(`📤 [Whisper API] Sending to OpenAI: ${fileName} (${audioFile.type.split(';')[0]})`);

    // Call OpenAI Whisper API
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en', // English for crypto commands
      response_format: 'json',
      temperature: 0.0, // Deterministic for command parsing
    });

    const transcribedText = transcription.text;

    console.log(`✅ [Whisper API] Transcription successful: "${transcribedText}"`);

    // Return transcribed text
    return NextResponse.json({
      success: true,
      text: transcribedText,
    });

  } catch (error: any) {
    console.error('❌ [Whisper API] Transcription error:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    // Handle specific OpenAI errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API key invalid', message: 'OpenAI API key is not configured correctly.' },
        { status: 500 }
      );
    }

    if (error.status === 413) {
      return NextResponse.json(
        { error: 'File too large', message: 'Audio file exceeds 25MB limit.' },
        { status: 413 }
      );
    }

    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit', message: 'Too many transcription requests. Please try again in a moment.' },
        { status: 429 }
      );
    }

    // Return detailed error message
    return NextResponse.json(
      { 
        error: 'Transcription failed',
        message: error.message || 'Something went wrong. Please try again.',
        details: `Status: ${error.status || 'unknown'}, Type: ${error.type || 'unknown'}`
      },
      { status: 500 }
    );
  }
}

