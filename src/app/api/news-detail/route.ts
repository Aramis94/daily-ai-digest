import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})

export async function POST(request: Request) {
  const { title, summary } = await request.json()

  const prompt = `Expand this news item into a longer, detailed article (3-4 paragraphs). 
  Include 2-3 realistic source references with website names.
  Title: ${title}
  Summary: ${summary}
  
  Format as JSON: {
    "detailed": "...",
    "sources": [{"name": "...", "url": "..."}]
  }`

  const res = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  })

  const data = JSON.parse(res.choices[0].message.content || '{}')
  return NextResponse.json(data)
}