import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

    let profile
  if (user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, language, topics')
      .eq('id', user.id)
      .single()
    console.log('Logged-in user query:', { data, error, userId: user.id })
    profile = data
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, language, topics')
      .limit(1)
    console.log('Cron query:', { data, error })
    profile = data?.[0]
  }

   if (!profile) {
    return NextResponse.json({ 
      error: 'No profile found',
      user: user ? user.id : null,
      debug: 'Check if you are logged in and have a profile'
    }, { status: 400 })
  }

  const topics = profile.topics?.join(', ') || 'tech, AI'
  const language = profile.language || 'hungarian'

  const newsPrompt = `Give me 3 short, interesting news summaries about: ${topics}. 
  Format as JSON: {"items": [{"title": "...", "summary": "...", "why": "..."}]}`

  const lessonPrompt = `Teach one useful thing in ${language} language. 
  Include: a word/phrase, example sentence, and short explanation. 
  Format as JSON: {"word": "...", "example": "...", "explanation": "..."}`

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

  return NextResponse.json({ news, lesson })
}