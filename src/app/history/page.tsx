'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function HistoryPage() {
  const [digests, setDigests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('daily_digests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      setDigests(data || [])
      setLoading(false)
    }
    load()
  }, [supabase, router])

  if (loading) return <p className="p-8">Betöltés...</p>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Előzmények</h1>

      {digests.length === 0 && <p>Még nincs előzmény.</p>}

      <div className="space-y-8">
        {digests.map((digest) => (
          <div key={digest.id} className="border rounded-lg p-6 bg-white shadow-sm">
            <p className="text-sm text-gray-500 mb-4">
              {new Date(digest.created_at).toLocaleString('hu-HU')}
            </p>

            {/* Hírek */}
            <h2 className="font-semibold mb-2">Hírek</h2>
            <div className="space-y-3 mb-4">
              {digest.news?.items?.map((item: any, i: number) => (
                <div key={i}>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-700">{item.summary}</p>
                </div>
              ))}
            </div>

            {/* Nyelvlecke */}
            <h2 className="font-semibold mb-2">Nyelvlecke</h2>
            <div className="bg-green-50 p-3 rounded">
              <p className="font-bold">{digest.language_lesson?.word}</p>
              <p className="italic text-sm">{digest.language_lesson?.example}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}