package com.chakulasmart.care;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.config.Guard;
import com.chakulasmart.diary.DiaryService;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Nutritionist workspace. Every client-data endpoint checks the client's consent first. */
@RestController
@RequestMapping("/api/pro")
public class ProController {

    public record ProfileReq(String headline, String bio, String specialization, String city, Double monthlyFee,
                             Boolean acceptingClients) {
    }

    public record NoteReq(@NotBlank String note) {
    }

    private final JdbcTemplate jdbc;
    private final ConsentService consent;
    private final DiaryService diary;

    public ProController(JdbcTemplate jdbc, ConsentService consent, DiaryService diary) {
        this.jdbc = jdbc;
        this.consent = consent;
        this.diary = diary;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "NUTRITIONIST");
        return M.of(
                "active_clients", jdbc.queryForObject("SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = ? AND status = 'ACTIVE'", Long.class, me.id()),
                "pending_invites", jdbc.queryForObject("SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = ? AND status = 'PENDING'", Long.class, me.id()),
                "not_registered", jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = 'NUTRITIONIST' AND user_id IS NULL", Long.class, me.id()),
                "roster_total", jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = 'NUTRITIONIST'", Long.class, me.id()),
                "plans_created", jdbc.queryForObject("SELECT count(*) FROM meal_plans WHERE owner_id = ? AND for_user_id <> owner_id", Long.class, me.id()),
                "notes_written", jdbc.queryForObject("SELECT count(*) FROM progress_notes WHERE nutritionist_id = ?", Long.class, me.id()));
    }

    @GetMapping("/profile")
    public Map<String, Object> profile(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "NUTRITIONIST");
        return jdbc.queryForMap("SELECT n.user_id, u.full_name, n.headline, n.bio, n.specialization, n.city, n.monthly_fee, "
                + "n.accepting_clients FROM nutritionist_profiles n JOIN users u ON u.id = n.user_id WHERE n.user_id = ?", me.id());
    }

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@AuthenticationPrincipal CurrentUser me, @RequestBody ProfileReq r) {
        Guard.role(me, "NUTRITIONIST");
        jdbc.update("UPDATE nutritionist_profiles SET headline = ?, bio = ?, specialization = ?, city = ?, monthly_fee = ?, "
                        + "accepting_clients = ? WHERE user_id = ?",
                r.headline() == null ? "" : r.headline().trim(), r.bio() == null ? "" : r.bio().trim(),
                r.specialization() == null ? "" : r.specialization().trim(), r.city() == null ? "" : r.city().trim(),
                r.monthlyFee() == null ? 0 : r.monthlyFee(), r.acceptingClients() == null || r.acceptingClients(), me.id());
        return profile(me);
    }

    @GetMapping("/clients/{clientId}")
    public Map<String, Object> client(@AuthenticationPrincipal CurrentUser me, @PathVariable("clientId") long clientId) {
        Guard.role(me, "NUTRITIONIST");
        consent.requireActive(me.id(), clientId);
        consent.audit(me.id(), clientId, "VIEWED_CLIENT_DASHBOARD");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("client", jdbc.queryForMap("SELECT id, full_name, email FROM users WHERE id = ?", clientId));
        out.put("profile", jdbc.queryForMap("SELECT goal, household_size, daily_budget, meals_per_day, allergies, diet_notes, favorite_foods "
                + "FROM user_profiles WHERE user_id = ?", clientId));
        out.put("link", jdbc.queryForMap("SELECT id, goal_note, responded_at FROM nutritionist_clients WHERE nutritionist_id = ? AND client_id = ?", me.id(), clientId));
        out.put("today", diary.dayView(clientId, LocalDate.now()));
        out.put("history", diary.history(clientId, 14));
        out.put("weights", diary.weights(clientId));
        out.put("plans", jdbc.queryForList("SELECT id, title, week_start, created_at FROM meal_plans WHERE owner_id = ? AND for_user_id = ? "
                + "ORDER BY week_start DESC, id DESC", me.id(), clientId));
        out.put("notes", jdbc.queryForList("SELECT id, note, created_at FROM progress_notes WHERE nutritionist_id = ? AND client_id = ? "
                + "ORDER BY created_at DESC", me.id(), clientId));
        return out;
    }

    @PostMapping("/clients/{clientId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addNote(@AuthenticationPrincipal CurrentUser me, @PathVariable("clientId") long clientId,
                                       @Valid @RequestBody NoteReq r) {
        Guard.role(me, "NUTRITIONIST");
        consent.requireActive(me.id(), clientId);
        Long id = jdbc.queryForObject("INSERT INTO progress_notes (nutritionist_id, client_id, note) VALUES (?, ?, ?) RETURNING id",
                Long.class, me.id(), clientId, r.note().trim());
        return M.of("id", id);
    }

    @DeleteMapping("/clients/{clientId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal CurrentUser me, @PathVariable("clientId") long clientId) {
        Guard.role(me, "NUTRITIONIST");
        jdbc.update("UPDATE nutritionist_clients SET status = 'REVOKED', responded_at = now() WHERE nutritionist_id = ? AND client_id = ?",
                me.id(), clientId);
    }
}
