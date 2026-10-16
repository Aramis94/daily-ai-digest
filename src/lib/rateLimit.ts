import { rateLimit } from '@/lib/rateLimit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 5, 60_000)) { // 5 kérés / perc
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }


const requests = new Map<string, number[]>()

export function rateLimit(identifier: string, limit = 10, windowMs = 60_000) {
  const now = Date.now()
  const timestamps = requests.get(identifier) || []
  const recent = timestamps.filter(t => now - t < windowMs)

  if (recent.length >= limit) {
    return false
  }

  recent.push(now)
  requests.set(identifier, recent)
  return true
}