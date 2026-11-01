// The API returns snake_case for most objects and camelCase for recipes (Java records).
export type Role = 'INDIVIDUAL' | 'NUTRITIONIST' | 'BUSINESS' | 'ADMIN'

export interface Profile {
  goal: string
  household_size: number
  daily_budget: number
  meals_per_day: number
  allergies: string
  diet_notes: string
  favorite_foods: string
  onboarded: boolean
}
export interface Subscription { plan_code: string; status: string; started_at: string; renews_at: string }
export interface RoleRequest { role: Role; status: 'PENDING' | 'REJECTED'; review_note?: string | null }
export interface User {
  id: number
  email: string
  full_name: string
  phone?: string | null
  created_at: string
  status?: string
  roles: Role[]
  role_requests?: RoleRequest[]
  profile: Profile
  subscriptions: Subscription[]
}
export interface Ingredient {
  foodId: number; name: string; emoji: string; category: string; servingDesc: string; quantity: number
  cost: number; calories: number; protein: number; carbs: number; fat: number; fiber: number; allergens: string
}
export interface Recipe {
  id: number; name: string; description: string; emoji: string; mealType: string; prepMinutes: number
  steps: string; tags: string; cost: number; calories: number; protein: number; carbs: number
  fat: number; fiber: number; allergens: string[]; ingredients: Ingredient[]; ownerId?: number | null; ownerName?: string | null
}
export interface Food {
  id: number; name: string; category: string; emoji: string; serving_desc: string
  calories: number; protein: number; carbs: number; fat: number; fiber: number; price_kes: number; allergens: string
}
export interface PlanInfo {
  code: string; role: Role; name: string; price_kes: number; tagline: string; features: string[]
}
export interface RosterPerson {
  id: number; full_name: string; email: string; phone: string | null; notes: string; goal_note: string | null
  client_id: number | null; link_id: number | null; invited_at: string | null; invite_expired: boolean; created_at: string
  status: 'INVITED' | 'PENDING' | 'ACTIVE' | 'REVOKED' | 'REGISTERED'
  latest_weight?: number | null; meals_7d?: number | null; goal?: string | null
}
