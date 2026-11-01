package com.chakulasmart.biz;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.config.Guard;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Food-business workspace. Businesses see ONLY their own listings and the enquiries sent to them. */
@RestController
@RequestMapping("/api")
public class BusinessController {

    public record BizProfileReq(@NotBlank String businessName, String category, String description, String city,
                                String phone, String whatsapp) {
    }

    public record ProductReq(@NotBlank @Size(max = 140) String name, String category, Double price, String unit,
                             String offerText, Boolean inStock, Long foodId) {
    }

    public record EnquiryReq(long businessId, @NotBlank @Size(max = 2000) String message, String contact) {
    }

    public record StatusReq(String status) {
    }

    private final JdbcTemplate jdbc;

    public BusinessController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/biz/overview")
    public Map<String, Object> overview(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "BUSINESS");
        return M.of(
                "products", jdbc.queryForObject("SELECT count(*) FROM products WHERE business_id = ?", Long.class, me.id()),
                "in_stock", jdbc.queryForObject("SELECT count(*) FROM products WHERE business_id = ? AND in_stock", Long.class, me.id()),
                "offers", jdbc.queryForObject("SELECT count(*) FROM products WHERE business_id = ? AND offer_text IS NOT NULL AND offer_text <> ''", Long.class, me.id()),
                "new_enquiries", jdbc.queryForObject("SELECT count(*) FROM enquiries WHERE business_id = ? AND status = 'NEW'", Long.class, me.id()),
                "total_enquiries", jdbc.queryForObject("SELECT count(*) FROM enquiries WHERE business_id = ?", Long.class, me.id()),
                "customers", jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = 'BUSINESS'", Long.class, me.id()),
                "customers_registered", jdbc.queryForObject("SELECT count(*) FROM managed_users WHERE owner_id = ? AND owner_role = 'BUSINESS' AND user_id IS NOT NULL", Long.class, me.id()));
    }

    @GetMapping("/biz/profile")
    public Map<String, Object> profile(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "BUSINESS");
        return jdbc.queryForMap("SELECT user_id, business_name, category, description, city, phone, whatsapp, verified "
                + "FROM business_profiles WHERE user_id = ?", me.id());
    }

    @PutMapping("/biz/profile")
    public Map<String, Object> updateProfile(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody BizProfileReq r) {
        Guard.role(me, "BUSINESS");
        jdbc.update("UPDATE business_profiles SET business_name = ?, category = ?, description = ?, city = ?, phone = ?, whatsapp = ? "
                        + "WHERE user_id = ?",
                r.businessName().trim(), r.category() == null || r.category().isBlank() ? "Grocery" : r.category().trim(),
                r.description() == null ? "" : r.description().trim(), r.city() == null ? "" : r.city().trim(),
                r.phone() == null ? "" : r.phone().trim(), r.whatsapp() == null ? "" : r.whatsapp().trim(), me.id());
        return profile(me);
    }

    @GetMapping("/biz/products")
    public List<Map<String, Object>> products(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "BUSINESS");
        return jdbc.queryForList("SELECT id, name, category, price, unit, offer_text, in_stock, food_id FROM products "
                + "WHERE business_id = ? ORDER BY name", me.id());
    }

    @PostMapping("/biz/products")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addProduct(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody ProductReq r) {
        Guard.role(me, "BUSINESS");
        if (r.price() == null || r.price() < 0) throw ApiException.badRequest("A valid price is required");
        Long id = jdbc.queryForObject(
                "INSERT INTO products (business_id, name, category, price, unit, offer_text, in_stock, food_id) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", Long.class,
                me.id(), r.name().trim(), r.category() == null || r.category().isBlank() ? "Other" : r.category().trim(),
                r.price(), r.unit() == null || r.unit().isBlank() ? "kg" : r.unit().trim(),
                r.offerText() == null || r.offerText().isBlank() ? null : r.offerText().trim(),
                r.inStock() == null || r.inStock(), r.foodId());
        return M.of("id", id);
    }

    @PutMapping("/biz/products/{id}")
    public Map<String, Object> updateProduct(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id,
                                             @Valid @RequestBody ProductReq r) {
        Guard.role(me, "BUSINESS");
        if (r.price() == null || r.price() < 0) throw ApiException.badRequest("A valid price is required");
        int n = jdbc.update("UPDATE products SET name = ?, category = ?, price = ?, unit = ?, offer_text = ?, in_stock = ?, food_id = ? "
                        + "WHERE id = ? AND business_id = ?",
                r.name().trim(), r.category() == null || r.category().isBlank() ? "Other" : r.category().trim(), r.price(),
                r.unit() == null || r.unit().isBlank() ? "kg" : r.unit().trim(),
                r.offerText() == null || r.offerText().isBlank() ? null : r.offerText().trim(),
                r.inStock() == null || r.inStock(), r.foodId(), id, me.id());
        if (n == 0) throw ApiException.notFound("Product not found");
        return M.of("id", id);
    }

    @DeleteMapping("/biz/products/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        Guard.role(me, "BUSINESS");
        jdbc.update("DELETE FROM products WHERE id = ? AND business_id = ?", id, me.id());
    }

    @GetMapping("/biz/enquiries")
    public List<Map<String, Object>> enquiries(@AuthenticationPrincipal CurrentUser me) {
        Guard.role(me, "BUSINESS");
        // Only the sender's name and the contact they chose to share, never any health or diary data.
        return jdbc.queryForList("SELECT e.id, e.message, e.contact, e.status, e.created_at, u.full_name AS from_name "
                + "FROM enquiries e JOIN users u ON u.id = e.from_user_id WHERE e.business_id = ? ORDER BY e.created_at DESC", me.id());
    }

    @PatchMapping("/biz/enquiries/{id}")
    public Map<String, Object> setEnquiryStatus(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id,
                                                @RequestBody StatusReq r) {
        Guard.role(me, "BUSINESS");
        String st = r.status() == null ? "" : r.status().toUpperCase();
        if (!Set.of("NEW", "REPLIED", "CLOSED").contains(st)) throw ApiException.badRequest("Invalid status");
        int n = jdbc.update("UPDATE enquiries SET status = ? WHERE id = ? AND business_id = ?", st, id, me.id());
        if (n == 0) throw ApiException.notFound("Enquiry not found");
        return M.of("id", id, "status", st);
    }

    /** Any signed-in user can contact a business. */
    @PostMapping("/enquiries")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> sendEnquiry(@AuthenticationPrincipal CurrentUser me, @Valid @RequestBody EnquiryReq r) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM business_profiles b JOIN user_roles ur ON ur.user_id = b.user_id AND ur.role = 'BUSINESS' AND ur.status = 'APPROVED' "
                + "JOIN users u ON u.id = b.user_id AND u.status = 'ACTIVE' WHERE b.user_id = ?", Integer.class, r.businessId());
        if (n == null || n == 0) throw ApiException.notFound("Business not found");
        Long id = jdbc.queryForObject("INSERT INTO enquiries (business_id, from_user_id, message, contact) VALUES (?, ?, ?, ?) RETURNING id",
                Long.class, r.businessId(), me.id(), r.message().trim(), r.contact());
        return M.of("id", id);
    }
}
