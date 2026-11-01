package com.chakulasmart.catalog;

import static com.chakulasmart.util.M.d;
import static com.chakulasmart.util.M.l;
import static com.chakulasmart.util.M.r1;
import static com.chakulasmart.util.M.r2;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Recipes with ingredient list, cost per portion and nutrition per portion (computed from foods). */
@Component
public class RecipeCatalog {

    public record Ingredient(long foodId, String name, String emoji, String category, String servingDesc,
                             double quantity, double cost, double calories, double protein, double carbs,
                             double fat, double fiber, String allergens) {
    }

    public record Recipe(long id, String name, String description, String emoji, String mealType, int prepMinutes,
                         String steps, String tags, double cost, double calories, double protein, double carbs,
                         double fat, double fiber, List<String> allergens, List<Ingredient> ingredients,
                         Long ownerId, String ownerName) {
        public boolean isFor(String type) {
            return List.of(mealType.split(",")).contains(type);
        }
    }

    private final JdbcTemplate jdbc;

    public RecipeCatalog(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Recipe> all() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.id, r.name, r.description, r.emoji, r.meal_type, r.prep_minutes, r.steps, r.tags, r.owner_id, "
                        + "CASE WHEN bp.business_name IS NOT NULL THEN bp.business_name ELSE u.full_name END AS owner_name "
                        + "FROM recipes r LEFT JOIN users u ON u.id = r.owner_id LEFT JOIN business_profiles bp ON bp.user_id = r.owner_id "
                        + "WHERE r.active ORDER BY r.name");
        List<Map<String, Object>> ing = jdbc.queryForList(
                "SELECT ri.recipe_id, ri.quantity, f.id AS food_id, f.name, f.emoji, f.category, f.serving_desc, "
                        + "f.calories, f.protein, f.carbs, f.fat, f.fiber, f.price_kes, f.allergens "
                        + "FROM recipe_ingredients ri JOIN foods f ON f.id = ri.food_id ORDER BY ri.id");
        Map<Long, List<Ingredient>> byRecipe = new HashMap<>();
        for (Map<String, Object> r : ing) {
            double q = d(r.get("quantity"));
            Ingredient i = new Ingredient(l(r.get("food_id")), (String) r.get("name"), (String) r.get("emoji"),
                    (String) r.get("category"), (String) r.get("serving_desc"), q,
                    r2(q * d(r.get("price_kes"))), r1(q * d(r.get("calories"))), r1(q * d(r.get("protein"))),
                    r1(q * d(r.get("carbs"))), r1(q * d(r.get("fat"))), r1(q * d(r.get("fiber"))),
                    (String) r.get("allergens"));
            byRecipe.computeIfAbsent(l(r.get("recipe_id")), k -> new ArrayList<>()).add(i);
        }
        List<Recipe> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            long id = l(r.get("id"));
            List<Ingredient> list = byRecipe.getOrDefault(id, List.of());
            double cost = 0, cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
            Set<String> allergens = new LinkedHashSet<>();
            for (Ingredient i : list) {
                cost += i.cost();
                cal += i.calories();
                pro += i.protein();
                carb += i.carbs();
                fat += i.fat();
                fib += i.fiber();
                for (String a : i.allergens().split(",")) {
                    if (!a.isBlank()) allergens.add(a.trim());
                }
            }
            out.add(new Recipe(id, (String) r.get("name"), (String) r.get("description"), (String) r.get("emoji"),
                    (String) r.get("meal_type"), ((Number) r.get("prep_minutes")).intValue(), (String) r.get("steps"),
                    (String) r.get("tags"), r2(cost), r1(cal), r1(pro), r1(carb), r1(fat), r1(fib),
                    new ArrayList<>(allergens), list,
                    r.get("owner_id") == null ? null : l(r.get("owner_id")), (String) r.get("owner_name")));
        }
        return out;
    }

    public Optional<Recipe> find(long id) {
        return all().stream().filter(r -> r.id() == id).findFirst();
    }
}
