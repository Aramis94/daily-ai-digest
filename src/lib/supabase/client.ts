// Böngészős Supabase kliens. A lapok ezt hívják: bejelentkezés, profil olvasás, digest lista.
// A kulcs a nyilvános anon kulcs. A jogokat a Supabase RLS szabályai korlátozzák.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}