// Közös szövegsegédek az API-knak.
// languageName: a profiles nyelvkódját a Groq prompt nyelvére fordítja.
// clampText: levágja és megtisztítja a felhasználótól vagy a modelltől jövő szöveget.
// escapeHtml: emailbe tett szöveg, hogy ne lehessen HTML-t injektálni.
// clientIp: a korláthoz használt IP. safeNextPath: csak saját oldali átirányítást enged.
// safeHttpsUrl: csak sima https linket enged a forrásoknál. parseModelJson: a Groq JSON válaszát olvassa.
// Ezt hívja meg: api/digest, api/lesson, api/news-detail, api/translate-digests és az auth/callback.
const LANGUAGE_NAMES: Record<string, string> = {
  hungarian: "Hungarian",
  english: "English",
  german: "German",
  french: "French",
  italian: "Italian",
  portuguese: "Portuguese",
  japanese: "Japanese",
  korean: "Korean",
  chinese: "Chinese",
}

// hungarian -> Hungarian, és társai. Ismeretlen kódnál angol.
export function languageName(code: string | null | undefined) {
  return LANGUAGE_NAMES[code || ""] || "English"
}

// Vezérlőkarakterek kiszedése, szóközök összehúzása, max hossz.
export function clampText(input: unknown, max: number) {
  return String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

// Email HTML-be kerülő szöveg ártalmatlanítása.
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;")
}

// A hívó IP-je a Vercel fejléceiből, a korláthoz.
export function clientIp(request: Request) {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

// Átirányítás csak / kezdetű saját útvonalra mehet, külső címre nem.
export function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return "/"
  }
  return next
}

// Forráslink: csak https, felhasználónév és jelszó nélkül.
export function safeHttpsUrl(value: unknown) {
  try {
    const url = new URL(String(value))
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

// A Groq szöveges JSON válaszát objektummá alakítja. Hibás válasznál null.
export function parseModelJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
