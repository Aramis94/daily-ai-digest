'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const [language, setLanguage] = useState('hungarian')
  const [topics, setTopics] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('language, topics')
        .eq('id', user.id)
        .single()

      if (data) {
        setLanguage(data.language || 'hungarian')
        setTopics((data.topics || []).join(', '))
      }
      setLoading(false)
    }
    loadProfile()
  }, [supabase, router])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const topicsArray = topics
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    const { error } = await supabase
      .from('profiles')
      .update({ language, topics: topicsArray })
      .eq('id', user.id)

    setMessage(error ? error.message : 'Mentve!')
    setSaving(false)
  }

  if (loading) return <p className="p-8">Betöltés...</p>

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Beállítások</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Nyelv</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border p-2 w-full rounded"
        >
          <option value="hungarian">Magyar</option>
          <option value="english">Angol</option>
          <option value="german">Német</option>
          <option value="spanish">Spanyol</option>
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium 