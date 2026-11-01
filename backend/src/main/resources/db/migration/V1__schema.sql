-- ChakulaSmart schema (PostgreSQL). Flyway runs this automatically on first start.

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(200) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    full_name     VARCHAR(150) NOT NULL,
    phone         VARCHAR(40),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

-- One account can hold several roles (hybrid model). The backend authorises on these rows.
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    VARCHAR(20) NOT NULL CHECK (role IN ('INDIVIDUAL', 'NUTRITIONIST', 'BUSINESS')),
    PRIMARY KEY (user_id, role)
);

CREATE TABLE user_profiles (
    user_id        BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    goal           VARCHAR(30)  NOT NULL DEFAULT 'EAT_HEALTHY'
                   CHECK (goal IN ('EAT_HEALTHY', 'LOSE_WEIGHT', 'GAIN_MUSCLE', 'SAVE_MONEY', 'MANAGE_CONDITION')),
    household_size INT          NOT NULL DEFAULT 1 CHECK (household_size BETWEEN 1 AND 30),
    daily_budget   NUMERIC(10,2) NOT NULL DEFAULT 300 CHECK (daily_budget >= 0),
    meals_per_day  INT          NOT NULL DEFAULT 3 CHECK (meals_per_day BETWEEN 1 AND 6),
    allergies      TEXT         NOT NULL DEFAULT '',
    diet_notes     TEXT         NOT NULL DEFAULT '',
    favorite_foods TEXT         NOT NULL DEFAULT '',
    onboarded      BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Food & recipe library ------------------------------------------------------
CREATE TABLE foods (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(120) NOT NULL UNIQUE,
    category     VARCHAR(30)  NOT NULL,
    emoji        VARCHAR(8)   NOT NULL DEFAULT '🍽️',
    serving_desc VARCHAR(80)  NOT NULL,
    calories     NUMERIC(7,1) NOT NULL,
    protein      NUMERIC(6,1) NOT NULL DEFAULT 0,
    carbs        NUMERIC(6,1) NOT NULL DEFAULT 0,
    fat          NUMERIC(6,1) NOT NULL DEFAULT 0,
    fiber        NUMERIC(6,1) NOT NULL DEFAULT 0,
    price_kes    NUMERIC(8,2) NOT NULL,
    allergens    TEXT         NOT NULL DEFAULT ''
);
CREATE INDEX idx_foods_category ON foods (category);

CREATE TABLE recipes (
    id           BIGSERIAL PRIMARY KEY,
    name         VARCHAR(150) NOT NULL UNIQUE,
    description  TEXT         NOT NULL,
    emoji        VARCHAR(8)   NOT NULL DEFAULT '🍲',
    meal_type    VARCHAR(60)  NOT NULL,          -- comma separated: BREAKFAST,LUNCH,DINNER,SNACK
    prep_minutes INT          NOT NULL,
    steps        TEXT         NOT NULL,
    tags         VARCHAR(200) NOT NULL DEFAULT ''
);

CREATE TABLE recipe_ingredients (
    id        BIGSERIAL PRIMARY KEY,
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    food_id   BIGINT NOT NULL REFERENCES foods(id),
    quantity  NUMERIC(6,2) NOT NULL DEFAULT 1
);
CREATE INDEX idx_recipe_ing_recipe ON recipe_ingredients (recipe_id);

-- Food diary ----------------------------------------------------------------
CREATE TABLE meals (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    eaten_on    DATE   NOT NULL,
    meal_type   VARCHAR(10) NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    recipe_id   BIGINT REFERENCES recipes(id) ON DELETE SET NULL,
    actual_cost NUMERIC(9,2),                      -- what you really paid; NULL = use estimated price
    notes       VARCHAR(300),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meals_user_date ON meals (user_id, eaten_on);

CREATE TABLE meal_items (
    id       BIGSERIAL PRIMARY KEY,
    meal_id  BIGINT NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    food_id  BIGINT NOT NULL REFERENCES foods(id),
    servings NUMERIC(6,2) NOT NULL DEFAULT 1
);
CREATE INDEX idx_meal_items_meal ON meal_items (meal_id);

CREATE TABLE weight_logs (
    id        BIGSERIAL PRIMARY KEY,
    user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    logged_on DATE   NOT NULL,
    weight_kg NUMERIC(5,1) NOT NULL,
    UNIQUE (user_id, logged_on)
);

-- Meal plans & shopping ------------------------------------------------------
CREATE TABLE meal_plans (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- who created it
    for_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- whose plan it is
    title       VARCHAR(160) NOT NULL,
    week_start  DATE NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_for ON meal_plans (for_user_id);
CREATE INDEX idx_plans_owner ON meal_plans (owner_id);

CREATE TABLE meal_plan_entries (
    id        BIGSERIAL PRIMARY KEY,
    plan_id   BIGINT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_index INT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
    meal_type VARCHAR(10) NOT NULL CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK')),
    recipe_id BIGINT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE
);
CREATE INDEX idx_plan_entries_plan ON meal_plan_entries (plan_id);

CREATE TABLE shopping_lists (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id    BIGINT REFERENCES meal_plans(id) ON DELETE SET NULL,
    title      VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shopping_items (
    id       BIGSERIAL PRIMARY KEY,
    list_id  BIGINT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    food_id  BIGINT REFERENCES foods(id) ON DELETE SET NULL,
    name     VARCHAR(150) NOT NULL,
    quantity NUMERIC(8,2) NOT NULL DEFAULT 1,
    unit     VARCHAR(80)  NOT NULL DEFAULT '',
    est_cost NUMERIC(9,2) NOT NULL DEFAULT 0,
    checked  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_shopping_items_list ON shopping_items (list_id);

-- Nutritionists ---------------------------------------------------------------
CREATE TABLE nutritionist_profiles (
    user_id           BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    headline          VARCHAR(200) NOT NULL DEFAULT '',
    bio               TEXT NOT NULL DEFAULT '',
    specialization    VARCHAR(200) NOT NULL DEFAULT '',
    city              VARCHAR(80)  NOT NULL DEFAULT '',
    monthly_fee       NUMERIC(9,2) NOT NULL DEFAULT 0,
    accepting_clients BOOLEAN NOT NULL DEFAULT TRUE
);

-- Consent-based relationship: a nutritionist sees NOTHING until the client accepts.
CREATE TABLE nutritionist_clients (
    id              BIGSERIAL PRIMARY KEY,
    nutritionist_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED')),
    goal_note       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,
    UNIQUE (nutritionist_id, client_id)
);
CREATE INDEX idx_nc_client ON nutritionist_clients (client_id);

CREATE TABLE progress_notes (
    id              BIGSERIAL PRIMARY KEY,
    nutritionist_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note            TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_client ON progress_notes (client_id);

-- Who looked at whose data (shown to the client for transparency)
CREATE TABLE access_log (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action     VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_access_subject ON access_log (subject_id, created_at);

-- Food businesses --------------------------------------------------------------
CREATE TABLE business_profiles (
    user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(150) NOT NULL,
    category      VARCHAR(40)  NOT NULL DEFAULT 'Grocery',
    description   TEXT NOT NULL DEFAULT '',
    city          VARCHAR(80)  NOT NULL DEFAULT '',
    phone         VARCHAR(40)  NOT NULL DEFAULT '',
    whatsapp      VARCHAR(40)  NOT NULL DEFAULT '',
    verified      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    business_id BIGINT NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
    food_id     BIGINT REFERENCES foods(id) ON DELETE SET NULL,
    name        VARCHAR(140) NOT NULL,
    category    VARCHAR(40)  NOT NULL DEFAULT 'Other',
    price       NUMERIC(9,2) NOT NULL CHECK (price >= 0),
    unit        VARCHAR(40)  NOT NULL DEFAULT 'kg',
    offer_text  VARCHAR(160),
    in_stock    BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_products_business ON products (business_id);
CREATE INDEX idx_products_food ON products (food_id);

CREATE TABLE enquiries (
    id           BIGSERIAL PRIMARY KEY,
    business_id  BIGINT NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
    from_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message      TEXT NOT NULL,
    contact      VARCHAR(150),
    status       VARCHAR(10) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'REPLIED', 'CLOSED')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enquiries_business ON enquiries (business_id, created_at);

-- Subscriptions (billing is simulated; see BillingController) ---------------------
CREATE TABLE subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_code  VARCHAR(30) NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    renews_at  TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, plan_code)
);
