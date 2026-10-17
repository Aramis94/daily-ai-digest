"use client"

// Előzmények. Egy lekéréssel a legújabb 80 digestet hozza a daily_digests táblából.
// A törlés gomb egy sort töröl, az összes törlése a felhasználó minden digestjét.
// Ezt hívja: src/lib/supabase/client.ts és src/lib/translations.ts. API végpontot nem hív.
// Ezt hívja meg: a menü Előzmények linkje.


import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { translations } from "@/lib/translations"

const locales: Record<string, string> = {
  hungarian: "hu-HU",
  english: "en-US",
  german: "de-DE",
}

type HistoryNews = { title?: string; summary?: string; theme?: string }
type HistoryDigest = {
  id: string
  created_at: string
  news?: { items?: HistoryNews[] } | null
  language_lesson?: { word?: string; example?: string } | null
}

export default function HistoryPage() {
  const [digests, setDigests] = useState<HistoryDigest[]>([])
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState("hungarian")
  const supabase = createClient()
  const router = useRouter()
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    // Nyelv a profilból, utána egyetlen lista: id, dátum, hírek, lecke, legfeljebb 80.
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
        .limit(80)

      setDigests(data || [])
      setLoading(false)
    }
    load()
  }, [supabase, router])

  // Egy digest törlése a daily_digests táblából, majd kivétel a listáról.
  async function removeDigest(id: string) {
    const { error } = await supabase.from("daily_digests").delete().eq("id", id)
    if (!error) setDigests((prev) => prev.filter((digest) => digest.id !== id))
  }

  // Megerősítés után a felhasználó minden digestje törlődik. A profil és a pontok megmaradnak.
  async function deleteAllHistory() {
    if (!window.confirm(t.deleteAllConfirm)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from("daily_digests").delete().eq("user_id", user.id)
    if (!error) setDigests([])
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8a8176]">{t.loading}</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl tracking-tight">{t.history}</h1>
        <button
          type="button"
          onClick={deleteAllHistory}
          className="rounded-full border border-[#e4d9c8] bg-white px-4 py-2 text-sm"
        >
          {t.deleteAll}
        </button>
      </div>

      {digests.length === 0 && (
        <p className="mt-8 text-[#6b645b]">{t.historyEmpty}</p>
      )}

      <div className="mt-8 space-y-5">
        {digests.map((digest) => (
          <article key={digest.id} className="rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a6a45]">
                {new Date(digest.created_at).toLocaleString(locales[appLanguage] || "hu-HU")}
              </p>
              <button
                type="button"
                onClick={() => removeDigest(digest.id)}
                className="rounded-full border border-[#e4d9c8] bg-white px-3 py-1 text-sm"
              >
                {t.deleteOne}
              </button>
            </div>

            <h2 className="font-display mt-4 text-xl">{t.news}</h2>
            <div className="mt-3 space-y-4">
              {digest.news?.items?.map((item, i) => (
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