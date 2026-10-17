// Valódi cikkek a Google News RSS-ből. A modell nem talál ki linket: a cím, a kiadó és az URL innen jön.
// Ezt hívja: src/app/api/digest/route.ts.

import { clampText, safeHttpsUrl } from "@/lib/text"

export type RealArticle = {
  title: string
  link: string
  excerpt: string
  sourceName: string
  theme: string
  themeKey: string
  searchUrl: string
}

type Edition = { hl: string; gl: string; ceid: string }
type Topic = { key: string; hungarian: string; english: string; german: string }

const EDITIONS: Record<string, Edition> = {
  hungarian: { hl: "hu", gl: "HU", ceid: "HU:hu" },
  english: { hl: "en", gl: "US", ceid: "US:en" },
  german: { hl: "de", gl: "DE", ceid: "DE:de" },
}

const TOPICS: Topic[] = [
  { key: "nature", hungarian: "természet", english: "nature", german: "Natur" },
  { key: "history", hungarian: "történelem", english: "history", german: "Geschichte" },
  { key: "space", hungarian: "űrkutatás", english: "space", german: "Weltraum" },
  { key: "food", hungarian: "ételek", english: "food", german: "Essen" },
  { key: "music", hungarian: "zene", english: "music", german: "Musik" },
  { key: "sport", hungarian: "sport", english: "sport", german: "Sport" },
  { key: "cities", hungarian: "városok", english: "cities", german: "Städte" },
  { key: "animals", hungarian: "állatok", english: "animals", german: "Tiere" },
  { key: "health", hungarian: "egészség", english: "health", german: "Gesundheit" },
  { key: "oceans", hungarian: "óceán", english: "ocean", german: "Ozean" },
  { key: "architecture", hungarian: "építészet", english: "architecture", german: "Architektur" },
  { key: "inventions", hungarian: "találmányok", english: "inventions", german: "Erfindungen" },
  { key: "climate", hungarian: "klíma", english: "climate", german: "Klima" },
  { key: "culture", hungarian: "kultúra", english: "culture", german: "Kultur" },
  { key: "science", hungarian: "tudomány", english: "science", german: "Wissenschaft" },
]

function edition(language: string | null): Edition {
  return EDITIONS[language || ""] || EDITIONS.english
}

function label(topic: Topic, language: string | null) {
  if (language === "hungarian") return topic.hungarian
  if (language === "german") return topic.german
  return topic.english
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))
  return match ? decodeXml(match[1]) : ""
}

export function parseGoogleNews(xml: string) {
  return xml.split(/<item\b/i).slice(1).map((block) => {
    const source = block.match(/<source\b[^>]*>([\s\S]*?)<\/source>/i)
    const sourceName = clampText(source ? decodeXml(source[1]) : "", 80)
    const link = safeHttpsUrl(tag(block, "link")) || safeHttpsUrl(tag(block, "guid"))
    let title = clampText(tag(block, "title"), 180)
    if (sourceName && title.toLowerCase().endsWith(sourceName.toLowerCase())) {
      title = clampText(title.slice(0, -sourceName.length).replace(/[\s\-–—|:]+$/, ""), 180)
    }
    return {
      title,
      link,
      excerpt: clampText(tag(block, "description"), 500),
      sourceName,
    }
  }).filter((item) => item.title && item.link)
}

export function topicKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "topic"
}

function searchUrl(query: string, language: string | null) {
  const place = edition(language)
  const params = new URLSearchParams({
    q: query,
    hl: place.hl,
    gl: place.gl,
    ceid: place.ceid,
  })
  return `https://news.google.com/search?${params.toString()}`
}

async function fetchFeed(query: string, language: string | null) {
  const place = edition(language)
  const params = new URLSearchParams({
    q: query,
    hl: place.hl,
    gl: place.gl,
    ceid: place.ceid,
  })
  const response = await fetch(`https://news.google.com/rss/search?${params.toString()}`, {
    headers: { "User-Agent": "TudasMindenNapra/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  })
  if (!response.ok) return []
  return parseGoogleNews(await response.text())
}

function topicChoices(
  language: string | null,
  topics: string[],
  prefs: Record<string, number>,
  recent: string[],
  excluded: string[],
) {
  const recentSet = new Set(recent)
  const blocked = (key: string, query: string) => excluded.some((word) => {
    const clean = word.toLowerCase()
    return clean && (`${key} ${query}`.toLowerCase().includes(clean))
  })
  const custom = topics.map((topic) => ({
    key: topicKey(topic),
    query: topic,
    label: topic,
    score: prefs[topicKey(topic)] || prefs[topic.toLowerCase()] || 0,
  }))
  const pool = TOPICS.map((topic) => ({
    key: topic.key,
    query: label(topic, language),
    label: label(topic, language),
    score: prefs[topic.key] || 0,
  }))
  const rows = (custom.length ? custom : pool)
    .filter((topic) => !blocked(topic.key, topic.query))
    .filter((topic) => topic.score > 0 || !recentSet.has(topic.key))
    .sort((a, b) => b.score - a.score || Math.random() - 0.5)
  const fallback = pool
    .filter((topic) => !blocked(topic.key, topic.query))
    .sort((a, b) => b.score - a.score || Math.random() - 0.5)
  const chosen = []
  const seen = new Set<string>()
  for (const topic of [...rows, ...fallback]) {
    if (seen.has(topic.key) || chosen.length >= 8) continue
    seen.add(topic.key)
    chosen.push(topic)
  }
  return chosen
}

export async function loadRealArticles(
  language: string | null,
  topics: string[],
  prefs: Record<string, number>,
  recentCategories: string[],
  recentTitles: string[],
  excluded: string[] = [],
) {
  const seenTitles = new Set(recentTitles.map((title) => title.toLowerCase()))
  const articles: RealArticle[] = []
  const feeds = await Promise.all(topicChoices(language, topics, prefs, recentCategories, excluded).map(async (topic) => ({
    topic,
    items: await fetchFeed(topic.query, language).catch(() => []),
  })))

  for (const feed of feeds) {
    if (articles.length >= 5) break
    const item = feed.items.find((candidate) => !seenTitles.has(candidate.title.toLowerCase()))
    if (!item?.link) continue
    seenTitles.add(item.title.toLowerCase())
    articles.push({
      title: item.title,
      link: item.link,
      excerpt: item.excerpt,
      sourceName: item.sourceName || "Google News",
      theme: feed.topic.label,
      themeKey: feed.topic.key,
      searchUrl: searchUrl(feed.topic.query, language),
    })
  }
  return articles
}
