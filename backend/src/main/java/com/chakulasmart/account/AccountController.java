package com.chakulasmart.account;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.mail.Notifier;
import com.chakulasmart.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    public record ProfileReq(String goal, Integer householdSize, Double dailyBudget, Integer mealsPerDay,
                             @Size(max = 500) String allergies, @Size(max = 1000) String dietNotes,
                             @Size(max = 500) String favoriteFoods) {
    }

    public record RoleReq(String role, String businessName, String specialization, @Size(max = 300) String applicationNote) {
    }

    public record PasswordReq(@NotBlank String currentPassword, @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record MeReq(String fullName, String phone) {
    }

    private final AccountService accounts;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final Notifier notifier;

    public AccountController(AccountService accounts, JdbcTemplate jdbc, PasswordEncoder encoder, Notifier notifier) {
        this.accounts = accounts;
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.notifier = notifier;
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal CurrentUser me) {
        return accounts.userView(me.id());
    }

    @PutMapping("/me")
    public Map<String, Object> updateMe(@AuthenticationPrincipal CurrentUser me, @RequestBody MeReq r) {
        if (r.fullName() == null || r.fullName().isBlank()) {
            throw ApiException.badRequest("Name is required");
        }
        jdbc.update("UPDATE users SET full_name = ?, phone = ? WHERE id = ?", r.fullName().trim(), r.phone(), me.id());
        return accounts.userView(me.id());
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@AuthenticationPrincipal CurrentUser me, @RequestBody ProfileReq r) {
        String goal = r.goal() == null ? "EAT_HEALTHY" : r.goal().toUpperCase();
        if (!AccountService.GOALS.contains(goal)) {
            throw ApiException.badRequest("Unknown goal");
        }
        int household = r.householdSize() == null ? 1 : r.householdSize();
        int meals = r.mealsPerDay() == null ? 3 : r.mealsPerDay();
        double budget = r.dailyBudget() == null ? 300 : r.dailyBudget();
        if (household < 1 || household > 30) throw ApiException.badRequest("Household size must be 1 to 30");
        if (meals < 1 || meals > 6) throw ApiException.badRequest("Meals per day must be 1 to 6");
        if (budget < 0) throw ApiException.badRequest("Budget cannot be negative");
        jdbc.update("UPDATE user_profiles SET goal = ?, household_size = ?, daily_budget = ?, meals_per_day = ?, "
                        + "allergies = ?, diet_notes = ?, favorite_foods = ?, onboarded = TRUE, updated_at = now() "
                        + "WHERE user_id = ?",
                goal, household, budget, meals,
                r.allergies() == null ? "" : r.allergies().trim(),
                r.dietNotes() == null ? "" : r.dietNotes().trim(),
                r.favoriteFoods() == null ? "" : r.favoriteFoods().trim(),
                me.id());
        return accounts.userView(me.id());
    }

    /** Ask for another role on the same account (hybrid model). Nutritionist and business roles wait for admin approval. */
    @PostMapping("/roles")
    public Map<String, Object> addRole(@AuthenticationPrincipal CurrentUser me, @RequestBody RoleReq r) {
        accounts.requestRole(me.id(), r.role(), r.businessName(), r.specialization(), r.applicationNote());
        return accounts.userView(me.id());
    }

    @PostMapping("/password")
    public Map<String, Object> changePassword(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody PasswordReq r) {
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, me.id());
        if (!encoder.matches(r.currentPassword(), hash)) {
            throw ApiException.badRequest("Your current password is not correct");
        }
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?", encoder.encode(r.newPassword()), me.id());
        notifier.passwordChanged(me.email(), me.fullName());
        return Map.of("message", "Password updated");
    }
}
