import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, canEdit } from '@/lib/auth'
import { assertInworldConfigured } from '@/lib/generate-audio-file'
import {
  getBulkPlan,
  runIntroductionBatch,
  runChapterMetadataBatch,
  runSectionsBatch,
  runQuizQuestionsBatch,
  runAdditionalQuestionsBatch,
} from '@/lib/bulk-translate-ru'

/** Per-request ceiling (each batch should finish within proxy timeouts). */
export const maxDuration = 300

export type BulkMode =
  | 'plan'
  | 'introduction'
  | 'chapterMetadata'
  | 'sections'
  | 'quizQuestions'
  | 'additionalQuestions'

function parseBody(body: Record<string, unknown>) {
  const forceRetranslateText = Boolean(body.forceRetranslateText)
  const generateAudio = body.generateAudio !== false
  const forceRegenerateAudio = Boolean(body.forceRegenerateAudio)
  const generateEnglishAudio = Boolean(body.generateEnglishAudio)
  const forceRegenerateEnglishAudio = Boolean(body.forceRegenerateEnglishAudio)
  const anyAudio = generateAudio || generateEnglishAudio
  const mode = (body.mode as BulkMode) || 'plan'
  const offset = Math.max(0, parseInt(String(body.offset ?? 0), 10) || 0)
  const rawLimit = body.limit
  let limit: number
  if (rawLimit !== undefined && rawLimit !== null) {
    limit = Math.min(50, Math.max(1, parseInt(String(rawLimit), 10) || 1))
  } else {
    // Defaults: small batches when generating audio (many Inworld calls per quiz row)
    if (mode === 'sections') {
      limit = anyAudio ? 1 : 6
    } else if (mode === 'quizQuestions' || mode === 'additionalQuestions') {
      limit = anyAudio ? 1 : 4
    } else if (mode === 'chapterMetadata') {
      limit = 12
    } else {
      limit = 1
    }
  }

  return {
    forceRetranslateText,
    generateAudio,
    forceRegenerateAudio,
    generateEnglishAudio,
    forceRegenerateEnglishAudio,
    anyAudio,
    mode,
    offset,
    limit,
  }
}

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

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const opts = parseBody(body)
    const bulkOpts = {
      forceRetranslateText: opts.forceRetranslateText,
      generateAudio: opts.generateAudio,
      forceRegenerateAudio: opts.forceRegenerateAudio,
      generateEnglishAudio: opts.generateEnglishAudio,
      forceRegenerateEnglishAudio: opts.forceRegenerateEnglishAudio,
    }

    if (opts.mode === 'plan') {
      const plan = await getBulkPlan()
      const anyAudio = opts.anyAudio
      return NextResponse.json({
        ok: true,
        mode: 'plan',
        plan,
        defaults: {
          sectionsBatch: anyAudio ? 1 : 6,
          quizBatch: anyAudio ? 1 : 4,
          chapterMetadataBatch: 12,
        },
      })
    }

    if (opts.anyAudio) {
      try {
        assertInworldConfigured()
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Inworld not configured' },
          { status: 500 }
        )
      }
    }

    switch (opts.mode) {
      case 'introduction': {
        const result = await runIntroductionBatch(bulkOpts)
        return NextResponse.json({
          ok: result.errors.length === 0,
          mode: 'introduction',
          done: true,
          logs: result.logs,
          errors: result.errors,
        })
      }
      case 'chapterMetadata': {
        const result = await runChapterMetadataBatch(bulkOpts, opts.offset, opts.limit)
        return NextResponse.json({
          ok: result.errors.length === 0,
          mode: 'chapterMetadata',
          offset: opts.offset,
          limit: opts.limit,
          nextOffset: result.nextOffset,
          hasMore: result.hasMore,
          logs: result.logs,
          errors: result.errors,
        })
      }
      case 'sections': {
        const result = await runSectionsBatch(bulkOpts, opts.offset, opts.limit)
        return NextResponse.json({
          ok: result.errors.length === 0,
          mode: 'sections',
          offset: opts.offset,
          limit: opts.limit,
          nextOffset: result.nextOffset,
          hasMore: result.hasMore,
          logs: result.logs,
          errors: result.errors,
        })
      }
      case 'quizQuestions': {
        const result = await runQuizQuestionsBatch(bulkOpts, opts.offset, opts.limit)
        return NextResponse.json({
          ok: result.errors.length === 0,
          mode: 'quizQuestions',
          offset: opts.offset,
          limit: opts.limit,
          nextOffset: result.nextOffset,
          hasMore: result.hasMore,
          logs: result.logs,
          errors: result.errors,
        })
      }
      case 'additionalQuestions': {
        const result = await runAdditionalQuestionsBatch(bulkOpts, opts.offset, opts.limit)
        return NextResponse.json({
          ok: result.errors.length === 0,
          mode: 'additionalQuestions',
          offset: opts.offset,
          limit: opts.limit,
          nextOffset: result.nextOffset,
          hasMore: result.hasMore,
          logs: result.logs,
          errors: result.errors,
        })
      }
      default:
        return NextResponse.json({ error: `Unknown mode: ${opts.mode}` }, { status: 400 })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk translate failed'
    console.error('[bulk-translate-ru]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
