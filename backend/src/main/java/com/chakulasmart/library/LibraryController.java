package com.chakulasmart.library;

import com.chakulasmart.catalog.RecipeCatalog;
import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Foods and recipes that admins, nutritionists and businesses add to the shared library.
 * Once saved they are available to everyone's meal ideas, planner and shopping lists.
 * Owners edit/delete their own items; admins can manage everything. Built-in items (no owner) are admin-only.
 */
@RestController
@RequestMapping("/api/library")
public class LibraryController {
    private static final Set<String> MEALS = Set.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");

    public record FoodReq(String name, String category, String emoji, String servingDesc, Double calories, Double protein,
                          Double carbs, Double fat, Double fiber, Double priceKes, String allergens) {
    }

    public record IngredientReq(Long foodId, Double quantity) {
    }

    public record RecipeReq(String name, String description, String emoji, List<String> mealTypes, Integer prepMinutes,
                            String steps, String tags, List<IngredientReq> ingredients) {
    }

    private final JdbcTemplate jdbc;
    private final RecipeCatalog catalog;

    public LibraryController(JdbcTemplate jdbc, RecipeCatalog catalog) {
        this.jdbc = jdbc;
        this.catalog = catalog;
    }

    private static boolean admin(CurrentUser me) {
        return me.has("ADMIN");
    }

    private static void canCreate(CurrentUser me) {
        if (!(me.has("ADMIN") || me.has("NUTRITIONIST") || me.has("BUSINESS"))) {
            throw ApiException.forbidden("Only approved nutritionists, businesses and admins can add to the library");
        }
    }

    /** Items the caller may edit: their own (admins: everything). */
    @GetMapping("/mine")
    public Map<String, Object> mine(@AuthenticationPrincipal CurrentUser me) {
        canCreate(me);
        String foodSql = "SELECT id, name, category, emoji, serving_desc, calories, protein, carbs, fat, fiber, price_kes, allergens, owner_id, created_at "
                + "FROM foods WHERE active" + (admin(me) ? "" : " AND owner_id = ?") + " ORDER BY category, name";
        List<Map<String, Object>> foods = admin(me) ? jdbc.queryForList(foodSql) : jdbc.queryForList(foodSql, me.id());
        List<RecipeCatalog.Recipe> recipes = catalog.all().stream()
                .filter(r -> admin(me) || (r.ownerId() != null && r.ownerId() == me.id())).toList();
        return M.of("foods", foods, "recipes", recipes);
    }

    // ------------------------------------------------------------ foods

    @PostMapping("/foods")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createFood(@AuthenticationPrincipal CurrentUser me, @RequestBody FoodReq r) {
        canCreate(me);
        Object[] v = foodValues(r);
        try {
            Long id = jdbc.queryForObject("INSERT INTO foods (name, category, emoji, serving_desc, calories, protein, carbs, fat, fiber, price_kes, allergens, owner_id) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", Long.class, append(v, me.id()));
            return M.of("id", id);
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("A food with that name already exists. Search for it and use it in your recipe.");
        }
    }

    @PutMapping("/foods/{id}")
    public Map<String, Object> updateFood(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id, @RequestBody FoodReq r) {
        canCreate(me);
        requireOwner(me, "foods", id);
        try {
            jdbc.update("UPDATE foods SET name = ?, category = ?, emoji = ?, serving_desc = ?, calories = ?, protein = ?, carbs = ?, fat = ?, fiber = ?, "
                    + "price_kes = ?, allergens = ? WHERE id = ?", append(foodValues(r), id));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("Another food already uses that name");
        }
        return M.of("id", id);
    }

    /** Deletes the food, or just hides it if recipes or diaries still use it. */
    @DeleteMapping("/foods/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFood(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        canCreate(me);
        requireOwner(me, "foods", id);
        Integer used = jdbc.queryForObject("SELECT (SELECT count(*) FROM recipe_ingredients WHERE food_id = ?) + (SELECT count(*) FROM meal_items WHERE food_id = ?)",
                Integer.class, id, id);
        if (used != null && used > 0) {
            Integer inActive = jdbc.queryForObject("SELECT count(*) FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id AND r.active WHERE ri.food_id = ?", Integer.class, id);
            if (inActive != null && inActive > 0) {
                throw ApiException.conflict("This food is used in " + inActive + " recipe(s). Remove it from them first.");
            }
            jdbc.update("UPDATE foods SET active = FALSE WHERE id = ?", id);
        } else {
            jdbc.update("DELETE FROM foods WHERE id = ?", id);
        }
    }

    private static Object[] foodValues(FoodReq r) {
        String name = r.name() == null ? "" : r.name().trim();
        if (name.isEmpty() || name.length() > 120) throw ApiException.badRequest("Food name is required (max 120 characters)");
        String serving = r.servingDesc() == null ? "" : r.servingDesc().trim();
        if (serving.isEmpty()) throw ApiException.badRequest("Describe one serving, e.g. \"1 plate (250 g)\"");
        double price = num(r.priceKes(), "Price", 100000);
        return new Object[]{name, blank(r.category(), "Other", 30), blank(r.emoji(), "🍽️", 8), serving.length() > 80 ? serving.substring(0, 80) : serving,
                num(r.calories(), "Calories", 5000), num(r.protein(), "Protein", 500), num(r.carbs(), "Carbs", 1000), num(r.fat(), "Fat", 500),
                num(r.fiber(), "Fibre", 200), price, r.allergens() == null ? "" : r.allergens().trim()};
    }

    // ------------------------------------------------------------ recipes

    @PostMapping("/recipes")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> createRecipe(@AuthenticationPrincipal CurrentUser me, @RequestBody RecipeReq r) {
        canCreate(me);
        Object[] v = recipeValues(r);
        Long id;
        try {
            id = jdbc.queryForObject("INSERT INTO recipes (name, description, emoji, meal_type, prep_minutes, steps, tags, owner_id) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id", Long.class, append(v, me.id()));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("A recipe with that name already exists. Choose a different name.");
        }
        saveIngredients(id, r.ingredients());
        return M.of("id", id);
    }

    @PutMapping("/recipes/{id}")
    @Transactional
    public Map<String, Object> updateRecipe(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id, @RequestBody RecipeReq r) {
        canCreate(me);
        requireOwner(me, "recipes", id);
        Object[] v = recipeValues(r);
        try {
            jdbc.update("UPDATE recipes SET name = ?, description = ?, emoji = ?, meal_type = ?, prep_minutes = ?, steps = ?, tags = ? WHERE id = ?", append(v, id));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("Another recipe already uses that name");
        }
        jdbc.update("DELETE FROM recipe_ingredients WHERE recipe_id = ?", id);
        saveIngredients(id, r.ingredients());
        return M.of("id", id);
    }

    /** Deletes the recipe, or hides it if it is already in someone's plan or diary (so their history stays intact). */
    @DeleteMapping("/recipes/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRecipe(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        canCreate(me);
        requireOwner(me, "recipes", id);
        Integer used = jdbc.queryForObject("SELECT (SELECT count(*) FROM meal_plan_entries WHERE recipe_id = ?) + (SELECT count(*) FROM meals WHERE recipe_id = ?)",
                Integer.class, id, id);
        if (used != null && used > 0) {
            jdbc.update("UPDATE recipes SET active = FALSE WHERE id = ?", id);
        } else {
            jdbc.update("DELETE FROM recipes WHERE id = ?", id);
        }
    }

    private Object[] recipeValues(RecipeReq r) {
        String name = r.name() == null ? "" : r.name().trim();
        if (name.isEmpty() || name.length() > 150) throw ApiException.badRequest("Recipe name is required (max 150 characters)");
        Set<String> meals = new LinkedHashSet<>();
        if (r.mealTypes() != null) for (String m : r.mealTypes()) if (m != null && MEALS.contains(m.toUpperCase())) meals.add(m.toUpperCase());
        if (meals.isEmpty()) throw ApiException.badRequest("Pick at least one meal type");
        int prep = r.prepMinutes() == null ? 20 : r.prepMinutes();
        if (prep < 1 || prep > 1440) throw ApiException.badRequest("Preparation time must be 1 to 1440 minutes");
        String steps = r.steps() == null ? "" : r.steps().trim();
        if (steps.isEmpty()) throw ApiException.badRequest("Add the preparation steps");
        if (r.ingredients() == null || r.ingredients().isEmpty()) throw ApiException.badRequest("Add at least one ingredient");
        String tags = r.tags() == null ? "" : r.tags().trim();
        return new Object[]{name, r.description() == null ? "" : r.description().trim(), blank(r.emoji(), "🍲", 8),
                String.join(",", meals), prep, steps, tags.length() > 200 ? tags.substring(0, 200) : tags};
    }

    private void saveIngredients(long recipeId, List<IngredientReq> list) {
        Set<Long> seen = new LinkedHashSet<>();
        for (IngredientReq i : list) {
            if (i.foodId() == null || i.quantity() == null || i.quantity() <= 0 || i.quantity() > 9999) {
                throw ApiException.badRequest("Every ingredient needs a food and a quantity above 0");
            }
            if (!seen.add(i.foodId())) throw ApiException.badRequest("Each food can appear only once in a recipe");
            Integer ok = jdbc.queryForObject("SELECT count(*) FROM foods WHERE id = ? AND active", Integer.class, i.foodId());
            if (ok == null || ok == 0) throw ApiException.badRequest("An ingredient food no longer exists");
            jdbc.update("INSERT INTO recipe_ingredients (recipe_id, food_id, quantity) VALUES (?, ?, ?)", recipeId, i.foodId(), i.quantity());
        }
    }

    // ------------------------------------------------------------ helpers

    /** table is a fixed internal literal ("foods" or "recipes"), never user input. */
    private void requireOwner(CurrentUser me, String table, long id) {
        List<Long> owner = jdbc.queryForList("SELECT COALESCE(owner_id, 0) FROM " + table + " WHERE id = ? AND active", Long.class, id);
        if (owner.isEmpty()) throw ApiException.notFound("Not found");
        if (!admin(me) && owner.get(0) != me.id()) throw ApiException.forbidden("You can only change items you created");
    }

    private static Object[] append(Object[] a, Object extra) {
        Object[] out = java.util.Arrays.copyOf(a, a.length + 1);
        out[a.length] = extra;
        return out;
    }

    private static String blank(String s, String dflt, int max) {
        String t = s == null ? "" : s.trim();
        if (t.isEmpty()) return dflt;
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static double num(Double v, String label, double max) {
        double d = v == null ? 0 : v;
        if (d < 0 || d > max) throw ApiException.badRequest(label + " must be between 0 and " + (long) max);
        return d;
    }
}
