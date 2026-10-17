// Esti emlékeztető, budapesti idő szerint 20 óra körül. Csak annak megy, akinél az email be van kapcsolva, és ma még nincs aktivitás.
// Ezt hívja meg: a vercel.json napi cronja, GET /api/streak-reminder.

import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { Resend } from "resend"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { budapestDate } from "@/lib/streak"

const resend = new Resend(process.env.RESEND_API_KEY)

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

function reminderCopy(language: string | null) {
  if (language === "hungarian") return { subject: "Ma még nem nyitottad meg a tudásmorzsát", text: "A mai streak még nincs meg. Nyisd meg a digestet vagy kérj egy nyelvleckét." }
  if (language === "german") return { subject: "Dein Tageswissen ist heute noch nicht offen", text: "Deine Serie ist heute noch offen. Öffne den Digest oder hol dir eine Sprachlektion." }
  return { subject: "You have not opened today's knowledge yet", text: "Today's streak is still open. Open the digest or ask for a language lesson." }
}

export async function GET(request: Request) {
  if (!isCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })

  const supabase = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const today = budapestDate()
  const { data: profiles } = await supabase.from("profiles").select("id, language, email_notifications").eq("email_notifications", true)
  let sent = 0

  for (const profile of profiles || []) {
    const { data: activity } = await supabase
      .from("user_activity")
      .select("did_view_digest, did_complete_lesson, frozen")
      .eq("user_id", profile.id)
      .eq("activity_date", today)
      .maybeSingle()

    if (activity && (activity.did_view_digest || activity.did_complete_lesson || activity.frozen)) continue

    const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
    const email = userData?.user?.email
    if (!email) continue

    const copy = reminderCopy(profile.language)
    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Daily Digest <onboarding@resend.dev>",
        to: email,
        subject: copy.subject,
        html: `<p>${copy.text}</p><p><a href="https://daily-ai-digest-indol.vercel.app">Tudás minden napra</a></p>`,
      })
      sent += 1
    } catch {
      // Egy cím hiba ne állítsa meg a többit.
    }
  }

  return NextResponse.json({ sent, today })
}
