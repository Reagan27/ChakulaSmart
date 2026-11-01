package com.chakulasmart.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Sends plain-text email. If no SMTP server is configured (SPRING_MAIL_HOST unset) the message is written to the
 * backend log instead, so development works without a mail server. Every attempt is recorded in email_log (no body).
 */
@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final JdbcTemplate jdbc;
    private final String from;

    public MailService(ObjectProvider<JavaMailSender> sender, JdbcTemplate jdbc, @Value("${app.mail.from}") String from) {
        this.sender = sender;
        this.jdbc = jdbc;
        this.from = from;
    }

    @Async
    public void send(String to, String subject, String body, String kind) {
        JavaMailSender s = sender.getIfAvailable();
        if (s == null) {
            log.info("\n===== EMAIL (no SMTP configured, not sent) =====\nTo: {}\nSubject: {}\n\n{}\n================================================", to, subject, body);
            record(to, subject, kind, "LOGGED", null);
            return;
        }
        try {
            SimpleMailMessage m = new SimpleMailMessage();
            m.setFrom(from);
            m.setTo(to);
            m.setSubject(subject);
            m.setText(body);
            s.send(m);
            record(to, subject, kind, "SENT", null);
        } catch (Exception e) {
            log.warn("Could not send '{}' email to {}: {}", kind, to, e.getMessage());
            String msg = String.valueOf(e.getMessage());
            record(to, subject, kind, "FAILED", msg.length() > 480 ? msg.substring(0, 480) : msg);
        }
    }

    private void record(String to, String subject, String kind, String status, String error) {
        try {
            jdbc.update("INSERT INTO email_log (to_email, subject, kind, status, error) VALUES (?, ?, ?, ?, ?)",
                    to, subject.length() > 240 ? subject.substring(0, 240) : subject, kind, status, error);
        } catch (Exception e) {
            log.warn("Could not write email_log: {}", e.getMessage());
        }
    }
}
