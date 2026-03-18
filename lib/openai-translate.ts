/**
 * Translate text EN↔RU via OpenAI Chat Completions.
 * For HTML, instructs the model to preserve tags and only translate visible text.
 */

export type TranslateDirection = 'en_to_ru' | 'ru_to_en'
export type TranslateFormat = 'html' | 'plain'

export async function openaiTranslate(
  text: string,
  direction: TranslateDirection,
  format: TranslateFormat
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is not set in environment')
  }

  const model = process.env.OPENAI_TRANSLATE_MODEL?.trim() || 'gpt-4o-mini'
  const [from, to] =
    direction === 'en_to_ru' ? (['English', 'Russian'] as const) : (['Russian', 'English'] as const)

  const system =
    format === 'html'
      ? `You translate ${from} HTML to ${to}. Rules:
- Preserve ALL HTML tags, attributes, class names, and structure exactly. Do not add or remove tags.
- Only translate human-readable text that appears between tags (and in text nodes). Do not translate URLs, code, or attribute values unless they are clearly user-facing alt/title text.
- Output ONLY the translated HTML document fragment. No markdown code fences, no explanation.`
      : `Translate the following from ${from} to ${to}. Output only the translation, no quotes or preamble.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text.slice(0, 120_000) },
      ],
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Empty translation from OpenAI')
  }

  // Strip accidental markdown fences
  let out = content
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '')
  }
  return out.trim()
}
