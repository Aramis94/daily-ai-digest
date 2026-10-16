'use client'

import { useState } from 'react'

export default function Home() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    const res = await fetch('/api/generate', { method: 'POST' })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Daily AI Digest</h1>
      <button
        onClick={generate}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? 'Generálás...' : 'Napi digest generálása'}
      </button>

      {result && (
        <pre className="mt-6 bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}