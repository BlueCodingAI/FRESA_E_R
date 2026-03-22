import { NextRequest, NextResponse } from 'next/server'

/** Allow long-running job on supported hosts (e.g. Vercel). */
export const maxDuration = 300
import { prisma } from '@/lib/prisma'
import { verifyToken, canEdit } from '@/lib/auth'
import { openaiTranslate } from '@/lib/openai-translate'
import { generateAudioFilesToPublic, assertInworldConfigured } from '@/lib/generate-audio-file'

type Expl = { correct: string; incorrect: string[] }

function asExpl(v: unknown): Expl | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.correct !== 'string') return null
  if (!Array.isArray(o.incorrect)) return null
  return { correct: o.correct, incorrect: o.incorrect.map((x) => String(x)) }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function needsTextTranslate(force: boolean, source: string, existing: string | null | undefined) {
  const s = source?.trim()
  if (!s) return false
  if (force) return true
  return !existing?.trim()
}

export async function POST(request: NextRequest) {
  const logs: string[] = []
  const errors: string[] = []

  const push = (msg: string) => {
    logs.push(msg)
    console.log(`[bulk-translate-ru] ${msg}`)
  }

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

    const body = await request.json().catch(() => ({}))
    const forceRetranslateText = Boolean(body.forceRetranslateText)
    const generateAudio = body.generateAudio !== false
    const forceRegenerateAudio = Boolean(body.forceRegenerateAudio)

    const scope = {
      introduction: body.scope?.introduction !== false,
      chapterMetadata: body.scope?.chapterMetadata !== false,
      sections: body.scope?.sections !== false,
      quizQuestions: body.scope?.quizQuestions !== false,
      additionalQuestions: body.scope?.additionalQuestions !== false,
    }

    if (generateAudio) {
      try {
        assertInworldConfigured()
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Inworld not configured' },
          { status: 500 }
        )
      }
    }

    // --- Introduction (Section type = introduction) ---
    if (scope.introduction) {
      try {
        const intro = await prisma.section.findFirst({ where: { type: 'introduction' } })
        if (intro) {
          let textRu = intro.textRu
          if (needsTextTranslate(forceRetranslateText, intro.text, intro.textRu)) {
            textRu = await openaiTranslate(intro.text, 'en_to_ru', 'html')
            await sleep(120)
            push(`Introduction: translated text to Russian`)
          } else {
            push(`Introduction: skipped text (already has Russian or no English)`)
          }

          let audioUrlRu = intro.audioUrlRu
          let timestampsUrlRu = intro.timestampsUrlRu
          if (generateAudio && textRu?.trim()) {
            const needAudio =
              forceRegenerateAudio || !intro.audioUrlRu?.trim() || !intro.timestampsUrlRu?.trim()
            if (needAudio) {
              const gen = await generateAudioFilesToPublic({
                text: textRu,
                context: 'section',
                fileKey: 'ru',
                uniqueId: `intro-${intro.id}`,
              })
              audioUrlRu = gen.audioUrl
              timestampsUrlRu = gen.timestampsUrl
              push(`Introduction: generated RU audio`)
            }
          }

          await prisma.section.update({
            where: { id: intro.id },
            data: {
              textRu: textRu ?? intro.textRu,
              audioUrlRu: audioUrlRu ?? null,
              timestampsUrlRu: timestampsUrlRu ?? null,
            },
          })
        } else {
          push(`Introduction: no introduction section in DB — skipped`)
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e)
        errors.push(`Introduction: ${m}`)
        push(`Introduction: ERROR ${m}`)
      }
    }

    // --- Chapters (title + description) ---
    if (scope.chapterMetadata) {
      const chapters = await prisma.chapter.findMany({ orderBy: { number: 'asc' } })
      for (const ch of chapters) {
        try {
          let titleRu = ch.titleRu
          let descriptionRu = ch.descriptionRu
          if (needsTextTranslate(forceRetranslateText, ch.title, ch.titleRu)) {
            titleRu = await openaiTranslate(ch.title, 'en_to_ru', 'plain')
            await sleep(80)
          }
          if (ch.description && needsTextTranslate(forceRetranslateText, ch.description, ch.descriptionRu)) {
            descriptionRu = await openaiTranslate(ch.description, 'en_to_ru', 'plain')
            await sleep(80)
          }
          await prisma.chapter.update({
            where: { id: ch.id },
            data: {
              titleRu: titleRu ?? ch.titleRu,
              descriptionRu: descriptionRu ?? ch.descriptionRu,
            },
          })
          push(`Chapter ${ch.number}: metadata translated`)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          errors.push(`Chapter ${ch.number} metadata: ${m}`)
        }
      }
    }

    // --- Sections (non-introduction) ---
    if (scope.sections) {
      const sections = await prisma.section.findMany({
        where: { NOT: { type: 'introduction' } },
        orderBy: [{ chapterId: 'asc' }, { order: 'asc' }],
      })
      for (const sec of sections) {
        try {
          let titleRu = sec.titleRu
          let textRu = sec.textRu
          if (needsTextTranslate(forceRetranslateText, sec.title, sec.titleRu)) {
            titleRu = await openaiTranslate(sec.title, 'en_to_ru', 'plain')
            await sleep(60)
          }
          if (needsTextTranslate(forceRetranslateText, sec.text, sec.textRu)) {
            textRu = await openaiTranslate(sec.text, 'en_to_ru', 'html')
            await sleep(100)
          }

          let audioUrlRu = sec.audioUrlRu
          let timestampsUrlRu = sec.timestampsUrlRu
          if (generateAudio && textRu?.trim()) {
            const needAudio =
              forceRegenerateAudio || !sec.audioUrlRu?.trim() || !sec.timestampsUrlRu?.trim()
            if (needAudio) {
              const gen = await generateAudioFilesToPublic({
                text: textRu,
                context: 'section',
                fileKey: 'ru',
                uniqueId: `sec-${sec.id}`,
              })
              audioUrlRu = gen.audioUrl
              timestampsUrlRu = gen.timestampsUrl
            }
          }

          await prisma.section.update({
            where: { id: sec.id },
            data: {
              titleRu: titleRu ?? sec.titleRu,
              textRu: textRu ?? sec.textRu,
              audioUrlRu: audioUrlRu ?? null,
              timestampsUrlRu: timestampsUrlRu ?? null,
            },
          })
          push(`Section ${sec.id.slice(0, 8)}… (ch order): OK`)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          errors.push(`Section ${sec.id}: ${m}`)
        }
      }
    }

    async function processQuizRow(
      kind: 'QuizQuestion' | 'AdditionalQuestion',
      q: {
        id: string
        question: string
        questionRu: string | null
        options: string[]
        optionsRu: string[] | null
        explanation: unknown
        explanationRu: unknown
        questionAudioUrlRu?: string | null
        questionTimestampsUrlRu?: string | null
      }
    ) {
      let questionRu = q.questionRu
      if (needsTextTranslate(forceRetranslateText, q.question, q.questionRu)) {
        questionRu = await openaiTranslate(q.question, 'en_to_ru', 'plain')
        await sleep(80)
      }

      let optionsRu: string[]
      if (
        q.optionsRu &&
        q.optionsRu.length === q.options.length &&
        q.optionsRu.every((o) => o?.trim()) &&
        !forceRetranslateText
      ) {
        optionsRu = [...q.optionsRu]
      } else {
        optionsRu = []
        for (const opt of q.options) {
          optionsRu.push(await openaiTranslate(opt, 'en_to_ru', 'plain'))
          await sleep(50)
        }
      }

      const expl = asExpl(q.explanation)
      let explanationRu = asExpl(q.explanationRu)
      if (expl) {
        const needExpl =
          forceRetranslateText ||
          !explanationRu ||
          !explanationRu.correct?.trim() ||
          explanationRu.incorrect.length !== expl.incorrect.length
        if (needExpl) {
          const correctRu = await openaiTranslate(expl.correct, 'en_to_ru', 'plain')
          await sleep(60)
          const incorrectRu: string[] = []
          for (const line of expl.incorrect) {
            incorrectRu.push(await openaiTranslate(line, 'en_to_ru', 'plain'))
            await sleep(50)
          }
          explanationRu = { correct: correctRu, incorrect: incorrectRu }
        }
      }

      const baseData: Record<string, unknown> = {
        questionRu: questionRu ?? q.questionRu,
        optionsRu: optionsRu ?? q.optionsRu,
        explanationRu: explanationRu ?? q.explanationRu,
      }

      if (generateAudio && questionRu?.trim() && optionsRu?.length && explanationRu) {
        const hasAudio =
          !forceRegenerateAudio &&
          Boolean(q.questionAudioUrlRu?.trim()) &&
          Boolean(q.questionTimestampsUrlRu?.trim())
        if (!hasAudio) {
          const qAu = await generateAudioFilesToPublic({
            text: questionRu,
            context: 'quiz',
            fileKey: 'ru',
            uniqueId: `${kind}-${q.id}-qu`,
          })
          const optAud: string[] = []
          const optTs: string[] = []
          for (let i = 0; i < optionsRu.length; i++) {
            const g = await generateAudioFilesToPublic({
              text: optionsRu[i],
              context: 'quiz',
              fileKey: 'ru',
              uniqueId: `${kind}-${q.id}-o${i}`,
            })
            optAud.push(g.audioUrl)
            optTs.push(g.timestampsUrl)
          }
          const gCor = await generateAudioFilesToPublic({
            text: explanationRu.correct,
            context: 'quiz',
            fileKey: 'ru',
            uniqueId: `${kind}-${q.id}-ec`,
          })
          const incAud: string[] = []
          const incTs: string[] = []
          for (let i = 0; i < explanationRu.incorrect.length; i++) {
            const g = await generateAudioFilesToPublic({
              text: explanationRu.incorrect[i],
              context: 'quiz',
              fileKey: 'ru',
              uniqueId: `${kind}-${q.id}-ei${i}`,
            })
            incAud.push(g.audioUrl)
            incTs.push(g.timestampsUrl)
          }

          baseData.questionAudioUrlRu = qAu.audioUrl
          baseData.questionTimestampsUrlRu = qAu.timestampsUrl
          baseData.optionAudioUrlsRu = optAud
          baseData.optionTimestampsUrlsRu = optTs
          baseData.correctExplanationAudioUrlRu = gCor.audioUrl
          baseData.correctExplanationTimestampsUrlRu = gCor.timestampsUrl
          baseData.incorrectExplanationAudioUrlsRu = incAud
          baseData.incorrectExplanationTimestampsUrlsRu = incTs
        }
      }

      if (kind === 'QuizQuestion') {
        await prisma.quizQuestion.update({
          where: { id: q.id },
          data: baseData as any,
        })
      } else {
        await prisma.additionalQuestion.update({
          where: { id: q.id },
          data: baseData as any,
        })
      }
      push(`${kind} ${q.id.slice(0, 8)}…: OK`)
    }

    if (scope.quizQuestions) {
      const questions = await prisma.quizQuestion.findMany({ orderBy: { order: 'asc' } })
      for (const q of questions) {
        try {
          await processQuizRow('QuizQuestion', q)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          errors.push(`QuizQuestion ${q.id}: ${m}`)
        }
      }
    }

    if (scope.additionalQuestions) {
      const adds = await prisma.additionalQuestion.findMany({ orderBy: { order: 'asc' } })
      for (const q of adds) {
        try {
          await processQuizRow('AdditionalQuestion', q)
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e)
          errors.push(`AdditionalQuestion ${q.id}: ${m}`)
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      logs,
      errors,
      message:
        errors.length === 0
          ? 'Bulk EN → RU translation finished.'
          : 'Completed with some errors — see errors array.',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk translate failed'
    console.error('[bulk-translate-ru]', error)
    return NextResponse.json({ error: message, logs, errors }, { status: 500 })
  }
}
