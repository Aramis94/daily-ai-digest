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

  if (loading) return <p className="p-8">{t.loading}</p>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t.history}</h1>

      {digests.length === 0 && <p>{t.historyEmpty}</p>}

      <div className="space-y-8">
        {digests.map((digest) => (
          <div key={digest.id} className="border rounded-lg p-6 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-4">
              {new Date(digest.created_at).toLocaleString(locales[appLanguage] || "hu-HU")}
            </p>

            <h2 className="font-semibold mb-2">{t.news}</h2>
            <div className="space-y-3 mb-4">
              {digest.news?.items?.map((item: any, i: number) => (
                <div key={i}>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-700">{item.summary}</p>
                </div>
              ))}
            </div>

            <h2 className="font-semibold mb-2">{t.lessonHeading}</h2>
            {digest.language_lesson?.word ? (
              <div className="bg-green-50 p-3 rounded">
                <p className="font-bold">{digest.language_lesson.word}</p>
                <p className="italic text-sm">{digest.language_lesson.example}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t.noLesson}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
