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