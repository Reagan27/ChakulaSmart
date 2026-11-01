package com.chakulasmart.account;

import com.chakulasmart.mail.Notifier;
import com.chakulasmart.util.Tokens;
import com.chakulasmart.web.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** "Forgot password" flow: one-time, 1-hour tokens emailed to the account owner. */
@Service
public class PasswordResetService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final Notifier notifier;

    public PasswordResetService(JdbcTemplate jdbc, PasswordEncoder encoder, Notifier notifier) {
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.notifier = notifier;
    }

    /** Never reveals whether the email exists; silently ignores unknown, inactive or flooding requests. */
    public void requestReset(String email) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, full_name, email FROM users WHERE lower(email) = ? AND status IN ('ACTIVE', 'SUSPENDED')",
                email.trim().toLowerCase());
        if (rows.isEmpty()) return;
        Map<String, Object> u = rows.get(0);
        long id = ((Number) u.get("id")).longValue();
        Integer recent = jdbc.queryForObject(
                "SELECT count(*) FROM password_resets WHERE user_id = ? AND created_at > now() - interval '1 hour'", Integer.class, id);
        if (recent != null && recent >= 5) return;
        issue(id, (String) u.get("email"), (String) u.get("full_name"), false);
    }

    /** Creates a fresh token (older unused ones stop working) and emails the link. */
    @Transactional
    public void issue(long userId, String email, String name, boolean welcome) {
        jdbc.update("UPDATE password_resets SET used_at = now() WHERE user_id = ? AND used_at IS NULL", userId);
        String token = Tokens.random();
        jdbc.update("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, now() + interval '1 hour')",
                userId, Tokens.sha256(token));
        notifier.passwordReset(email, name, token, welcome);
    }

    @Transactional
    public void reset(String token, String newPassword) {
        if (token == null || token.isBlank()) throw ApiException.badRequest("This reset link is not valid");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT pr.id, pr.user_id, u.email, u.full_name FROM password_resets pr JOIN users u ON u.id = pr.user_id "
                        + "WHERE pr.token_hash = ? AND pr.used_at IS NULL AND pr.expires_at > now() FOR UPDATE OF pr",
                Tokens.sha256(token.trim()));
        if (rows.isEmpty()) {
            throw ApiException.badRequest("This reset link has expired or was already used. Please request a new one.");
        }
        Map<String, Object> r = rows.get(0);
        long userId = ((Number) r.get("user_id")).longValue();
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?", encoder.encode(newPassword), userId);
        jdbc.update("UPDATE password_resets SET used_at = now() WHERE user_id = ? AND used_at IS NULL", userId);
        notifier.passwordChanged((String) r.get("email"), (String) r.get("full_name"));
    }
}
