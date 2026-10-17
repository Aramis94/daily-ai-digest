// Napi szokás. A nap a böngésző helyi ideje szerint számít.
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
