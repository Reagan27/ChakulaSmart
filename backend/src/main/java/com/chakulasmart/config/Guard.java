package com.chakulasmart.config;

import com.chakulasmart.web.ApiException;

public final class Guard {
    private Guard() {
    }

    public static void role(CurrentUser me, String role) {
        if (me == null || !me.has(role)) {
            throw ApiException.forbidden("This area needs a " + role.toLowerCase()
                    + " account. You can activate it from your account page.");
        }
    }
}
