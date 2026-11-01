import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, BookOpen, CalendarDays, ClipboardList, HeartHandshake, HeartPulse, Home, Inbox, LayoutDashboard, LogOut, Menu,
  Mail, Package, Settings, ShieldCheck, ShoppingBasket, Sparkles, Store, TrendingUp, UserCog, Users, Utensils, Wallet, X,
} from 'lucide-react'
import Logo from './Logo'
import { Spinner } from './ui'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/types'

interface NavItem { to: string; label: string; icon: any; end?: boolean }
const NAV: Record<Role, NavItem[]> = {
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/library', label: 'Recipes & foods', icon: BookOpen },
    { to: '/admin/emails', label: 'Emails', icon: Mail },
    { to: '/admin/account', label: 'Account & password', icon: Settings },
  ],
  INDIVIDUAL: [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/app/diary', label: 'Food diary', icon: Utensils },
    { to: '/app/suggestions', label: 'Meal ideas', icon: Sparkles },
    { to: '/app/planner', label: 'Meal planner', icon: CalendarDays },
    { to: '/app/shopping', label: 'Shopping lists', icon: ShoppingBasket },
    { to: '/app/budget', label: 'Budget', icon: Wallet },
    { to: '/app/progress', label: 'Progress', icon: TrendingUp },
    { to: '/app/care', label: 'My nutritionist', icon: HeartHandshake },
    { to: '/app/account', label: 'Account & plan', icon: Settings },
  ],
  NUTRITIONIST: [
    { to: '/pro', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/pro/clients', label: 'Clients', icon: Users },
    { to: '/pro/plans', label: 'Meal plans', icon: ClipboardList },
    { to: '/pro/library', label: 'Recipes & foods', icon: BookOpen },
    { to: '/pro/profile', label: 'Public profile', icon: UserCog },
    { to: '/pro/account', label: 'Account & plan', icon: Settings },
  ],
  BUSINESS: [
    { to: '/biz', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/biz/products', label: 'Products & prices', icon: Package },
    { to: '/biz/customers', label: 'Customers', icon: Users },
    { to: '/biz/library', label: 'Recipes & foods', icon: BookOpen },
    { to: '/biz/enquiries', label: 'Enquiries', icon: Inbox },
    { to: '/biz/profile', label: 'Business profile', icon: Store },
    { to: '/biz/account', label: 'Account & plan', icon: Settings },
  ],
}
const WS_LABEL: Record<Role, string> = { ADMIN: 'Administration', INDIVIDUAL: 'Personal & family', NUTRITIONIST: 'Nutritionist', BUSINESS: 'Food business' }
const WS_HOME: Record<Role, string> = { ADMIN: '/admin', INDIVIDUAL: '/app', NUTRITIONIST: '/pro', BUSINESS: '/biz' }
const WS_ICON: Record<Role, any> = { ADMIN: ShieldCheck, INDIVIDUAL: Home, NUTRITIONIST: HeartPulse, BUSINESS: Store }

export default function DashboardLayout({ role }: { role: Role }) {
  const { user, loading, logout, setWorkspace, has } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => { if (user && has(role)) setWorkspace(role) }, [user, role]) // eslint-disable-line

  if (loading) return <Spinner label="Loading your dashboard" />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!has(role)) return <Navigate to="/workspace" replace />

  const Side = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5"><Logo to="/" /></div>
      <div className="px-4">
        <label className="mb-1 block px-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Workspace</label>
        <div className="relative">
          <select aria-label="Switch workspace" className="input appearance-none pr-8 font-semibold" value={role}
            onChange={(e) => { const r = e.target.value as Role; setWorkspace(r); nav(WS_HOME[r]) }}>
            {user.roles.map((r) => <option key={r} value={r}>{WS_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Dashboard">
        {NAV[role].map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-forest text-white shadow-soft' : 'text-gray-600 hover:bg-forest-50 hover:text-forest'}`}>
            <n.icon className="h-[18px] w-[18px]" />{n.label}
          </NavLink>
        ))}
        <div className="my-3 border-t border-gray-100" />
        <NavLink to="/recipes" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-forest-50 hover:text-forest"><BookOpen className="h-[18px] w-[18px]" />Recipe library</NavLink>
        <NavLink to="/directory/businesses" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-forest-50 hover:text-forest"><Store className="h-[18px] w-[18px]" />Vendor directory</NavLink>
        <NavLink to="/workspace" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-600 hover:bg-forest-50 hover:text-forest"><BarChart3 className="h-[18px] w-[18px]" />All workspaces</NavLink>
      </nav>
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-100 font-bold text-forest">{user.full_name[0]}</div>
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{user.full_name}</div><div className="truncate text-xs text-gray-500">{user.email}</div></div>
          <button onClick={() => { logout(); nav('/') }} aria-label="Sign out" className="rounded-full p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-forest-100 bg-white lg:block">{Side}</aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-forest-100 bg-white/90 px-4 backdrop-blur lg:hidden">
          <Logo />
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-full p-2 text-forest"><Menu /></button>
        </div>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-lift animate-rise">
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 rounded-full p-2 text-gray-500"><X className="h-5 w-5" /></button>
              {Side}
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-8"><Outlet /></main>
      </div>
    </div>
  )
}

export function Greeting({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return <>{g}, {user?.full_name.split(' ')[0]}{children}</>
}
export { Link }
