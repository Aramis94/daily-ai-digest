'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { translations } from '@/lib/translations'

export default function SettingsPage() {
  const [language, setLanguage] = useState('hungarian')
  const [topics, setTopics] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const t = translations[language as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('language, topics, email_notifications')
        .eq('id', user.id)
        .single()

      if (data) {
        setLanguage(data.language || 'hungarian')
        setTopics((data.topics || []).join(', '))
        setEmailNotifications(data.email_notifications ?? true)
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
      .slice(0, 12)

    const { error } = await supabase
      .from('profiles')
      .update({ 
        language, 
        topics: topicsArray,
        email_notifications: emailNotifications 
      })
      .eq('id', user.id)

    if (!error) {
      // Újrageneráljuk a legutóbbi digestet az új nyelven
      await fetch('/api/digest', { method: 'POST' })
      window.location.reload()
    } else {
      setMessage(error.message)
    }
    setSaving(false)
  }

  if (loading) return <p className="p-8">{t.loading}</p>

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t.settings}</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">{t.appLanguage}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border p-2 w-full rounded"
        >
          <option value="hungarian">Magyar</option>
          <option value="english">English</option>
          <option value="german">Deutsch</option>
          <option value="spanish">Español</option>
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">{t.topics}</label>
        <input
          type="text"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="AI, tech, science, sport"
          className="border p-2 w-full rounded"
        />
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
          />
          <span>{t.emailNotifications}</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? t.saving : t.save}
      </button>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}