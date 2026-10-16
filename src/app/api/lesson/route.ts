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
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('learning_language, language_level, language')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'No profile' }, { status: 400 })
  }

  const targetLang = profile.learning_language || 'hungarian'
  const appLang = profile.language || 'hungarian'

  const targetName = targetLang === 'hungarian' ? 'Hungarian' :
                     targetLang === 'german' ? 'German' :
                     targetLang === 'spanish' ? 'Spanish' :
                     targetLang === 'french' ? 'French' :
                     targetLang === 'italian' ? 'Italian' :
                     targetLang === 'japanese' ? 'Japanese' : 'English'

  const appName = appLang === 'hungarian' ? 'Hungarian' :
                  appLang === 'german' ? 'German' :
                  appLang === 'spanish' ? 'Spanish' : 'English'

  const lessonPrompt = `Teach one useful thing in ${targetName} for a learner whose interface language is ${appName}. 
  Provide the word/phrase and example in ${targetName}, and the explanation translated into ${appName}.
  Level: ${profile.language_level || 'A2'}.
  Format as JSON: {"word": "...", "example": "...", "explanation": "..."}`

  const res = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: lessonPrompt }],
    response_format: { type: 'json_object' },
  })

  const lesson = JSON.parse(res.choices[0].message.content || '{}')

  return NextResponse.json({ lesson })
}
