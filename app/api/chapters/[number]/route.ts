import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { existsSync } from 'fs'
import { join } from 'path'
import { getRequestLocale } from '@/lib/locale-server'
import { localeQuizAudioFields } from '@/lib/quiz-locale'

// Helper function to validate file exists
function validateFileUrl(url: string | null): string | null {
  if (!url) return null
  
  // Remove leading slash and check if file exists
  const filePath = url.startsWith('/') ? url.slice(1) : url
  const fullPath = join(process.cwd(), 'public', filePath)
  
  if (!existsSync(fullPath)) {
    console.warn(`⚠️ File not found: ${fullPath}. Returning null for URL.`)
    return null
  }
  
  return url
}

// Public API to fetch chapter content for frontend pages
// This route is public and doesn't require authentication
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params
    const chapterNumber = parseInt(number)

    if (isNaN(chapterNumber)) {
      return NextResponse.json({ error: 'Invalid chapter number' }, { status: 400 })
    }

    // Fetch chapter from database (should be seeded with original data)
    const chapter = await prisma.chapter.findUnique({
      where: { number: chapterNumber },
      include: {
        sections: {
          // Get ALL sections for the chapter (introduction sections are in chapter 0, not regular chapters)
          orderBy: { order: 'asc' },
        },
        quizQuestions: {
          where: {
            quizType: 'chapter',
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found. Please run the seed script to initialize data.' }, { status: 404 })
    }

    const locale = getRequestLocale(request)

    // Return sections with their audio URLs (don't validate strictly - let browser handle 404s)
    // This allows audio to work even if files are generated dynamically or paths differ slightly
    const validatedChapter = {
      ...chapter,
      sections: chapter.sections.map((section: any) => {
        const useRu = locale === 'ru'
        return {
          ...section,
          title: useRu ? (section.titleRu || section.title) : section.title,
          text: useRu ? (section.textRu || section.text) : section.text,
          audioUrl: useRu
            ? (section.audioUrlRu || section.audioUrl || null)
            : (section.audioUrl || null),
          timestampsUrl: useRu
            ? (section.timestampsUrlRu || section.timestampsUrl || null)
            : (section.timestampsUrl || null),
          imageUrl: section.imageUrl || null,
        }
      }),
      quizQuestions: chapter.quizQuestions.map((question: Record<string, unknown>) => {
        const useRu = locale === 'ru'
        return {
          ...question,
          question: useRu
            ? ((question.questionRu as string) || (question.question as string))
            : (question.question as string),
          options: useRu
            ? ((question.optionsRu as string[])?.length ? question.optionsRu : question.options)
            : question.options,
          explanation: useRu
            ? (question.explanationRu || question.explanation)
            : question.explanation,
          ...localeQuizAudioFields(question, useRu),
        }
      }),
    }

    return NextResponse.json(
      { chapter: validatedChapter },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error('Error fetching chapter:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapter' },
      { status: 500 }
    )
  }
}

