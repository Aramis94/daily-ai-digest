// A személyes beállítások a profiles.topic_prefs mezőben vannak, a kategóriapontok mellett.
// __interests: témák szintje és súlya. __excluded: tiltott témák. __feedback: az utolsó 30 👍/👎.
// Ezt hívja: a beállítások, a főoldal és az api/digest.

import { clampText } from "@/lib/text"

export type Level = "beginner" | "intermediate" | "expert"
export type Interest = { topic: string; level: Level; weight: 1 | 2 | 3 }
export type Feedback = {
  title: string
  theme?: string
  themeKey?: string
  vote: 1 | -1
  reason?: string
}

const levels: Level[] = ["beginner", "intermediate", "expert"]

export function readPersonalization(raw: unknown) {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const scores: Record<string, number> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith("__") && typeof value === "number") scores[key] = value
  }

  const interests = (Array.isArray(obj.__interests) ? obj.__interests : [])
    .map(asInterest)
    .filter((item): item is Interest => item !== null)
    .slice(0, 12)

  const excluded = (Array.isArray(obj.__excluded) ? obj.__excluded : [])
    .map((item) => clampText(item, 40))
    .filter(Boolean)
    .slice(0, 12)

  const feedback = (Array.isArray(obj.__feedback) ? obj.__feedback : [])
    .map(asFeedback)
    .filter((item): item is Feedback => item !== null)
    .slice(0, 30)

  return { scores, interests, excluded, feedback }
}

export function interestsFromTopics(topics: string[] | null | undefined): Interest[] {
  return (topics || [])
    .map((topic) => clampText(topic, 40))
    .filter(Boolean)
    .slice(0, 12)
    .map((topic) => ({ topic, level: "intermediate" as const, weight: 2 as const }))
}

export function savePersonalization(
  raw: unknown,
  scores: Record<string, number>,
  interests: Interest[],
  excluded: string[],
  feedback: Feedback[],
) {
  const current = readPersonalization(raw)
  return {
    ...current.scores,
    ...scores,
    __interests: interests.slice(0, 12),
    __excluded: excluded.map((item) => clampText(item, 40)).filter(Boolean).slice(0, 12),
    __feedback: (feedback.length ? feedback : current.feedback).slice(0, 30),
  }
}

export function feedbackPrompt(feedback: Feedback[]) {
  const liked = feedback.filter((item) => item.vote > 0).slice(0, 8)
  const disliked = feedback.filter((item) => item.vote < 0).slice(0, 8)
  const line = (item: Feedback) => `- ${item.title}${item.reason ? ` (${item.reason})` : ""}`
  return `Recent feedback, use it only as taste, not as facts:
Liked:
${liked.map(line).join("\n") || "none"}
Disliked, avoid this style:
${disliked.map(line).join("\n") || "none"}`
}

function asInterest(value: unknown): Interest | null {
  if (!value || typeof value !== "object") return null
  const row = value as { topic?: unknown; level?: unknown; weight?: unknown }
  const topic = clampText(row.topic, 40)
  if (!topic) return null
  const level = levels.includes(row.level as Level) ? row.level as Level : "intermediate"
  const weight = row.weight === 1 || row.weight === 3 ? row.weight : 2
  return { topic, level, weight }
}

function asFeedback(value: unknown): Feedback | null {
  if (!value || typeof value !== "object") return null
  const row = value as { title?: unknown; theme?: unknown; themeKey?: unknown; vote?: unknown; reason?: unknown }
  const title = clampText(row.title, 180)
  if (!title || (row.vote !== 1 && row.vote !== -1)) return null
  return {
    title,
    theme: clampText(row.theme, 40),
    themeKey: clampText(row.themeKey, 40).toLowerCase(),
    vote: row.vote,
    reason: clampText(row.reason, 40),
  }
}
