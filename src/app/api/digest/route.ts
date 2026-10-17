// Hírgenerálás. POST: a bejelentkezett felhasználó gombja. GET: a Vercel napi cronja, titkos kulccsal.
// A Groq öt valódi Google News cikket foglal össze. A link és a kiadó neve a feedből jön, nem a modellből.
// Utána a 30 napnál régebbi és a 200 hír feletti legrégebbi sorok törlődnek. Ha az email be van kapcsolva, a Resend levelet küld.
// Ezt hívja: src/lib/supabase/server.ts, src/lib/rateLimit.ts, src/lib/text.ts, a Groq és a Resend.
// Ezt hívja meg: src/app/page.tsx generálógombja, src/app/settings/page.tsx mentése, és a vercel.json napi cronja (GET).
import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import OpenAI from "openai"
import { Resend } from "resend"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rateLimit"
import { clampText, clientIp, escapeHtml, languageName, parseModelJson } from "@/lib/text"
import { loadRealArticles, topicKey } from "@/lib/googleNews"
import { feedbackPrompt, readPersonalization } from "@/lib/personalization"

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
})

const resend = new Resend(process.env.RESEND_API_KEY)

type NewsItem = {
  title?: string
  summary?: string
  why?: string
  theme?: string
  themeKey?: string
  favorite?: boolean
  sourceName?: string
  sourceUrl?: string
  searchUrl?: string
  excerpt?: string
}
type NewsPayload = { items?: NewsItem[]; theme?: string; themeKey?: string }
type Profile = {
  id: string
  language: string | null
  topics: string[] | null
  email_notifications: boolean | null
  topic_prefs: Record<string, unknown> | null
}
type StoredDigest = { id: string; created_at?: string; news?: { items?: NewsItem[]; theme?: string; themeKey?: string } | null }
type DigestDb = {
  from: (table: string) => {
    select: (columns: string) => Query
    insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    update: (values: Record<string, unknown>) => Query
    delete: () => Query
  }
}
type Query = {
  eq: (column: string, value: string) => Query
  lt: (column: string, value: string) => Query
  in: (column: string, values: string[]) => Query
  order: (column: string, options: { ascending: boolean }) => Query
  limit: (count: number) => Query
  single: () => Promise<{ data: Profile | null; error: { message: string } | null }>
  then: (resolve: (value: { data: StoredDigest[] | null }) => unknown) => Promise<unknown>
}

// A napi cron csak akkor mehet tovább, ha a kérés a CRON_SECRET kulcsot hozza.
function isCron(request: Request) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get("authorization") ?? ""
  if (!secret || !header.startsWith("Bearer ")) return false
  const token = header.slice("Bearer ".length)
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Cronhoz használt kliens. A service role kulccsal minden felhasználó digestjét elkészíti.
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// A levél tárgya és szövege a profil nyelve szerint.
function emailCopy(language: string) {
  if (language === "Hungarian") {
    return {
      subject: "A mai Tudás minden napra kész",
      intro: "A mai digeszted elkészült a következő témákban:",
      news: "Hírek címei",
      button: "Megnézem a teljes digesztet",
    }
  }
  if (language === "German") {
    return {
      subject: "Dein Tudás minden napra ist fertig",
      intro: "Dein Digest ist fertig zu diesen Themen:",
      news: "Schlagzeilen",
      button: "Den vollständigen Digest ansehen",
    }
  }
  return {
    subject: "Your Tudás minden napra is ready",
    intro: "Today's digest is ready for these topics:",
    news: "Headlines",
    button: "Open the full digest",
  }
}

// Az utolsó öt digest címei és kategóriái, hogy az új hír ne ismételje őket.
async function recentContext(supabase: DigestDb, userId: string) {
  const { data } = await supabase
    .from("daily_digests")
    .select("news")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5) as { data: StoredDigest[] | null }

  const titles: string[] = []
  const categories: string[] = []
  for (const row of data || []) {
    for (const item of row.news?.items || []) {
      const title = clampText(item.title, 140)
      const category = clampText(item.themeKey || row.news?.themeKey, 40).toLowerCase()
      if (title) titles.push(title)
      if (category) categories.push(category)
    }
  }

  return {
    titles: titles.slice(0, 15),
    categories: [...new Set(categories)].slice(0, 15),
  }
}

// A 30 napnál régebbi és a 200 hír feletti sorokból kiveszi a nem kedvenc híreket. A csillagozott hír megmarad.
async function trimUserDigests(supabase: DigestDb, userId: string) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("daily_digests")
    .select("id, created_at, news")
    .eq("user_id", userId)
    .order("created_at", { ascending: true }) as { data: StoredDigest[] | null }

  const rows = data || []

  const keep = async (row: StoredDigest) => {
    const items = row.news?.items || []
    const favorites = items.filter((item) => item.favorite)
    if (favorites.length === items.length) return items.length
    if (favorites.length === 0) {
      await supabase.from("daily_digests").delete().eq("id", row.id).eq("user_id", userId)
      row.news = { ...row.news, items: [] }
      return 0
    }
    await supabase
      .from("daily_digests")
      .update({ news: { ...row.news, items: favorites } })
      .eq("id", row.id)
      .eq("user_id", userId)
    row.news = { ...row.news, items: favorites }
    return favorites.length
  }

  for (const row of rows) {
    if ((row.created_at || "") < cutoff) await keep(row)
  }

  let total = rows.reduce((sum, row) => sum + (row.news?.items?.length || 0), 0)
  for (const row of rows) {
    if (total <= 200) break
    const before = row.news?.items?.length || 0
    if (before === 0) continue
    const after = await keep(row)
    total -= before - after
  }
}

// Öt valódi cikk lekérése, majd Groq összefoglaló. Mentés a daily_digests táblába, takarítás, opcionális email.
async function generateForProfile(supabase: DigestDb, profile: Profile, email: string | null) {
  const customTopics = (profile.topics || [])
    .map((topic) => clampText(topic, 40))
    .filter(Boolean)
    .slice(0, 12)
  const recent = await recentContext(supabase, profile.id)
  const outputLanguage = languageName(profile.language)
  const personal = readPersonalization(profile.topic_prefs)
  const namedTopics = personal.interests.length
    ? personal.interests.map((item) => item.topic)
    : customTopics
  const prefs = { ...personal.scores }
  for (const interest of personal.interests) {
    const key = topicKey(interest.topic)
    prefs[key] = (prefs[key] || 0) + interest.weight
  }
  const articles = await loadRealArticles(
    profile.language,
    namedTopics,
    prefs,
    recent.categories,
    recent.titles,
    personal.excluded,
  )
  if (articles.length === 0) return false

  const depthOf = (theme: string, themeKey: string) => {
    const match = personal.interests.find((item) => {
      const name = topicKey(item.topic)
      return name === themeKey || item.topic.toLowerCase() === theme.toLowerCase()
    })
    return match?.level || "intermediate"
  }

  const packed = articles.map((article, index) => (
    `${index + 1}. Category: ${article.theme}\nDepth: ${depthOf(article.theme, article.themeKey)}\nTitle: ${article.title}\nSource: ${article.sourceName}\nText: ${article.excerpt || article.title}`
  )).join("\n\n")

  const newsPrompt = `Summarize each real article between the markers.
Write in ${outputLanguage}. Use only the facts in that article. Do not add sources or URLs.
Depth beginner means plain words. intermediate means a normal reader. expert means precise terms.
Keep the same order and the same number of items.
${feedbackPrompt(personal.feedback)}
<articles>
${packed}
</articles>
Format as JSON: {"items": [{"title": "short headline", "summary": "two sentences", "why": "one sentence"}]}`

  let rewritten: { title?: string; summary?: string; why?: string }[] | null = null
  for (let attempt = 0; attempt < 2 && !rewritten; attempt++) {
    const newsRes = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: newsPrompt }],
      response_format: { type: "json_object" },
    })
    const parsed = parseModelJson<{ items?: { title?: string; summary?: string; why?: string }[] }>(newsRes.choices[0].message.content)
    if (parsed?.items?.length === articles.length) rewritten = parsed.items
  }

  const news: NewsPayload = {
    items: articles.map((article, index) => ({
      title: clampText(rewritten?.[index]?.title, 180) || article.title,
      summary: clampText(rewritten?.[index]?.summary, 500) || article.excerpt || article.title,
      why: clampText(rewritten?.[index]?.why, 240),
      theme: article.theme,
      themeKey: article.themeKey,
      sourceName: article.sourceName,
      sourceUrl: article.link,
      searchUrl: article.searchUrl,
      excerpt: article.excerpt,
    })),
  }

  const { error } = await supabase.from("daily_digests").insert({
    user_id: profile.id,
    news,
    language_lesson: null,
  })
  if (error) return false

  await trimUserDigests(supabase, profile.id)

  if (profile.email_notifications && email) {
    const copy = emailCopy(outputLanguage)
    const titles = (news.items || [])
      .map((item) => `<li>${escapeHtml(clampText(item.title, 180))}</li>`)
      .join("") || "<li>-</li>"
    const themes = (news.items || []).map((item) => item.theme).filter(Boolean).join(", ")
    const safeTopics = escapeHtml(customTopics.join(", ") || themes || "vegyes")

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Daily Digest <onboarding@resend.dev>",
      to: email,
      subject: copy.subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">Tudás minden napra</h2>
          <p>${copy.intro} <strong>${safeTopics}</strong></p>
          <h3>${copy.news}</h3>
          <ul>${titles}</ul>
          <p style="margin-top: 24px;">
            <a href="https://daily-ai-digest-indol.vercel.app" style="background: #1a73e8; color: white; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
              ${copy.button}
            </a>
          </p>
        </div>
      `,
    })
  }

  return true
}

// Vercel cron, naponta 7:00 UTC. Végigmegy minden profilon, és mindegyiknek digestet készít.
export async function GET(request: Request) {
  if (!isCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = adminClient()
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, language, topics, email_notifications, topic_prefs")

  if (error || !profiles?.length) {
    return NextResponse.json({ error: "No profiles found" }, { status: 400 })
  }

  let ok = 0
  for (const profile of profiles as Profile[]) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
      const sent = await generateForProfile(supabase as unknown as DigestDb, profile, userData?.user?.email ?? null)
      if (sent) ok += 1
    } catch {
      // Keep going so one user does not stop the daily run.
    }
  }

  return NextResponse.json({ ok, count: profiles.length })
}

// A főoldal vagy a beállítások gombja. Csak a belépett felhasználónak generál, percenként legfeljebb ötször.
export async function POST(request: Request) {
  if (!rateLimit(clientIp(request), 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, language, topics, email_notifications, topic_prefs")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: "No profile found" }, { status: 400 })
  }

  try {
    const sent = await generateForProfile(supabase as unknown as DigestDb, profile, user.email ?? null)
    if (!sent) {
      return NextResponse.json({ error: "Generation failed" }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: "Generation failed" }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}