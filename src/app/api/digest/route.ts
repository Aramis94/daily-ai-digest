import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function POST(request: Request) {
  const supabase = await createClient()

  // Ha a kliens küld userId-t (gombnyomás), csak arra generálunk
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // Cron hívásnál nincs body
  }

  const specificUserId = body.userId

  // Lekérjük a profilokat
  let query = supabase.from('profiles').select('id, language, topics')
  if (specificUserId) {
    query = query.eq('id', specificUserId)
  }

  const { data: profiles, error } = await query

  if (error || !profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No profiles found' }, { status: 400 })
  }

  const results = []

  for (const profile of profiles) {
    const topics = profile.topics?.join(', ') || 'tech, AI'
    const language = profile.language || 'hungarian'

    const newsPrompt = `Give me 3 short, interesting news summaries about: ${topics}. 
    Format as JSON: {"items": [{"title": "...", "summary": "...", "why": "..."}]}`

    const lessonPrompt = `Teach one useful thing in ${language} language. 
    Include: a word/phrase, example sentence, and short explanation. 
    Format as JSON: {"word": "...", "example": "...", "explanation": "..."}`

    try {
      const [newsRes, lessonRes] = await Promise.all([
        groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: newsPrompt }],
          response_format: { type: 'json_object' },
        }),
        groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: lessonPrompt }],
          response_format: { type: 'json_object' },
        }),
      ])

      const news = JSON.parse(newsRes.choices[0].message.content || '{}')
      const lesson = JSON.parse(lessonRes.choices[0].message.content || '{}')

      await supabase.from('daily_digests').insert({
        user_id: profile.id,
        news,
        language_lesson: lesson,
      })

      results.push({ userId: profile.id, status: 'ok' })
    } catch (err) {
      results.push({ userId: profile.id, status: 'error' })
    }
  }

  return NextResponse.json({ results })
}