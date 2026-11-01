package com.chakulasmart.account;

import com.chakulasmart.mail.Notifier;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountService {
    public static final Set<String> ROLES = Set.of("INDIVIDUAL", "NUTRITIONIST", "BUSINESS");
    public static final Set<String> GOALS =
            Set.of("EAT_HEALTHY", "LOSE_WEIGHT", "GAIN_MUSCLE", "SAVE_MONEY", "MANAGE_CONDITION");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final Notifier notifier;

    public AccountService(JdbcTemplate jdbc, PasswordEncoder encoder, Notifier notifier) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.notifier = notifier;
    }

    /**
     * Every account gets the INDIVIDUAL tracker. Choosing NUTRITIONIST or BUSINESS creates the account as PENDING:
     * it cannot sign in until an administrator approves that role.
     */
    @Transactional
    public long createUser(String email, String password, String fullName, String phone,
                           String accountType, String businessName, String specialization, String applicationNote) {
        String type = accountType == null ? "" : accountType.trim().toUpperCase();
        if (!ROLES.contains(type)) {
            throw ApiException.badRequest("account_type must be INDIVIDUAL, NUTRITIONIST or BUSINESS");
        }
        boolean needsApproval = !"INDIVIDUAL".equals(type);
        long id = insertUser(email, password, fullName, phone, needsApproval ? "PENDING" : "ACTIVE");
        jdbc.update("INSERT INTO user_profiles (user_id) VALUES (?)", id);
        jdbc.update("INSERT INTO user_roles (user_id, role, status) VALUES (?, 'INDIVIDUAL', 'APPROVED')", id);
        if (needsApproval) {
            requestRole(id, type, businessName, specialization, applicationNote);
        }
        return id;
    }

    /** Used for invitation sign-ups: an ordinary, immediately active individual account. */
    @Transactional
    public long createIndividual(String email, String password, String fullName, String phone) {
        long id = insertUser(email, password, fullName, phone, "ACTIVE");
        jdbc.update("INSERT INTO user_profiles (user_id) VALUES (?)", id);
        jdbc.update("INSERT INTO user_roles (user_id, role, status) VALUES (?, 'INDIVIDUAL', 'APPROVED')", id);
        return id;
    }

    @Transactional
    public long createAdmin(String email, String password, String fullName) {
        long id = insertUser(email, password, fullName, null, "ACTIVE");
        jdbc.update("INSERT INTO user_profiles (user_id, onboarded) VALUES (?, TRUE)", id);
        jdbc.update("INSERT INTO user_roles (user_id, role, status) VALUES (?, 'ADMIN', 'APPROVED')", id);
        return id;
    }

    private long insertUser(String email, String password, String fullName, String phone, String status) {
        String e = email.trim().toLowerCase();
        Integer n = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = ?", Integer.class, e);
        if (n != null && n > 0) {
            throw ApiException.conflict("An account with this email already exists");
        }
        Long id = jdbc.queryForObject(
                "INSERT INTO users (email, password_hash, full_name, phone, status) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, e, encoder.encode(password), fullName.trim(), phone == null || phone.isBlank() ? null : phone.trim(), status);
        return id;
    }

    /**
     * Ask for a NUTRITIONIST / BUSINESS role. It stays PENDING (and grants nothing) until an administrator approves it.
     * INDIVIDUAL needs no approval.
     */
    @Transactional
    public void requestRole(long userId, String role, String businessName, String specialization, String applicationNote) {
        String r = role == null ? "" : role.trim().toUpperCase();
        if (!ROLES.contains(r)) {
            throw ApiException.badRequest("Unknown role");
        }
        if ("INDIVIDUAL".equals(r)) {
            jdbc.update("INSERT INTO user_roles (user_id, role, status) VALUES (?, 'INDIVIDUAL', 'APPROVED') ON CONFLICT DO NOTHING", userId);
            return;
        }
        String note = applicationNote == null || applicationNote.isBlank() ? null : applicationNote.trim();
        int changed = jdbc.update("INSERT INTO user_roles (user_id, role, status, application_note, requested_at) VALUES (?, ?, 'PENDING', ?, now()) "
                + "ON CONFLICT (user_id, role) DO UPDATE SET status = 'PENDING', application_note = EXCLUDED.application_note, "
                + "requested_at = now(), review_note = NULL, reviewed_at = NULL, reviewed_by = NULL WHERE user_roles.status = 'REJECTED'",
                userId, r, note);
        if (changed == 0) {
            return; // already pending or approved: nothing to do
        }
        if ("NUTRITIONIST".equals(r)) {
            jdbc.update("INSERT INTO nutritionist_profiles (user_id, specialization) VALUES (?, ?) ON CONFLICT DO NOTHING",
                    userId, specialization == null ? "" : specialization.trim());
        } else {
            String name = (businessName == null || businessName.isBlank())
                    ? jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, userId)
                    : businessName.trim();
            jdbc.update("INSERT INTO business_profiles (user_id, business_name) VALUES (?, ?) ON CONFLICT DO NOTHING", userId, name);
        }
        Map<String, Object> u = jdbc.queryForMap("SELECT full_name, email FROM users WHERE id = ?", userId);
        notifier.applicationReceived((String) u.get("email"), (String) u.get("full_name"), r);
        notifier.newApplicationForAdmins((String) u.get("full_name"), (String) u.get("email"), r);
    }

    public Map<String, Object> userView(long id) {
        Map<String, Object> u = jdbc.queryForMap(
                "SELECT id, email, full_name, phone, status, created_at FROM users WHERE id = ?", id);
        List<String> roles = jdbc.queryForList(
                "SELECT role FROM user_roles WHERE user_id = ? AND status = 'APPROVED' ORDER BY role", String.class, id);
        List<Map<String, Object>> requests = jdbc.queryForList(
                "SELECT role, status, review_note FROM user_roles WHERE user_id = ? AND status <> 'APPROVED' ORDER BY role", id);
        Map<String, Object> profile = jdbc.queryForMap(
                "SELECT goal, household_size, daily_budget, meals_per_day, allergies, diet_notes, favorite_foods, onboarded "
                        + "FROM user_profiles WHERE user_id = ?", id);
        List<Map<String, Object>> subs = jdbc.queryForList(
                "SELECT plan_code, status, started_at, renews_at FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE'", id);
        Map<String, Object> out = new java.util.LinkedHashMap<>(u);
        out.put("roles", new ArrayList<>(roles));
        out.put("role_requests", requests);
        out.put("profile", profile);
        out.put("subscriptions", subs);
        return out;
    }

    public Map<String, Object> authResponse(String token, long userId) {
        return M.of("token", token, "user", userView(userId));
    }
}
