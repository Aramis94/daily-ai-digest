'use client'

// Felső menü. Csak bejelentkezve látszik, a /login oldalon nem.
// Oldalváltáskor lekéri a profiles.language mezőt, és arra fordítja a menüt.
// A böngészőfül címét is az app nevére állítja.


import { createClient } from '@/lib/supabase/client'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { translations } from '@/lib/translations'

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [appLanguage, setAppLanguage] = useState('hungarian')

  const t = translations[appLanguage as keyof typeof translations] || translations.hungarian

  // Oldalváltáskor újraolvassa a profiles.language mezőt.
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
  }, [pathname])
  
  // A böngészőfül címe az aktuális nyelv appName szövege.
  useEffect(() => {
  document.title = t.appName
}, [t.appName])

  // Kijelentkezés: Supabase signOut, utána a login oldal.
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (pathname === '/login') return null

  const links = [
    { href: '/', label: t.home },
    { href: '/history', label: t.history },
    { href: '/settings', label: t.settings },
  ]

  return (
    <nav className="sticky top-0 z-20 border-b border-[#e4d9c8]/80 bg-[#f3eee6]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
        <Link href="/" className="font-display text-xl tracking-tight text-[#1c1915]">
          {t.appName}
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? 'bg-[#1c1915] text-[#f6f1e8]'
                    : 'text-[#5e574e] hover:bg-[#efe7db] hover:text-[#1c1915]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="ml-1 rounded-full px-3 py-1.5 text-sm text-[#8a4b32] hover:bg-[#f3e4d8]"
          >
            {t.logout}
          </button>
        </div>
      </div>
    </nav>
  )
}
