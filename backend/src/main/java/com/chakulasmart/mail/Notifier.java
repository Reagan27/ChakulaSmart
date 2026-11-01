package com.chakulasmart.mail;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriUtils;
import java.nio.charset.StandardCharsets;

/** All the emails the platform sends, in one place. */
@Component
public class Notifier {
    private final MailService mail;
    private final JdbcTemplate jdbc;
    private final String baseUrl;

    public Notifier(MailService mail, JdbcTemplate jdbc, @Value("${app.base-url}") String baseUrl) {
        this.mail = mail;
        this.jdbc = jdbc;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String link(String path, String token) {
        return baseUrl + path + "?token=" + UriUtils.encode(token, StandardCharsets.UTF_8);
    }

    private static String first(String name) {
        String n = name == null ? "" : name.trim();
        int i = n.indexOf(' ');
        return i > 0 ? n.substring(0, i) : (n.isEmpty() ? "there" : n);
    }

    private static final String FOOTER = "\n\n— The ChakulaSmart team\nEat better. Spend smarter. Live healthier.";

    public void passwordReset(String to, String name, String token, boolean welcome) {
        String url = link("/reset-password", token);
        String subject = welcome ? "Set your ChakulaSmart password" : "Reset your ChakulaSmart password";
        String intro = welcome ? "An administrator account has been created for you on ChakulaSmart. Choose a password to get started:"
                : "We received a request to reset your password. Choose a new one here:";
        mail.send(to, subject, "Hello " + first(name) + ",\n\n" + intro + "\n\n" + url
                + "\n\nThis link works once and expires in 1 hour. If you did not ask for it, you can ignore this email; your password stays the same." + FOOTER,
                welcome ? "ADMIN_WELCOME" : "PASSWORD_RESET");
    }

    public void passwordChanged(String to, String name) {
        mail.send(to, "Your ChakulaSmart password was changed",
                "Hello " + first(name) + ",\n\nYour password was just changed. If this was not you, reset it now at "
                        + baseUrl + "/forgot-password and contact support." + FOOTER, "PASSWORD_CHANGED");
    }

    /** Invitation for someone who has no account yet. ownerRole is NUTRITIONIST or BUSINESS. */
    public void inviteNew(String to, String name, String ownerName, String ownerRole, String token, int days) {
        boolean pro = "NUTRITIONIST".equals(ownerRole);
        String url = link("/join", token);
        String what = pro
                ? ownerName + ", a nutritionist on ChakulaSmart, has invited you to be their client. Create your free account to plan meals, track your food budget and share your progress with them."
                : ownerName + " has added you as a customer on ChakulaSmart. Create your free account to plan meals, track your food budget and see their fresh produce and offers.";
        String consent = pro ? "\n\nYou stay in control: your nutritionist only sees your diary and progress because you join through this link, and you can withdraw access at any time."
                : "\n\nYou stay in control: the business only sees your name and the contact details you share.";
        mail.send(to, ownerName + " invited you to ChakulaSmart",
                "Hello " + first(name) + ",\n\n" + what + "\n\nCreate your account:\n" + url + "\n\nThe link is personal to you and is valid for "
                        + days + " days." + consent + FOOTER, "INVITE");
    }

    /** Someone who already has an account was added to a roster. */
    public void connectionRequest(String to, String name, String ownerName, String ownerRole) {
        boolean pro = "NUTRITIONIST".equals(ownerRole);
        String body = pro
                ? ownerName + " (nutritionist) would like to work with you on ChakulaSmart. They cannot see anything until you accept.\n\nSign in and open \"My nutritionist\" to accept or decline:\n" + baseUrl + "/app/care"
                : ownerName + " has added you as a customer on ChakulaSmart. They only see your name and the contact details you shared.\n\nSign in any time: " + baseUrl + "/login";
        mail.send(to, pro ? ownerName + " wants to connect with you" : ownerName + " added you as a customer",
                "Hello " + first(name) + ",\n\n" + body + FOOTER, pro ? "CONNECTION_REQUEST" : "CUSTOMER_ADDED");
    }

    public void applicationReceived(String to, String name, String role) {
        mail.send(to, "We received your ChakulaSmart application",
                "Hello " + first(name) + ",\n\nThank you for applying as a " + label(role) + ". An administrator reviews every application; you will get an email as soon as it is decided, and you can sign in after approval." + FOOTER,
                "APPLICATION_RECEIVED");
    }

    public void applicationApproved(String to, String name, String role, boolean newAccount) {
        mail.send(to, "Your ChakulaSmart " + label(role) + " account is approved",
                "Hello " + first(name) + ",\n\nGood news: your " + label(role) + " access has been approved. "
                        + (newAccount ? "You can now sign in:" : "Open your workspace here:") + "\n" + baseUrl + "/login" + FOOTER, "APPLICATION_APPROVED");
    }

    public void applicationRejected(String to, String name, String role, String note) {
        mail.send(to, "Update on your ChakulaSmart application",
                "Hello " + first(name) + ",\n\nWe were not able to approve your " + label(role) + " application at this time."
                        + (note == null || note.isBlank() ? "" : "\n\nReviewer note: " + note.trim())
                        + "\n\nIf you think this is a mistake, reply to this email with more details." + FOOTER, "APPLICATION_REJECTED");
    }

    public void accountSuspended(String to, String name, String note) {
        mail.send(to, "Your ChakulaSmart account was suspended",
                "Hello " + first(name) + ",\n\nYour account has been suspended by an administrator."
                        + (note == null || note.isBlank() ? "" : "\n\nReason: " + note.trim()) + "\n\nPlease contact support if you have questions." + FOOTER,
                "ACCOUNT_SUSPENDED");
    }

    /** Tell every active administrator that an application is waiting. */
    public void newApplicationForAdmins(String applicantName, String applicantEmail, String role) {
        List<String> admins = jdbc.queryForList(
                "SELECT u.email FROM users u JOIN user_roles r ON r.user_id = u.id AND r.role = 'ADMIN' AND r.status = 'APPROVED' WHERE u.status = 'ACTIVE'",
                String.class);
        for (String a : admins) {
            mail.send(a, "New " + label(role) + " application: " + applicantName,
                    applicantName + " (" + applicantEmail + ") applied as a " + label(role) + ".\n\nReview it here: " + baseUrl + "/admin/approvals" + FOOTER,
                    "ADMIN_NEW_APPLICATION");
        }
    }

    private static String label(String role) {
        return "NUTRITIONIST".equals(role) ? "nutritionist" : "BUSINESS".equals(role) ? "food business" : role.toLowerCase();
    }
}
