package com.chakulasmart.care;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The client's side of the nutritionist relationship: accept, withdraw consent, see who viewed your data. */
@RestController
@RequestMapping("/api/care")
public class CareController {

    public record RespondReq(boolean accept) {
    }

    private final JdbcTemplate jdbc;

    public CareController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String TEAM_SQL =
            "SELECT nc.id AS link_id, nc.status, nc.goal_note, nc.created_at, u.id AS nutritionist_id, u.full_name, "
                    + "np.headline, np.specialization, np.city FROM nutritionist_clients nc JOIN users u ON u.id = nc.nutritionist_id "
                    + "LEFT JOIN nutritionist_profiles np ON np.user_id = u.id WHERE nc.client_id = ? AND nc.status = ? ORDER BY nc.created_at DESC";

    @GetMapping("/requests")
    public List<Map<String, Object>> requests(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList(TEAM_SQL, me.id(), "PENDING");
    }

    @GetMapping("/team")
    public List<Map<String, Object>> team(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList(TEAM_SQL, me.id(), "ACTIVE");
    }

    @PostMapping("/requests/{linkId}/respond")
    public Map<String, Object> respond(@AuthenticationPrincipal CurrentUser me, @PathVariable("linkId") long linkId,
                                       @RequestBody RespondReq r) {
        int n = jdbc.update("UPDATE nutritionist_clients SET status = ?, responded_at = now() "
                        + "WHERE id = ? AND client_id = ? AND status = 'PENDING'",
                r.accept() ? "ACTIVE" : "REVOKED", linkId, me.id());
        if (n == 0) throw ApiException.notFound("Request not found");
        return M.of("status", r.accept() ? "ACTIVE" : "REVOKED");
    }

    @DeleteMapping("/team/{linkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@AuthenticationPrincipal CurrentUser me, @PathVariable("linkId") long linkId) {
        jdbc.update("UPDATE nutritionist_clients SET status = 'REVOKED', responded_at = now() WHERE id = ? AND client_id = ?",
                linkId, me.id());
    }

    @GetMapping("/notes")
    public List<Map<String, Object>> notes(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList(
                "SELECT pn.id, pn.note, pn.created_at, u.full_name AS nutritionist_name FROM progress_notes pn "
                        + "JOIN users u ON u.id = pn.nutritionist_id "
                        + "WHERE pn.client_id = ? AND EXISTS (SELECT 1 FROM nutritionist_clients nc WHERE nc.nutritionist_id = pn.nutritionist_id "
                        + "AND nc.client_id = pn.client_id AND nc.status = 'ACTIVE') ORDER BY pn.created_at DESC", me.id());
    }

    @GetMapping("/access-log")
    public List<Map<String, Object>> accessLog(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList(
                "SELECT a.id, a.action, a.created_at, u.full_name AS actor_name FROM access_log a JOIN users u ON u.id = a.actor_id "
                        + "WHERE a.subject_id = ? ORDER BY a.created_at DESC LIMIT 30", me.id());
    }
}
