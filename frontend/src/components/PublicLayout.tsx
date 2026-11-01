import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../lib/auth'

const LINKS = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/meal-planning', label: 'Meal planning' },
  { to: '/food-budgeting', label: 'Food budgeting' },
  { to: '/for-nutritionists', label: 'For nutritionists' },
  { to: '/for-businesses', label: 'For businesses' },
  { to: '/about', label: 'About' },
]

export function Navbar() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  return (
    <header className="sticky top-0 z-40 border-b border-forest-100 bg-cream/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-4 xl:flex" aria-label="Main">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) => `whitespace-nowrap text-sm font-semibold transition ${isActive ? 'text-forest' : 'text-gray-600 hover:text-forest'}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 xl:flex">
          {user ? (
            <Link to="/workspace" className="btn btn-primary">Open my dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Login</Link>
              <Link to="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>
        <button className="rounded-full p-2 text-forest xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="border-t border-forest-100 bg-cream px-5 pb-5 pt-2 xl:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className="border-b border-forest-100/60 py-3 text-sm font-semibold text-ink">{l.label}</NavLink>
            ))}
          </nav>
          <div className="mt-4 flex gap-2">
            {user ? <Link to="/workspace" className="btn btn-primary flex-1">Open my dashboard</Link> : (
              <>
                <Link to="/login" className="btn btn-ghost flex-1">Login</Link>
                <Link to="/register" className="btn btn-primary flex-1">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-24 bg-forest-900 text-forest-100">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm text-forest-200">Eat better. Spend smarter. Live healthier. One platform for families, nutritionists and food businesses across Kenya.</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold text-white">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/recipes">Kenyan recipes</Link></li>
            <li><Link className="hover:text-white" to="/directory/nutritionists">Find a nutritionist</Link></li>
            <li><Link className="hover:text-white" to="/directory/businesses">Food vendors</Link></li>
            <li><Link className="hover:text-white" to="/pricing">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold text-white">Join</h4>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" to="/register?type=INDIVIDUAL">Individual / Family</Link></li>
            <li><Link className="hover:text-white" to="/register?type=NUTRITIONIST">Nutritionist</Link></li>
            <li><Link className="hover:text-white" to="/register?type=BUSINESS">Food business</Link></li>
            <li><Link className="hover:text-white" to="/login">Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-forest-300">
        © {new Date().getFullYear()} ChakulaSmart. Nutrition values and prices are estimates for planning, not medical advice.
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  )
}
