'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function NewsDetailContent() {
  const searchParams = useSearchParams()
  const title = searchParams.get('title') || ''
  const summary = searchParams.get('summary') || ''
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/news-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary })
      })
      const data = await res.json()
      setDetail(data)
      setLoading(false)
    }
    if (title) load()
  }, [title, summary])

  if (loading) return <p className="p-8">Részletes cikk betöltése...</p>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">{title}</h1>
      
      <div className="prose max-w-none mb-8">
        <p className="text-lg leading-relaxed">{detail?.detailed}</p>
      </div>

      {detail?.sources?.length > 0 && (
        <div className="bg-gray-50 p-6 rounded-lg mb-8">
          <h2 className="font-semibold mb-3">Források</h2>
          <ul className="space-y-2">
            {detail.sources.map((source: any, i: number) => (
              <li key={i}>
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
        ← Vissza a hírekhez
      </Link>
    </div>
  )
}

export default function NewsDetailPage() {
  return (
    <Suspense fallback={<p className="p-8">Betöltés...</p>}>
      <NewsDetailContent />
    </Suspense>
  )
}