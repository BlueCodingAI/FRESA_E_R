import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { getRequestLocale } from '@/lib/locale-server'
import { localeQuizAudioFields } from '@/lib/quiz-locale'

// GET - Get quiz questions for a chapter with proper count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const locale = getRequestLocale(request)
    const { number } = await params
    const chapterNumber = parseInt(number)

    if (isNaN(chapterNumber)) {
      return NextResponse.json({ error: 'Invalid chapter number' }, { status: 400 })
    }

    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth-token')?.value

    // Chapter 1 quiz is accessible without authentication (guest access)
    // Registration is prompted AFTER completing the first quiz
    if (chapterNumber !== 1) {
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const decoded = verifyToken(token)
      if (!decoded) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
    }

    // Get chapter first
    const chapter = await prisma.chapter.findUnique({
      where: { number: chapterNumber },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
    }

    // Get chapter quiz setting (how many questions to show)
    const quizSetting = await prisma.chapterQuizSettings.findUnique({
      where: { chapterNumber },
    })

    const questionCount = quizSetting?.questionCount || 10 // Default to 10 if not set

    // Fetch all quiz questions for this chapter
    const allQuestions = await prisma.quizQuestion.findMany({
      where: {
        chapterId: chapter.id,
        quizType: 'chapter',
      },
      orderBy: { order: 'asc' },
    })

    // Shuffle using Fisher-Yates (unbiased) and select the required number — no duplicate questions
    const shuffled = [...allQuestions]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, Math.min(questionCount, allQuestions.length))
    // Ensure no duplicate questions by id (each question appears at most once)
    const seenIds = new Set<string>()
    const selectedQuestions = selected.filter((q) => {
      const id = String(q.id)
      if (seenIds.has(id)) return false
      seenIds.add(id)
      return true
    })

    // Format questions
    const formattedQuestions = selectedQuestions.map((q: Record<string, unknown>) => {
      const useRu = locale === 'ru'
      const question = useRu ? (q.questionRu || q.question) : q.question
      const options = useRu ? (q.optionsRu && (q.optionsRu as string[]).length ? q.optionsRu : q.options) : q.options
      const explanation = useRu ? (q.explanationRu || q.explanation) : q.explanation

      return {
        id: q.id,
        question,
        options,
        correctAnswer: q.correctAnswer,
        explanation,
        ...localeQuizAudioFields(q, useRu),
      }
    })

    return NextResponse.json({ 
      questions: formattedQuestions,
      totalAvailable: allQuestions.length,
      questionCount 
    })
  } catch (error: any) {
    console.error('[Chapter Quiz GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch chapter quiz questions' }, { status: 500 })
  }
}

