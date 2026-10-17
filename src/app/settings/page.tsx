'use client'

// Beállítások. A profiles tábla nyelv, témák és email mezőit menti.
// Mentés után csak akkor hívja a /api/digest végpontot, ha a nyelv vagy a témák változtak.
// Az összes előzmény törlése csak a digesteket viszi. A profil visszaállítása a témákat és a pontokat is alapra teszi.
// Ezt hívja: src/lib/supabase/client.ts, src/lib/translations.ts és POST /api/digest.
// Ezt hívja meg: a menü Beállítások linkje.


import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { translations } from '@/lib/translations'
import { interestsFromTopics, readPersonalization, savePersonalization, type Interest, type Level } from '@/lib/personalization'

export default function SettingsPage() {
  const [language, setLanguage] = useState('hungarian')
  const [interests, setInterests] = useState<Interest[]>([])
  const [excluded, setExcluded] = useState<string[]>([])
  const [draftTopic, setDraftTopic] = useState('')
  const [draftLevel, setDraftLevel] = useState<Level>('intermediate')
  const [draftWeight, setDraftWeight] = useState<1 | 2 | 3>(2)
  const [draftExcluded, setDraftExcluded] = useState('')
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [savedLanguage, setSavedLanguage] = useState('hungarian')
  const [savedKey, setSavedKey] = useState('')
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
        .select('language, topics, email_notifications, topic_prefs')
        .eq('id', user.id)
        .single()

      if (data) {
        const nextLanguage = data.language === 'spanish' ? 'hungarian' : (data.language || 'hungarian')
        const personal = readPersonalization(data.topic_prefs)
        const nextInterests = personal.interests.length ? personal.interests : interestsFromTopics(data.topics)
        setLanguage(nextLanguage)
        setSavedLanguage(nextLanguage)
        setInterests(nextInterests)
        setExcluded(personal.excluded)
        setSavedKey(JSON.stringify({ interests: nextInterests, excluded: personal.excluded }))
        setEmailNotifications(data.email_notifications ?? true)
      }
      setLoading(false)
    }
    loadProfile()
  }, [supabase, router])

  // Profil mentése. Új digest csak nyelv- vagy témaváltozáskor készül.
  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const contentChanged = language !== savedLanguage || JSON.stringify({ interests, excluded }) !== savedKey
    const { data: profile } = await supabase
      .from('profiles')
      .select('topic_prefs')
      .eq('id', user.id)
      .single()
    const personal = readPersonalization(profile?.topic_prefs)

    const { error } = await supabase
      .from('profiles')
      .update({
        language,
        topics: interests.map((item) => item.topic),
        email_notifications: emailNotifications,
        topic_prefs: savePersonalization(profile?.topic_prefs, personal.scores, interests, excluded, personal.feedback),
      })
      .eq('id', user.id)

    if (!error) {
      if (contentChanged) await fetch('/api/digest', { method: 'POST' })
      window.location.reload()
    } else {
      setMessage(error.message)
    }
    setSaving(false)
  }

  // Csak a nem kedvenc híreket törli. A csillagozottak megmaradnak.
  const deleteAllHistory = async () => {
    if (!window.confirm(t.favoritesKept)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('daily_digests').select('id, news').eq('user_id', user.id)
    for (const row of data || []) {
      const items = row.news?.items || []
      const favorites = items.filter((item: { favorite?: boolean }) => item.favorite)
      if (favorites.length === 0) {
        await supabase.from('daily_digests').delete().eq('id', row.id)
      } else if (favorites.length !== items.length) {
        await supabase.from('daily_digests').update({ news: { ...row.news, items: favorites } }).eq('id', row.id)
      }
    }
    setMessage(t.favoritesKept)
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
          <div className="space-y-2">
            {interests.map((item) => (
              <div key={item.topic} className="flex flex-wrap items-center gap-2">
                <span className="min-w-24 flex-1 text-sm">{item.topic}</span>
                <select
                  value={item.level}
                  onChange={(e) => setInterests((prev) => prev.map((row) => row.topic === item.topic ? { ...row, level: e.target.value as Level } : row))}
                  className="rounded-xl border border-[#e4d9c8] bg-white px-2 py-1.5 text-sm"
                >
                  <option value="beginner">{t.beginner}</option>
                  <option value="intermediate">{t.intermediate}</option>
                  <option value="expert">{t.expert}</option>
                </select>
                <select
                  value={item.weight}
                  onChange={(e) => setInterests((prev) => prev.map((row) => row.topic === item.topic ? { ...row, weight: Number(e.target.value) as 1 | 2 | 3 } : row))}
                  className="rounded-xl border border-[#e4d9c8] bg-white px-2 py-1.5 text-sm"
                >
                  <option value={1}>{t.weightLow}</option>
                  <option value={2}>{t.weightMid}</option>
                  <option value={3}>{t.weightHigh}</option>
                </select>
                <button type="button" onClick={() => setInterests((prev) => prev.filter((row) => row.topic !== item.topic))} className="text-sm text-[#8a4b32]">
                  {t.remove}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={draftTopic}
              onChange={(e) => setDraftTopic(e.target.value)}
              placeholder={t.addTopic}
              className="min-w-32 flex-1 rounded-xl border border-[#e4d9c8] bg-white px-3 py-2 text-sm"
            />
            <select value={draftLevel} onChange={(e) => setDraftLevel(e.target.value as Level)} className="rounded-xl border border-[#e4d9c8] bg-white px-2 py-2 text-sm">
              <option value="beginner">{t.beginner}</option>
              <option value="intermediate">{t.intermediate}</option>
              <option value="expert">{t.expert}</option>
            </select>
            <select value={draftWeight} onChange={(e) => setDraftWeight(Number(e.target.value) as 1 | 2 | 3)} className="rounded-xl border border-[#e4d9c8] bg-white px-2 py-2 text-sm">
              <option value={1}>{t.weightLow}</option>
              <option value={2}>{t.weightMid}</option>
              <option value={3}>{t.weightHigh}</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const topic = draftTopic.trim().slice(0, 40)
                if (!topic || interests.some((item) => item.topic.toLowerCase() === topic.toLowerCase()) || interests.length >= 12) return
                setInterests((prev) => [...prev, { topic, level: draftLevel, weight: draftWeight }])
                setDraftTopic('')
              }}
              className="rounded-full border border-[#e4d9c8] bg-white px-3 py-2 text-sm"
            >
              {t.addTopic}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#5e574e]">{t.excluded}</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {excluded.map((item) => (
              <button key={item} type="button" onClick={() => setExcluded((prev) => prev.filter((row) => row !== item))} className="rounded-full bg-[#f3e4d8] px-3 py-1 text-sm text-[#8a4b32]">
                {item} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={draftExcluded}
              onChange={(e) => setDraftExcluded(e.target.value)}
              className="flex-1 rounded-xl border border-[#e4d9c8] bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const topic = draftExcluded.trim().slice(0, 40)
                if (!topic || excluded.some((item) => item.toLowerCase() === topic.toLowerCase())) return
                setExcluded((prev) => [...prev, topic].slice(0, 12))
                setDraftExcluded('')
              }}
              className="rounded-full border border-[#e4d9c8] bg-white px-3 py-2 text-sm"
            >
              {t.addTopic}
            </button>
          </div>
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