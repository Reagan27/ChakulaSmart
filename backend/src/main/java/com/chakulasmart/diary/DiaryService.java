package com.chakulasmart.diary;

import static com.chakulasmart.util.M.d;
import static com.chakulasmart.util.M.r1;
import static com.chakulasmart.util.M.r2;

import com.chakulasmart.catalog.RecipeCatalog;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DiaryService {
    public static final Set<String> MEAL_TYPES = Set.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");

    public record ItemReq(long foodId, double servings) {
    }

    public record MealReq(LocalDate date, String mealType, Long recipeId, Double portions, List<ItemReq> items,
                          Double actualCost, String notes) {
    }

    private final JdbcTemplate jdbc;
    private final RecipeCatalog catalog;

    public DiaryService(JdbcTemplate jdbc, RecipeCatalog catalog) {
        this.jdbc = jdbc;
        this.catalog = catalog;
    }

    public static double calorieTarget(String goal) {
        return switch (goal == null ? "" : goal) {
            case "LOSE_WEIGHT" -> 1800;
            case "GAIN_MUSCLE" -> 2600;
            case "MANAGE_CONDITION" -> 1900;
            default -> 2100;
        };
    }

    @Transactional
    public long logMeal(long userId, MealReq req) {
        String type = req.mealType() == null ? "" : req.mealType().trim().toUpperCase();
        if (!MEAL_TYPES.contains(type)) {
            throw ApiException.badRequest("meal_type must be BREAKFAST, LUNCH, DINNER or SNACK");
        }
        LocalDate date = req.date() == null ? LocalDate.now() : req.date();
        if (req.actualCost() != null && req.actualCost() < 0) {
            throw ApiException.badRequest("Cost cannot be negative");
        }
        List<double[]> lines = new ArrayList<>(); // {foodId, servings}
        if (req.recipeId() != null) {
            RecipeCatalog.Recipe recipe = catalog.find(req.recipeId())
                    .orElseThrow(() -> ApiException.notFound("Recipe not found"));
            double portions = req.portions() == null || req.portions() <= 0 ? 1.0 : req.portions();
            for (RecipeCatalog.Ingredient i : recipe.ingredients()) {
                lines.add(new double[]{i.foodId(), i.quantity() * portions});
            }
        } else {
            if (req.items() == null || req.items().isEmpty()) {
                throw ApiException.badRequest("Add at least one food or choose a recipe");
            }
            for (ItemReq it : req.items()) {
                if (it.servings() <= 0 || it.servings() > 50) {
                    throw ApiException.badRequest("Servings must be between 0 and 50");
                }
                lines.add(new double[]{it.foodId(), it.servings()});
            }
        }
        Long mealId = jdbc.queryForObject(
                "INSERT INTO meals (user_id, eaten_on, meal_type, recipe_id, actual_cost, notes) "
                        + "VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class, userId, java.sql.Date.valueOf(date), type, req.recipeId(), req.actualCost(), req.notes());
        for (double[] line : lines) {
            jdbc.update("INSERT INTO meal_items (meal_id, food_id, servings) VALUES (?, ?, ?)",
                    mealId, (long) line[0], line[1]);
        }
        return mealId;
    }

    /** Everything the diary / dashboard needs for one day. */
    public Map<String, Object> dayView(long userId, LocalDate date) {
        Map<String, Object> profile = jdbc.queryForMap(
                "SELECT goal, daily_budget, meals_per_day FROM user_profiles WHERE user_id = ?", userId);
        List<Map<String, Object>> meals = jdbc.query(
                "SELECT m.id, m.meal_type, m.notes, m.recipe_id, m.actual_cost, r.name AS recipe_name, r.emoji AS recipe_emoji "
                        + "FROM meals m LEFT JOIN recipes r ON r.id = m.recipe_id "
                        + "WHERE m.user_id = ? AND m.eaten_on = ? ORDER BY m.id",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getLong("id"));
                    m.put("meal_type", rs.getString("meal_type"));
                    m.put("notes", rs.getString("notes"));
                    m.put("recipe_id", rs.getObject("recipe_id"));
                    m.put("recipe_name", rs.getString("recipe_name"));
                    m.put("recipe_emoji", rs.getString("recipe_emoji"));
                    m.put("actual_cost", rs.getBigDecimal("actual_cost"));
                    return m;
                }, userId, java.sql.Date.valueOf(date));

        List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT mi.meal_id, mi.id, mi.food_id, mi.servings, f.name, f.emoji, f.serving_desc, "
                        + "f.calories * mi.servings AS calories, f.protein * mi.servings AS protein, "
                        + "f.carbs * mi.servings AS carbs, f.fat * mi.servings AS fat, f.price_kes * mi.servings AS cost "
                        + "FROM meal_items mi JOIN foods f ON f.id = mi.food_id "
                        + "WHERE mi.meal_id IN (SELECT id FROM meals WHERE user_id = ? AND eaten_on = ?) ORDER BY mi.id",
                userId, java.sql.Date.valueOf(date));

        double tCal = 0, tPro = 0, tCarb = 0, tFat = 0, tSpend = 0;
        for (Map<String, Object> meal : meals) {
            long mealId = (Long) meal.get("id");
            List<Map<String, Object>> mine = new ArrayList<>();
            double cal = 0, pro = 0, carb = 0, fat = 0, est = 0;
            for (Map<String, Object> it : items) {
                if (((Number) it.get("meal_id")).longValue() == mealId) {
                    mine.add(it);
                    cal += d(it.get("calories"));
                    pro += d(it.get("protein"));
                    carb += d(it.get("carbs"));
                    fat += d(it.get("fat"));
                    est += d(it.get("cost"));
                }
            }
            Object actual = meal.get("actual_cost");
            double spend = actual != null ? d(actual) : est;
            meal.put("items", mine);
            meal.put("calories", r1(cal));
            meal.put("protein", r1(pro));
            meal.put("carbs", r1(carb));
            meal.put("fat", r1(fat));
            meal.put("estimated_cost", r2(est));
            meal.put("cost", r2(spend));
            tCal += cal;
            tPro += pro;
            tCarb += carb;
            tFat += fat;
            tSpend += spend;
        }
        double budget = d(profile.get("daily_budget"));
        double target = calorieTarget((String) profile.get("goal"));
        Map<String, Object> totals = M.of("calories", r1(tCal), "protein", r1(tPro), "carbs", r1(tCarb),
                "fat", r1(tFat), "spend", r2(tSpend));
        Map<String, Object> bud = M.of("daily", r2(budget), "spent", r2(tSpend), "remaining", r2(budget - tSpend));
        return M.of("date", date.toString(), "meals", meals, "totals", totals, "budget", bud,
                "calorie_target", target, "meals_per_day", profile.get("meals_per_day"), "goal", profile.get("goal"));
    }

    @Transactional
    public void deleteMeal(long userId, long mealId) {
        int n = jdbc.update("DELETE FROM meals WHERE id = ? AND user_id = ?", mealId, userId);
        if (n == 0) throw ApiException.notFound("Meal not found");
    }

    /** Daily spend / calories for the last N days (missing days are filled with zeros). */
    public Map<String, Object> history(long userId, int days) {
        int n = Math.max(1, Math.min(days, 90));
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(n - 1L);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "WITH per_meal AS ( "
                        + " SELECT m.id, m.eaten_on, COALESCE(m.actual_cost, SUM(mi.servings * f.price_kes), 0) AS spend, "
                        + "        COALESCE(SUM(mi.servings * f.calories), 0) AS calories, "
                        + "        COALESCE(SUM(mi.servings * f.protein), 0) AS protein "
                        + " FROM meals m LEFT JOIN meal_items mi ON mi.meal_id = m.id LEFT JOIN foods f ON f.id = mi.food_id "
                        + " WHERE m.user_id = ? AND m.eaten_on BETWEEN ? AND ? GROUP BY m.id) "
                        + "SELECT eaten_on, SUM(spend) AS spend, SUM(calories) AS calories, SUM(protein) AS protein, COUNT(*) AS meals "
                        + "FROM per_meal GROUP BY eaten_on",
                userId, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end));
        Map<LocalDate, Map<String, Object>> byDate = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            byDate.put(((java.sql.Date) r.get("eaten_on")).toLocalDate(), r);
        }
        double budget = d(jdbc.queryForObject("SELECT daily_budget FROM user_profiles WHERE user_id = ?", Object.class, userId));
        List<Map<String, Object>> out = new ArrayList<>();
        double total = 0;
        int tracked = 0;
        for (int i = 0; i < n; i++) {
            LocalDate day = start.plusDays(i);
            Map<String, Object> r = byDate.get(day);
            double spend = r == null ? 0 : d(r.get("spend"));
            if (r != null) tracked++;
            total += spend;
            out.add(M.of("date", day.toString(), "spend", r2(spend), "calories", r == null ? 0.0 : r1(d(r.get("calories"))),
                    "protein", r == null ? 0.0 : r1(d(r.get("protein"))), "meals", r == null ? 0L : ((Number) r.get("meals")).longValue(),
                    "over_budget", spend > budget));
        }
        return M.of("days", out, "daily_budget", r2(budget), "total_spend", r2(total),
                "average_spend", r2(tracked == 0 ? 0 : total / tracked), "days_tracked", tracked);
    }

    public List<Map<String, Object>> weights(long userId) {
        return jdbc.queryForList("SELECT logged_on, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY logged_on", userId);
    }

    public void logWeight(long userId, LocalDate date, double kg) {
        if (kg <= 20 || kg > 400) throw ApiException.badRequest("Enter a realistic weight in kg");
        jdbc.update("INSERT INTO weight_logs (user_id, logged_on, weight_kg) VALUES (?, ?, ?) "
                        + "ON CONFLICT (user_id, logged_on) DO UPDATE SET weight_kg = EXCLUDED.weight_kg",
                userId, java.sql.Date.valueOf(date == null ? LocalDate.now() : date), kg);
    }
}
