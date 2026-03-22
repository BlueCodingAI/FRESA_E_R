import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { getRequestLocale } from '@/lib/locale-server'
import { localeQuizAudioFields } from '@/lib/quiz-locale'

// GET - Get all questions for Practice/End-of-Course Exam
export async function GET(request: NextRequest) {
  try {
    const locale = getRequestLocale(request)
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get exam chapter settings (how many questions from each chapter)
    const examChapterSettings = await prisma.examChapterSettings.findMany({
      orderBy: { chapterNumber: 'asc' },
    })

    // Get all chapters
    const chapters = await prisma.chapter.findMany({
      where: { number: { gt: 0 } }, // Exclude chapter 0 (introduction)
      orderBy: { number: 'asc' },
    })

    // Build questions array based on per-chapter settings
    const selectedQuestions: any[] = []

    // For each chapter, get the specified number of random questions
    for (const chapter of chapters) {
      const setting = examChapterSettings.find(s => s.chapterNumber === chapter.number)
      const questionCount = setting?.questionCount || 0

      if (questionCount > 0) {
        // Fetch all questions for this chapter
        const chapterQuestions = await prisma.quizQuestion.findMany({
          where: {
            chapterId: chapter.id,
            quizType: 'chapter',
          },
          orderBy: { order: 'asc' },
        })

        // Shuffle and select the required number using Fisher-Yates algorithm
        const shuffled = [...chapterQuestions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const selected = shuffled.slice(0, Math.min(questionCount, chapterQuestions.length))

        selectedQuestions.push(
          ...selected.map((q) => {
            const useRu = locale === 'ru'
            const row = q as unknown as Record<string, unknown>
            return {
              id: q.id,
              question: useRu ? (q.questionRu || q.question) : q.question,
              options: useRu ? (q.optionsRu && q.optionsRu.length ? q.optionsRu : q.options) : q.options,
              correctAnswer: q.correctAnswer,
              explanation: useRu ? (q.explanationRu || q.explanation) : q.explanation,
              ...localeQuizAudioFields(row, useRu),
              source: 'chapter',
              chapterNumber: chapter.number,
            }
          })
        )
      }
    }

    // Fetch additional questions
    const additionalQuestions = await prisma.additionalQuestion.findMany({
      orderBy: { order: 'asc' },
    })

    // Add all additional questions
    selectedQuestions.push(
      ...additionalQuestions.map((q) => {
        const useRu = locale === 'ru'
        const row = q as unknown as Record<string, unknown>
        return {
          id: q.id,
          question: useRu ? (q.questionRu || q.question) : q.question,
          options: useRu ? (q.optionsRu && q.optionsRu.length ? q.optionsRu : q.options) : q.options,
          correctAnswer: q.correctAnswer,
          explanation: useRu ? (q.explanationRu || q.explanation) : q.explanation,
          ...localeQuizAudioFields(row, useRu),
          source: 'additional',
        }
      })
    )

    // Shuffle all questions together using Fisher-Yates algorithm
    const shuffledAll = [...selectedQuestions];
    for (let i = shuffledAll.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledAll[i], shuffledAll[j]] = [shuffledAll[j], shuffledAll[i]];
    }

    // Ensure no duplicate questions by id (each question appears at most once)
    const seenIds = new Set<string>();
    const uniqueQuestions = shuffledAll.filter((q) => {
      const id = String(q.id);
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    return NextResponse.json({ 
      questions: uniqueQuestions,
      examQuestionCount: uniqueQuestions.length
    })
  } catch (error: any) {
    console.error('[Exam Questions GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch exam questions' }, { status: 500 })
  }
}

