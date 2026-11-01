package com.chakulasmart.roster;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.config.Guard;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The same list-management API for both owners:
 *   nutritionists  /api/pro/roster      (their clients)
 *   businesses     /api/biz/customers   (their customers)
 */
@RestController
@RequestMapping("/api")
public class RosterController {

    public record ImportReq(List<RosterService.Row> rows) {
    }

    private final RosterService roster;

    public RosterController(RosterService roster) {
        this.roster = roster;
    }

    /** Which workspace is calling, from the URL; also enforces that the caller really has that (approved) role. */
    private static String role(CurrentUser me, HttpServletRequest req) {
        String role = req.getRequestURI().startsWith("/api/pro/") ? "NUTRITIONIST" : "BUSINESS";
        Guard.role(me, role);
        return role;
    }

    @GetMapping({"/pro/roster", "/biz/customers"})
    public List<Map<String, Object>> list(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req,
                                          @RequestParam(name = "q", required = false) String q) {
        return roster.list(me.id(), role(me, req), q);
    }

    @PostMapping({"/pro/roster", "/biz/customers"})
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req, @RequestBody RosterService.Row row) {
        return roster.create(me, role(me, req), row);
    }

    @PutMapping({"/pro/roster/{id}", "/biz/customers/{id}"})
    public Map<String, Object> update(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req,
                                      @PathVariable("id") long id, @RequestBody RosterService.Row row) {
        return roster.update(me, role(me, req), id, row);
    }

    @DeleteMapping({"/pro/roster/{id}", "/biz/customers/{id}"})
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req, @PathVariable("id") long id) {
        roster.delete(me, role(me, req), id);
    }

    @PostMapping({"/pro/roster/{id}/resend", "/biz/customers/{id}/resend"})
    public Map<String, Object> resend(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req, @PathVariable("id") long id) {
        return roster.resend(me, role(me, req), id);
    }

    @PostMapping({"/pro/roster/import", "/biz/customers/import"})
    public Map<String, Object> importRows(@AuthenticationPrincipal CurrentUser me, HttpServletRequest req, @RequestBody ImportReq body) {
        return roster.importRows(me, role(me, req), body.rows());
    }
}
