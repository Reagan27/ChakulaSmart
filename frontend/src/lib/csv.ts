// Small CSV reader for people imports (handles quotes, commas/semicolons/tabs, BOM, header detection).

export interface ImportRow { fullName: string; email: string; phone: string; notes: string; goalNote: string }

function splitLine(line: string, d: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === d) { out.push(cur); cur = '' } else cur += c
  }
  out.push(cur)
  return out.map((x) => x.trim())
}

/** Splits into records, keeping newlines that sit inside quotes. */
function records(text: string): string[] {
  const rows: string[] = []
  let cur = ''
  let q = false
  for (const c of text.replace(/^﻿/, '')) {
    if (c === '"') q = !q
    if ((c === '\n' || c === '\r') && !q) { if (cur.trim()) rows.push(cur); cur = '' } else cur += c
  }
  if (cur.trim()) rows.push(cur)
  return rows
}

const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
const FIELD: Record<string, keyof ImportRow> = {
  name: 'fullName', fullname: 'fullName', clientname: 'fullName', customername: 'fullName',
  email: 'email', emailaddress: 'email', mail: 'email',
  phone: 'phone', mobile: 'phone', tel: 'phone', telephone: 'phone', phonenumber: 'phone', whatsapp: 'phone',
  notes: 'notes', note: 'notes', comments: 'notes',
  goal: 'goalNote', goals: 'goalNote', goalnote: 'goalNote',
}

export function parseCsv(text: string): ImportRow[] {
  const recs = records(text)
  if (recs.length === 0) return []
  const head = recs[0]
  const d = [',', ';', '\t'].reduce((best, c) => (head.split(c).length > head.split(best).length ? c : best), ',')
  const first = splitLine(head, d)
  const hasHeader = !first.some((c) => c.includes('@'))
  const order: (keyof ImportRow)[] = ['fullName', 'email', 'phone', 'notes', 'goalNote']
  const cols: (keyof ImportRow | null)[] = hasHeader ? first.map((h) => FIELD[key(h)] ?? null) : order
  return recs.slice(hasHeader ? 1 : 0).map((r) => {
    const cells = splitLine(r, d)
    const row: ImportRow = { fullName: '', email: '', phone: '', notes: '', goalNote: '' }
    cols.forEach((c, i) => { if (c) row[c] = cells[i] ?? '' })
    return row
  })
}

export const CSV_TEMPLATE = 'name,email,phone,notes,goal\n"Wanjiku Kamau",wanjiku@example.com,0712345678,"Two children under 10","Balanced family meals within KSh 600/day"\n'

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
