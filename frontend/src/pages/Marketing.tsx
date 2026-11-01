import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Check, FileText, HeartPulse, Lock, MessageSquare, Search, ShoppingBasket, Store, Tag as TagIcon, Users } from 'lucide-react'
import Photo from '../components/Photo'
import { Field } from '../components/ui'
import RecipeCard from '../components/RecipeCard'
import { useApi } from '../lib/hooks'
import { ksh } from '../lib/format'
import type { Recipe } from '../lib/types'

function Hero({ eyebrow, title, children, cta }: { eyebrow: string; title: string; children: ReactNode; cta?: ReactNode }) {
  return (
    <section className="hero text-white">
      <div className="container-x py-16 sm:py-20">
        <span className="badge bg-white/15 text-forest-100 ring-1 ring-white/25">{eyebrow}</span>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-forest-100">{children}</p>
        {cta && <div className="mt-7 flex flex-wrap gap-3">{cta}</div>}
      </div>
    </section>
  )
}

function Feature({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-100 text-forest"><Icon className="h-5 w-5" /></div>
      <h3 className="mt-4 font-display text-lg font-extrabold">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{children}</p>
    </div>
  )
}

const GetStarted = ({ type, label = 'Get started free' }: { type: string; label?: string }) => (
  <Link to={`/register?type=${type}`} className="btn btn-accent px-7 py-3 text-base">{label} <ArrowRight className="h-4 w-4" /></Link>
)

export function HowItWorks() {
  const steps = [
    ['Create your account', 'Choose Individual / Family, Nutritionist or Food Business. You can add the others later with the same login.'],
    ['Set your goal and budget', 'Tell us who you cook for, what you can spend per day, what you like and what to avoid.'],
    ['Plan, cook, log', 'Get suggestions, build a weekly plan, and record meals. Calories, protein and spending are calculated for you.'],
    ['Shop and improve', 'Turn plans into shopping lists with vendor prices, and invite a nutritionist to review your progress.'],
  ]
  return (
    <>
      <Hero eyebrow="How it works" title="Simple enough for every household, powerful enough for professionals"
        cta={<GetStarted type="INDIVIDUAL" />}>Four steps from “what should we eat?” to a plan you can afford.</Hero>
      <div className="container-x mt-14 grid gap-5 md:grid-cols-2">
        {steps.map(([t, d], i) => (
          <div key={t} className="card flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest font-display text-lg font-extrabold text-white">{i + 1}</span>
            <div><h3 className="font-display text-lg font-extrabold">{t}</h3><p className="mt-1 text-sm text-gray-600">{d}</p></div>
          </div>
        ))}
      </div>
      <div className="container-x mt-14 grid gap-5 md:grid-cols-3">
        <Feature icon={Users} title="Families">Plan for the whole household and keep spending under control.</Feature>
        <Feature icon={HeartPulse} title="Nutritionists">Manage consenting clients, build plans, track progress.</Feature>
        <Feature icon={Store} title="Food businesses">List products and prices where meal planners are already looking.</Feature>
      </div>
    </>
  )
}

export function MealPlanningInfo() {
  const recipes = useApi<Recipe[]>('/public/recipes')
  const [day] = useState(0)
  void day
  return (
    <>
      <Hero eyebrow="Meal planning" title="A whole week of meals in one click"
        cta={<GetStarted type="INDIVIDUAL" label="Plan my week" />}>
        Auto-generate a 7-day plan from your budget, goal and food preferences, or build it yourself. Then turn it into a shopping list and a printable PDF.
      </Hero>
      <section className="container-x mt-14 grid items-center gap-10 lg:grid-cols-2">
        <Photo src="/images/meal-prep.jpg" alt="Healthy meal preparation" emoji="🥗" className="h-72 w-full rounded-3xl shadow-lift" />
        <div className="space-y-4">
          {[
            [FileText, 'Printable PDF plans', 'Share a clean plan with family or clients.'],
            [ShoppingBasket, 'Instant shopping lists', 'Ingredients are totalled across the week and multiplied by your household size.'],
            [BarChart3, 'Cost and calories per day', 'See the cost per person and calories for each day before you commit.'],
          ].map(([I, t, d]: any) => (
            <div key={t} className="flex gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-100 text-forest"><I className="h-5 w-5" /></div>
              <div><h3 className="font-display font-extrabold">{t}</h3><p className="text-sm text-gray-600">{d}</p></div></div>
          ))}
        </div>
      </section>
      {recipes.data && (
        <section className="container-x mt-14">
          <h2 className="font-display text-2xl font-extrabold">Meals your plan can draw from</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{recipes.data.slice(0, 4).map((r) => <RecipeCard key={r.id} r={r} />)}</div>
        </section>
      )}
    </>
  )
}

export function FoodBudgeting() {
  const [people, setPeople] = useState(4)
  const [daily, setDaily] = useState(600)
  const [meals, setMeals] = useState(3)
  const recipes = useApi<Recipe[]>('/public/recipes')
  const perMealPerPerson = useMemo(() => (people > 0 && meals > 0 ? daily / meals / people : 0), [daily, meals, people])
  const affordable = (recipes.data ?? []).filter((r) => r.cost <= perMealPerPerson)
  return (
    <>
      <Hero eyebrow="Food budgeting" title="Know what you can spend before you reach the market"
        cta={<GetStarted type="INDIVIDUAL" label="Track my budget" />}>
        Set a daily food budget and ChakulaSmart shows what you have left after every meal, and suggests dishes that fit.
      </Hero>
      <section className="container-x mt-12 grid gap-8 lg:grid-cols-[380px_1fr]">
        <div className="card h-fit space-y-4">
          <h2 className="font-display text-lg font-extrabold">Try the budget calculator</h2>
          <Field label="People eating"><input className="input" type="number" min={1} max={30} value={people} onChange={(e) => setPeople(Math.max(1, +e.target.value || 1))} /></Field>
          <Field label="Daily food budget (KSh)"><input className="input" type="number" min={0} step={50} value={daily} onChange={(e) => setDaily(Math.max(0, +e.target.value || 0))} /></Field>
          <Field label="Meals per day"><input className="input" type="number" min={1} max={6} value={meals} onChange={(e) => setMeals(Math.min(6, Math.max(1, +e.target.value || 1)))} /></Field>
        </div>
        <div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card"><div className="label">Per week</div><div className="font-display text-2xl font-extrabold text-forest">{ksh(daily * 7)}</div></div>
            <div className="card"><div className="label">Per month</div><div className="font-display text-2xl font-extrabold text-forest">{ksh(daily * 30)}</div></div>
            <div className="card"><div className="label">Per person per meal</div><div className="font-display text-2xl font-extrabold text-sun-600">{ksh(perMealPerPerson)}</div></div>
          </div>
          <h3 className="mt-8 font-display text-lg font-extrabold">{affordable.length} recipes fit that budget</h3>
          {recipes.data && affordable.length === 0 && <p className="mt-2 text-sm text-gray-500">Try raising the budget or reducing meals per day.</p>}
          <div className="mt-4 grid gap-5 sm:grid-cols-2">{affordable.slice(0, 4).map((r) => <RecipeCard key={r.id} r={r} />)}</div>
        </div>
      </section>
    </>
  )
}

export function ForNutritionists() {
  return (
    <>
      <Hero eyebrow="For nutritionists & dietitians" title="Run your practice from one calm dashboard"
        cta={<><GetStarted type="NUTRITIONIST" label="Create professional account" /><Link to="/directory/nutritionists" className="btn text-white ring-1 ring-white/40 hover:bg-white/10">See the directory</Link></>}>
        Invite clients, see their food diary with their consent, build culturally relevant meal plans and share progress, with privacy controls built in.
      </Hero>
      <div className="container-x mt-14 grid gap-5 md:grid-cols-3">
        <Feature icon={Users} title="Client management">Invite clients by email, record goals, and follow weight and meals over time.</Feature>
        <Feature icon={FileText} title="Meal plans & PDFs">Generate a plan from the client's budget and allergies, then export a clean PDF.</Feature>
        <Feature icon={MessageSquare} title="Notes & feedback">Write progress notes that appear in the client's own dashboard.</Feature>
        <Feature icon={Lock} title="Consent by design">You see nothing until the client accepts, and they can withdraw at any moment.</Feature>
        <Feature icon={Search} title="Public profile">Appear in the directory so households can find and invite you.</Feature>
        <Feature icon={BarChart3} title="Progress at a glance">Spend, calories, protein and weight trends in one view.</Feature>
      </div>
      <div className="container-x mt-10"><div className="card flex flex-wrap items-center justify-between gap-4 bg-forest-50"><div><h3 className="font-display text-xl font-extrabold">Professional plan: KSh 750 / month</h3><p className="text-sm text-gray-600">Launch price hypothesis. Basic profile and directory listing are free.</p></div><GetStarted type="NUTRITIONIST" label="Start now" /></div></div>
    </>
  )
}

export function ForBusinesses() {
  return (
    <>
      <Hero eyebrow="For food businesses" title="Be the vendor people find when they plan their meals"
        cta={<><GetStarted type="BUSINESS" label="Create business account" /><Link to="/directory/businesses" className="btn text-white ring-1 ring-white/40 hover:bg-white/10">Browse vendors</Link></>}>
        Grocers, vegetable vendors, suppliers and meal-prep kitchens can publish prices and offers where shoppers build their shopping lists.
      </Hero>
      <div className="container-x mt-14 grid gap-5 md:grid-cols-3">
        <Feature icon={Store} title="Business profile">Tell shoppers who you are, where you operate and how to reach you by phone or WhatsApp.</Feature>
        <Feature icon={TagIcon} title="Products, prices & offers">List what you sell, update stock, and attach offers like “3 for KSh 60”.</Feature>
        <Feature icon={ShoppingBasket} title="Matched to shopping lists">When a shopper's list needs beans or sukuma, your cheapest matching product shows up beside it.</Feature>
        <Feature icon={MessageSquare} title="Customer enquiries">Receive messages from interested customers in one inbox.</Feature>
        <Feature icon={Lock} title="No private health data">You only see a customer's name and the contact they choose to share.</Feature>
        <Feature icon={Check} title="Start simple">Profiles and listings first. Online ordering can come when your customers ask for it.</Feature>
      </div>
      <div className="container-x mt-10"><div className="card flex flex-wrap items-center justify-between gap-4 bg-forest-50"><div><h3 className="font-display text-xl font-extrabold">Business Plus: KSh 1,000 / month</h3><p className="text-sm text-gray-600">Featured listing and unlimited products. Basic listing is free.</p></div><GetStarted type="BUSINESS" label="List my business" /></div></div>
    </>
  )
}

export function About() {
  return (
    <>
      <Hero eyebrow="About us" title="Good food decisions shouldn't need a big budget or a degree in nutrition">
        ChakulaSmart helps Kenyan households eat well on what they have, helps nutritionists reach and support more people, and helps local food sellers be found.
      </Hero>
      <div className="container-x mt-14 grid gap-5 md:grid-cols-3">
        <Feature icon={HeartPulse} title="Local first">Built around ugali, sukuma, githeri, omena and the foods Kenyans really cook.</Feature>
        <Feature icon={Lock} title="Privacy respected">Health data stays with you unless you choose to share it.</Feature>
        <Feature icon={Users} title="Fair for everyone">Free for households to start; professionals and vendors pay for extra tools.</Feature>
      </div>
      <div className="container-x mt-8"><p className="max-w-3xl text-sm text-gray-500">Nutrition values and food prices in ChakulaSmart are estimates intended for planning. They are not medical advice. People with medical conditions should follow the guidance of their healthcare provider.</p></div>
    </>
  )
}
