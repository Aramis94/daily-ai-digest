// Új nyelvlecke. A profiles tanulási nyelvét és szintjét olvassa, a Groq egy szót és példát ad.
// A legutóbbi digest language_lesson mezőjébe menti. Ha még nincs digest, üres hírrel létrehoz egyet.
// Ezt hívja: src/lib/supabase/server.ts, src/lib/rateLimit.ts, src/lib/text.ts és a Groq.
// Ezt hívja meg: src/app/page.tsx, az új lecke gombja.
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rateLimit"
import { clientIp, languageName, parseModelJson } from "@/lib/text"

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

type Lesson = { word?: string; example?: string; explanation?: string }

// Belépett felhasználó leckéje. Groq, majd a legutóbbi digest frissítése vagy új sor.
export async function POST(request: Request) {
  if (!rateLimit(clientIp(request), 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("learning_language, language_level, language")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 })
  }

  const targetName = languageName(profile.learning_language)
  const appName = languageName(profile.language)
  const level = ["A1", "A2", "B1", "B2", "C1"].includes(profile.language_level) ? profile.language_level : "A2"

  const lessonPrompt = `Teach one useful thing in ${targetName} at ${level} level.
The learner's interface language is ${appName}.
The word and example must be in ${targetName}. The explanation must be in ${appName}.
Format as JSON: {"word": "...", "example": "...", "explanation": "..."}`

  let lesson: Lesson | null = null
  try {
    const res = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: lessonPrompt }],
      response_format: { type: "json_object" },
    })
    lesson = parseModelJson<Lesson>(res.choices[0].message.content)
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 })
  }

  if (!lesson?.word) {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 })
  }

  const { data: latest } = await supabase
    .from("daily_digests")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.id) {
    await supabase
      .from("daily_digests")
      .update({ language_lesson: lesson })
      .eq("id", latest.id)
      .eq("user_id", user.id)
  } else {
    await supabase.from("daily_digests").insert({
      user_id: user.id,
      news: { items: [] },
      language_lesson: lesson,
    })
  }

  return NextResponse.json({ lesson })
}
