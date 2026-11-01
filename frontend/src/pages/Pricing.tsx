import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useApi } from '../lib/hooks'
import { ErrorBox, Spinner } from '../components/ui'
import { ksh } from '../lib/format'
import type { PlanInfo } from '../lib/types'

const ROLE_LABEL: Record<string, string> = { INDIVIDUAL: 'Individuals & families', NUTRITIONIST: 'Nutritionists', BUSINESS: 'Food businesses' }

export default function Pricing() {
  const { data, error, loading, reload } = useApi<PlanInfo[]>('/public/plans')
  return (
    <div className="container-x py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-4xl font-extrabold">Simple pricing that grows with you</h1>
        <p className="mt-3 text-gray-600">Start free. Upgrade when advanced planning, reports or visibility are worth it to you. Prices are launch hypotheses and may change.</p>
      </div>
      {loading && <Spinner />}
      {error && <div className="mt-8"><ErrorBox message={error} onRetry={reload} /></div>}
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {(data ?? []).map((p) => (
          <div key={p.code} className={`card flex flex-col ${p.price_kes > 0 ? 'ring-2 ring-forest-200' : ''}`}>
            <span className="badge self-start bg-forest-100 text-forest-800">{ROLE_LABEL[p.role]}</span>
            <h3 className="mt-3 font-display text-xl font-extrabold">{p.name}</h3>
            <div className="mt-2"><span className="font-display text-3xl font-extrabold text-forest">{p.price_kes === 0 ? 'Free' : ksh(p.price_kes)}</span>{p.price_kes > 0 && <span className="text-sm text-gray-500"> / month</span>}</div>
            <p className="mt-2 text-sm text-gray-600">{p.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" />{f}</li>)}
            </ul>
            <Link to={`/register?type=${p.role}`} className={`btn mt-6 ${p.price_kes > 0 ? 'btn-primary' : 'btn-ghost'}`}>{p.price_kes > 0 ? 'Choose plan' : 'Start free'}</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
