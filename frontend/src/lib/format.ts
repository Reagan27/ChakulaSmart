export const ksh = (n: number | string | null | undefined) =>
  'KSh ' + Math.round(Number(n ?? 0)).toLocaleString('en-KE')

export const num = (n: number | string | null | undefined, digits = 0) =>
  Number(n ?? 0).toLocaleString('en-KE', { maximumFractionDigits: digits })

/** Local calendar date as YYYY-MM-DD (not UTC, so late-evening Nairobi users get the right day). */
export function isoDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const prettyDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
export const shortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
export const timeAgo = (ts: string) => {
  const s = (Date.now() - new Date(ts).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}

export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const
export const MEAL_LABEL: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack' }
export const MEAL_EMOJI: Record<string, string> = { BREAKFAST: '🌅', LUNCH: '☀️', DINNER: '🌙', SNACK: '🍎' }
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const GOALS: Record<string, string> = {
  EAT_HEALTHY: 'Eat healthier',
  LOSE_WEIGHT: 'Lose weight',
  GAIN_MUSCLE: 'Gain muscle',
  SAVE_MONEY: 'Spend less on food',
  MANAGE_CONDITION: 'Manage a health condition',
}
export function mondayOf(iso: string): string {
  const d = parseISO(iso)
  const dow = (d.getDay() + 6) % 7
  return addDays(iso, -dow)
}
