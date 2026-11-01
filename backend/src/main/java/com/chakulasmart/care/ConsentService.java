package com.chakulasmart.care;

import com.chakulasmart.web.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Single place that decides whether a nutritionist may touch a client's data. */
@Component
public class ConsentService {
    private final JdbcTemplate jdbc;

    public ConsentService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isActive(long nutritionistId, long clientId) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM nutritionist_clients WHERE nutritionist_id = ? AND client_id = ? AND status = 'ACTIVE'",
                Integer.class, nutritionistId, clientId);
        return n != null && n > 0;
    }

    public void requireActive(long nutritionistId, long clientId) {
        if (!isActive(nutritionistId, clientId)) {
            throw ApiException.forbidden("This client has not granted you access (or has withdrawn it)");
        }
    }

    public void audit(long actorId, long subjectId, String action) {
        jdbc.update("INSERT INTO access_log (actor_id, subject_id, action) VALUES (?, ?, ?)", actorId, subjectId, action);
    }
}
