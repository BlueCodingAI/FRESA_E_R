import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, canEdit } from '@/lib/auth'
import { generateAudioFilesToPublic } from '@/lib/generate-audio-file'

const INWORLD_API_KEY = process.env.INWORLD_API_KEY

export async function POST(request: NextRequest) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = verifyToken(token)
    if (!user || !canEdit(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!INWORLD_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Inworld AI API key is not configured. Please set INWORLD_API_KEY in your .env file. Format: Base64(workspace_id:api_key). Restart the server after updating.',
        },
        { status: 500 }
      )
    }

    const {
      text,
      voiceId,
      context,
      fileKey,
      modelId,
      audioEncoding,
      speakingRate,
      sampleRateHertz,
      bitRate,
      temperature,
      timestampType,
      applyTextNormalization,
    } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const { audioUrl, timestampsUrl } = await generateAudioFilesToPublic({
      text,
      context: context || 'section',
      fileKey,
      voiceId,
      modelId,
      audioEncoding,
      speakingRate,
      sampleRateHertz,
      bitRate,
      temperature,
      timestampType,
      applyTextNormalization,
    })

    const audioFileName = audioUrl.split('/').pop() || ''
    const timestampsFileName = timestampsUrl.split('/').pop() || ''

    return NextResponse.json({
      success: true,
      audioUrl,
      timestampsUrl,
      audioFileName,
      timestampsFileName,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate audio'
    console.error('Error generating audio:', error)
    const isClient =
      message.includes('Text is required') || message.includes('No readable text')
    return NextResponse.json({ error: message }, { status: isClient ? 400 : 500 })
  }
}
