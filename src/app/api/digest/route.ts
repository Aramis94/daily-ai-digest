import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const supabase = await createClient()

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // Cron hívás
  }

  const specificUserId = body.userId

  let query = supabase
    .from('profiles')
    .select('id, language, topics, email_notifications')

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

      // Email küldés, ha be van kapcsolva
      if (profile.email_notifications) {
        const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
        const email = userData?.user?.email

        if (email) {
          const newsHtml = news.items?.map((item: any) => 
            `<h3>${item.title}</h3><p>${item.summary}</p><p><em>${item.why}</em></p>`
          ).join('') || ''

          await resend.emails.send({
            from: 'Daily Digest <onboarding@resend.dev>',
            to: nw940417@gmail.com,
            subject: 'A mai Daily AI Digest',
            html: `
              <h2>Hírek</h2>
              ${newsHtml}
              <h2>Nyelvlecke</h2>
              <p><strong>${lesson.word}</strong></p>
              <p><em>${lesson.example}</em></p>
              <p>${lesson.explanation}</p>
            `,
          })
        }
      }

      results.push({ userId: profile.id, status: 'ok' })
    } catch (err) {
      results.push({ userId: profile.id, status: 'error' })
    }
  }

  return NextResponse.json({ results })
}