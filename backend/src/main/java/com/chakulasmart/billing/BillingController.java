package com.chakulasmart.billing;

import com.chakulasmart.account.AccountService;
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

/**
 * SIMULATED billing: it records an active subscription for 30 days without charging anybody.
 * Replace subscribe() with an M-Pesa (Daraja STK push) or card payment flow before going live.
 */
@RestController
@RequestMapping("/api/billing")
public class BillingController {

    public record SubscribeReq(String planCode) {
    }

    private final JdbcTemplate jdbc;
    private final AccountService accounts;

    public BillingController(JdbcTemplate jdbc, AccountService accounts) {
        this.jdbc = jdbc;
        this.accounts = accounts;
    }

    @GetMapping("/subscriptions")
    public List<Map<String, Object>> mine(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList("SELECT plan_code, status, started_at, renews_at FROM subscriptions WHERE user_id = ? AND status = 'ACTIVE'", me.id());
    }

    @PostMapping("/subscribe")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> subscribe(@AuthenticationPrincipal CurrentUser me, @RequestBody SubscribeReq r) {
        Map<String, Object> plan = Plans.find(r.planCode());
        if (plan == null) throw ApiException.badRequest("Unknown plan");
        if ("FREE".equals(plan.get("code"))) throw ApiException.badRequest("The free plan needs no subscription");
        String role = (String) plan.get("role");
        if (!me.has(role)) throw ApiException.forbidden("Activate the " + role.toLowerCase() + " role on your account first");
        jdbc.update("INSERT INTO subscriptions (user_id, plan_code, status, started_at, renews_at) "
                        + "VALUES (?, ?, 'ACTIVE', now(), now() + interval '30 days') "
                        + "ON CONFLICT (user_id, plan_code) DO UPDATE SET status = 'ACTIVE', started_at = now(), renews_at = now() + interval '30 days'",
                me.id(), plan.get("code"));
        return M.of("user", accounts.userView(me.id()), "simulated", true);
    }

    @DeleteMapping("/subscriptions/{code}")
    public Map<String, Object> cancel(@AuthenticationPrincipal CurrentUser me, @PathVariable("code") String code) {
        jdbc.update("UPDATE subscriptions SET status = 'CANCELLED' WHERE user_id = ? AND plan_code = ?", me.id(), code);
        return accounts.userView(me.id());
    }
}
