'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { translations } from '@/lib/translations'

export default function Navbar() {
  const router = useRouter()
  const supabase = createClient()
  const [appLanguage, setAppLanguage] = useState('hungarian')

  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  useEffect(() => {
    const loadLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .single()

      if (data?.language) {
        setAppLanguage(data.language)
      }
    }
    loadLanguage()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="bg-white border-b px-6 py-4 flex justify-between items-center">
      <div className="flex gap-6">
        <Link href="/" className="font-bold text-lg">{t.appName}</Link>
        <Link href="/" className="text-gray-600 hover:text-black">{t.home}</Link>
        <Link href="/settings" className="text-gray-600 hover:text-black">{t.settings}</Link>
        <Link href="/history" className="text-gray-600 hover:text-black">{t.history}</Link>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-red-600 hover:text-red-800"
      >
        {t.logout}
      </button>
    </nav>
  )
}