"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { translations } from "@/lib/translations"

function safeHttps(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:") return null
    return parsed.toString()
  } catch {
    return null
  }
}

function NewsDetailContent() {
  const searchParams = useSearchParams()
  const title = searchParams.get("title") || ""
  const summary = searchParams.get("summary") || ""
  const [detail, setDetail] = useState<any>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState("hungarian")
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("language")
          .eq("id", user.id)
          .single()
        if (profile?.language) setAppLanguage(profile.language)
      }

      if (!title) {
        setLoading(false)
        setFailed(true)
        return
      }

      const res = await fetch("/api/news-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary }),
      })
      if (!res.ok) {
        setFailed(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setDetail(data)
      setLoading(false)
    }
    load()
  }, [title, summary])

  if (loading) return <p className="p-8">{t.detailLoading}</p>

  const sources = (detail?.sources || [])
    .map((source: { name?: string; url?: string }) => {
      const url = source.url ? safeHttps(source.url) : null
      if (!url || !source.name) return null
      return { name: source.name, url }
    })
    .filter(Boolean) as { name: string; url: string }[]

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{title}</h1>

      {failed ? (
        <p className="mb-8 text-gray-600">{t.detailFailed}</p>
      ) : (
        <div className="prose max-w-none mb-8">
          <p className="text-lg leading-relaxed whitespace-pre-wrap">{detail?.detailed}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="font-semibold mb-1">{t.sources}</h2>
          <p className="text-sm text-gray-500 mb-3">{t.sourcesNote}</p>
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        href="/"
        className="inline-block bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
      >
        {t.backHome}
      </Link>
    </div>
  )
}

export default function NewsDetailPage() {
  return (
    <Suspense fallback={<p className="p-8">...</p>}>
      <NewsDetailContent />
    </Suspense>
  )
}
