'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { translations } from '@/lib/translations'

const locales: Record<string, string> = {
  hungarian: 'hu-HU',
  english: 'en-US',
  german: 'de-DE',
  spanish: 'es-ES',
}

const languages = [
  ['hungarian', 'Magyar'],
  ['english', 'Angol'],
  ['german', 'Német'],
  ['spanish', 'Spanyol'],
  ['french', 'Francia'],
  ['italian', 'Olasz'],
  ['japanese', 'Japán'],
] as const

const levels = ['A1', 'A2', 'B1', 'B2', 'C1']

export default function Home() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [appLanguage, setAppLanguage] = useState('hungarian')
  const [learningLanguage, setLearningLanguage] = useState('hungarian')
  const [languageLevel, setLanguageLevel] = useState('A2')
  const supabase = createClient()

  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian
  const today = new Date().toLocaleDateString(locales[appLanguage] || 'hu-HU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  useEffect(() => {
    const loadLatest = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('language, learning_language, language_level')
        .eq('id', user.id)
        .single()

      if (profile) {
        setAppLanguage(profile.language || 'hungarian')
        setLearningLanguage(profile.learning_language || 'hungarian')
        setLanguageLevel(profile.language_level || 'A2')
      }

      const { data } = await supabase
        .from('daily_digests')
        .select('news, language_lesson')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setResult({
          news: data.news,
          lesson: data.language_lesson
        })
      }
      setLoading(false)
    }
    loadLatest()
  }, [supabase])

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

  const generate = async () => {
    setGenerating(true)
    const { data: { user } } = await supabase.auth.getUser()

    await fetch('/api/digest', { method: 'POST' })

    const { data } = await supabase
      .from('daily_digests')
      .select('news, language_lesson')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      setResult({
        news: data.news,
        lesson: data.language_lesson
      })
    }
    setGenerating(false)
  }

  const generateLesson = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setLessonLoading(true)
    const res = await fetch('/api/lesson', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      if (data.lesson) {
        setResult((prev: any) => ({
          ...prev,
          lesson: data.lesson
        }))
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
              {result.news?.items?.map((item: any, i: number) => (
                <article key={i} className="py-6 first:pt-0">
                  <p className="font-display text-sm text-[#c4552a]">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <h3 className="font-display mt-1 text-2xl leading-snug tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-[#3f3a34]">{item.summary}</p>
                  {item.why && (
                    <p className="mt-3 text-sm italic text-[#6b645b]">{item.why}</p>
                  )}
                  <Link
                    href={`/news/${i}?title=${encodeURIComponent(item.title)}&summary=${encodeURIComponent(item.summary)}&why=${encodeURIComponent(item.why || '')}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#0f6e6b] hover:underline"
                  >
                    {t.readMore}
                    <span aria-hidden>→</span>
                  </Link>
                </article>
              ))}
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
