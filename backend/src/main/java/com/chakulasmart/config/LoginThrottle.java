package com.chakulasmart.config;

import com.chakulasmart.web.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** In-memory brute-force guard: too many failed sign-ins for one key lock it for a while. */
@Component
public class LoginThrottle {
    private static final int MAX_FAILURES = 8;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public void check(String key) {
        Deque<Instant> q = failures.get(key);
        if (q == null) return;
        synchronized (q) {
            prune(q);
            if (q.size() >= MAX_FAILURES) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many failed attempts. Please wait a few minutes or reset your password.");
            }
        }
    }

    public void fail(String key) {
        Deque<Instant> q = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            prune(q);
            q.addLast(Instant.now());
        }
    }

    public void clear(String key) {
        failures.remove(key);
    }

    private static void prune(Deque<Instant> q) {
        Instant cutoff = Instant.now().minus(WINDOW);
        while (!q.isEmpty() && q.peekFirst().isBefore(cutoff)) q.pollFirst();
    }
}
