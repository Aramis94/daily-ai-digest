'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
      <div className="flex gap-6">
        <Link href="/" className="font-bold text-lg">Daily Digest</Link>
        <Link href="/" className="text-gray-600 hover:text-black">Főoldal</Link>
        <Link href="/settings" className="text-gray-600 hover:text-black">Beállítások</Link>
        <Link href="/history" className="text-gray-600 hover:text-black">Előzmények</Link>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-red-600 hover:text-red-800"
      >
        Kijelentkezés
      </button>
    </nav>
  )
}