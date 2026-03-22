/**
 * Shared server-side audio + timestamps generation (same logic as POST /api/admin/generate-audio).
 * Used by the route handler and bulk translation jobs.
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { generateAudioWithInworld } from '@/lib/inworld-tts'
import { cleanTextForAudio, getAudioSegmentsFromText } from '@/lib/text-cleaning'

const INWORLD_API_KEY = process.env.INWORLD_API_KEY
const INWORLD_EN_VOICE_ID = process.env.INWORLD_EN_VOICE_ID || process.env.INWORLD_MAN_VOICE_ID || 'Dennis'
const INWORLD_RU_VOICE_ID = process.env.INWORLD_RU_VOICE_ID || process.env.INWORLD_WOMAN_VOICE_ID || 'Dennis'
const INWORLD_WOMAN_VOICE_ID = process.env.INWORLD_WOMAN_VOICE_ID || 'Dennis'
const INWORLD_MODEL_ID = process.env.INWORLD_MODEL_ID || 'inworld-tts-1'
const INWORLD_TEMPERATURE = parseFloat(process.env.INWORLD_TEMPERATURE || '1.1')

export type GenerateAudioContext = 'section' | 'quiz' | 'introduction'

export interface GenerateAudioToPublicParams {
  /** Raw text (HTML allowed — same as generate-audio API) */
  text: string
  context?: GenerateAudioContext
  fileKey?: string
  voiceId?: string
  /** Extra uniqueness for filenames when many files are created in the same millisecond */
  uniqueId?: string
  /** Optional Inworld overrides (same as /api/admin/generate-audio body) */
  modelId?: string
  audioEncoding?: string
  speakingRate?: number
  sampleRateHertz?: number
  bitRate?: number
  temperature?: number
  timestampType?: string
  applyTextNormalization?: string
}

export interface GenerateAudioToPublicResult {
  audioUrl: string
  timestampsUrl: string
}

export function assertInworldConfigured(): void {
  if (!INWORLD_API_KEY?.trim()) {
    throw new Error(
      'INWORLD_API_KEY is not configured. Set it in .env (Base64(workspace_id:api_key)).'
    )
  }
}

/**
 * Generate MP3 + timestamps JSON under public/audio and public/timestamps.
 */
export async function generateAudioFilesToPublic(
  params: GenerateAudioToPublicParams
): Promise<GenerateAudioToPublicResult> {
  assertInworldConfigured()

  const {
    text,
    context = 'section',
    fileKey,
    voiceId,
    uniqueId,
    modelId,
    audioEncoding,
    speakingRate,
    sampleRateHertz,
    bitRate,
    temperature,
    timestampType,
    applyTextNormalization,
  } = params

  if (!text || text.trim().length === 0) {
    throw new Error('Text is required for audio generation')
  }

  const segments = getAudioSegmentsFromText(text)
  const cleanedText = segments.length > 0 ? segments.join(' ') : cleanTextForAudio(text)
  if (!cleanedText || cleanedText.trim().length === 0) {
    throw new Error('No readable text after cleaning for audio generation')
  }

  let selectedVoiceId: string
  const normalizedFileKey = typeof fileKey === 'string' ? fileKey.toLowerCase() : ''
  if (voiceId) {
    selectedVoiceId = voiceId
  } else if (normalizedFileKey === 'ru') {
    selectedVoiceId = INWORLD_RU_VOICE_ID
  } else if (normalizedFileKey === 'en') {
    selectedVoiceId = INWORLD_EN_VOICE_ID
  } else if (context === 'quiz') {
    selectedVoiceId = INWORLD_WOMAN_VOICE_ID
  } else {
    selectedVoiceId = INWORLD_EN_VOICE_ID
  }

  const ttsOptions = {
    modelId: modelId || INWORLD_MODEL_ID,
    audioEncoding: audioEncoding || 'MP3',
    speakingRate: speakingRate !== undefined ? parseFloat(String(speakingRate)) : 1.0,
    sampleRateHertz: sampleRateHertz !== undefined ? parseInt(String(sampleRateHertz), 10) : 48000,
    bitRate: bitRate !== undefined ? parseInt(String(bitRate), 10) : undefined,
    temperature:
      temperature !== undefined && temperature !== null
        ? parseFloat(String(temperature))
        : INWORLD_TEMPERATURE,
    timestampType: (timestampType || 'WORD') as 'WORD' | 'CHARACTER' | 'TIMESTAMP_TYPE_UNSPECIFIED',
    applyTextNormalization:
      (applyTextNormalization || 'APPLY_TEXT_NORMALIZATION_UNSPECIFIED') as
        | 'ON'
        | 'OFF'
        | 'APPLY_TEXT_NORMALIZATION_UNSPECIFIED',
  }

  let audioBytes: Buffer
  let timestampsData: unknown

  if (segments.length <= 1) {
    const result = await generateAudioWithInworld(
      cleanedText,
      selectedVoiceId,
      INWORLD_API_KEY!,
      ttsOptions
    )
    audioBytes = result.audioBuffer
    timestampsData = result.timestampData
  } else {
    const buffers: Buffer[] = []
    const allWords: Array<{ text: string; start: number; end: number; confidence: number }> = []
    let timeOffset = 0
    const textParts: string[] = []

    for (const segment of segments) {
      const result = await generateAudioWithInworld(segment, selectedVoiceId, INWORLD_API_KEY!, ttsOptions)
      buffers.push(result.audioBuffer)
      const words = (result.timestampData as any)?.segments?.[0]?.words ?? []
      for (const w of words) {
        allWords.push({
          text: w.text ?? '',
          start: (w.start ?? 0) + timeOffset,
          end: (w.end ?? 0) + timeOffset,
          confidence: w.confidence ?? 1.0,
        })
      }
      const segDuration = words.length > 0 ? Math.max(...words.map((w: { end?: number }) => w.end ?? 0)) : 0
      timeOffset += segDuration
      textParts.push(segment)
    }

    audioBytes = Buffer.concat(buffers)
    timestampsData = {
      text: textParts.join(' '),
      segments: [{ words: allWords }],
    }
  }

  if (audioBytes.length === 0) {
    throw new Error('Generated audio file is empty')
  }

  const keyPart =
    typeof fileKey === 'string' && /^[a-zA-Z0-9_-]{1,16}$/.test(fileKey) ? `${fileKey}-` : ''
  const uniq =
    (uniqueId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) ||
    Math.random().toString(36).slice(2, 10)
  const baseTime = Date.now()
  const sanitizedText = cleanedText.substring(0, 20).replace(/[^\p{L}\p{N}]/gu, '_')
  const audioFileName = `${baseTime}-${keyPart}${uniq}-${sanitizedText}.mp3`

  const uploadPath = join(process.cwd(), 'public/audio')
  if (!existsSync(uploadPath)) {
    await mkdir(uploadPath, { recursive: true })
  }

  const audioFilePath = join(uploadPath, audioFileName)
  await writeFile(audioFilePath, audioBytes)

  const timestampsDir = join(process.cwd(), 'public/timestamps')
  if (!existsSync(timestampsDir)) {
    await mkdir(timestampsDir, { recursive: true })
  }

  const timestampsFileName = `${baseTime}-${keyPart}${uniq}-${sanitizedText}.timestamps.json`
  const timestampsFilePath = join(timestampsDir, timestampsFileName)
  await writeFile(timestampsFilePath, JSON.stringify(timestampsData, null, 2))

  return {
    audioUrl: `/audio/${audioFileName}`,
    timestampsUrl: `/timestamps/${timestampsFileName}`,
  }
}
