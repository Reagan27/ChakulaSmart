import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChefHat, ClipboardList, HeartPulse, Leaf, ShoppingBasket, Store, Users, Wallet } from 'lucide-react'
import { PlateArt } from '../components/FoodArt'
import Photo from '../components/Photo'
import RecipeCard from '../components/RecipeCard'
import { useApi } from '../lib/hooks'
import type { Recipe } from '../lib/types'

const ACCOUNTS = [
  {
    type: 'INDIVIDUAL', icon: Users, title: 'Individual / Family', tint: 'from-forest-50 to-forest-100',
    items: ['Track daily meals', 'Get meal suggestions', 'Manage food budgets', 'Generate shopping lists'],
    cta: 'Get started', to: '/register?type=INDIVIDUAL',
  },
  {
    type: 'NUTRITIONIST', icon: HeartPulse, title: 'Nutritionist', tint: 'from-sun-100 to-amber-50',
    items: ['Manage clients', 'Create meal plans', 'Monitor progress', 'Share reports'],
    cta: 'Professional login', to: '/register?type=NUTRITIONIST',
  },
  {
    type: 'BUSINESS', icon: Store, title: 'Food business', tint: 'from-forest-100 to-emerald-50',
    items: ['Manage food offerings', 'Promote food products', 'Reach new customers', 'Explore partnerships'],
    cta: 'Business login', to: '/register?type=BUSINESS',
  },
]

const STEPS = [
  { icon: ClipboardList, t: 'Tell us about you', d: 'Goal, household size, daily budget and any allergies. Takes one minute.' },
  { icon: ChefHat, t: 'Get Kenyan meal ideas', d: 'Suggestions fit your budget, goal and what you ate in the last few days.' },
  { icon: Wallet, t: 'Track food and spend', d: 'Log meals in seconds and see exactly what you have left to spend today.' },
  { icon: ShoppingBasket, t: 'Shop smarter', d: 'Turn your weekly plan into a shopping list and compare nearby vendor prices.' },
]

export default function Home() {
  const stats = useApi<{ foods: number; recipes: number; nutritionists: number; businesses: number }>('/public/stats')
  const recipes = useApi<Recipe[]>('/public/recipes')
  const featured = (recipes.data ?? []).filter((r) => r.mealType.includes('LUNCH')).slice(0, 3)

  return (
    <>
      {/* HERO */}
      <section className="hero relative overflow-hidden text-white">
        <div className="container-x relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div className="animate-rise">
            <span className="badge bg-white/15 text-forest-100 ring-1 ring-white/25">🇰🇪 Built for Kenyan kitchens</span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
              Your food.<br />Your budget.<br /><span className="text-sun">Your health.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-forest-100">
              Plan meals, track what you eat, manage your food budget, or help clients improve their nutrition, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-accent px-7 py-3 text-base">Get started free <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/recipes" className="btn px-7 py-3 text-base text-white ring-1 ring-white/40 hover:bg-white/10">Browse recipes</Link>
            </div>
            <p className="mt-4 text-sm text-forest-200">No account needed to explore recipes, nutritionists and vendors.</p>
          </div>
          <div className="relative mx-auto hidden w-full max-w-md lg:block">
            <div className="absolute -inset-6 rounded-full bg-white/10 blur-3xl" />
            <PlateArt className="relative animate-floaty drop-shadow-2xl" />
            <div className="absolute -left-4 top-10 rounded-2xl bg-white px-4 py-3 text-ink shadow-lift">
              <div className="text-xs font-semibold text-gray-500">Today's budget</div>
              <div className="font-display text-lg font-extrabold text-forest">KSh 110 left</div>
            </div>
            <div className="absolute -right-2 bottom-12 rounded-2xl bg-white px-4 py-3 text-ink shadow-lift">
              <div className="text-xs font-semibold text-gray-500">Next meal</div>
              <div className="font-display text-sm font-extrabold">Githeri & veg · KSh 80</div>
            </div>
          </div>
        </div>
      </section>

      {/* stats strip */}
      <section className="container-x -mt-8 relative z-10">
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-lift sm:grid-cols-4 sm:p-6">
          {[
            ['Kenyan foods', stats.data?.foods], ['Recipes', stats.data?.recipes],
            ['Nutritionists', stats.data?.nutritionists], ['Food vendors', stats.data?.businesses],
          ].map(([l, v]) => (
            <div key={l as string} className="text-center">
              <div className="font-display text-3xl font-extrabold text-forest">{v ?? '·'}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ACCOUNT TYPES */}
      <section className="container-x mt-20" id="start">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">How would you like to use ChakulaSmart?</h2>
          <p className="mt-3 text-gray-600">Pick what fits you today. One account can hold all three, and you choose which dashboard to open after signing in.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ACCOUNTS.map((a) => (
            <div key={a.type} className={`card flex flex-col bg-gradient-to-br ${a.tint} transition hover:-translate-y-1 hover:shadow-lift`}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest text-white"><a.icon className="h-6 w-6" /></div>
              <h3 className="mt-4 font-display text-xl font-extrabold">{a.title}</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-gray-700">
                {a.items.map((i) => <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-forest" />{i}</li>)}
              </ul>
              <Link to={a.to} className="btn btn-primary mt-6 self-start">{a.cta} <ArrowRight className="h-4 w-4" /></Link>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-x mt-24">
        <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">From “what's for dinner?” to a full week, planned</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.t} className="card relative">
              <span className="absolute right-4 top-4 font-display text-5xl font-extrabold text-forest-100">{i + 1}</span>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-100 text-forest"><s.icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-lg font-extrabold">{s.t}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* KENYAN FOOD */}
      <section className="container-x mt-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Photo src="/images/kenyan-food.jpg" alt="Ugali, sukuma wiki and beans" emoji="🥬" className="h-80 w-full rounded-3xl shadow-lift" />
          <div>
            <span className="badge bg-forest-100 text-forest-800">Real Kenyan food</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Ugali, sukuma, githeri, omena, mukimo. The food you actually eat.</h2>
            <p className="mt-4 text-gray-600">Our library is built around everyday Kenyan meals, with calories, protein and estimated prices per serving, so planning feels natural instead of foreign.</p>
            <Link to="/recipes" className="btn btn-primary mt-6">Explore recipes <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
        {featured.length > 0 && (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featured.map((r) => <RecipeCard key={r.id} r={r} />)}</div>
        )}
      </section>

      {/* CONNECTED */}
      <section className="mt-24 bg-forest-50 py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="badge bg-sun-100 text-sun-600">One platform, three audiences</span>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Planning, budgeting, expert help and local vendors, connected.</h2>
            <ol className="mt-6 space-y-3 text-gray-700">
              {['You plan the week’s meals.', 'ChakulaSmart builds the shopping list.', 'Local vendors show prices for those ingredients.', 'A nutritionist (with your permission) refines the plan.', 'You track meals, spending and progress.'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">{i + 1}</span>{t}</li>
              ))}
            </ol>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card"><Leaf className="h-6 w-6 text-forest" /><h3 className="mt-3 font-display font-extrabold">Privacy first</h3><p className="mt-1 text-sm text-gray-600">Nutritionists only see your data after you accept their invitation. Withdraw any time and see who viewed what.</p></div>
            <div className="card"><Wallet className="h-6 w-6 text-sun" /><h3 className="mt-3 font-display font-extrabold">Budget aware</h3><p className="mt-1 text-sm text-gray-600">Every suggestion is scored against what you have left to spend today.</p></div>
            <Photo src="/images/nutritionist.jpg" alt="Nutritionist consulting a client" emoji="🩺" className="h-44 w-full rounded-2xl sm:col-span-2" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container-x mt-24">
        <div className="hero overflow-hidden rounded-3xl px-8 py-14 text-center text-white sm:px-16">
          <h2 className="font-display text-3xl font-extrabold sm:text-4xl">Eat better. Spend smarter. Live healthier.</h2>
          <p className="mx-auto mt-3 max-w-xl text-forest-100">Free to start. Upgrade only when you want advanced planning and reports.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="btn btn-accent px-7 py-3 text-base">Create free account</Link>
            <Link to="/pricing" className="btn px-7 py-3 text-base text-white ring-1 ring-white/40 hover:bg-white/10">See pricing</Link>
          </div>
        </div>
      </section>
    </>
  )
}
