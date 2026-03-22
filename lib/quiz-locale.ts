/**
 * Pick EN vs RU quiz audio URLs for API responses (parallel *Ru fields on QuizQuestion / AdditionalQuestion).
 */

export function parseJsonField<T>(v: unknown): T | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as T
  if (typeof v === 'object') return v as T
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T
    } catch {
      return null
    }
  }
  return null
}

function pickStrOrNull(en: string | null | undefined, ru: string | null | undefined, useRu: boolean) {
  if (useRu && ru != null && String(ru).trim()) return ru
  return en ?? null
}

function pickArrOrNull(
  en: unknown,
  ru: unknown,
  useRu: boolean
): string[] | null {
  const enArr = parseJsonField<string[]>(en)
  const ruArr = parseJsonField<string[]>(ru)
  if (useRu && ruArr && Array.isArray(ruArr) && ruArr.length > 0) {
    return ruArr
  }
  return enArr && Array.isArray(enArr) ? enArr : null
}

/** Map a Prisma quiz row to locale-specific audio fields (question text/options handled elsewhere). */
export function localeQuizAudioFields(q: Record<string, unknown>, useRu: boolean) {
  return {
    questionAudioUrl: pickStrOrNull(
      q.questionAudioUrl as string | null | undefined,
      q.questionAudioUrlRu as string | null | undefined,
      useRu
    ),
    questionTimestampsUrl: pickStrOrNull(
      q.questionTimestampsUrl as string | null | undefined,
      q.questionTimestampsUrlRu as string | null | undefined,
      useRu
    ),
    optionAudioUrls: pickArrOrNull(q.optionAudioUrls, q.optionAudioUrlsRu, useRu),
    optionTimestampsUrls: pickArrOrNull(q.optionTimestampsUrls, q.optionTimestampsUrlsRu, useRu),
    correctExplanationAudioUrl: pickStrOrNull(
      q.correctExplanationAudioUrl as string | null | undefined,
      q.correctExplanationAudioUrlRu as string | null | undefined,
      useRu
    ),
    correctExplanationTimestampsUrl: pickStrOrNull(
      q.correctExplanationTimestampsUrl as string | null | undefined,
      q.correctExplanationTimestampsUrlRu as string | null | undefined,
      useRu
    ),
    incorrectExplanationAudioUrls: pickArrOrNull(
      q.incorrectExplanationAudioUrls,
      q.incorrectExplanationAudioUrlsRu,
      useRu
    ),
    incorrectExplanationTimestampsUrls: pickArrOrNull(
      q.incorrectExplanationTimestampsUrls,
      q.incorrectExplanationTimestampsUrlsRu,
      useRu
    ),
  }
}
