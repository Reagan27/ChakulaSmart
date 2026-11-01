import { Navigate, Route, Routes } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import { About, FoodBudgeting, ForBusinesses, ForNutritionists, HowItWorks, MealPlanningInfo } from './pages/Marketing'
import Pricing from './pages/Pricing'
import { RecipeDetail, Recipes } from './pages/Recipes'
import { BusinessDetail, BusinessDirectory, NutritionistDirectory } from './pages/Directory'
import { Login, NotFound, Register, Workspace } from './pages/Auth'
import { ForgotPassword, Join, ResetPassword } from './pages/AuthExtra'
import { AdminApprovals, AdminEmails, AdminOverview, AdminUsers } from './pages/admin/Admin'
import Overview from './pages/app/Overview'
import Diary from './pages/app/Diary'
import Suggestions from './pages/app/Suggestions'
import { PlanBuilder, PlanDetail, PlannerList } from './pages/app/Planner'
import { ShoppingDetail, ShoppingLists } from './pages/app/Shopping'
import { Budget, Progress } from './pages/app/Budget'
import Care from './pages/app/Care'
import Library from './pages/Library'
import Account, { Onboarding } from './pages/app/Account'
import { ClientDetail, ClientPlanBuilder, ProClients, ProOverview, ProProfile } from './pages/pro/Pro'
import { BizCustomers, BizEnquiries, BizOverview, BizProducts, BizProfile } from './pages/biz/Biz'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="recipes/:id" element={<RecipeDetail />} />
        <Route path="meal-planning" element={<MealPlanningInfo />} />
        <Route path="food-budgeting" element={<FoodBudgeting />} />
        <Route path="for-nutritionists" element={<ForNutritionists />} />
        <Route path="for-businesses" element={<ForBusinesses />} />
        <Route path="about" element={<About />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="directory/nutritionists" element={<NutritionistDirectory />} />
        <Route path="directory/businesses" element={<BusinessDirectory />} />
        <Route path="directory/businesses/:id" element={<BusinessDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="join" element={<Join />} />
      <Route path="workspace" element={<Workspace />} />

      <Route path="app" element={<DashboardLayout role="INDIVIDUAL" />}>
        <Route index element={<Overview />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="diary" element={<Diary />} />
        <Route path="suggestions" element={<Suggestions />} />
        <Route path="planner" element={<PlannerList />} />
        <Route path="planner/new" element={<PlanBuilder />} />
        <Route path="planner/:id" element={<PlanDetail />} />
        <Route path="shopping" element={<ShoppingLists />} />
        <Route path="shopping/:id" element={<ShoppingDetail />} />
        <Route path="budget" element={<Budget />} />
        <Route path="progress" element={<Progress />} />
        <Route path="care" element={<Care />} />
        <Route path="account" element={<Account />} />
      </Route>

      <Route path="pro" element={<DashboardLayout role="NUTRITIONIST" />}>
        <Route index element={<ProOverview />} />
        <Route path="clients" element={<ProClients />} />
        <Route path="clients/:clientId" element={<ClientDetail />} />
        <Route path="clients/:clientId/plan/new" element={<ClientPlanBuilder />} />
        <Route path="plans" element={<PlannerList base="/pro/plans" mineOnly={false} title="Meal plans" canAuto={false} />} />
        <Route path="plans/new" element={<Navigate to="/pro/clients" replace />} />
        <Route path="plans/:id" element={<PlanDetail base="/pro/plans" />} />
        <Route path="library" element={<Library />} />
        <Route path="profile" element={<ProProfile />} />
        <Route path="account" element={<Account />} />
      </Route>

      <Route path="biz" element={<DashboardLayout role="BUSINESS" />}>
        <Route index element={<BizOverview />} />
        <Route path="products" element={<BizProducts />} />
        <Route path="customers" element={<BizCustomers />} />
        <Route path="library" element={<Library />} />
        <Route path="enquiries" element={<BizEnquiries />} />
        <Route path="profile" element={<BizProfile />} />
        <Route path="account" element={<Account />} />
      </Route>

      <Route path="admin" element={<DashboardLayout role="ADMIN" />}>
        <Route index element={<AdminOverview />} />
        <Route path="approvals" element={<AdminApprovals />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="library" element={<Library />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  )
}
