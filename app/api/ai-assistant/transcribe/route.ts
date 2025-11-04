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
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Validate file size (max 25MB)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Audio file too large (max 25MB)' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/m4a'];
    if (!allowedTypes.includes(audioFile.type)) {
      return NextResponse.json(
        { error: `Invalid audio format. Supported: ${allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`🎙️ [Whisper API] Transcribing audio: ${audioFile.name} (${(audioFile.size / 1024).toFixed(1)}KB)`);

    // Convert File to Buffer for OpenAI
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File object that OpenAI expects
    const file = new File([buffer], audioFile.name, { type: audioFile.type });

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

    console.log(`✅ [Whisper API] Transcription successful: "${transcribedText.substring(0, 50)}..."`);

    // Return transcribed text
    return NextResponse.json({
      success: true,
      text: transcribedText,
    });

  } catch (error: any) {
    console.error('❌ [Whisper API] Transcription error:', error);

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

    return NextResponse.json(
      { 
        error: 'Transcription failed',
        message: error.message || 'Something went wrong. Please try again.',
      },
      { status: 500 }
    );
  }
}

