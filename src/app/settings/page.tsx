'use client'

// Beállítások. A profiles tábla nyelv, témák és email mezőit menti.
// Mentés után mindig meghívja a /api/digest végpontot, tehát új híreket generál.
// Az összes előzmény törlése csak a digesteket viszi. A profil visszaállítása a témákat és a pontokat is alapra teszi.
// Ezt hívja: src/lib/supabase/client.ts, src/lib/translations.ts és POST /api/digest.
// Ezt hívja meg: a menü Beállítások linkje.


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
    // A mentett nyelv, témák és email kapcsoló betöltése.
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
        setLanguage(data.language === 'spanish' ? 'hungarian' : (data.language || 'hungarian'))
        setTopics((data.topics || []).join(', '))
        setEmailNotifications(data.email_notifications ?? true)
      }
      setLoading(false)
    }
    loadProfile()
  }, [supabase, router])

  // Profil mentése, majd új digest generálása és az oldal újratöltése.
  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const topicsArray = topics
      .split(',')
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0)
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
      await fetch('/api/digest', { method: 'POST' })
      window.location.reload()
    } else {
      setMessage(error.message)
    }
    setSaving(false)
  }

  // Csak az előzményeket törli. A témák és a kategóriapontok megmaradnak.
  const deleteAllHistory = async () => {
    if (!window.confirm(t.deleteAllConfirm)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('daily_digests').delete().eq('user_id', user.id)
    setMessage(error ? error.message : t.historyEmpty)
  }

  // Előzmények törlése, témák és pontok ürítése, tanulási nyelv magyar, szint A2. Az app nyelve marad.
  const resetProfile = async () => {
    if (!window.confirm(t.resetConfirm)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: deleteError } = await supabase.from('daily_digests').delete().eq('user_id', user.id)
    if (deleteError) {
      setMessage(deleteError.message)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        topics: [],
        topic_prefs: {},
        learning_language: 'hungarian',
        language_level: 'A2',
      })
      .eq('id', user.id)

    if (error) {
      setMessage(error.message)
      return
    }

    window.location.href = '/'
  }

  if (loading) {
    return <p className="mx-auto max-w-lg px-5 py-16 text-sm text-[#8a8176]">{t.loading}</p>
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-10 sm:px-8">
      <h1 className="font-display text-4xl tracking-tight">{t.settings}</h1>

      <div className="mt-8 space-y-6 rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6 sm:p-8">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#5e574e]">{t.appLanguage}</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2.5"
          >
            <option value="hungarian">Magyar</option>
            <option value="english">English</option>
            <option value="german">Deutsch</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#5e574e]">{t.topics}</label>
          <input
            type="text"
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="AI, tech, science, sport"
            className="w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2.5"
          />
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-[#f3eee6] px-4 py-3">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm leading-relaxed">{t.emailNotifications}</span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[#1c1915] px-5 py-2.5 text-sm font-medium text-[#f6f1e8] disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>

        {message && <p className="text-sm text-[#8a4b32]">{message}</p>}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={deleteAllHistory}
          className="rounded-full border border-[#e4d9c8] bg-white px-5 py-2.5 text-sm"
        >
          {t.deleteAll}
        </button>
        <button
          type="button"
          onClick={resetProfile}
          className="rounded-full border border-[#e7c7b8] bg-[#fff7f3] px-5 py-2.5 text-sm text-[#8a4b32]"
        >
          {t.resetProfile}
        </button>
      </div>
    </div>
  )
}