'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const translations = {
  hu: {
    title: 'Bejelentkezés',
    subtitle: 'A napi hírek és a nyelvlecke itt vár.',
    email: 'Email',
    password: 'Jelszó',
    login: 'Bejelentkezés',
    signup: 'Regisztráció',
    loginSuccess: 'Sikeres bejelentkezés!',
    signupSuccess: 'Regisztráció sikeres! Nézd meg az emailedet.',
  },
  en: {
    title: 'Login',
    subtitle: 'Your daily news and language lesson are here.',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    signup: 'Sign up',
    loginSuccess: 'Login successful!',
    signupSuccess: 'Sign up successful! Check your email.',
  },
  de: {
    title: 'Anmelden',
    subtitle: 'Deine täglichen Nachrichten und die Sprachlektion warten hier.',
    email: 'E-Mail',
    password: 'Passwort',
    login: 'Anmelden',
    signup: 'Registrieren',
    loginSuccess: 'Erfolgreich angemeldet!',
    signupSuccess: 'Registrierung erfolgreich! Überprüfe deine E-Mail.',
  },
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [lang, setLang] = useState<'hu' | 'en' | 'de'>('hu')
  const router = useRouter()
  const supabase = createClient()
  const t = translations[lang]

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
    } else {
      setMessage(t.loginSuccess)
      router.push('/')
    }
  }

  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : t.signupSuccess)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <p className="font-display text-center text-3xl tracking-tight">Daily AI Digest</p>
        <p className="mt-2 text-center text-sm text-[#6b645b]">{t.subtitle}</p>

        <div className="mt-8 rounded-3xl border border-[#e4d9c8] bg-[#fffaf3] p-6 shadow-[0_20px_50px_-30px_rgba(28,25,21,0.45)] sm:p-8">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="font-display text-2xl">{t.title}</h1>
            <div className="flex gap-1 rounded-full bg-[#efe7db] p-1">
              {(['hu', 'en', 'de'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    lang === code
                      ? 'bg-[#1c1915] text-[#f6f1e8]'
                      : 'text-[#5e574e] hover:text-[#1c1915]'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <input
            type="email"
            placeholder={t.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-xl border border-[#e4d9c8] bg-white px-3 py-2.5"
          />

          <input
            type="password"
            placeholder={t.password}
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
              {t.login}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              className="rounded-full border border-[#d9cfc0] bg-white px-4 py-2.5 text-sm"
            >
              {t.signup}
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-[#5e574e]">{message}</p>}
        </div>
      </div>
    </div>
  )
}
