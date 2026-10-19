// Napi szokás. A napok a profiles.topic_prefs.__activity mezőben vannak, külön tábla nélkül.
// A streak él, ha aznap digestet nézett vagy leckét kért. Egy kihagyott napra havonta két automatikus mentés van.
// Ezt hívja: src/app/page.tsx és az api/streak-reminder.

export type Activity = {
  activity_date: string
  did_view_digest: boolean
  did_complete_lesson: boolean
  frozen: boolean
}

export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function budapestDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export function dayCounts(row: Activity | undefined, kind: "any" | "lesson") {
  if (!row) return false
  if (kind === "lesson") return row.did_complete_lesson || row.frozen
  return row.did_view_digest || row.did_complete_lesson || row.frozen
}

export function countStreak(rows: Activity[], today: string, kind: "any" | "lesson") {
  const byDate = new Map(rows.map((row) => [row.activity_date, row]))
  let cursor = dayCounts(byDate.get(today), kind) ? today : addDays(today, -1)
  if (!dayCounts(byDate.get(cursor), kind)) return 0
  let count = 0
  while (dayCounts(byDate.get(cursor), kind)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

export function weekCount(rows: Activity[], today: string) {
  const [year, month, day] = today.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  const start = addDays(today, -((date.getDay() + 6) % 7))
  let count = 0
  for (let index = 0; index < 7; index += 1) {
    const current = addDays(start, index)
    if (current > today) break
    if (dayCounts(rows.find((row) => row.activity_date === current), "any")) count += 1
  }
  return count
}

export function freezesUsed(rows: Activity[], today: string) {
  const month = today.slice(0, 7)
  return rows.filter((row) => row.frozen && row.activity_date.startsWith(month)).length
}

export function readActivity(raw: unknown): Activity[] {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {}
  const bag = obj.__activity && typeof obj.__activity === "object" ? obj.__activity as Record<string, { view?: boolean; lesson?: boolean; frozen?: boolean }> : {}
  return Object.entries(bag)
    .filter(([date]) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .map(([date, value]) => ({
      activity_date: date,
      did_view_digest: Boolean(value?.view),
      did_complete_lesson: Boolean(value?.lesson),
      frozen: Boolean(value?.frozen),
    }))
}

export function saveActivity(raw: unknown, rows: Activity[]) {
  const obj = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {}
  const cutoff = addDays(localDate(), -60)
  const bag: Record<string, { view: boolean; lesson: boolean; frozen: boolean }> = {}
  for (const row of rows) {
    if (row.activity_date < cutoff) continue
    bag[row.activity_date] = {
      view: row.did_view_digest,
      lesson: row.did_complete_lesson,
      frozen: row.frozen,
    }
  }
  obj.__activity = bag
  return obj
}

export function withToday(rows: Activity[], today: string, flag: "did_view_digest" | "did_complete_lesson") {
  const next = rows.map((row) => ({ ...row }))
  const current = next.find((row) => row.activity_date === today)
  if (!current) {
    next.push({
      activity_date: today,
      did_view_digest: flag === "did_view_digest",
      did_complete_lesson: flag === "did_complete_lesson",
      frozen: false,
    })
  } else {
    current[flag] = true
  }
  return next
}

export function withFreeze(rows: Activity[], today: string) {
  const byDate = new Map(rows.map((row) => [row.activity_date, row]))
  const yesterday = addDays(today, -1)
  const before = addDays(today, -2)
  if (dayCounts(byDate.get(yesterday), "any") || !dayCounts(byDate.get(before), "any") || freezesUsed(rows, today) >= 2) {
    return { rows, changed: false }
  }
  return {
    changed: true,
    rows: [...rows, { activity_date: yesterday, did_view_digest: false, did_complete_lesson: false, frozen: true }],
  }
}
