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

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8a8176]">{t.detailLoading}</p>
  }

  const sources = (detail?.sources || [])
    .map((source: { name?: string; url?: string }) => {
      const url = source.url ? safeHttps(source.url) : null
      if (!url || !source.name) return null
      return { name: source.name, url }
    })
    .filter(Boolean) as { name: string; url: string }[]

  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <Link href="/" className="text-sm font-medium text-[#0f6e6b] hover:underline">
        ← {t.backHome}
      </Link>

      <h1 className="font-display mt-5 text-4xl leading-tight tracking-tight sm:text-5xl">
        {title}
      </h1>

      {summary && (
        <p className="mt-5 text-lg leading-relaxed text-[#5e574e]">{summary}</p>
      )}

      {failed ? (
        <p className="mt-8 text-[#6b645b]">{t.detailFailed}</p>
      ) : (
        <p className="mt-8 whitespace-pre-wrap text-lg leading-8 text-[#1c1915]">
          {detail?.detailed}
        </p>
      )}

      {sources.length > 0 && (
        <div className="mt-10 rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6">
          <h2 className="font-display text-xl">{t.sources}</h2>
          <p className="mt-1 text-sm text-[#8a8176]">{t.sourcesNote}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-full border border-[#e4d9c8] bg-white px-3 py-1.5 text-sm text-[#0f6e6b] hover:border-[#0f6e6b]"
                >
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

export default function NewsDetailPage() {
  return (
    <Suspense fallback={<p className="p-8">...</p>}>
      <NewsDetailContent />
    </Suspense>
  )
}
