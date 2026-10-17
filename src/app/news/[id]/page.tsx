"use client"

// Egy hír hosszabb változata. Az URL-ben a hír sorszáma és a digest azonosítója van, a szöveg nincs.
// Ha a hírön már van elmentett detail, azt olvassa. Ha nincs, a /api/news-detail végpont generálja és menti.
// Ezt hívja: src/lib/supabase/client.ts, src/lib/translations.ts és POST /api/news-detail.
// Ezt hívja meg: a főoldal Többet erről linkje.


import { Suspense, useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { translations } from "@/lib/translations"

type Source = { name: string; url: string }
type DetailView = { title: string; summary: string; detailed: string; sources: Source[] }

// Csak https link mehet ki a források közül.
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
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const digestId = searchParams.get("digest") || ""
  const index = Number(params.id)
  const [detail, setDetail] = useState<DetailView | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState("hungarian")
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    // Előbb a már elmentett cikket nézi. Ha nincs, a /api/news-detail generálja és menti.
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single()
      if (profile?.language) setAppLanguage(profile.language)

      if (!/^[0-9a-f-]{36}$/i.test(digestId) || !Number.isInteger(index)) {
        setFailed(true)
        setLoading(false)
        return
      }

      const { data: row } = await supabase
        .from("daily_digests")
        .select("news")
        .eq("id", digestId)
        .eq("user_id", user.id)
        .single()

      const item = row?.news?.items?.[index]
      if (item?.detail?.detailed) {
        const sources = (item.detail.sources || [])
          .map((source: { name?: string; url?: string }) => {
            const url = source.url ? safeHttps(source.url) : null
            if (!url || !source.name) return null
            return { name: source.name, url }
          })
          .filter((source: Source | null): source is Source => source !== null)

        setDetail({
          title: item.title || "",
          summary: item.summary || "",
          detailed: item.detail.detailed,
          sources,
        })
        setLoading(false)
        return
      }

      const res = await fetch("/api/news-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestId, index }),
      })
      if (!res.ok) {
        setFailed(true)
        setLoading(false)
        return
      }
      setDetail(await res.json())
      setLoading(false)
    }
    load()
  }, [digestId, index])

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8a8176]">{t.detailLoading}</p>
  }

  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <Link href="/" className="text-sm font-medium text-[#0f6e6b] hover:underline">
        ← {t.backHome}
      </Link>

      <h1 className="font-display mt-5 text-4xl leading-tight tracking-tight sm:text-5xl">
        {detail?.title}
      </h1>

      {detail?.summary && (
        <p className="mt-5 text-lg leading-relaxed text-[#5e574e]">{detail.summary}</p>
      )}

      {failed || !detail ? (
        <p className="mt-8 text-[#6b645b]">{t.detailFailed}</p>
      ) : (
        <p className="mt-8 whitespace-pre-wrap text-lg leading-8 text-[#1c1915]">
          {detail.detailed}
        </p>
      )}

      {(detail?.sources.length || 0) > 0 && (
        <div className="mt-10 rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6">
          <h2 className="font-display text-xl">{t.sources}</h2>
          <p className="mt-1 text-sm text-[#8a8176]">{t.sourcesNote}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {detail?.sources.map((source) => (
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