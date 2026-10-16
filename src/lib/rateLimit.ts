const requests = new Map<string, number[]>()

export function rateLimit(identifier: string, limit = 10, windowMs = 60_000) {
  const now = Date.now()

  if (requests.size > 5000) {
    for (const [key, stamps] of requests) {
      if (stamps.every((t) => now - t >= windowMs)) requests.delete(key)
    }
    if (requests.size > 5000) requests.clear()
  }

  const recent = (requests.get(identifier) || []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    requests.set(identifier, recent)
    return false
  }

  recent.push(now)
  requests.set(identifier, recent)
  return true
}
