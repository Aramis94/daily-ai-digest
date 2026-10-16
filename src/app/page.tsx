'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLatest = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
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
  }, [])

  const generate = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await fetch('/api/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id })
    })

    // Újratöltjük a legújabbat
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

  if (loading) return <p className="p-8">Betöltés...</p>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Daily AI Digest</h1>

      <button
        onClick={generate}
        disabled={loading}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? 'Generálás...' : 'Új digest generálása'}
      </button>

      {result ? (
        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Hírek</h2>
            <div className="space-y-4">
              {result.news?.items?.map((item: any, i: number) => (
                <div key={i} className="border rounded-lg p-4 bg-white shadow-sm">
                  <h3 className="font-bold text-lg">{item.title}</h3>
                  <p className="mt-2 text-gray-700">{item.summary}</p>
                  <p className="mt-2 text-sm text-blue-600">{item.why}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Napi nyelvlecke</h2>
            <div className="border rounded-lg p-6 bg-green-50">
              <p className="text-xl font-bold">{result.lesson?.word}</p>
              <p className="mt-2 italic">{result.lesson?.example}</p>
              <p className="mt-2 text-gray-700">{result.lesson?.explanation}</p>
            </div>
          </section>
        </div>
      ) : (
        <p className="mt-8 text-gray-500">Még nincs digest. Kattints a gombra az első generáláshoz.</p>
      )}
    </div>
  )
}