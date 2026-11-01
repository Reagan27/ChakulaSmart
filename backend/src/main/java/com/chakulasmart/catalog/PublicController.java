package com.chakulasmart.catalog;

import com.chakulasmart.billing.Plans;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Everything here is readable WITHOUT an account. Never exposes any private user data. */
@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final JdbcTemplate jdbc;
    private final RecipeCatalog catalog;

    public PublicController(JdbcTemplate jdbc, RecipeCatalog catalog) {
        this.jdbc = jdbc;
        this.catalog = catalog;
    }

    private static String like(String q) {
        return "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return M.of(
                "foods", jdbc.queryForObject("SELECT count(*) FROM foods WHERE active", Long.class),
                "recipes", jdbc.queryForObject("SELECT count(*) FROM recipes WHERE active", Long.class),
                "nutritionists", jdbc.queryForObject("SELECT count(*) FROM nutritionist_profiles n JOIN users u ON u.id = n.user_id AND u.status = 'ACTIVE' "
                        + "JOIN user_roles r ON r.user_id = n.user_id AND r.role = 'NUTRITIONIST' AND r.status = 'APPROVED'", Long.class),
                "businesses", jdbc.queryForObject("SELECT count(*) FROM business_profiles b "
                        + "JOIN users bu ON bu.id = b.user_id AND bu.status = 'ACTIVE' JOIN user_roles br ON br.user_id = b.user_id AND br.role = 'BUSINESS' AND br.status = 'APPROVED'", Long.class));
    }

    @GetMapping("/foods")
    public List<Map<String, Object>> foods(@RequestParam(name = "q", required = false) String q,
                                           @RequestParam(name = "category", required = false) String category) {
        StringBuilder sql = new StringBuilder("SELECT id, name, category, emoji, serving_desc, calories, protein, carbs, fat, "
                + "fiber, price_kes, allergens FROM foods WHERE active");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND lower(name) LIKE ?");
            args.add(like(q));
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND category = ?");
            args.add(category);
        }
        sql.append(" ORDER BY category, name");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/recipes")
    public List<RecipeCatalog.Recipe> recipes(@RequestParam(name = "q", required = false) String q,
                                              @RequestParam(name = "meal_type", required = false) String mealType,
                                              @RequestParam(name = "max_cost", required = false) Double maxCost,
                                              @RequestParam(name = "tag", required = false) String tag) {
        return catalog.all().stream()
                .filter(r -> q == null || q.isBlank() || r.name().toLowerCase().contains(q.trim().toLowerCase())
                        || r.ingredients().stream().anyMatch(i -> i.name().toLowerCase().contains(q.trim().toLowerCase())))
                .filter(r -> mealType == null || mealType.isBlank() || r.isFor(mealType.toUpperCase()))
                .filter(r -> maxCost == null || r.cost() <= maxCost)
                .filter(r -> tag == null || tag.isBlank() || r.tags().contains(tag))
                .toList();
    }

    @GetMapping("/recipes/{id}")
    public RecipeCatalog.Recipe recipe(@PathVariable("id") long id) {
        return catalog.find(id).orElseThrow(() -> ApiException.notFound("Recipe not found"));
    }

    @GetMapping("/nutritionists")
    public List<Map<String, Object>> nutritionists(@RequestParam(name = "q", required = false) String q,
                                                   @RequestParam(name = "city", required = false) String city) {
        StringBuilder sql = new StringBuilder("SELECT u.id, u.full_name, n.headline, n.bio, n.specialization, n.city, "
                + "n.monthly_fee, n.accepting_clients FROM nutritionist_profiles n JOIN users u ON u.id = n.user_id AND u.status = 'ACTIVE' "
                + "JOIN user_roles ur ON ur.user_id = n.user_id AND ur.role = 'NUTRITIONIST' AND ur.status = 'APPROVED' WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(u.full_name) LIKE ? OR lower(n.specialization) LIKE ? OR lower(n.headline) LIKE ?)");
            String p = like(q);
            args.add(p);
            args.add(p);
            args.add(p);
        }
        if (city != null && !city.isBlank()) {
            sql.append(" AND lower(n.city) LIKE ?");
            args.add(like(city));
        }
        sql.append(" ORDER BY n.accepting_clients DESC, u.full_name");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/businesses")
    public List<Map<String, Object>> businesses(@RequestParam(name = "q", required = false) String q,
                                                @RequestParam(name = "category", required = false) String category) {
        StringBuilder sql = new StringBuilder("SELECT b.user_id AS id, b.business_name, b.category, b.description, b.city, "
                + "b.phone, b.whatsapp, b.verified, (SELECT count(*) FROM products p WHERE p.business_id = b.user_id) AS product_count "
                + "FROM business_profiles b JOIN users bu ON bu.id = b.user_id AND bu.status = 'ACTIVE' JOIN user_roles br ON br.user_id = b.user_id AND br.role = 'BUSINESS' AND br.status = 'APPROVED' WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(b.business_name) LIKE ? OR lower(b.description) LIKE ? OR EXISTS "
                    + "(SELECT 1 FROM products p WHERE p.business_id = b.user_id AND lower(p.name) LIKE ?))");
            String p = like(q);
            args.add(p);
            args.add(p);
            args.add(p);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND b.category = ?");
            args.add(category);
        }
        sql.append(" ORDER BY b.verified DESC, b.business_name");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/businesses/{id}")
    public Map<String, Object> business(@PathVariable("id") long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT b.user_id AS id, b.business_name, b.category, b.description, b.city, b.phone, b.whatsapp, b.verified "
                        + "FROM business_profiles b JOIN users bu ON bu.id = b.user_id AND bu.status = 'ACTIVE' JOIN user_roles br ON br.user_id = b.user_id AND br.role = 'BUSINESS' AND br.status = 'APPROVED' WHERE b.user_id = ?", id);
        if (rows.isEmpty()) throw ApiException.notFound("Business not found");
        Map<String, Object> b = new java.util.LinkedHashMap<>(rows.get(0));
        b.put("products", jdbc.queryForList(
                "SELECT id, name, category, price, unit, offer_text, in_stock FROM products WHERE business_id = ? "
                        + "ORDER BY in_stock DESC, name", id));
        return b;
    }

    @GetMapping("/products")
    public List<Map<String, Object>> products(@RequestParam(name = "q", required = false) String q) {
        StringBuilder sql = new StringBuilder("SELECT p.id, p.name, p.category, p.price, p.unit, p.offer_text, p.in_stock, "
                + "b.user_id AS business_id, b.business_name, b.city FROM products p JOIN business_profiles b ON b.user_id = p.business_id "
                + "JOIN users bu ON bu.id = b.user_id AND bu.status = 'ACTIVE' JOIN user_roles br ON br.user_id = b.user_id AND br.role = 'BUSINESS' AND br.status = 'APPROVED' WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND lower(p.name) LIKE ?");
            args.add(like(q));
        }
        sql.append(" ORDER BY p.price LIMIT 60");
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    @GetMapping("/plans")
    public List<Map<String, Object>> plans() {
        return Plans.ALL;
    }
}
