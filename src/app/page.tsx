'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { translations } from '@/lib/translations'

export default function Home() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [appLanguage, setAppLanguage] = useState('hungarian')
  const [learningLanguage, setLearningLanguage] = useState('hungarian')
  const [languageLevel, setLanguageLevel] = useState('A2')
  const supabase = createClient()

  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

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
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    await fetch('/api/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id })
    })

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
    setLoading(false)
  }

  const generateLesson = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const res = await fetch('/api/lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
    const data = await res.json()

    setResult((prev: any) => ({
      ...prev,
      lesson: data.lesson
    }))
  }

  if (loading) return <p className="p-8">{t.loading}</p>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{t.appName}</h1>

      <button
        onClick={generate}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? t.generating : t.generate}
      </button>

      {result ? (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">{t.news}</h2>
            <div className="space-y-4">
              {result.news?.items?.map((item: any, i: number) => (
                <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="mt-2 text-gray-700">{item.summary}</p>
                  <p className="mt-2 text-sm text-blue-600">{item.why}</p>
                  <Link
                    href={`/news/${i}?title=${encodeURIComponent(item.title)}&summary=${encodeURIComponent(item.summary)}&why=${encodeURIComponent(item.why)}`}
                    className="inline-block mt-3 text-blue-600 hover:underline text-sm"
                  >
                    {t.readMore}
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">{t.lesson}</h2>
            
            <div className="flex gap-4 mb-4 items-center">
              <select
                value={learningLanguage}
                onChange={(e) => updateLearning(e.target.value, languageLevel)}
                className="border p-2 rounded"
              >
                <option value="hungarian">Magyar</option>
                <option value="english">Angol</option>
                <option value="german">Német</option>
                <option value="spanish">Spanyol</option>
                <option value="french">Francia</option>
                <option value="italian">Olasz</option>
                <option value="japanese">Japán</option>
              </select>

              <select
                value={languageLevel}
                onChange={(e) => updateLearning(learningLanguage, e.target.value)}
                className="border p-2 rounded"
              >
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="B1">B1</option>
                <option value="B2">B2</option>
                <option value="C1">C1</option>
              </select>

              <button
                onClick={generateLesson}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm"
              >
                {t.newLesson}
              </button>
            </div>

            {result.lesson && (
              <div className="border rounded-lg p-6 bg-green-50">
                <p className="text-xl font-bold">{result.lesson?.word}</p>
                <p className="mt-2 italic">{result.lesson?.example}</p>
                <p className="mt-2 text-gray-700">{result.lesson?.explanation}</p>
              </div>
            )}
          </section>
        </div>
      ) : (
        <p className="mt-8 text-gray-500">{t.noDigest}</p>
      )}
    </div>
  )
}