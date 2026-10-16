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
    // Cron
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

    const languageName = language === 'hungarian' ? 'Hungarian' : 
                         language === 'german' ? 'German' : 
                         language === 'spanish' ? 'Spanish' : 'English'

    const newsPrompt = `Give me 3 short, interesting news summaries about: ${topics}. 
    Write the titles and summaries in ${languageName}.
    Format as JSON: {"items": [{"title": "...", "summary": "...", "why": "..."}]}`

    const lessonPrompt = `Teach one useful thing in ${languageName} language. 
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

      if (profile.email_notifications) {
        const titles = news.items?.map((item: any) => `<li>${item.title}</li>`).join('') || '<li>Nincs hír</li>'

        await resend.emails.send({
          from: 'Daily Digest <onboarding@resend.dev>',
          to: 'nw940417@gmail.com',
          subject: 'A mai Daily AI Digest kész',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a73e8;">Daily AI Digest</h2>
              <p>A mai digeszted elkészült a következő témákban: <strong>${topics}</strong></p>
              
              <h3>Hírek címei</h3>
              <ul>
                ${titles}
              </ul>

              <h3>Napi nyelvlecke</h3>
              <p><strong>${lesson.word}</strong></p>

              <p style="margin-top: 24px;">
                <a href="https://daily-ai-digest-indol.vercel.app" 
                   style="background: #1a73e8; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
                  Megnézem a teljes digesztet
                </a>
              </p>
            </div>
          `,
        })
      }

      results.push({ userId: profile.id, status: 'ok' })
    } catch (err: any) {
      results.push({ userId: profile.id, status: 'error', message: err.message })
    }
  }

  return NextResponse.json({ results })
}