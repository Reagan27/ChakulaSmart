-- V3: real-data cleanup, admin role + approvals, password reset, managed users (roster), email log.

-- 1) Remove the old demo accounts (ON DELETE CASCADE clears their diaries, plans, products, enquiries...).
DELETE FROM users WHERE lower(email) LIKE '%@chakula.demo';

-- 2) Account status. New nutritionist / business sign-ups start as PENDING until an admin approves them.
ALTER TABLE users ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'));
ALTER TABLE users ADD COLUMN status_note   VARCHAR(300);
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

-- 3) Role approval. Existing rows are grandfathered as APPROVED.
ALTER TABLE user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
    CHECK (role IN ('INDIVIDUAL', 'NUTRITIONIST', 'BUSINESS', 'ADMIN'));
ALTER TABLE user_roles ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'APPROVED'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE user_roles ADD COLUMN application_note TEXT;          -- licence / registration number given at sign-up
ALTER TABLE user_roles ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE user_roles ADD COLUMN reviewed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE user_roles ADD COLUMN reviewed_at  TIMESTAMPTZ;
ALTER TABLE user_roles ADD COLUMN review_note  VARCHAR(300);
CREATE INDEX idx_user_roles_status ON user_roles (status, role);

-- 4) Password reset tokens (only a SHA-256 hash of the token is stored).
CREATE TABLE password_resets (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_password_resets_user ON password_resets (user_id, created_at);

-- 5) Managed users: the people a nutritionist (clients) or a business (customers) keeps on their own list.
--    A row can exist before the person has an account; user_id is set once they register (or if they already had one).
CREATE TABLE managed_users (
    id                BIGSERIAL PRIMARY KEY,
    owner_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_role        VARCHAR(12) NOT NULL CHECK (owner_role IN ('NUTRITIONIST', 'BUSINESS')),
    full_name         VARCHAR(150) NOT NULL,
    email             VARCHAR(200) NOT NULL,
    phone             VARCHAR(40),
    notes             TEXT NOT NULL DEFAULT '',     -- private to the owner
    goal_note         TEXT,                         -- nutritionists only: shown to the client
    user_id           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    invite_token_hash CHAR(64) UNIQUE,
    invite_expires_at TIMESTAMPTZ,
    invited_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_managed_owner_email ON managed_users (owner_id, owner_role, lower(email));
CREATE INDEX idx_managed_user ON managed_users (user_id);

-- Existing nutritionist/client links become roster entries.
INSERT INTO managed_users (owner_id, owner_role, full_name, email, goal_note, user_id, created_at)
SELECT nc.nutritionist_id, 'NUTRITIONIST', u.full_name, u.email, nc.goal_note, nc.client_id, nc.created_at
FROM nutritionist_clients nc JOIN users u ON u.id = nc.client_id;

-- 6) Outgoing email log (no bodies stored: they contain one-time links).
CREATE TABLE email_log (
    id         BIGSERIAL PRIMARY KEY,
    to_email   VARCHAR(200) NOT NULL,
    subject    VARCHAR(250) NOT NULL,
    kind       VARCHAR(30)  NOT NULL,
    status     VARCHAR(10)  NOT NULL CHECK (status IN ('SENT', 'LOGGED', 'FAILED')),
    error      VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_email_log_created ON email_log (created_at DESC);

-- 7) Admin activity log.
CREATE TABLE admin_actions (
    id             BIGSERIAL PRIMARY KEY,
    admin_id       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action         VARCHAR(40) NOT NULL,
    target_user_id BIGINT,
    detail         VARCHAR(300),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_actions_created ON admin_actions (created_at DESC);
