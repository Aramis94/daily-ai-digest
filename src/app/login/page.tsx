'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const translations = {
  hu: {
    title: 'Bejelentkezés',
    email: 'Email',
    password: 'Jelszó',
    login: 'Bejelentkezés',
    signup: 'Regisztráció',
    loginSuccess: 'Sikeres bejelentkezés!',
    signupSuccess: 'Regisztráció sikeres! Nézd meg az emailedet.',
  },
  en: {
    title: 'Login',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    signup: 'Sign up',
    loginSuccess: 'Login successful!',
    signupSuccess: 'Sign up successful! Check your email.',
  },
  de: {
    title: 'Anmelden',
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
    <div className="p-8 max-w-md mx-auto">
      {/* Nyelvválasztó */}
      <div className="flex justify-end gap-2 mb-6">
        {(['hu', 'en', 'de'] as const).map((code) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`px-3 py-1 text-sm rounded transition ${
              lang === code
                ? 'bg-zinc-800 text-white dark:bg-white dark:text-black'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-6">{t.title}</h1>
      
      <input
        type="email"
        placeholder={t.email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full mb-3 rounded"
      />
      
      <input
        type="password"
        placeholder={t.password}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full mb-4 rounded"
      />
      
      <div className="flex gap-3">
        <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded">
          {t.login}
        </button>
        <button onClick={handleSignUp} className="bg-gray-300 px-4 py-2 rounded">
          {t.signup}
        </button>
      </div>
      
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}