package com.chakulasmart.planner;

import static com.chakulasmart.util.M.d;
import static com.chakulasmart.util.M.r2;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/shopping")
public class ShoppingController {

    public record CheckReq(boolean checked) {
    }

    public record AddItemReq(String name, Double quantity, String unit, Double estCost) {
    }

    public record NewListReq(String title) {
    }

    private final JdbcTemplate jdbc;

    public ShoppingController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private void requireOwner(CurrentUser me, long listId) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM shopping_lists WHERE id = ? AND user_id = ?", Integer.class, listId, me.id());
        if (n == null || n == 0) throw ApiException.notFound("Shopping list not found");
    }

    @GetMapping
    public List<Map<String, Object>> lists(@AuthenticationPrincipal CurrentUser me) {
        return jdbc.queryForList(
                "SELECT l.id, l.title, l.plan_id, l.created_at, count(i.id) AS item_count, "
                        + "count(i.id) FILTER (WHERE i.checked) AS checked_count, COALESCE(sum(i.est_cost), 0) AS est_total "
                        + "FROM shopping_lists l LEFT JOIN shopping_items i ON i.list_id = l.id "
                        + "WHERE l.user_id = ? GROUP BY l.id ORDER BY l.created_at DESC", me.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal CurrentUser me, @RequestBody NewListReq r) {
        String title = (r.title() == null || r.title().isBlank()) ? "My shopping list" : r.title().trim();
        Long id = jdbc.queryForObject("INSERT INTO shopping_lists (user_id, title) VALUES (?, ?) RETURNING id", Long.class, me.id(), title);
        return M.of("id", id);
    }

    /** List with items; every item also gets up to 3 cheapest in-stock vendor products that match it. */
    @GetMapping("/{id}")
    public Map<String, Object> detail(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        requireOwner(me, id);
        Map<String, Object> list = jdbc.queryForMap("SELECT id, title, plan_id, created_at FROM shopping_lists WHERE id = ?", id);
        List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT id, food_id, name, quantity, unit, est_cost, checked FROM shopping_items WHERE list_id = ? ORDER BY checked, id", id);
        double total = 0;
        for (Map<String, Object> it : items) {
            total += d(it.get("est_cost"));
            String base = String.valueOf(it.get("name")).toLowerCase().replaceAll("\\(.*\\)", "").trim();
            String[] words = base.split("\\s+");
            String key = "%" + (words.length == 0 || words[words.length - 1].length() < 3 ? base : words[words.length - 1]) + "%";
            it.put("vendors", jdbc.queryForList(
                    "SELECT p.id, p.name, p.price, p.unit, p.offer_text, b.user_id AS business_id, b.business_name, b.city, b.phone "
                            + "FROM products p JOIN business_profiles b ON b.user_id = p.business_id "
                            + "WHERE p.in_stock AND (p.food_id = ? OR lower(p.name) LIKE ?) ORDER BY p.price LIMIT 3",
                    it.get("food_id"), key));
        }
        Map<String, Object> out = new java.util.LinkedHashMap<>(list);
        out.put("items", items);
        out.put("est_total", r2(total));
        return out;
    }

    @PostMapping("/{id}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> addItem(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id, @RequestBody AddItemReq r) {
        requireOwner(me, id);
        if (r.name() == null || r.name().isBlank()) throw ApiException.badRequest("Item name is required");
        Long itemId = jdbc.queryForObject(
                "INSERT INTO shopping_items (list_id, name, quantity, unit, est_cost) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, id, r.name().trim(), r.quantity() == null ? 1 : r.quantity(), r.unit() == null ? "" : r.unit(),
                r.estCost() == null ? 0 : r.estCost());
        return M.of("id", itemId);
    }

    @PatchMapping("/items/{itemId}")
    public Map<String, Object> check(@AuthenticationPrincipal CurrentUser me, @PathVariable("itemId") long itemId, @RequestBody CheckReq r) {
        int n = jdbc.update("UPDATE shopping_items SET checked = ? WHERE id = ? AND list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)",
                r.checked(), itemId, me.id());
        if (n == 0) throw ApiException.notFound("Item not found");
        return M.of("id", itemId, "checked", r.checked());
    }

    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@AuthenticationPrincipal CurrentUser me, @PathVariable("itemId") long itemId) {
        jdbc.update("DELETE FROM shopping_items WHERE id = ? AND list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)", itemId, me.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        jdbc.update("DELETE FROM shopping_lists WHERE id = ? AND user_id = ?", id, me.id());
    }
}
