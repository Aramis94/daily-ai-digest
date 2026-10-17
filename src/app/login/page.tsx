'use client'

// Belépés és regisztráció. A nyelv gomb a login_lang sütibe ment, és a profiles.language mezőbe is.
// Sikeres belépés után a /api/translate-digests végpont lefordítja a legutóbbi hírt, majd a főoldalra lép.
// Ezt hívja: src/lib/supabase/client.ts, src/lib/translations.ts, POST /api/translate-digests.
// Ezt hívja meg: a proxy.ts, ha nincs belépve, és a Navbar kijelentkezése.


import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { translations } from '@/lib/translations'

const languages = ['hungarian', 'english', 'german'] as const
type AppLanguage = (typeof languages)[number]

// A login_lang süti olvasása. Ismeretlen érték esetén magyar.
function readLoginLanguage(): AppLanguage {
  const match = document.cookie.match(/(?:^|; )login_lang=([^;]+)/)
  const value = match?.[1]
  return languages.includes(value as AppLanguage) ? (value as AppLanguage) : 'hungarian'
}

// A választott nyelv egy évre a böngésző sütijébe kerül.
function saveLoginLanguage(language: AppLanguage) {
  document.cookie = `login_lang=${language}; path=/; max-age=31536000; samesite=lax`
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [lang, setLang] = useState<AppLanguage>('hungarian')
  const supabase = createClient()
  const t = translations[lang]

  useEffect(() => {
    setLang(readLoginLanguage())
  }, [])

  useEffect(() => {
    document.title = t.appName
  }, [t.appName])

  // Nyelvgomb: süti és a login feliratok azonnal váltanak, profil még nem.
  function chooseLanguage(language: AppLanguage) {
    saveLoginLanguage(language)
    setLang(language)
  }

  // Belépés, nyelv mentése a profiles táblába, legutóbbi hír fordítása, majd teljes újratöltés a főoldalra.
  async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setMessage(error?.message || 'Login failed')
      return
    }

    saveLoginLanguage(lang)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ language: lang })
      .eq('id', data.user.id)

    if (updateError) {
      setMessage(updateError.message)
      return
    }

    const translated = await fetch('/api/translate-digests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latestOnly: true }),
    })
    if (!translated.ok) {
      const body = await translated.text()
      setMessage(`${translated.status}: ${body}`)
      return
    }

    window.location.href = '/'
  }

  // Új fiók. Ha a Supabase azonnal ad felhasználót, a nyelvet is elmenti. Emailes megerősítés kellhet.
  async function handleSignUp() {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMessage(error.message)
      return
    }

    saveLoginLanguage(lang)

    if (data.user) {
      await supabase.from('profiles').update({ language: lang }).eq('id', data.user.id)
    }

    setMessage(t.signupSuccess)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <p className="font-display text-center text-3xl tracking-tight">{t.appName}</p>
        <p className="mt-2 text-center text-sm text-[#6b645b]">{t.loginSubtitle}</p>

        <div className="mt-8 rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6 shadow-[0_20px_50px_-30px_rgba(28,25,21,0.45)] sm:p-8">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="font-display text-2xl">{t.loginTitle}</h1>
            <div className="flex gap-1 rounded-full bg-[#efe7db] p-1">
              {languages.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => chooseLanguage(code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    lang === code
                      ? 'bg-[#1c1915] text-[#f6f1e8]'
                      : 'text-[#5e574e] hover:text-[#1c1915]'
                  }`}
                >
                  {code === 'hungarian' ? 'HU' : code === 'english' ? 'EN' : 'DE'}
                </button>
              ))}
            </div>
          </div>

          <input
            type="email"
            placeholder={t.loginEmail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2.5"
          />

          <input
            type="password"
            placeholder={t.loginPassword}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-5 w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2.5"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleLogin}
              className="rounded-full bg-[#1c1915] px-4 py-2.5 text-sm font-medium text-[#f6f1e8]"
            >
              {t.loginButton}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="rounded-full border border-[#d9cfc0] bg-white px-4 py-2.5 text-sm"
            >
              {t.signupButton}
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-[#5e574e]">{message}</p>}
        </div>
      </div>
    </div>
  )
}