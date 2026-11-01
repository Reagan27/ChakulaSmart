# 🥬 ChakulaSmart: Eat better. Spend smarter. Live healthier.

One food-and-nutrition platform for Kenya with **three dashboards on one account**:

| Workspace | For | What they do |
|---|---|---|
| **Personal & family** | Households | Food diary, budget tracker, meal suggestions, weekly planner, shopping lists with vendor prices, weight progress, PDF plans |
| **Nutritionist** | Dietitians | Invite clients (consent-based), view diary/progress, build or auto-generate plans, share notes, public directory profile |
| **Food business** | Grocers, vendors | Profile, products & prices & offers, customer enquiries, matched to shoppers' lists |

Built with the **hybrid account model**: one login can hold several roles, and you pick the dashboard after signing in (there is also a switcher in the sidebar).

**Stack:** Java 17 + Spring Boot 3.3 (Spring Security + JWT, JDBC, Flyway, OpenPDF) · PostgreSQL · React 18 + TypeScript + Vite + Tailwind CSS + Recharts.

---

## Quick start

**Prerequisites:** JDK 17+, Maven 3.9+, Node 18+, PostgreSQL running locally.

### 1. Database (nothing to do, almost)
By default the API connects to `localhost:5432` with user `tickets` / password `tickets`, the same server and credentials as your existing app, but it uses a **separate database named `chakulasmart`**.
On startup `DatabaseBootstrap` checks whether `chakulasmart` exists and, if not, **creates it**. Flyway then creates every table and loads the Kenyan food and recipe library.

> The `tickets` role needs permission to create databases. If you see *"Could not create database"*, run once as a Postgres superuser:
> `ALTER ROLE tickets CREATEDB;` (or `CREATE DATABASE chakulasmart OWNER tickets;`).
> No Postgres installed? `docker compose up -d` starts one with the same credentials.

### 2. Run the API
```bash
./run-backend.sh          # or: cd backend && mvn spring-boot:run
```
API: http://localhost:8080. The first start creates the administrator account.

### 3. Run the web app
```bash
./run-frontend.sh         # or: cd frontend && npm install && npm run dev
```
Open http://localhost:5173

### First sign-in (administrator)
On first start the API creates an administrator (no demo users exist any more):

| Email | Password |
|---|---|
| `admin@chakulasmart.com` | `Demo@1234` |

Change both with `ADMIN_EMAIL` / `ADMIN_PASSWORD` **before the first start in production** (an existing admin is never overwritten), or change the password under *Account & password*. The log warns while the default is in use. Admins can add more admins (they get an email to set their own password).

## Accounts, approvals and passwords
- **Individuals / families** register and sign in immediately.
- **Nutritionists and food businesses** register as *pending*: they cannot sign in, and are hidden from the public directory, until an admin approves them under **Admin → Approvals** (with their licence / registration number shown). Approval and rejection are emailed. Accounts that already existed before this update are treated as approved. Approving a business also marks it *verified*.
- Existing users who add a nutritionist/business workspace later apply the same way; they keep using their normal account meanwhile.
- **Forgot password**: `/forgot-password` emails a one-time, 1-hour link. Logged-in users can change their password in *Account*. Repeated failed sign-ins are rate limited.
- Admins can suspend/reactivate/delete users, email a reset link, and see an email log and an activity log.

## Managing your own people (nutritionists and businesses)
*Clients* (nutritionist) and *Customers* (business) pages: add, edit, search, delete, **import from CSV** (columns `name,email,phone,notes,goal`; template download included) and resend invitations.
- New people get an email with a personal link (`/join?token=…`, valid 14 days) to create their account. For a nutritionist's client, registering through the link is the consent to share their diary (they can withdraw any time).
- People who already have an account get an email instead; a nutritionist still waits for them to accept in *My nutritionist*.
- Businesses only ever see name and contact details, never health data.

## Recipes and foods created by users
Admins, approved nutritionists and approved businesses get a **Recipes & foods** page to create, edit and delete their own foods (serving, nutrition, price, allergens) and recipes (meal types, steps, ingredients). Cost and nutrition are calculated from the ingredients. Saved items are immediately available in everyone's meal ideas, planner, shopping lists and the public recipe library, credited to their author. Owners manage only their own items; admins manage all. Deleting something already used in a plan or diary hides it instead, so history is never broken.

## Email
Set these to send real email (any SMTP provider); `APP_BASE_URL` is used for the links:
`SPRING_MAIL_HOST`, `SPRING_MAIL_PORT` (587), `SPRING_MAIL_USERNAME`, `SPRING_MAIL_PASSWORD`, `MAIL_FROM`, `APP_BASE_URL`.
With no `SPRING_MAIL_HOST`, emails are printed in the backend log (so links still work in development) and listed as "Logged only" in Admin → Emails.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `CHAKULA_DB_URL` | `jdbc:postgresql://localhost:5432/chakulasmart` | Database URL (the prefix avoids clashing with your tickets app's `DB_URL`) |
| `CHAKULA_DB_USER` / `CHAKULA_DB_PASSWORD` | `tickets` / `tickets` | Credentials |
| `JWT_SECRET` | dev value | **Set a random 32+ character secret in production** |
| `JWT_EXPIRY_HOURS` | `72` | Token lifetime |
| `CORS_ORIGINS` | localhost:5173, 4173, 3000 | Allowed browser origins |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | `admin@chakulasmart.com` / `Demo@1234` | First administrator (created once) |
| `APP_BASE_URL` | `http://localhost:5173` | Public web URL used in emails |
| `PORT` | `8080` | API port |
| `VITE_API_URL` (frontend build) | empty | Public API URL when deploying the frontend separately (dev uses the Vite proxy) |

## Project layout
```
backend/   Spring Boot API
  src/main/java/com/chakulasmart/
    config/    JWT, security, DB auto-create, SPA fallback
    account/   register, login, roles, profile
    catalog/   public foods, recipes, nutritionists, businesses, plans
    diary/     meals, history, weight, rule-based suggestion engine
    planner/   weekly plans, auto-generation, shopping lists, PDF export
    care/      client-side consent, nutritionist workspace
    biz/       business workspace, enquiries
    billing/   plans + simulated subscriptions
    admin/     approvals, user management, email log
    roster/    clients/customers CRUD, CSV import, invitations
    mail/      email sending + templates
  src/main/resources/db/migration/   V1 schema, V2 Kenyan foods & recipes (Flyway)
frontend/  React app (public site, auth, three dashboards)
docker-compose.yml, run-backend.sh, run-frontend.sh
```

## How the main features work
- **Suggestion engine** (`SuggestionService`): scores every recipe by remaining budget per meal, calorie fit, your goal, favourite foods and recent repeats, and filters out allergens.
- **Auto meal plan**: runs the same scoring for 7 days × your meals per day, with variety.
- **Shopping list from a plan**: totals every ingredient × household size; each item shows the 3 cheapest in-stock vendor products that match it.
- **Costs and nutrition**: computed from the `foods` table (estimates; vendors can publish real prices).

## Security & privacy
- Roles are stored server-side and **re-read from the database on every request**; choosing a role in the frontend grants nothing.
- Queries are scoped to the signed-in user. Nutritionists reach client data only through `ConsentService` (the client must have accepted, and can revoke). Each view is written to `access_log` and shown to the client.
- Businesses never receive health or diary data: they see only a sender's name and the contact that person chose to share.
- BCrypt password hashing, stateless JWT. Add rate limiting and email verification before launch.

## Adding photographs
The site works without photos (illustrated plate and gradients). To use real images, save them in `frontend/public/images/`:
`hero-food.jpg` (hero), `kenyan-food.jpg`, `meal-prep.jpg`, `nutritionist.jpg`. Free sources: Unsplash, Pexels. Fonts (DM Sans + Manrope) load from Google Fonts; self-host them for production if you prefer.

## Billing is simulated
`/api/billing/subscribe` records a 30-day subscription **without charging anyone**. Before launch, replace it with M-Pesa (Daraja STK push) and verify the callback. The prices (KSh 250 / 750 / 1,000) are hypotheses from your plan, not validated rates. Paid features are not yet hard-gated server-side; add checks in the relevant services once payments are real.

## Build for production
```bash
cd frontend && npm run build                       # outputs frontend/dist
mkdir -p ../backend/src/main/resources/static && cp -r dist/* ../backend/src/main/resources/static/   # optional: serve the UI from the API jar
cd ../backend && mvn -DskipTests package && java -jar target/chakulasmart-api-1.0.0.jar
```

## Roadmap ideas
M-Pesa payments · email verification · server-side premium gating · vendor ordering · WhatsApp reminders · Swahili translation · more foods and county price data.

*Nutrition values and prices are estimates for planning and are not medical advice.*
