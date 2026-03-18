import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getRequestLocale } from '@/lib/locale-server'

// Public API to fetch all chapters for frontend navigation
// This route is public and doesn't require authentication
export async function GET(request: NextRequest) {
  try {
    const locale = getRequestLocale(request)
    // Get all chapters except chapter 0 (introduction chapter)
    const chapters = await prisma.chapter.findMany({
      where: {
        number: { not: 0 }, // Exclude chapter 0 (introduction)
      },
      include: {
        sections: {
          where: {
            type: { not: 'introduction' }, // Only content sections
          },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            titleRu: true,
            sectionNumber: true,
            order: true,
          },
        },
        _count: {
          select: { 
            sections: true,
            quizQuestions: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    })

    const localized = chapters.map((ch: any) => {
      const useRu = locale === 'ru'
      return {
        ...ch,
        title: useRu ? (ch.titleRu || ch.title) : ch.title,
        sections: (ch.sections || []).map((s: any) => ({
          ...s,
          title: useRu ? (s.titleRu || s.title) : s.title,
        })),
      }
    })

    return NextResponse.json(
      { chapters: localized },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error('Error fetching chapters:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chapters' },
      { status: 500 }
    )
  }
}

