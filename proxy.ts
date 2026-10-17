// Minden oldalkérés előtt fut. Frissíti a Supabase sütit, és belépés nélkül a /login oldalra küld.
// A /login, /auth és /api útvonalak nyilvánosak maradnak.
// Ezt hívja: közvetlenül a Supabase szerver klienst, nem a src/lib/supabase/server.ts fájlt.
// Ezt hívja meg: a Next.js minden oldal- és API-kérés előtt, a fájl alján lévő matcher szerint.
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Süti frissítés, majd belépés ellenőrzés. Vendéget a loginra küld, a statikus fájlokat a matcher kihagyja.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isPublic = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/api/")

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    const redirect = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie)
    })
    return redirect
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
