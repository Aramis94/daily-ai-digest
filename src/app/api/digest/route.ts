import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { Resend } from 'resend'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rateLimit'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

const resend = new Resend(process.env.RESEND_API_KEY)

function isCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (!secret || !header.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length)
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function handle(request: Request) {
  const cron = isCron(request)

  if (!cron) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(ip, 5, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  const cookieClient = await createClient()

  let targetUserId: string | null = null
  let sessionEmail: string | null = null
  let supabase: any

  if (cron) {
    const admin = adminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }
    supabase = admin
  } else {
    const { data: { user } } = await cookieClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    targetUserId = user.id
    sessionEmail = user.email ?? null
    supabase = cookieClient
  }

  let query = supabase
    .from('profiles')
    .select('id, language, topics, email_notifications')

  if (targetUserId) {
    query = query.eq('id', targetUserId)
  }

  const { data: profiles, error } = await query

  if (error || !profiles || profiles.length === 0) {
    return NextResponse.json({ error: 'No profiles found' }, { status: 400 })
  }

  const list = Array.isArray(profiles) ? profiles : [profiles]
  const results = []

  for (const profile of list) {
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
        let email = sessionEmail
        if (cron) {
          const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
          email = userData?.user?.email ?? null
        }

        if (email) {
          const titles = news.items?.map((item: { title: string }) => `<li>${item.title}</li>`).join('') || '<li>Nincs hír</li>'
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      results.push({ userId: profile.id, status: 'error', message })
    }
  }

  return NextResponse.json({ results })
}

export async function POST(request: Request) {
  return handle(request)
}

export async function GET(request: Request) {
  return handle(request)
}