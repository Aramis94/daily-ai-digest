'use client'

// Főoldal. A legutóbbi digest híreit és a nyelvleckét mutatja.
// Betöltéskor: Supabase getUser, profiles sor, majd a legújabb daily_digests sor.
// A generálás a /api/digest végpontot hívja, a lecke a /api/lesson végpontot.
// Ezt hívja: src/lib/supabase/client.ts, src/lib/translations.ts, POST /api/digest, POST /api/lesson.
// A Többet erről link a src/app/news/[id]/page.tsx oldalra visz.
// Ezt hívja meg: a / útvonal, a menü Főoldal linkje.


import { useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { translations } from '@/lib/translations'
import { readPersonalization, savePersonalization } from '@/lib/personalization'
import { countStreak, freezesUsed, localDate, readActivity, saveActivity, weekCount, withFreeze, withToday } from '@/lib/streak'

const locales: Record<string, string> = {
  hungarian: 'hu-HU',
  english: 'en-US',
  german: 'de-DE',
}

const languages = [
  ['hungarian', 'Magyar'],
  ['english', 'Angol'],
  ['german', 'Német'],
  ['french', 'Francia'],
  ['italian', 'Olasz'],
  ['japanese', 'Japán'],
] as const

const levels = ['A1', 'A2', 'B1', 'B2', 'C1']

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
}

type Lesson = {
  word?: string
  example?: string
  explanation?: string
}

type DigestView = {
  id?: string
  news?: { items?: NewsItem[]; theme?: string; themeKey?: string } | null
  lesson?: Lesson | null
}

// A mai dátum a böngésző nyelvén. A szerver üres szöveget ad, hogy a build ne hívja a dátumot.
function todayLabel(language: string) {
  return new Date().toLocaleDateString(locales[language] || 'hu-HU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function Home() {
  const [result, setResult] = useState<DigestView | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [appLanguage, setAppLanguage] = useState('hungarian')
  const [learningLanguage, setLearningLanguage] = useState('hungarian')
  const [languageLevel, setLanguageLevel] = useState('A2')
  const [prefs, setPrefs] = useState<Record<string, number>>({})
  const [itemVotes, setItemVotes] = useState<Record<number, 1 | -1>>({})
  const [reasonFor, setReasonFor] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [lessonStreak, setLessonStreak] = useState(0)
  const [weekDays, setWeekDays] = useState(0)
  const [freezesLeft, setFreezesLeft] = useState(2)
  const [todayView, setTodayView] = useState(false)
  const [todayLesson, setTodayLesson] = useState(false)
  const [notice, setNotice] = useState('')
  const supabase = createClient()
  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  async function showStreak(raw: unknown) {
    const today = localDate()
    const frozen = withFreeze(readActivity(raw), today)
    const rows = frozen.rows
    const todayRow = rows.find((row) => row.activity_date === today)
    setStreak(countStreak(rows, today, 'any'))
    setLessonStreak(countStreak(rows, today, 'lesson'))
    setWeekDays(weekCount(rows, today))
    setFreezesLeft(Math.max(0, 2 - freezesUsed(rows, today)))
    setTodayView(Boolean(todayRow?.did_view_digest))
    setTodayLesson(Boolean(todayRow?.did_complete_lesson))
    return frozen.changed ? saveActivity(raw, rows) : null
  }

  async function refreshStreak(userId: string) {
    const { data } = await supabase.from('profiles').select('topic_prefs').eq('id', userId).single()
    const next = await showStreak(data?.topic_prefs)
    if (next) await supabase.from('profiles').update({ topic_prefs: next }).eq('id', userId)
  }

  async function markActivity(userId: string, flag: 'did_view_digest' | 'did_complete_lesson') {
    const { data } = await supabase.from('profiles').select('topic_prefs').eq('id', userId).single()
    const today = localDate()
    const saved = saveActivity(data?.topic_prefs, withToday(readActivity(data?.topic_prefs), today, flag))
    const next = await showStreak(saved) || saved
    await supabase.from('profiles').update({ topic_prefs: next }).eq('id', userId)
  }

  const today = useSyncExternalStore(
    () => () => {},
    () => todayLabel(appLanguage),
    () => ''
  )

  useEffect(() => {
    // Belépés ellenőrzése, profil (nyelv, tanulás, pontok) és a legutóbbi digest.
    const loadLatest = async () => {
      try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('language, learning_language, language_level, topic_prefs')
        .eq('id', user.id)
        .single()

      if (profile) {
        setAppLanguage(profile.language === 'spanish' ? 'hungarian' : (profile.language || 'hungarian'))
        setLearningLanguage(profile.learning_language === 'spanish' ? 'hungarian' : (profile.learning_language || 'hungarian'))
        setLanguageLevel(profile.language_level || 'A2')
        setPrefs(readPersonalization(profile.topic_prefs).scores)
      }

      const { data } = await supabase
        .from('daily_digests')
        .select('id, news, language_lesson')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setResult({
          id: data.id,
          news: data.news,
          lesson: data.language_lesson
        })
        await markActivity(user.id, 'did_view_digest')
      } else {
        await refreshStreak(user.id)
      }
      } finally {
        setLoading(false)
      }
    }
    loadLatest()
  }, [supabase])

  // A tanulási nyelv és a szint azonnal a profiles táblába megy. Új leckét ettől még nem gyárt.
  const updateLearning = async (newLang: string, newLevel: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ learning_language: newLang, language_level: newLevel })
      .eq('id', user.id)

    setLearningLanguage(newLang)
    setLanguageLevel(newLevel)
  }

  // Gyakrabban: +1, Ritkábban: -1. A pont -10 és 10 között marad, a profiles.topic_prefs mezőbe kerül.
  async function voteTheme(key: string, vote: 1 | -1) {
    const clean = key.trim().toLowerCase()
    if (!clean) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('topic_prefs').eq('id', user.id).single()
    const next = { ...prefs, [clean]: Math.max(-10, Math.min(10, (prefs[clean] || 0) + vote)) }
    setPrefs(next)
    const personal = readPersonalization(profile?.topic_prefs)
    await supabase.from('profiles').update({
      topic_prefs: savePersonalization(profile?.topic_prefs, next, personal.interests, personal.excluded, personal.feedback),
    }).eq('id', user.id)
  }

  async function toggleFavorite(index: number) {
    if (!result?.id || !result.news?.items) return
    const items = result.news.items.map((item, i) => (
      i === index ? { ...item, favorite: !item.favorite } : item
    ))
    const news = { ...result.news, items }
    const { error } = await supabase.from('daily_digests').update({ news }).eq('id', result.id)
    if (!error) setResult({ ...result, news })
  }

  async function rateItem(index: number, vote: 1 | -1, reason = '') {
    const item = result?.news?.items?.[index]
    if (!item || itemVotes[index]) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('topic_prefs').eq('id', user.id).single()
    const personal = readPersonalization(profile?.topic_prefs)
    const key = String(item.themeKey || item.theme || '').trim().toLowerCase()
    const next = { ...prefs }
    if (key) next[key] = Math.max(-10, Math.min(10, (prefs[key] || 0) + vote))
    const feedback = [{
      title: item.title || '',
      theme: item.theme || '',
      themeKey: key,
      vote,
      reason,
    }, ...personal.feedback]
    setPrefs(next)
    setItemVotes((prev) => ({ ...prev, [index]: vote }))
    setReasonFor(null)
    await supabase.from('profiles').update({
      topic_prefs: savePersonalization(profile?.topic_prefs, next, personal.interests, personal.excluded, feedback),
    }).eq('id', user.id)
  }

  // Új öt hírt kér a /api/digest végponttól, majd a legutóbbi sort újraolvassa.
  const generate = async () => {
    setGenerating(true)
    setNotice('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/digest', { method: 'POST' })
      if (!res.ok) {
        setNotice(t.generateFailed)
        return
      }

      const { data } = await supabase
        .from('daily_digests')
        .select('id, news, language_lesson')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setResult({
          id: data.id,
          news: data.news,
          lesson: data.language_lesson
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  // Új szót kér a /api/lesson végponttól, és csak a leckét cseréli a képernyőn.
  const generateLesson = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLessonLoading(true)
    const res = await fetch('/api/lesson', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      if (data.lesson) {
        setResult((prev) => ({
          id: prev?.id,
          news: prev?.news,
          lesson: data.lesson
        }))
        await markActivity(user.id, 'did_complete_lesson')
      }
    }
    setLessonLoading(false)
  }

  const fieldClass =
    'rounded-xl border border-[#e4d9c8] bg-white px-3 py-2 text-sm text-[#1c1915]'

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <p className="text-sm tracking-wide text-[#8a8176]">{t.loading}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-col gap-6 border-b border-[#e4d9c8] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6a45]">
            {t.kicker}
          </p>
          <h1 className="font-display mt-2 text-4xl tracking-tight text-[#1c1915] sm:text-5xl">
            {t.appName}
          </h1>
          <p className="mt-2 capitalize text-[#6b645b]">{today}</p>
          {notice && <p className="mt-2 text-sm text-[#8a4b32]">{notice}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#5e574e]">
            <p className="font-display text-3xl text-[#c4552a]">🔥 {streak}</p>
            <div>
              <p>{streak > 0 ? `${streak} ${t.streakDays}` : t.streakStart}</p>
              <p>
                {todayView && todayLesson ? t.todayBoth : todayView || todayLesson ? t.todayDone : t.todayMissing}
              </p>
              <p>{t.lessonStreak}: {lessonStreak} · {weekDays}/7 {t.weekGoal} · {freezesLeft} {t.freezesLeft}</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="rounded-full bg-[#1c1915] px-5 py-2.5 text-sm font-medium text-[#f6f1e8] transition hover:bg-[#34302b] disabled:opacity-50"
        >
          {generating ? t.generating : t.generate}
        </button>
      </header>

      {result ? (
        <div className="mt-10 space-y-14">
          <section>
            <h2 className="font-display text-2xl text-[#1c1915]">{t.news}</h2>
            <div className="mt-5 divide-y divide-[#eadfce]">
              {result.news?.items?.map((item, i) => {
                const theme = item.theme || result.news?.theme
                const themeKey = String(item.themeKey || result.news?.themeKey || theme || '').trim().toLowerCase()
                const themeScore = themeKey ? prefs[themeKey] || 0 : 0

                return (
                  <article key={i} className="py-6 first:pt-0">
                    <p className="font-display text-sm text-[#c4552a]">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <div className="mt-1 flex items-start justify-between gap-3">
                      <h3 className="font-display text-2xl leading-snug tracking-tight">
                        {item.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(i)}
                        aria-label={t.favorites}
                        className="text-2xl leading-none text-[#c4552a]"
                      >
                        {item.favorite ? '★' : '☆'}
                      </button>
                    </div>
                    <p className="mt-3 leading-relaxed text-[#3f3a34]">{item.summary}</p>
                    {item.why && (
                      <p className="mt-3 text-sm italic text-[#6b645b]">{item.why}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <Link
                        href={`/news/${i}?digest=${result.id || ''}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-[#0f6e6b] hover:underline"
                      >
                        {t.readMore}
                        <span aria-hidden>→</span>
                      </Link>
                      {item.sourceUrl?.startsWith('https://') && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[#0f6e6b] hover:underline"
                        >
                          {t.source}: {item.sourceName || t.sources}
                        </a>
                      )}
                      {item.searchUrl?.startsWith('https://') && (
                        <a
                          href={item.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#8a6a45] hover:underline"
                        >
                          {t.searchMore}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => rateItem(i, 1)}
                        disabled={itemVotes[i] !== undefined}
                        className={`rounded-full border px-3 py-1 text-sm ${itemVotes[i] === 1 ? 'border-[#0f6e6b] bg-[#f3faf8]' : 'border-[#e4d9c8] bg-white'}`}
                      >
                        {t.like}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReasonFor(reasonFor === i ? null : i)}
                        disabled={itemVotes[i] !== undefined}
                        className={`rounded-full border px-3 py-1 text-sm ${itemVotes[i] === -1 ? 'border-[#c4552a] bg-[#fff7f3]' : 'border-[#e4d9c8] bg-white'}`}
                      >
                        {t.dislike}
                      </button>
                      {reasonFor === i && (
                        <span className="flex flex-wrap gap-2">
                          {([
                            ['tooLong', t.reasonLong],
                            ['alreadyKnew', t.reasonKnown],
                            ['irrelevant', t.reasonIrrelevant],
                            ['badLanguage', t.reasonLanguage],
                            ['tooTechnical', t.reasonTechnical],
                          ] as const).map(([reason, label]) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => rateItem(i, -1, reason)}
                              className="rounded-full bg-[#f3eee6] px-3 py-1 text-sm"
                            >
                              {label}
                            </button>
                          ))}
                        </span>
                      )}
                      {theme && (
                        <span className="rounded-full bg-[#f3e4d8] px-3 py-1 text-sm text-[#8a4b32]">
                          {t.category}: {theme} ({themeScore})
                        </span>
                      )}
                      {theme && (
                        <button
                          type="button"
                          onClick={() => voteTheme(themeKey, 1)}
                          disabled={themeScore >= 10}
                          className="rounded-full border border-[#e4d9c8] bg-white px-3 py-1 text-sm disabled:opacity-40"
                        >
                          {t.moreOften}
                        </button>
                      )}
                      {theme && (
                        <button
                          type="button"
                          onClick={() => voteTheme(themeKey, -1)}
                          disabled={themeScore <= -10}
                          className="rounded-full border border-[#e4d9c8] bg-white px-3 py-1 text-sm disabled:opacity-40"
                        >
                          {t.lessOften}
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-[#d7ebe6] bg-[#f7fbfa] p-6 sm:p-8">
            <h2 className="font-display text-2xl text-[#134e4a]">{t.lesson}</h2>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={learningLanguage}
                onChange={(e) => updateLearning(e.target.value, languageLevel)}
                className={fieldClass}
              >
                {languages.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>

              <select
                value={languageLevel}
                onChange={(e) => updateLearning(learningLanguage, e.target.value)}
                className={fieldClass}
              >
                {levels.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={generateLesson}
                disabled={lessonLoading}
                className="rounded-full bg-[#0f6e6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c5c59] disabled:opacity-50"
              >
                {lessonLoading ? t.generating : t.newLesson}
              </button>
            </div>

            {result.lesson?.word ? (
              <div className="mt-6 border-t border-[#d7ebe6] pt-6">
                <p className="font-display text-4xl tracking-tight text-[#134e4a]">
                  {result.lesson.word}
                </p>
                {result.lesson.example && (
                  <p className="mt-4 text-lg italic leading-relaxed text-[#1c1915]">
                    “{result.lesson.example}”
                  </p>
                )}
                {result.lesson.explanation && (
                  <p className="mt-3 leading-relaxed text-[#3f3a34]">
                    {result.lesson.explanation}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-6 text-sm text-[#5f7a76]">{t.noLesson}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="mt-10 rounded-3xl border border-dashed border-[#d9cfc0] bg-[#fffaf3] px-6 py-12 text-center">
          <p className="text-[#6b645b]">{t.noDigest}</p>
        </div>
      )}
    </div>
  )
}