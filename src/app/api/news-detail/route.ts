// Hosszabb szöveg a már elmentett cikk alapján. A forráslink a digestben tárolt valódi URL, a modell nem talál ki újat.
// Ezt hívja: src/lib/supabase/server.ts, src/lib/rateLimit.ts, src/lib/text.ts és a Groq.
// Ezt hívja meg: src/app/news/[id]/page.tsx, ha a cikk még nincs elmentve.
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rateLimit"
import { clampText, clientIp, parseModelJson, safeHttpsUrl } from "@/lib/text"

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

type Source = { name: string; url: string }
type StoredDetail = { detailed?: string; sources?: { name?: string; url?: string }[] }
type NewsItem = {
  title?: string
  summary?: string
  why?: string
  theme?: string
  themeKey?: string
  sourceName?: string
  sourceUrl?: string
  searchUrl?: string
  excerpt?: string
  detail?: StoredDetail
}
type NewsPayload = { items?: NewsItem[]; theme?: string; themeKey?: string }

function cleanSources(sources: { name?: string; url?: string }[] | undefined): Source[] {
  return (sources || [])
    .map((source) => {
      const url = safeHttpsUrl(source.url)
      const name = clampText(source.name, 120)
      if (!url || !name) return null
      return { name, url }
    })
    .filter((source): source is Source => source !== null)
    .slice(0, 5)
}

function savedSource(item: NewsItem): Source[] {
  const url = safeHttpsUrl(item.sourceUrl)
  const name = clampText(item.sourceName, 80)
  if (!url || !name) return cleanSources(item.detail?.sources)
  return [{ name, url }]
}

// Ha a hír detail mezője már tele van, azt adja vissza. Különben a Groq írja meg, és a digestbe menti.
export async function POST(request: Request) {
  if (!rateLimit(clientIp(request), 8, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { digestId?: unknown; index?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const digestId = clampText(body.digestId, 40)
  const index = Number(body.index)
  if (!/^[0-9a-f-]{36}$/i.test(digestId) || !Number.isInteger(index) || index < 0 || index > 20) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { data: row } = await supabase
    .from("daily_digests")
    .select("id, news")
    .eq("id", digestId)
    .eq("user_id", user.id)
    .single()

  const news = row?.news as NewsPayload | null
  const item = news?.items?.[index]
  const title = clampText(item?.title, 300)
  const summary = clampText(item?.summary, 2000)
  if (!row || !news?.items || !item || !title || !summary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const sources = savedSource(item)
  const searchUrl = safeHttpsUrl(item.searchUrl)

  if (item.detail?.detailed) {
    return NextResponse.json({
      title,
      summary,
      detailed: item.detail.detailed,
      sources,
      searchUrl,
    })
  }

  const prompt = `Write a longer explanation of 3-4 paragraphs from the article between the markers.
Use only these facts. Do not invent names, numbers, quotes, or URLs.
Write in the same language as the title.
<news>
Title: ${title}
Summary: ${summary}
Excerpt: ${clampText(item.excerpt, 500)}
</news>
Format as JSON: {"detailed": "..."}`

  try {
    const res = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    })
    const data = parseModelJson<StoredDetail>(res.choices[0].message.content)
    if (!data?.detailed) {
      return NextResponse.json({ error: "Generation failed" }, { status: 502 })
    }

    const items = news.items.map((current, i) => (
      i === index ? { ...current, detail: { detailed: data.detailed, sources } } : current
    ))

    const { error } = await supabase
      .from("daily_digests")
      .update({ news: { ...news, items } })
      .eq("id", digestId)
      .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: "Save failed" }, { status: 500 })

    return NextResponse.json({ title, summary, detailed: data.detailed, sources, searchUrl })
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 })
  }
}