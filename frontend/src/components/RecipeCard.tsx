import { Clock, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Recipe } from '../lib/types'
import { ksh } from '../lib/format'
import { Tag } from './ui'

export default function RecipeCard({ r, action }: { r: Recipe; action?: React.ReactNode }) {
  const tags = r.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)
  return (
    <div className="card group flex flex-col transition hover:-translate-y-1 hover:shadow-lift">
      <Link to={`/recipes/${r.id}`} className="flex flex-1 flex-col">
        <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-forest-50 to-forest-100 text-5xl transition group-hover:scale-[1.02]">{r.emoji}</div>
        <h3 className="font-display text-base font-extrabold leading-snug text-ink">{r.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{r.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        <div className="mt-auto flex items-center justify-between pt-4 text-sm">
          <span className="font-bold text-forest">{ksh(r.cost)} <span className="font-normal text-gray-400">/ person</span></span>
          <span className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-sun" />{Math.round(r.calories)}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.prepMinutes}m</span>
          </span>
        </div>
      </Link>
      {action && <div className="mt-3 border-t border-gray-100 pt-3">{action}</div>}
    </div>
  )
}
