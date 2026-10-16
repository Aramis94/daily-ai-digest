'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClient()

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setMessage(error ? error.message : 'Sikeres bejelentkezés!')
  }

  async function handleSignUp() {
    const { error } = await supabase.auth.signUp({ email, password })
    setMessage(error ? error.message : 'Regisztráció sikeres! Nézd meg az emailedet.')
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bejelentkezés</h1>
      
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border p-2 w-full mb-3 rounded"
      />
      
      <input
        type="password"
        placeholder="Jelszó"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border p-2 w-full mb-4 rounded"
      />
      
      <div className="flex gap-3">
        <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded">
          Bejelentkezés
        </button>
        <button onClick={handleSignUp} className="bg-gray-300 px-4 py-2 rounded">
          Regisztráció
        </button>
      </div>
      
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}