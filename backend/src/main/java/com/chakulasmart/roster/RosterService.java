package com.chakulasmart.roster;

import com.chakulasmart.account.AccountService;
import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.mail.Notifier;
import com.chakulasmart.util.M;
import com.chakulasmart.util.Tokens;
import com.chakulasmart.web.ApiException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The people a nutritionist (clients) or a business (customers) manages: create, read, update, delete, bulk import,
 * and email invitations with a personal registration link.
 *
 * Privacy: adding someone never gives a nutritionist access to health data. For existing accounts the client must
 * still accept in "My nutritionist"; for new people, registering through their personal invitation link is the consent.
 */
@Service
public class RosterService {
    public static final int INVITE_DAYS = 14;
    public static final int MAX_IMPORT = 500;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public record Row(String fullName, String email, String phone, String notes, String goalNote) {
    }

    private static final String SELECT =
            "SELECT mu.id, mu.full_name, mu.email, mu.phone, mu.notes, mu.goal_note, mu.user_id AS client_id, mu.invited_at, "
                    + "mu.invite_expires_at, (mu.user_id IS NULL AND mu.invite_expires_at IS NOT NULL AND mu.invite_expires_at < now()) AS invite_expired, "
                    + "mu.created_at, nc.id AS link_id, "
                    + "CASE WHEN mu.user_id IS NULL THEN 'INVITED' WHEN mu.owner_role = 'NUTRITIONIST' THEN COALESCE(nc.status, 'PENDING') ELSE 'REGISTERED' END AS status, "
                    + "CASE WHEN nc.status = 'ACTIVE' THEN (SELECT weight_kg FROM weight_logs w WHERE w.user_id = mu.user_id ORDER BY logged_on DESC LIMIT 1) END AS latest_weight, "
                    + "CASE WHEN nc.status = 'ACTIVE' THEN (SELECT count(*) FROM meals m WHERE m.user_id = mu.user_id AND m.eaten_on >= current_date - 6) END AS meals_7d, "
                    + "CASE WHEN nc.status = 'ACTIVE' THEN (SELECT goal FROM user_profiles up WHERE up.user_id = mu.user_id) END AS goal "
                    + "FROM managed_users mu LEFT JOIN nutritionist_clients nc ON mu.owner_role = 'NUTRITIONIST' "
                    + "AND nc.nutritionist_id = mu.owner_id AND nc.client_id = mu.user_id WHERE mu.owner_id = ? AND mu.owner_role = ?";

    private final JdbcTemplate jdbc;
    private final AccountService accounts;
    private final Notifier notifier;

    public RosterService(JdbcTemplate jdbc, AccountService accounts, Notifier notifier) {
        this.jdbc = jdbc;
        this.accounts = accounts;
        this.notifier = notifier;
    }

    // ---------------------------------------------------------------- read

    public List<Map<String, Object>> list(long ownerId, String role, String q) {
        StringBuilder sql = new StringBuilder(SELECT);
        List<Object> args = new ArrayList<>(List.of(ownerId, role));
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(mu.full_name) LIKE ? OR lower(mu.email) LIKE ? OR lower(COALESCE(mu.phone, '')) LIKE ?)");
            String like = "%" + q.trim().toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY lower(mu.full_name)");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    private Map<String, Object> get(long ownerId, String role, long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT + " AND mu.id = ?", ownerId, role, id);
        if (rows.isEmpty()) throw ApiException.notFound("Person not found on your list");
        return rows.get(0);
    }

    // ---------------------------------------------------------------- create

    @Transactional
    public Map<String, Object> create(CurrentUser me, String role, Row raw) {
        Row r = normalize(raw);
        long id = createInternal(me, role, r).id();
        return get(me.id(), role, id);
    }

    private record Created(long id, String outcome) {
    }

    /** Inserts the row and sends the right email. Outcome: INVITED (new person) or LINKED (already has an account). */
    private Created createInternal(CurrentUser me, String role, Row r) {
        if (r.email().equals(me.email().toLowerCase())) {
            throw ApiException.badRequest("You cannot add yourself");
        }
        Integer dup = jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = ? AND lower(email) = ?",
                Integer.class, me.id(), role, r.email());
        if (dup != null && dup > 0) {
            throw ApiException.conflict("Already on your list");
        }
        boolean pro = "NUTRITIONIST".equals(role);
        Long id = jdbc.queryForObject(
                "INSERT INTO managed_users (owner_id, owner_role, full_name, email, phone, notes, goal_note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, me.id(), role, r.fullName(), r.email(), r.phone(), r.notes() == null ? "" : r.notes(), pro ? r.goalNote() : null);
        String outcome = deliver(me.id(), role, id, r.fullName(), r.email(), pro ? r.goalNote() : null);
        return new Created(id, outcome);
    }

    private String ownerDisplayName(long ownerId, String role) {
        if ("BUSINESS".equals(role)) {
            List<String> n = jdbc.queryForList("SELECT business_name FROM business_profiles WHERE user_id = ?", String.class, ownerId);
            if (!n.isEmpty()) return n.get(0);
        }
        return jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, ownerId);
    }

    /** Links an existing account (and asks for consent) or emails a personal registration link. */
    private String deliver(long ownerId, String role, long managedId, String name, String email, String goalNote) {
        String ownerName = ownerDisplayName(ownerId, role);
        List<Long> existing = jdbc.queryForList("SELECT id FROM users WHERE lower(email) = ? AND status = 'ACTIVE'", Long.class, email);
        if (!existing.isEmpty()) {
            long userId = existing.get(0);
            jdbc.update("UPDATE managed_users SET user_id = ?, invite_token_hash = NULL, invite_expires_at = NULL, updated_at = now() WHERE id = ?",
                    userId, managedId);
            if ("NUTRITIONIST".equals(role)) {
                List<Map<String, Object>> link = jdbc.queryForList(
                        "SELECT id, status FROM nutritionist_clients WHERE nutritionist_id = ? AND client_id = ?", ownerId, userId);
                if (link.isEmpty()) {
                    jdbc.update("INSERT INTO nutritionist_clients (nutritionist_id, client_id, goal_note) VALUES (?, ?, ?)", ownerId, userId, goalNote);
                } else if ("REVOKED".equals(link.get(0).get("status"))) {
                    jdbc.update("UPDATE nutritionist_clients SET status = 'PENDING', goal_note = ?, responded_at = NULL, created_at = now() WHERE id = ?",
                            goalNote, link.get(0).get("id"));
                }
            }
            notifier.connectionRequest(email, name, ownerName, role);
            return "LINKED";
        }
        sendInvite(managedId, role, ownerName, name, email);
        return "INVITED";
    }

    private void sendInvite(long managedId, String role, String ownerName, String name, String email) {
        String token = Tokens.random();
        jdbc.update("UPDATE managed_users SET invite_token_hash = ?, invite_expires_at = now() + make_interval(days => ?), "
                + "invited_at = now(), updated_at = now() WHERE id = ?", Tokens.sha256(token), INVITE_DAYS, managedId);
        notifier.inviteNew(email, name, ownerName, role, token, INVITE_DAYS);
    }

    // ---------------------------------------------------------------- update / delete

    @Transactional
    public Map<String, Object> update(CurrentUser me, String role, long id, Row raw) {
        List<Map<String, Object>> cur = jdbc.queryForList(
                "SELECT email, user_id FROM managed_users WHERE id = ? AND owner_id = ? AND owner_role = ?", id, me.id(), role);
        if (cur.isEmpty()) throw ApiException.notFound("Person not found on your list");
        Row r = normalize(raw);
        String oldEmail = ((String) cur.get(0).get("email")).toLowerCase();
        Long userId = cur.get(0).get("user_id") == null ? null : ((Number) cur.get(0).get("user_id")).longValue();
        boolean emailChanged = !oldEmail.equals(r.email());
        if (emailChanged && userId != null) {
            throw ApiException.badRequest("The email cannot be changed once the person has registered");
        }
        if (emailChanged) {
            Integer dup = jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = ? AND lower(email) = ? AND id <> ?",
                    Integer.class, me.id(), role, r.email(), id);
            if (dup != null && dup > 0) throw ApiException.conflict("Another person on your list already uses that email");
            if (r.email().equals(me.email().toLowerCase())) throw ApiException.badRequest("You cannot add yourself");
        }
        boolean pro = "NUTRITIONIST".equals(role);
        jdbc.update("UPDATE managed_users SET full_name = ?, email = ?, phone = ?, notes = ?, goal_note = ?, updated_at = now() WHERE id = ?",
                r.fullName(), r.email(), r.phone(), r.notes() == null ? "" : r.notes(), pro ? r.goalNote() : null, id);
        if (pro && userId != null) {
            jdbc.update("UPDATE nutritionist_clients SET goal_note = ? WHERE nutritionist_id = ? AND client_id = ?", r.goalNote(), me.id(), userId);
        }
        if (emailChanged) {
            deliver(me.id(), role, id, r.fullName(), r.email(), pro ? r.goalNote() : null); // new address: invite it
        }
        return get(me.id(), role, id);
    }

    /** Removes the person from the list. Their ChakulaSmart account is untouched; a nutritionist loses data access. */
    @Transactional
    public void delete(CurrentUser me, String role, long id) {
        List<Map<String, Object>> cur = jdbc.queryForList(
                "SELECT user_id FROM managed_users WHERE id = ? AND owner_id = ? AND owner_role = ?", id, me.id(), role);
        if (cur.isEmpty()) throw ApiException.notFound("Person not found on your list");
        Object userId = cur.get(0).get("user_id");
        if ("NUTRITIONIST".equals(role) && userId != null) {
            jdbc.update("UPDATE nutritionist_clients SET status = 'REVOKED', responded_at = now() WHERE nutritionist_id = ? AND client_id = ?",
                    me.id(), ((Number) userId).longValue());
        }
        jdbc.update("DELETE FROM managed_users WHERE id = ?", id);
    }

    // ---------------------------------------------------------------- invitations

    public Map<String, Object> resend(CurrentUser me, String role, long id) {
        List<Map<String, Object>> cur = jdbc.queryForList(
                "SELECT full_name, email, user_id, invited_at, (invited_at IS NOT NULL AND invited_at > now() - interval '1 minute') AS too_soon "
                        + "FROM managed_users WHERE id = ? AND owner_id = ? AND owner_role = ?", id, me.id(), role);
        if (cur.isEmpty()) throw ApiException.notFound("Person not found on your list");
        Map<String, Object> c = cur.get(0);
        if (Boolean.TRUE.equals(c.get("too_soon"))) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "An invitation was just sent. Please wait a minute before sending another.");
        }
        String name = (String) c.get("full_name");
        String email = (String) c.get("email");
        String ownerName = ownerDisplayName(me.id(), role);
        if (c.get("user_id") == null) {
            sendInvite(id, role, ownerName, name, email);
        } else if ("NUTRITIONIST".equals(role) && jdbc.queryForList(
                "SELECT 1 FROM nutritionist_clients WHERE nutritionist_id = ? AND client_id = ? AND status = 'PENDING'",
                me.id(), ((Number) c.get("user_id")).longValue()).size() > 0) {
            jdbc.update("UPDATE managed_users SET invited_at = now() WHERE id = ?", id);
            notifier.connectionRequest(email, name, ownerName, role);
        } else {
            throw ApiException.badRequest("Nothing to resend: this person already has an account and is connected.");
        }
        return get(me.id(), role, id);
    }

    public Map<String, Object> inviteInfo(String token) {
        Map<String, Object> inv = findInvite(token, false);
        return M.of("owner_name", inv.get("owner_display"), "owner_role", inv.get("owner_role"),
                "full_name", inv.get("full_name"), "email", inv.get("email"), "phone", inv.get("phone"));
    }

    @Transactional
    public long acceptInvite(String token, String password, String fullName, String phone) {
        Map<String, Object> inv = findInvite(token, true);
        String email = (String) inv.get("email");
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = ?", Integer.class, email.toLowerCase());
        if (exists != null && exists > 0) {
            throw ApiException.conflict("An account with " + email + " already exists. Please sign in instead; your invitation will then appear in your dashboard.");
        }
        long managedId = ((Number) inv.get("id")).longValue();
        long ownerId = ((Number) inv.get("owner_id")).longValue();
        String role = (String) inv.get("owner_role");
        String name = fullName == null || fullName.isBlank() ? (String) inv.get("full_name") : fullName.trim();
        String ph = phone == null || phone.isBlank() ? (String) inv.get("phone") : phone.trim();
        long userId = accounts.createIndividual(email, password, name, ph);
        jdbc.update("UPDATE managed_users SET user_id = ?, invite_token_hash = NULL, invite_expires_at = NULL, updated_at = now() WHERE id = ?",
                userId, managedId);
        if ("NUTRITIONIST".equals(role)) {
            // Registering through the personal link is the client's consent. They can withdraw it any time.
            jdbc.update("INSERT INTO nutritionist_clients (nutritionist_id, client_id, status, goal_note, responded_at) VALUES (?, ?, 'ACTIVE', ?, now()) "
                    + "ON CONFLICT (nutritionist_id, client_id) DO UPDATE SET status = 'ACTIVE', responded_at = now()", ownerId, userId, inv.get("goal_note"));
        }
        return userId;
    }

    private Map<String, Object> findInvite(String token, boolean lock) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT mu.id, mu.owner_id, mu.owner_role, mu.full_name, mu.email, mu.phone, mu.goal_note, "
                        + "(mu.invite_expires_at < now()) AS expired, "
                        + "CASE WHEN mu.owner_role = 'BUSINESS' THEN COALESCE(bp.business_name, ou.full_name) ELSE ou.full_name END AS owner_display "
                        + "FROM managed_users mu JOIN users ou ON ou.id = mu.owner_id LEFT JOIN business_profiles bp ON bp.user_id = mu.owner_id "
                        + "WHERE mu.invite_token_hash = ? AND mu.user_id IS NULL" + (lock ? " FOR UPDATE OF mu" : ""),
                Tokens.sha256(token == null ? "" : token.trim()));
        if (rows.isEmpty()) {
            throw ApiException.notFound("This invitation link is not valid. It may already have been used.");
        }
        if (Boolean.TRUE.equals(rows.get(0).get("expired"))) {
            throw new ApiException(HttpStatus.GONE, "This invitation has expired. Please ask " + rows.get(0).get("owner_display") + " to send you a new one.");
        }
        return rows.get(0);
    }

    // ---------------------------------------------------------------- bulk import

    /** Creates many people at once. A bad row never stops the rest; every row gets its own result. */
    public Map<String, Object> importRows(CurrentUser me, String role, List<Row> rows) {
        if (rows == null || rows.isEmpty()) throw ApiException.badRequest("There are no rows to import");
        if (rows.size() > MAX_IMPORT) throw ApiException.badRequest("Import at most " + MAX_IMPORT + " people at a time");
        Set<String> seen = new HashSet<>();
        List<Map<String, Object>> results = new ArrayList<>();
        int invited = 0, linked = 0, skipped = 0, invalid = 0;
        int n = 0;
        for (Row raw : rows) {
            n++;
            String result;
            String message = null;
            String email = raw == null || raw.email() == null ? "" : raw.email().trim().toLowerCase();
            try {
                Row r = normalize(raw);
                if (!seen.add(r.email())) {
                    result = "SKIPPED";
                    message = "Duplicate of an earlier row in this file";
                } else {
                    Created c = createInternal(me, role, r);
                    result = c.outcome();
                    message = "LINKED".equals(c.outcome()) ? "Already on ChakulaSmart: connection request emailed" : "Invitation emailed";
                }
            } catch (ApiException e) {
                boolean dup = e.getStatus() == HttpStatus.CONFLICT;
                result = dup ? "SKIPPED" : "INVALID";
                message = e.getMessage();
            }
            switch (result) {
                case "INVITED" -> invited++;
                case "LINKED" -> linked++;
                case "SKIPPED" -> skipped++;
                default -> invalid++;
            }
            results.add(M.of("row", n, "name", raw == null ? "" : String.valueOf(raw.fullName()), "email", email, "result", result, "message", message));
        }
        return M.of("total", rows.size(), "invited", invited, "linked", linked, "skipped", skipped, "invalid", invalid, "results", results);
    }

    // ---------------------------------------------------------------- validation

    private static Row normalize(Row r) {
        if (r == null) throw ApiException.badRequest("Empty row");
        String name = r.fullName() == null ? "" : r.fullName().trim();
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (name.isEmpty()) throw ApiException.badRequest("Name is required");
        if (name.length() > 150) throw ApiException.badRequest("Name is too long");
        if (email.isEmpty()) throw ApiException.badRequest("Email is required");
        if (email.length() > 200 || !EMAIL.matcher(email).matches()) throw ApiException.badRequest("\"" + email + "\" is not a valid email address");
        String phone = r.phone() == null || r.phone().isBlank() ? null : r.phone().trim();
        if (phone != null && phone.length() > 40) throw ApiException.badRequest("Phone number is too long");
        String notes = r.notes() == null ? "" : r.notes().trim();
        if (notes.length() > 2000) throw ApiException.badRequest("Notes are too long (max 2000 characters)");
        String goal = r.goalNote() == null || r.goalNote().isBlank() ? null : r.goalNote().trim();
        if (goal != null && goal.length() > 1000) throw ApiException.badRequest("Goal is too long (max 1000 characters)");
        return new Row(name, email, phone, notes, goal);
    }
}
