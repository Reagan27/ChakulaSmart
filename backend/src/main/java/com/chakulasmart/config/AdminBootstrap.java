package com.chakulasmart.config;

import com.chakulasmart.account.AccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Creates the first administrator on startup (ADMIN_EMAIL / ADMIN_PASSWORD). Never overwrites an existing account. */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private static final String DEFAULT_PASSWORD = "Demo@1234";

    private final JdbcTemplate jdbc;
    private final AccountService accounts;
    private final String email;
    private final String password;
    private final String name;

    public AdminBootstrap(JdbcTemplate jdbc, AccountService accounts,
                          @Value("${app.admin.email}") String email,
                          @Value("${app.admin.password}") String password,
                          @Value("${app.admin.name}") String name) {
        this.jdbc = jdbc;
        this.accounts = accounts;
        this.email = email == null ? "" : email.trim();
        this.password = password == null ? "" : password;
        this.name = name;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isEmpty() || password.length() < 8) {
            log.warn("No administrator created: set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 8 characters.");
            return;
        }
        Integer exists = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = ?", Integer.class, email.toLowerCase());
        if (exists != null && exists > 0) return;
        accounts.createAdmin(email, password, name);
        log.info("Administrator created: {}", email);
        if (DEFAULT_PASSWORD.equals(password)) {
            log.warn("The administrator uses the DEFAULT password. Sign in and change it (Account & password), or set ADMIN_PASSWORD, before going live.");
        }
    }
}
