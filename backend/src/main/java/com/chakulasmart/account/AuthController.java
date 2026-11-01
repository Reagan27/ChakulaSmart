package com.chakulasmart.account;

import com.chakulasmart.config.JwtService;
import com.chakulasmart.config.LoginThrottle;
import com.chakulasmart.roster.RosterService;
import com.chakulasmart.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterReq(@NotBlank @Email String email,
                              @NotBlank @Size(min = 8, max = 100) String password,
                              @NotBlank @Size(max = 120) String fullName,
                              String phone,
                              @NotBlank String accountType,
                              String businessName,
                              String specialization,
                              @Size(max = 300) String applicationNote) {
    }

    public record LoginReq(@NotBlank String email, @NotBlank String password) {
    }

    public record ForgotReq(@NotBlank @Email String email) {
    }

    public record ResetReq(@NotBlank String token, @NotBlank @Size(min = 8, max = 100) String password) {
    }

    public record AcceptReq(@NotBlank @Size(min = 8, max = 100) String password, @Size(max = 120) String fullName, String phone) {
    }

    private final AccountService accounts;
    private final JwtService jwt;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final LoginThrottle throttle;
    private final PasswordResetService resets;
    private final RosterService roster;

    public AuthController(AccountService accounts, JwtService jwt, JdbcTemplate jdbc, PasswordEncoder encoder,
                          LoginThrottle throttle, PasswordResetService resets, RosterService roster) {
        this.accounts = accounts;
        this.jwt = jwt;
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.throttle = throttle;
        this.resets = resets;
        this.roster = roster;
    }

    /** Individuals get a token straight away. Nutritionists and businesses get 202 and wait for admin approval. */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterReq r) {
        long id = accounts.createUser(r.email(), r.password(), r.fullName(), r.phone(),
                r.accountType(), r.businessName(), r.specialization(), r.applicationNote());
        String status = jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, id);
        if ("PENDING".equals(status)) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of(
                    "pending", true,
                    "message", "Application received. An administrator will review it and we will email you at "
                            + r.email().trim().toLowerCase() + " as soon as you can sign in."));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(accounts.authResponse(jwt.create(id), id));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginReq r, HttpServletRequest http) {
        String email = r.email().trim().toLowerCase();
        String key = email + "|" + http.getRemoteAddr();
        throttle.check(key);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, password_hash, status, status_note FROM users WHERE lower(email) = ?", email);
        if (rows.isEmpty() || !encoder.matches(r.password(), (String) rows.get(0).get("password_hash"))) {
            throttle.fail(key);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Wrong email or password");
        }
        Map<String, Object> row = rows.get(0);
        String status = (String) row.get("status");
        String note = (String) row.get("status_note");
        switch (status) {
            case "PENDING" -> throw ApiException.forbidden(
                    "Your application is still waiting for administrator approval. We will email you as soon as it is reviewed.");
            case "REJECTED" -> throw ApiException.forbidden("Your application was not approved."
                    + (note == null || note.isBlank() ? "" : " Reason: " + note));
            case "SUSPENDED" -> throw ApiException.forbidden("This account has been suspended."
                    + (note == null || note.isBlank() ? "" : " Reason: " + note) + " Please contact support.");
            default -> { /* ACTIVE */ }
        }
        throttle.clear(key);
        long id = ((Number) row.get("id")).longValue();
        jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", id);
        return accounts.authResponse(jwt.create(id), id);
    }

    @PostMapping("/forgot-password")
    public Map<String, Object> forgot(@Valid @RequestBody ForgotReq r) {
        resets.requestReset(r.email());
        return Map.of("message", "If an account uses that email, a reset link is on its way. It expires in 1 hour.");
    }

    @PostMapping("/reset-password")
    public Map<String, Object> reset(@Valid @RequestBody ResetReq r) {
        resets.reset(r.token(), r.password());
        return Map.of("message", "Password updated. You can now sign in.");
    }

    /** What the invitation page shows before the person creates their account. */
    @GetMapping("/invite/{token}")
    public Map<String, Object> inviteInfo(@PathVariable("token") String token) {
        return roster.inviteInfo(token);
    }

    @PostMapping("/invite/{token}/accept")
    public ResponseEntity<Map<String, Object>> acceptInvite(@PathVariable("token") String token, @Valid @RequestBody AcceptReq r) {
        long id = roster.acceptInvite(token, r.password(), r.fullName(), r.phone());
        return ResponseEntity.status(HttpStatus.CREATED).body(accounts.authResponse(jwt.create(id), id));
    }
}
