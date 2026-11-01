package com.chakulasmart.config;

import java.util.Set;

/** The authenticated principal. Roles are always re-read from the database, never trusted from the client. */
public record CurrentUser(long id, String email, String fullName, Set<String> roles) {
    public boolean has(String role) {
        return roles.contains(role);
    }
}
