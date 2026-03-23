/**
 * Shared EN→RU bulk translation + optional RU/EN audio (used by batched API routes).
 */

import { prisma } from '@/lib/prisma'
import { openaiTranslate } from '@/lib/openai-translate'
import { generateAudioFilesToPublic } from '@/lib/generate-audio-file'

export type Expl = { correct: string; incorrect: string[] }

export function asExpl(v: unknown): Expl | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.correct !== 'string') return null
  if (!Array.isArray(o.incorrect)) return null
  return { correct: o.correct, incorrect: o.incorrect.map((x) => String(x)) }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function needsTextTranslate(
  force: boolean,
  source: string,
  existing: string | null | undefined
) {
  const s = source?.trim()
  if (!s) return false
  if (force) return true
  return !existing?.trim()
}

export interface BulkOptions {
  forceRetranslateText: boolean
  /** Generate Russian (RU) audio for RU text */
  generateAudio: boolean
  /** Regenerate RU audio even when URLs exist */
  forceRegenerateAudio: boolean
  /** Generate English audio from English question/section text */
  generateEnglishAudio: boolean
  /** Regenerate EN audio even when URLs exist */
  forceRegenerateEnglishAudio: boolean
}

export interface BulkBatchResult {
  logs: string[]
  errors: string[]
}

export async function getBulkPlan(): Promise<{
  hasIntroduction: boolean
  chapterCount: number
  sectionCount: number
  quizQuestionCount: number
  additionalQuestionCount: number
}> {
  const [intro, chapterCount, sectionCount, quizQuestionCount, additionalQuestionCount] =
    await Promise.all([
      prisma.section.findFirst({ where: { type: 'introduction' }, select: { id: true } }),
      prisma.chapter.count(),
      prisma.section.count({ where: { NOT: { type: 'introduction' } } }),
      prisma.quizQuestion.count(),
      prisma.additionalQuestion.count(),
    ])
  return {
    hasIntroduction: !!intro,
    chapterCount,
    sectionCount,
    quizQuestionCount,
    additionalQuestionCount,
  }
}

export async function runIntroductionBatch(opts: BulkOptions): Promise<BulkBatchResult> {
  const logs: string[] = []
  const errors: string[] = []
  const push = (msg: string) => logs.push(msg)

  try {
    const intro = await prisma.section.findFirst({ where: { type: 'introduction' } })
    if (!intro) {
      push('Introduction: no introduction section in DB — skipped')
      return { logs, errors }
    }

    const skipRuTranslation = !opts.forceRetranslateText && !opts.generateAudio

    let textRu = intro.textRu
    if (!skipRuTranslation) {
      if (needsTextTranslate(opts.forceRetranslateText, intro.text, intro.textRu)) {
        textRu = await openaiTranslate(intro.text, 'en_to_ru', 'html')
        await sleep(120)
        push('Introduction: translated text to Russian')
      } else {
        push('Introduction: skipped text (already has Russian or no English)')
      }
    } else {
      push('Introduction: skipped RU translation (EN-audio-only mode)')
    }

    let audioUrlRu = intro.audioUrlRu
    let timestampsUrlRu = intro.timestampsUrlRu
    if (opts.generateAudio && (textRu ?? intro.textRu)?.trim()) {
      const ruBody = (textRu ?? intro.textRu) as string
      const needAudio =
        opts.forceRegenerateAudio ||
        !intro.audioUrlRu?.trim() ||
        !intro.timestampsUrlRu?.trim()
      if (needAudio) {
        const gen = await generateAudioFilesToPublic({
          text: ruBody,
          context: 'section',
          fileKey: 'ru',
          uniqueId: `intro-${intro.id}`,
        })
        audioUrlRu = gen.audioUrl
        timestampsUrlRu = gen.timestampsUrl
        push('Introduction: generated RU audio')
      }
    }

    let audioUrl = intro.audioUrl
    let timestampsUrl = intro.timestampsUrl
    if (opts.generateEnglishAudio && intro.text?.trim()) {
      const needEn =
        opts.forceRegenerateEnglishAudio ||
        !intro.audioUrl?.trim() ||
        !intro.timestampsUrl?.trim()
      if (needEn) {
        const gen = await generateAudioFilesToPublic({
          text: intro.text,
          context: 'section',
          fileKey: 'en',
          uniqueId: `intro-${intro.id}-en`,
        })
        audioUrl = gen.audioUrl
        timestampsUrl = gen.timestampsUrl
        push('Introduction: generated EN audio (saved under public/audio + public/timestamps on the server)')
      } else {
        push(
          'Introduction: skipped EN audio — English audioUrl/timestampsUrl already set (enable “Regenerate EN audio” to rewrite files)'
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (!skipRuTranslation) {
      data.textRu = textRu ?? intro.textRu
    }
    if (opts.generateAudio) {
      data.audioUrlRu = audioUrlRu ?? null
      data.timestampsUrlRu = timestampsUrlRu ?? null
    }
    if (opts.generateEnglishAudio) {
      data.audioUrl = audioUrl ?? null
      data.timestampsUrl = timestampsUrl ?? null
    }
    if (Object.keys(data).length > 0) {
      await prisma.section.update({
        where: { id: intro.id },
        data: data as any,
      })
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    errors.push(`Introduction: ${m}`)
    push(`Introduction: ERROR ${m}`)
  }

  return { logs, errors }
}

export async function runChapterMetadataBatch(
  opts: BulkOptions,
  offset: number,
  limit: number
): Promise<BulkBatchResult & { nextOffset: number; hasMore: boolean }> {
  const logs: string[] = []
  const errors: string[] = []
  const push = (msg: string) => logs.push(msg)

  const chapters = await prisma.chapter.findMany({
    orderBy: { number: 'asc' },
    skip: offset,
    take: limit,
  })

  for (const ch of chapters) {
    try {
      let titleRu = ch.titleRu
      let descriptionRu = ch.descriptionRu
      if (needsTextTranslate(opts.forceRetranslateText, ch.title, ch.titleRu)) {
        titleRu = await openaiTranslate(ch.title, 'en_to_ru', 'plain')
        await sleep(80)
      }
      if (
        ch.description &&
        needsTextTranslate(opts.forceRetranslateText, ch.description, ch.descriptionRu)
      ) {
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

  const nextOffset = offset + chapters.length
  const total = await prisma.chapter.count()
  const hasMore = nextOffset < total

  return { logs, errors, nextOffset, hasMore }
}

export async function runSectionsBatch(
  opts: BulkOptions,
  offset: number,
  limit: number
): Promise<BulkBatchResult & { nextOffset: number; hasMore: boolean }> {
  const logs: string[] = []
  const errors: string[] = []
  const push = (msg: string) => logs.push(msg)

  const sections = await prisma.section.findMany({
    where: { NOT: { type: 'introduction' } },
    orderBy: [{ chapterId: 'asc' }, { order: 'asc' }],
    skip: offset,
    take: limit,
  })

  for (const sec of sections) {
    try {
      const skipRuTranslation = !opts.forceRetranslateText && !opts.generateAudio

      let titleRu = sec.titleRu
      let textRu = sec.textRu
      if (!skipRuTranslation) {
        if (needsTextTranslate(opts.forceRetranslateText, sec.title, sec.titleRu)) {
          titleRu = await openaiTranslate(sec.title, 'en_to_ru', 'plain')
          await sleep(60)
        }
        if (needsTextTranslate(opts.forceRetranslateText, sec.text, sec.textRu)) {
          textRu = await openaiTranslate(sec.text, 'en_to_ru', 'html')
          await sleep(100)
        }
      }

      let audioUrlRu = sec.audioUrlRu
      let timestampsUrlRu = sec.timestampsUrlRu
      if (opts.generateAudio && (textRu ?? sec.textRu)?.trim()) {
        const ruBody = (textRu ?? sec.textRu) as string
        const needAudio =
          opts.forceRegenerateAudio ||
          !sec.audioUrlRu?.trim() ||
          !sec.timestampsUrlRu?.trim()
        if (needAudio) {
          const gen = await generateAudioFilesToPublic({
            text: ruBody,
            context: 'section',
            fileKey: 'ru',
            uniqueId: `sec-${sec.id}`,
          })
          audioUrlRu = gen.audioUrl
          timestampsUrlRu = gen.timestampsUrl
        }
      }

      let audioUrl = sec.audioUrl
      let timestampsUrl = sec.timestampsUrl
      if (opts.generateEnglishAudio && sec.text?.trim()) {
        const needEn =
          opts.forceRegenerateEnglishAudio ||
          !sec.audioUrl?.trim() ||
          !sec.timestampsUrl?.trim()
        if (needEn) {
          const gen = await generateAudioFilesToPublic({
            text: sec.text,
            context: 'section',
            fileKey: 'en',
            uniqueId: `sec-${sec.id}-en`,
          })
          audioUrl = gen.audioUrl
          timestampsUrl = gen.timestampsUrl
        } else {
          push(
            `Section ${sec.id.slice(0, 8)}…: skipped EN audio (URLs already set — use force EN regenerate)`
          )
        }
      }

      const data: Record<string, unknown> = {}
      if (!skipRuTranslation) {
        data.titleRu = titleRu ?? sec.titleRu
        data.textRu = textRu ?? sec.textRu
      }
      if (opts.generateAudio) {
        data.audioUrlRu = audioUrlRu ?? null
        data.timestampsUrlRu = timestampsUrlRu ?? null
      }
      if (opts.generateEnglishAudio) {
        data.audioUrl = audioUrl ?? null
        data.timestampsUrl = timestampsUrl ?? null
      }
      if (Object.keys(data).length > 0) {
        await prisma.section.update({
          where: { id: sec.id },
          data: data as any,
        })
      }
      push(`Section ${sec.id.slice(0, 8)}…: OK`)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      errors.push(`Section ${sec.id}: ${m}`)
    }
  }

  const total = await prisma.section.count({ where: { NOT: { type: 'introduction' } } })
  const nextOffset = offset + sections.length
  const hasMore = nextOffset < total

  return { logs, errors, nextOffset, hasMore }
}

type QuizRow = {
  id: string
  question: string
  questionRu: string | null
  options: string[]
  optionsRu: string[] | null
  explanation: unknown
  explanationRu: unknown
  questionAudioUrlRu?: string | null
  questionTimestampsUrlRu?: string | null
  questionAudioUrl?: string | null
  questionTimestampsUrl?: string | null
  optionAudioUrls?: unknown
  optionTimestampsUrls?: unknown
  correctExplanationAudioUrl?: string | null
  correctExplanationTimestampsUrl?: string | null
  incorrectExplanationAudioUrls?: unknown
  incorrectExplanationTimestampsUrls?: unknown
}

export async function processQuizRow(
  opts: BulkOptions,
  kind: 'QuizQuestion' | 'AdditionalQuestion',
  q: QuizRow,
  push: (msg: string) => void
) {
  const skipRuTranslation = !opts.forceRetranslateText && !opts.generateAudio

  let questionRu = q.questionRu
  let optionsRu: string[] | null = q.optionsRu
  let explanationRu = asExpl(q.explanationRu)

  if (!skipRuTranslation) {
    if (needsTextTranslate(opts.forceRetranslateText, q.question, q.questionRu)) {
      questionRu = await openaiTranslate(q.question, 'en_to_ru', 'plain')
      await sleep(80)
    }

    if (
      q.optionsRu &&
      q.optionsRu.length === q.options.length &&
      q.optionsRu.every((o) => o?.trim()) &&
      !opts.forceRetranslateText
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
    if (expl) {
      const needExpl =
        opts.forceRetranslateText ||
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
  }

  const baseData: Record<string, unknown> = {}
  if (!skipRuTranslation) {
    baseData.questionRu = questionRu ?? q.questionRu
    baseData.optionsRu = optionsRu ?? q.optionsRu
    baseData.explanationRu = explanationRu ?? q.explanationRu
  }

  const ruQ = (questionRu ?? q.questionRu)?.trim()
  const ruOpts =
    optionsRu && optionsRu.length === q.options.length ? optionsRu : null
  const ruExpl = explanationRu

  if (opts.generateAudio && ruQ && ruOpts && ruExpl) {
    const hasAudio =
      !opts.forceRegenerateAudio &&
      Boolean(q.questionAudioUrlRu?.trim()) &&
      Boolean(q.questionTimestampsUrlRu?.trim())
    if (!hasAudio) {
      const qAu = await generateAudioFilesToPublic({
        text: ruQ,
        context: 'quiz',
        fileKey: 'ru',
        uniqueId: `${kind}-${q.id}-qu`,
      })
      const optAud: string[] = []
      const optTs: string[] = []
      for (let i = 0; i < ruOpts.length; i++) {
        const g = await generateAudioFilesToPublic({
          text: ruOpts[i],
          context: 'quiz',
          fileKey: 'ru',
          uniqueId: `${kind}-${q.id}-o${i}`,
        })
        optAud.push(g.audioUrl)
        optTs.push(g.timestampsUrl)
      }
      const gCor = await generateAudioFilesToPublic({
        text: ruExpl.correct,
        context: 'quiz',
        fileKey: 'ru',
        uniqueId: `${kind}-${q.id}-ec`,
      })
      const incAud: string[] = []
      const incTs: string[] = []
      for (let i = 0; i < ruExpl.incorrect.length; i++) {
        const g = await generateAudioFilesToPublic({
          text: ruExpl.incorrect[i],
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

  const explEn = asExpl(q.explanation)
  if (
    opts.generateEnglishAudio &&
    q.question?.trim() &&
    q.options?.length &&
    explEn
  ) {
    const hasEnAudio =
      !opts.forceRegenerateEnglishAudio &&
      Boolean(q.questionAudioUrl?.trim()) &&
      Boolean(q.questionTimestampsUrl?.trim())
    if (hasEnAudio) {
      push(
        `${kind} ${q.id.slice(0, 8)}…: skipped EN quiz audio (question EN URLs already set — use force EN regenerate)`
      )
    }
    if (!hasEnAudio) {
      const qAu = await generateAudioFilesToPublic({
        text: q.question,
        context: 'quiz',
        fileKey: 'en',
        uniqueId: `${kind}-${q.id}-en-qu`,
      })
      const optAud: string[] = []
      const optTs: string[] = []
      for (let i = 0; i < q.options.length; i++) {
        const g = await generateAudioFilesToPublic({
          text: q.options[i],
          context: 'quiz',
          fileKey: 'en',
          uniqueId: `${kind}-${q.id}-en-o${i}`,
        })
        optAud.push(g.audioUrl)
        optTs.push(g.timestampsUrl)
      }
      const gCor = await generateAudioFilesToPublic({
        text: explEn.correct,
        context: 'quiz',
        fileKey: 'en',
        uniqueId: `${kind}-${q.id}-en-ec`,
      })
      const incAud: string[] = []
      const incTs: string[] = []
      for (let i = 0; i < explEn.incorrect.length; i++) {
        const g = await generateAudioFilesToPublic({
          text: explEn.incorrect[i],
          context: 'quiz',
          fileKey: 'en',
          uniqueId: `${kind}-${q.id}-en-ei${i}`,
        })
        incAud.push(g.audioUrl)
        incTs.push(g.timestampsUrl)
      }

      baseData.questionAudioUrl = qAu.audioUrl
      baseData.questionTimestampsUrl = qAu.timestampsUrl
      baseData.optionAudioUrls = optAud
      baseData.optionTimestampsUrls = optTs
      baseData.correctExplanationAudioUrl = gCor.audioUrl
      baseData.correctExplanationTimestampsUrl = gCor.timestampsUrl
      baseData.incorrectExplanationAudioUrls = incAud
      baseData.incorrectExplanationTimestampsUrls = incTs
    }
  }

  if (Object.keys(baseData).length === 0) {
    push(`${kind} ${q.id.slice(0, 8)}…: skipped (nothing to update)`)
    return
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

export async function runQuizQuestionsBatch(
  opts: BulkOptions,
  offset: number,
  limit: number
): Promise<BulkBatchResult & { nextOffset: number; hasMore: boolean }> {
  const logs: string[] = []
  const errors: string[] = []
  const push = (msg: string) => logs.push(msg)

  const questions = await prisma.quizQuestion.findMany({
    orderBy: { order: 'asc' },
    skip: offset,
    take: limit,
  })

  for (const q of questions) {
    try {
      await processQuizRow(opts, 'QuizQuestion', q, push)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      errors.push(`QuizQuestion ${q.id}: ${m}`)
    }
  }

  const total = await prisma.quizQuestion.count()
  const nextOffset = offset + questions.length
  const hasMore = nextOffset < total

  return { logs, errors, nextOffset, hasMore }
}

export async function runAdditionalQuestionsBatch(
  opts: BulkOptions,
  offset: number,
  limit: number
): Promise<BulkBatchResult & { nextOffset: number; hasMore: boolean }> {
  const logs: string[] = []
  const errors: string[] = []
  const push = (msg: string) => logs.push(msg)

  const questions = await prisma.additionalQuestion.findMany({
    orderBy: { order: 'asc' },
    skip: offset,
    take: limit,
  })

  for (const q of questions) {
    try {
      await processQuizRow(opts, 'AdditionalQuestion', q, push)
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      errors.push(`AdditionalQuestion ${q.id}: ${m}`)
    }
  }

  const total = await prisma.additionalQuestion.count()
  const nextOffset = offset + questions.length
  const hasMore = nextOffset < total

  return { logs, errors, nextOffset, hasMore }
}
