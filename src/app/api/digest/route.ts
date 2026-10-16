import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rateLimit'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  const isCron = secret === process.env.CRON_SECRET

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!isCron && !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let profiles
  if (isCron) {
    const { data } = await supabase.from('profiles').select('id, language, topics, email_notifications')
    profiles = data
  } else {
    const { data } = await supabase
      .from('profiles')
      .select('id, language, topics, email_notifications')
      .eq('id', user!.id)
      .single()
    profiles = data ? [data] : []
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No profiles found' }, { status: 400 })
  }

  const results = []

  for (const profile of profiles) {
    const topics = (profile.topics?.join(', ') || 'tech, AI').slice(0, 200)
    const languageName = profile.language === 'hungarian' ? 'Hungarian' : 
                         profile.language === 'german' ? 'German' : 
                         profile.language === 'spanish' ? 'Spanish' : 'English'

    const newsPrompt = `Give me 3 short, interesting news summaries about: ${topics}. 
    Write the titles and summaries in ${languageName}.
    Format as JSON: {"items": [{"title": "...", "summary": "...", "why": "..."}]}`

    try {
      const newsRes = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: newsPrompt }],
        response_format: { type: 'json_object' },
      })

      const news = JSON.parse(newsRes.choices[0].message.content || '{}')

      await supabase.from('daily_digests').insert({
        user_id: profile.id,
        news,
        language_lesson: null,
      })

      if (profile.email_notifications) {
        const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
        const email = userData?.user?.email
        if (email) {
          const titles = news.items?.map((item: any) => `<li>${item.title}</li>`).join('') || '<li>Nincs hír</li>'
          await resend.emails.send({
            from: 'Daily Digest <onboarding@resend.dev>',
            to: email,
            subject: 'A mai Daily AI Digest kész',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">Daily AI Digest</h2>
                <p>A mai digeszted elkészült a következő témákban: <strong>${topics}</strong></p>
                <h3>Hírek címei</h3>
                <ul>${titles}</ul>
                <p style="margin-top: 24px;">
                  <a href="https://daily-ai-digest-indol.vercel.app" style="background: #1a73e8; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
                    Megnézem a teljes digesztet
                  </a>
                </p>
              </div>
            `,
          })
        }
      }

      results.push({ userId: profile.id, status: 'ok' })
    } catch (err: any) {
      results.push({ userId: profile.id, status: 'error', message: err.message })
    }
  }

  return NextResponse.json({ results })
}