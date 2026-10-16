"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { translations } from "@/lib/translations"

const locales: Record<string, string> = {
  hungarian: "hu-HU",
  english: "en-US",
  german: "de-DE",
  spanish: "es-ES",
}

export default function HistoryPage() {
  const [digests, setDigests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState("hungarian")
  const supabase = createClient()
  const router = useRouter()
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single()

      if (profile?.language) setAppLanguage(profile.language)

      const { data } = await supabase
        .from("daily_digests")
        .select("id, created_at, news, language_lesson")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30)

      setDigests(data || [])
      setLoading(false)
    }
    load()
  }, [supabase, router])

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8a8176]">{t.loading}</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl tracking-tight">{t.history}</h1>

      {digests.length === 0 && (
        <p className="mt-8 text-[#6b645b]">{t.historyEmpty}</p>
      )}

      <div className="mt-8 space-y-5">
        {digests.map((digest) => (
          <article key={digest.id} className="rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6a45]">
              {new Date(digest.created_at).toLocaleString(locales[appLanguage] || "hu-HU")}
            </p>

            <h2 className="font-display mt-4 text-xl">{t.news}</h2>
            <div className="mt-3 space-y-4">
              {digest.news?.items?.map((item: any, i: number) => (
                <div key={i}>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#5e574e]">{item.summary}</p>
                </div>
              ))}
            </div>

            <h2 className="font-display mt-6 text-xl">{t.lessonHeading}</h2>
            {digest.language_lesson?.word ? (
              <div className="mt-3 rounded-2xl bg-[#f3faf8] px-4 py-3">
                <p className="font-display text-2xl text-[#134e4a]">{digest.language_lesson.word}</p>
                <p className="mt-1 text-sm italic text-[#3f3a34]">{digest.language_lesson.example}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#8a8176]">{t.noLesson}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
