package com.chakulasmart.config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Runs BEFORE Spring starts. If the target database does not exist yet, it connects to the
 * server's maintenance database ("postgres") with the same credentials and creates it.
 * Tables are then created by Flyway.
 */
public final class DatabaseBootstrap {

    private static final Pattern URL = Pattern.compile("^(jdbc:postgresql://[^/]+)/([^?]+)(\\?.*)?$");

    private DatabaseBootstrap() {
    }

    private static String env(String key, String fallback) {
        String v = System.getenv(key);
        return (v == null || v.isBlank()) ? fallback : v;
    }

    public static void ensureDatabaseExists() {
        String url = env("CHAKULA_DB_URL", "jdbc:postgresql://localhost:5432/chakulasmart");
        String user = env("CHAKULA_DB_USER", "tickets");
        String pass = env("CHAKULA_DB_PASSWORD", "tickets");

        Matcher m = URL.matcher(url);
        if (!m.matches()) {
            System.out.println("[ChakulaSmart] CHAKULA_DB_URL not in the expected form; skipping auto-create of the database.");
            return;
        }
        String base = m.group(1);
        String db = m.group(2);
        String query = m.group(3) == null ? "" : m.group(3);
        if (!db.matches("[A-Za-z0-9_]+")) {
            System.out.println("[ChakulaSmart] Database name '" + db + "' has unusual characters; skipping auto-create.");
            return;
        }

        // 1) Already there? Then nothing to do.
        try (Connection ignored = DriverManager.getConnection(url, user, pass)) {
            System.out.println("[ChakulaSmart] Database '" + db + "' is available.");
            return;
        } catch (SQLException notThereYet) {
            // fall through and try to create it
        }

        // 2) Create it using the maintenance database.
        try (Connection admin = DriverManager.getConnection(base + "/postgres" + query, user, pass)) {
            boolean exists = false;
            try (PreparedStatement ps = admin.prepareStatement("SELECT 1 FROM pg_database WHERE datname = ?")) {
                ps.setString(1, db);
                try (ResultSet rs = ps.executeQuery()) {
                    exists = rs.next();
                }
            }
            if (!exists) {
                try (Statement st = admin.createStatement()) {
                    st.execute("CREATE DATABASE \"" + db + "\"");
                }
                System.out.println("[ChakulaSmart] Created database '" + db + "'.");
            }
        } catch (SQLException e) {
            System.err.println("[ChakulaSmart] Could not create database '" + db + "': " + e.getMessage());
            System.err.println("[ChakulaSmart] Fix: run   ALTER ROLE " + user + " CREATEDB;   as a Postgres superuser,"
                    + " or create it yourself:   CREATE DATABASE " + db + " OWNER " + user + ";");
        }
    }
}
