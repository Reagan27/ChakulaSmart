package com.chakulasmart.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Reads the Bearer token, then loads the user (must be ACTIVE) and their APPROVED roles fresh from the database on every request. */
public class JwtFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final JdbcTemplate jdbc;

    public JwtFilter(JwtService jwt, JdbcTemplate jdbc) {
        this.jwt = jwt;
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                long id = jwt.parse(header.substring(7));
                List<Map<String, Object>> rows =
                        jdbc.queryForList("SELECT id, email, full_name FROM users WHERE id = ? AND status = 'ACTIVE'", id);
                if (!rows.isEmpty()) {
                    // Only APPROVED roles count: a pending nutritionist/business has no extra access.
                    Set<String> roles = new LinkedHashSet<>(
                            jdbc.queryForList("SELECT role FROM user_roles WHERE user_id = ? AND status = 'APPROVED' ORDER BY role", String.class, id));
                    Map<String, Object> row = rows.get(0);
                    CurrentUser cu = new CurrentUser(id, (String) row.get("email"), (String) row.get("full_name"), roles);
                    List<SimpleGrantedAuthority> authorities =
                            roles.stream().map(r -> new SimpleGrantedAuthority("ROLE_" + r)).toList();
                    SecurityContextHolder.getContext()
                            .setAuthentication(new UsernamePasswordAuthenticationToken(cu, null, authorities));
                }
            } catch (Exception ignored) {
                // invalid/expired token -> request continues unauthenticated and is rejected where needed
            }
        }
        chain.doFilter(req, res);
    }
}
