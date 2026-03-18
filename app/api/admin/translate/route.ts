import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, canEdit } from '@/lib/auth'
import { openaiTranslate, type TranslateDirection, type TranslateFormat } from '@/lib/openai-translate'

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

    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text : ''
    const direction = body.direction as TranslateDirection
    const format = (body.format as TranslateFormat) || 'plain'

    if (!text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    if (direction !== 'en_to_ru' && direction !== 'ru_to_en') {
      return NextResponse.json({ error: 'direction must be en_to_ru or ru_to_en' }, { status: 400 })
    }
    if (format !== 'html' && format !== 'plain') {
      return NextResponse.json({ error: 'format must be html or plain' }, { status: 400 })
    }

    const translated = await openaiTranslate(text, direction, format)
    return NextResponse.json({ translated })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Translation failed'
    console.error('translate:', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
