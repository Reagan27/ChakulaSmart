package com.chakulasmart.admin;

import com.chakulasmart.account.AccountService;
import com.chakulasmart.account.PasswordResetService;
import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.config.Guard;
import com.chakulasmart.mail.Notifier;
import com.chakulasmart.util.M;
import com.chakulasmart.util.Tokens;
import com.chakulasmart.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Administrator console API: approvals, user management, email log. Every method requires the ADMIN role. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private static final Set<String> APPROVABLE = Set.of("NUTRITIONIST", "BUSINESS");

    public record NoteReq(@Size(max = 300) String note) {
    }

    public record NewAdminReq(@NotBlank @Email String email, @NotBlank @Size(max = 120) String fullName) {
    }

    private final JdbcTemplate jdbc;
    private final Notifier notifier;
    private final PasswordResetService resets;
    private final AccountService accounts;

    public AdminController(JdbcTemplate jdbc, Notifier notifier, PasswordResetService resets, AccountService accounts) {
        this.jdbc = jdbc;
        this.notifier = notifier;
        this.resets = resets;
        this.accounts = accounts;
    }

    private void log(CurrentUser me, String action, Long target, String detail) {
        jdbc.update("INSERT INTO admin_actions (admin_id, action, target_user_id, detail) VALUES (?, ?, ?, ?)", me.id(), action, target, detail);
    }

    // ------------------------------------------------------------ overview

    @GetMapping("/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "ADMIN");
        return M.of(
                "users", jdbc.queryForObject("SELECT count(*) FROM users WHERE status = 'ACTIVE'", Long.class),
                "new_users_7d", jdbc.queryForObject("SELECT count(*) FROM users WHERE created_at > now() - interval '7 days'", Long.class),
                "nutritionists", jdbc.queryForObject("SELECT count(*) FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.role = 'NUTRITIONIST' AND r.status = 'APPROVED' AND u.status = 'ACTIVE'", Long.class),
                "businesses", jdbc.queryForObject("SELECT count(*) FROM user_roles r JOIN users u ON u.id = r.user_id WHERE r.role = 'BUSINESS' AND r.status = 'APPROVED' AND u.status = 'ACTIVE'", Long.class),
                "pending_nutritionists", jdbc.queryForObject("SELECT count(*) FROM user_roles WHERE role = 'NUTRITIONIST' AND status = 'PENDING'", Long.class),
                "pending_businesses", jdbc.queryForObject("SELECT count(*) FROM user_roles WHERE role = 'BUSINESS' AND status = 'PENDING'", Long.class),
                "suspended", jdbc.queryForObject("SELECT count(*) FROM users WHERE status = 'SUSPENDED'", Long.class),
                "emails_failed_7d", jdbc.queryForObject("SELECT count(*) FROM email_log WHERE status = 'FAILED' AND created_at > now() - interval '7 days'", Long.class),
                "recent_actions", jdbc.queryForList(
                        "SELECT a.id, a.action, a.detail, a.created_at, u.full_name AS admin_name, t.full_name AS target_name "
                                + "FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id LEFT JOIN users t ON t.id = a.target_user_id "
                                + "ORDER BY a.created_at DESC LIMIT 12"));
    }

    // ------------------------------------------------------------ approvals

    @GetMapping("/approvals")
    public List<Map<String, Object>> approvals(@AuthenticationPrincipal CurrentUser me,
                                               @RequestParam(name = "status", defaultValue = "PENDING") String status) {
        Guard.role(me, "ADMIN");
        String st = status.toUpperCase();
        if (!Set.of("PENDING", "APPROVED", "REJECTED").contains(st)) throw ApiException.badRequest("Unknown status");
        return jdbc.queryForList(
                "SELECT r.user_id, r.role, r.status, r.application_note, r.requested_at, r.reviewed_at, r.review_note, rv.full_name AS reviewed_by_name, "
                        + "u.full_name, u.email, u.phone, u.status AS account_status, u.created_at AS joined_at, "
                        + "np.specialization, np.city AS pro_city, np.headline, bp.business_name, bp.category AS business_category, bp.city AS business_city "
                        + "FROM user_roles r JOIN users u ON u.id = r.user_id LEFT JOIN users rv ON rv.id = r.reviewed_by "
                        + "LEFT JOIN nutritionist_profiles np ON np.user_id = r.user_id AND r.role = 'NUTRITIONIST' "
                        + "LEFT JOIN business_profiles bp ON bp.user_id = r.user_id AND r.role = 'BUSINESS' "
                        + "WHERE r.role IN ('NUTRITIONIST', 'BUSINESS') AND r.status = ? "
                        + "ORDER BY CASE WHEN r.status = 'PENDING' THEN r.requested_at END ASC, r.reviewed_at DESC NULLS LAST LIMIT 200", st);
    }

    @PostMapping("/approvals/{userId}/{role}/approve")
    @Transactional
    public Map<String, Object> approve(@AuthenticationPrincipal CurrentUser me, @PathVariable("userId") long userId,
                                       @PathVariable("role") String role) {
        Guard.role(me, "ADMIN");
        String r = approvable(role);
        Map<String, Object> u = pendingApplicant(userId, r);
        boolean newAccount = "PENDING".equals(u.get("status"));
        jdbc.update("UPDATE user_roles SET status = 'APPROVED', reviewed_by = ?, reviewed_at = now(), review_note = NULL WHERE user_id = ? AND role = ?",
                me.id(), userId, r);
        jdbc.update("UPDATE users SET status = 'ACTIVE', status_note = NULL WHERE id = ? AND status IN ('PENDING', 'REJECTED')", userId);
        if ("BUSINESS".equals(r)) {
            jdbc.update("UPDATE business_profiles SET verified = TRUE WHERE user_id = ?", userId);
        }
        log(me, "APPROVE_" + r, userId, (String) u.get("email"));
        notifier.applicationApproved((String) u.get("email"), (String) u.get("full_name"), r, newAccount);
        return M.of("status", "APPROVED");
    }

    @PostMapping("/approvals/{userId}/{role}/reject")
    @Transactional
    public Map<String, Object> reject(@AuthenticationPrincipal CurrentUser me, @PathVariable("userId") long userId,
                                      @PathVariable("role") String role, @Valid @RequestBody NoteReq body) {
        Guard.role(me, "ADMIN");
        String r = approvable(role);
        Map<String, Object> u = pendingApplicant(userId, r);
        String note = body.note() == null || body.note().isBlank() ? null : body.note().trim();
        jdbc.update("UPDATE user_roles SET status = 'REJECTED', reviewed_by = ?, reviewed_at = now(), review_note = ? WHERE user_id = ? AND role = ?",
                me.id(), note, userId, r);
        // A brand-new account that was only waiting for this approval is closed; an existing account keeps working as an individual.
        jdbc.update("UPDATE users SET status = 'REJECTED', status_note = ? WHERE id = ? AND status = 'PENDING'", note, userId);
        log(me, "REJECT_" + r, userId, note);
        notifier.applicationRejected((String) u.get("email"), (String) u.get("full_name"), r, note);
        return M.of("status", "REJECTED");
    }

    private static String approvable(String role) {
        String r = role == null ? "" : role.toUpperCase();
        if (!APPROVABLE.contains(r)) throw ApiException.badRequest("Only NUTRITIONIST and BUSINESS roles need approval");
        return r;
    }

    private Map<String, Object> pendingApplicant(long userId, String role) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.email, u.full_name, u.status FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.id = ? AND r.role = ? AND r.status <> 'APPROVED'",
                userId, role);
        if (rows.isEmpty()) throw ApiException.notFound("No application waiting for that person");
        return rows.get(0);
    }

    // ------------------------------------------------------------ users

    @GetMapping("/users")
    public List<Map<String, Object>> users(@AuthenticationPrincipal CurrentUser me,
                                           @RequestParam(name = "q", required = false) String q,
                                           @RequestParam(name = "role", required = false) String role,
                                           @RequestParam(name = "status", required = false) String status) {
        Guard.role(me, "ADMIN");
        StringBuilder sql = new StringBuilder(
                "SELECT u.id, u.email, u.full_name, u.phone, u.status, u.status_note, u.created_at, u.last_login_at, "
                        + "COALESCE((SELECT string_agg(r.role, ',' ORDER BY r.role) FROM user_roles r WHERE r.user_id = u.id AND r.status = 'APPROVED'), '') AS roles, "
                        + "COALESCE((SELECT string_agg(r.role, ',' ORDER BY r.role) FROM user_roles r WHERE r.user_id = u.id AND r.status = 'PENDING'), '') AS pending_roles "
                        + "FROM users u WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(u.full_name) LIKE ? OR lower(u.email) LIKE ? OR lower(COALESCE(u.phone, '')) LIKE ?)");
            String like = "%" + q.trim().toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (role != null && !role.isBlank()) {
            sql.append(" AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ? AND r.status = 'APPROVED')");
            args.add(role.toUpperCase());
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND u.status = ?");
            args.add(status.toUpperCase());
        }
        sql.append(" ORDER BY u.created_at DESC LIMIT 300");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @PostMapping("/users/{id}/suspend")
    public Map<String, Object> suspend(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id, @Valid @RequestBody NoteReq body) {
        Guard.role(me, "ADMIN");
        Map<String, Object> u = managedTarget(me, id);
        String note = body.note() == null || body.note().isBlank() ? null : body.note().trim();
        jdbc.update("UPDATE users SET status = 'SUSPENDED', status_note = ? WHERE id = ? AND status = 'ACTIVE'", note, id);
        log(me, "SUSPEND_USER", id, note);
        notifier.accountSuspended((String) u.get("email"), (String) u.get("full_name"), note);
        return M.of("status", "SUSPENDED");
    }

    @PostMapping("/users/{id}/reactivate")
    public Map<String, Object> reactivate(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        Guard.role(me, "ADMIN");
        managedTarget(me, id);
        jdbc.update("UPDATE users SET status = 'ACTIVE', status_note = NULL WHERE id = ? AND status = 'SUSPENDED'", id);
        log(me, "REACTIVATE_USER", id, null);
        return M.of("status", "ACTIVE");
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        Guard.role(me, "ADMIN");
        Map<String, Object> u = managedTarget(me, id);
        log(me, "DELETE_USER", null, u.get("email") + " (id " + id + ")");
        jdbc.update("DELETE FROM users WHERE id = ?", id);
    }

    @PostMapping("/users/{id}/send-reset")
    public Map<String, Object> sendReset(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        Guard.role(me, "ADMIN");
        Map<String, Object> u = managedTarget(me, id);
        resets.issue(id, (String) u.get("email"), (String) u.get("full_name"), false);
        log(me, "SEND_RESET", id, null);
        return M.of("message", "A password reset link was emailed to " + u.get("email"));
    }

    /** Admins cannot act on themselves or on other administrators from here. */
    private Map<String, Object> managedTarget(CurrentUser me, long id) {
        if (id == me.id()) throw ApiException.badRequest("You cannot do that to your own account");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.email, u.full_name, EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'ADMIN') AS is_admin FROM users u WHERE u.id = ?", id);
        if (rows.isEmpty()) throw ApiException.notFound("User not found");
        if (Boolean.TRUE.equals(rows.get(0).get("is_admin"))) throw ApiException.forbidden("Administrator accounts cannot be changed here");
        return rows.get(0);
    }

    // ------------------------------------------------------------ admins

    @GetMapping("/admins")
    public List<Map<String, Object>> admins(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "ADMIN");
        return jdbc.queryForList("SELECT u.id, u.email, u.full_name, u.last_login_at, u.created_at FROM users u JOIN user_roles r ON r.user_id = u.id "
                + "AND r.role = 'ADMIN' AND r.status = 'APPROVED' ORDER BY u.created_at");
    }

    /** Adds another administrator. They get an email with a link to choose their own password. */
    @PostMapping("/admins")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> addAdmin(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody NewAdminReq r) {
        Guard.role(me, "ADMIN");
        long id = accounts.createAdmin(r.email(), Tokens.random(), r.fullName()); // random placeholder; they set their own via the email link
        resets.issue(id, r.email().trim().toLowerCase(), r.fullName().trim(), true);
        log(me, "ADD_ADMIN", id, r.email().trim().toLowerCase());
        return M.of("id", id, "message", "Invitation sent to " + r.email().trim().toLowerCase());
    }

    // ------------------------------------------------------------ emails

    @GetMapping("/emails")
    public List<Map<String, Object>> emails(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "ADMIN");
        return jdbc.queryForList("SELECT id, to_email, subject, kind, status, error, created_at FROM email_log ORDER BY created_at DESC LIMIT 100");
    }
}
