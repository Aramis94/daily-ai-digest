'use client'

// Kedvenc hírek. A daily_digests sorokból csak a csillagozott tételeket mutatja.
// A csillag újra kattintva kiveszi a kedvencek közül.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { translations } from '@/lib/translations'

type FavoriteItem = {
  title?: string
  summary?: string
  why?: string
  theme?: string
  favorite?: boolean
  sourceName?: string
  sourceUrl?: string
}

type FavoriteRow = {
  digestId: string
  index: number
  item: FavoriteItem
}

export default function FavoritesPage() {
  const [rows, setRows] = useState<FavoriteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState('hungarian')
  const supabase = createClient()
  const router = useRouter()
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single()
      if (profile?.language && profile.language !== 'spanish') setAppLanguage(profile.language)

      const { data } = await supabase
        .from('daily_digests')
        .select('id, news')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const favorites: FavoriteRow[] = []
      for (const digest of data || []) {
        digest.news?.items?.forEach((item: FavoriteItem, index: number) => {
          if (item.favorite) favorites.push({ digestId: digest.id, index, item })
        })
      }
      setRows(favorites)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  async function unfavorite(row: FavoriteRow) {
    const { data } = await supabase
      .from('daily_digests')
      .select('news')
      .eq('id', row.digestId)
      .single()
    const items = (data?.news?.items || []).map((item: FavoriteItem, index: number) => (
      index === row.index ? { ...item, favorite: false } : item
    ))
    const { error } = await supabase
      .from('daily_digests')
      .update({ news: { ...data?.news, items } })
      .eq('id', row.digestId)
    if (!error) setRows((prev) => prev.filter((item) => item !== row))
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-sm text-[#8a8176]">{t.loading}</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl tracking-tight">{t.favorites}</h1>
      {rows.length === 0 && <p className="mt-8 text-[#6b645b]">{t.favoritesEmpty}</p>}
      <div className="mt-8 space-y-5">
        {rows.map((row) => (
          <article key={`${row.digestId}-${row.index}`} className="rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl leading-snug">{row.item.title}</h2>
              <button
                type="button"
                onClick={() => unfavorite(row)}
                aria-label={t.favorites}
                className="text-2xl leading-none text-[#c4552a]"
              >
                ★
              </button>
            </div>
            <p className="mt-3 leading-relaxed text-[#3f3a34]">{row.item.summary}</p>
            {row.item.sourceUrl?.startsWith('https://') && (
              <a href={row.item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-[#0f6e6b] hover:underline">
                {t.source}: {row.item.sourceName || t.sources}
              </a>
            )}
            <Link
              href={`/news/${row.index}?digest=${row.digestId}`}
              className="mt-4 inline-flex text-sm font-medium text-[#0f6e6b] hover:underline"
            >
              {t.readMore} →
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
