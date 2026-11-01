package com.chakulasmart.planner;

import static com.chakulasmart.util.M.d;
import static com.chakulasmart.util.M.r1;
import static com.chakulasmart.util.M.r2;

import com.chakulasmart.catalog.RecipeCatalog;
import com.chakulasmart.catalog.RecipeCatalog.Recipe;
import com.chakulasmart.care.ConsentService;
import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.diary.DiaryService;
import com.chakulasmart.diary.SuggestionService;
import com.chakulasmart.util.M;
import com.chakulasmart.web.ApiException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlannerService {

    public record EntryReq(int dayIndex, String mealType, long recipeId) {
    }

    public record PlanReq(String title, LocalDate weekStart, Long forUserId, String note, List<EntryReq> entries) {
    }

    private final JdbcTemplate jdbc;
    private final RecipeCatalog catalog;
    private final SuggestionService suggestions;
    private final ConsentService consent;

    public PlannerService(JdbcTemplate jdbc, RecipeCatalog catalog, SuggestionService suggestions, ConsentService consent) {
        this.jdbc = jdbc;
        this.catalog = catalog;
        this.suggestions = suggestions;
        this.consent = consent;
    }

    public static LocalDate mondayOf(LocalDate d) {
        return d.minusDays(d.getDayOfWeek().getValue() - 1L);
    }

    /** A nutritionist may plan for a client only with active consent; everyone may plan for themselves. */
    private long resolveTarget(CurrentUser me, Long forUserId) {
        long target = forUserId == null ? me.id() : forUserId;
        if (target != me.id()) {
            if (!me.has("NUTRITIONIST")) throw ApiException.forbidden("Only nutritionists can plan for other people");
            consent.requireActive(me.id(), target);
        }
        return target;
    }

    @Transactional
    public long create(CurrentUser me, PlanReq req) {
        long target = resolveTarget(me, req.forUserId());
        if (req.title() == null || req.title().isBlank()) throw ApiException.badRequest("Give the plan a title");
        if (req.entries() == null) throw ApiException.badRequest("entries are required");
        for (EntryReq e : req.entries()) {
            if (e.dayIndex() < 0 || e.dayIndex() > 6) throw ApiException.badRequest("day_index must be 0 (Mon) to 6 (Sun)");
            if (!DiaryService.MEAL_TYPES.contains(e.mealType() == null ? "" : e.mealType().toUpperCase())) {
                throw ApiException.badRequest("Invalid meal_type");
            }
        }
        LocalDate week = req.weekStart() == null ? mondayOf(LocalDate.now()) : req.weekStart();
        Long id = jdbc.queryForObject(
                "INSERT INTO meal_plans (owner_id, for_user_id, title, week_start, note) VALUES (?, ?, ?, ?, ?) RETURNING id",
                Long.class, me.id(), target, req.title().trim(), java.sql.Date.valueOf(week), req.note());
        for (EntryReq e : req.entries()) {
            jdbc.update("INSERT INTO meal_plan_entries (plan_id, day_index, meal_type, recipe_id) VALUES (?, ?, ?, ?)",
                    id, e.dayIndex(), e.mealType().toUpperCase(), e.recipeId());
        }
        return id;
    }

    public static List<String> mealTypesFor(int mealsPerDay) {
        return switch (mealsPerDay) {
            case 1 -> List.of("LUNCH");
            case 2 -> List.of("BREAKFAST", "DINNER");
            case 3 -> List.of("BREAKFAST", "LUNCH", "DINNER");
            default -> List.of("BREAKFAST", "LUNCH", "DINNER", "SNACK");
        };
    }

    /** Builds a 7-day plan automatically from budget, goal, allergies and preferences. */
    @Transactional
    public long generate(CurrentUser me, Long forUserId, LocalDate weekStart) {
        long target = resolveTarget(me, forUserId);
        SuggestionService.Profile p = suggestions.profile(target);
        List<Recipe> all = catalog.all();
        List<String> types = mealTypesFor(p.meals());
        double perMeal = Math.max(40, p.budget() / types.size());
        double ideal = Math.max(250, Math.min(800, DiaryService.calorieTarget(p.goal()) / types.size()));
        LocalDate week = weekStart == null ? mondayOf(LocalDate.now()) : mondayOf(weekStart);

        Map<Long, Integer> used = new HashMap<>();
        List<PlannerService.EntryReq> entries = new ArrayList<>();
        Random rnd = new Random(week.toEpochDay() + target);
        for (int day = 0; day < 7; day++) {
            for (String type : types) {
                double mealBudget = "SNACK".equals(type) ? Math.min(perMeal, 60) : perMeal;
                double mealCal = "SNACK".equals(type) ? 250 : ideal;
                List<SuggestionService.Suggestion> ranked = all.stream()
                        .filter(r -> r.isFor(type))
                        .filter(r -> !SuggestionService.conflictsWithAllergy(r, p.allergies()))
                        .map(r -> {
                            SuggestionService.Suggestion s = suggestions.score(r, p, mealBudget, mealCal, used.getOrDefault(r.id(), 0));
                            return new SuggestionService.Suggestion(r, s.score() + rnd.nextDouble() * 4, s.reasons());
                        })
                        .sorted(Comparator.comparingDouble(SuggestionService.Suggestion::score).reversed())
                        .toList();
                if (!ranked.isEmpty()) {
                    Recipe pick = ranked.get(0).recipe();
                    used.merge(pick.id(), 1, Integer::sum);
                    entries.add(new EntryReq(day, type, pick.id()));
                }
            }
        }
        if (entries.isEmpty()) throw ApiException.badRequest("No recipes match this profile's allergies and preferences");
        String name = jdbc.queryForObject("SELECT full_name FROM users WHERE id = ?", String.class, target);
        String title = target == me.id() ? "My week of " + week : "Plan for " + name + ", week of " + week;
        return create(me, new PlanReq(title, week, target, "Auto-generated from budget, goal and preferences", entries));
    }

    public List<Map<String, Object>> list(CurrentUser me, boolean onlyMine) {
        String sql = "SELECT p.id, p.title, p.week_start, p.note, p.owner_id, p.for_user_id, uo.full_name AS owner_name, "
                + "uf.full_name AS for_name, (p.owner_id <> p.for_user_id) AS by_professional, p.created_at "
                + "FROM meal_plans p JOIN users uo ON uo.id = p.owner_id JOIN users uf ON uf.id = p.for_user_id "
                + (onlyMine ? "WHERE p.for_user_id = ? " : "WHERE p.for_user_id = ? OR p.owner_id = ? ")
                + "ORDER BY p.week_start DESC, p.id DESC";
        return onlyMine ? jdbc.queryForList(sql, me.id()) : jdbc.queryForList(sql, me.id(), me.id());
    }

    public Map<String, Object> detail(CurrentUser me, long planId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.title, p.week_start, p.note, p.owner_id, p.for_user_id, uo.full_name AS owner_name, "
                        + "uf.full_name AS for_name FROM meal_plans p JOIN users uo ON uo.id = p.owner_id "
                        + "JOIN users uf ON uf.id = p.for_user_id WHERE p.id = ? AND (p.owner_id = ? OR p.for_user_id = ?)",
                planId, me.id(), me.id());
        if (rows.isEmpty()) throw ApiException.notFound("Plan not found");
        Map<Long, Recipe> byId = catalog.all().stream().collect(Collectors.toMap(Recipe::id, Function.identity()));
        List<Map<String, Object>> entryRows = jdbc.queryForList(
                "SELECT id, day_index, meal_type, recipe_id FROM meal_plan_entries WHERE plan_id = ? "
                        + "ORDER BY day_index, CASE meal_type WHEN 'BREAKFAST' THEN 1 WHEN 'LUNCH' THEN 2 WHEN 'DINNER' THEN 3 ELSE 4 END",
                planId);
        List<Map<String, Object>> entries = new ArrayList<>();
        double[] dayCost = new double[7];
        double[] dayCal = new double[7];
        for (Map<String, Object> e : entryRows) {
            Recipe r = byId.get(((Number) e.get("recipe_id")).longValue());
            int di = ((Number) e.get("day_index")).intValue();
            if (r != null) {
                dayCost[di] += r.cost();
                dayCal[di] += r.calories();
            }
            entries.add(M.of("id", e.get("id"), "day_index", di, "meal_type", e.get("meal_type"), "recipe", r));
        }
        double total = 0;
        int daysUsed = 0;
        List<Map<String, Object>> days = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            if (dayCost[i] > 0) daysUsed++;
            total += dayCost[i];
            days.add(M.of("day_index", i, "cost", r2(dayCost[i]), "calories", r1(dayCal[i])));
        }
        Map<String, Object> out = new LinkedHashMap<>(rows.get(0));
        out.put("entries", entries);
        out.put("days", days);
        out.put("total_cost_per_person", r2(total));
        out.put("avg_daily_cost_per_person", r2(daysUsed == 0 ? 0 : total / daysUsed));
        return out;
    }

    @Transactional
    public void delete(CurrentUser me, long planId) {
        int n = jdbc.update("DELETE FROM meal_plans WHERE id = ? AND owner_id = ?", planId, me.id());
        if (n == 0) throw ApiException.notFound("Plan not found (only its creator can delete it)");
    }

    /** Aggregates every ingredient in the plan x household size into a saved shopping list. */
    @Transactional
    public long shoppingListFromPlan(CurrentUser me, long planId) {
        Map<String, Object> plan = detail(me, planId); // also enforces access
        long forUser = ((Number) plan.get("for_user_id")).longValue();
        int household = jdbc.queryForObject("SELECT household_size FROM user_profiles WHERE user_id = ?", Integer.class, forUser);
        Long listId = jdbc.queryForObject(
                "INSERT INTO shopping_lists (user_id, plan_id, title) VALUES (?, ?, ?) RETURNING id",
                Long.class, me.id(), planId, "Shopping: " + plan.get("title"));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT f.id, f.name, f.serving_desc, f.price_kes, SUM(ri.quantity) AS q "
                        + "FROM meal_plan_entries e JOIN recipe_ingredients ri ON ri.recipe_id = e.recipe_id "
                        + "JOIN foods f ON f.id = ri.food_id WHERE e.plan_id = ? "
                        + "GROUP BY f.id, f.name, f.serving_desc, f.price_kes, f.category ORDER BY f.category, f.name",
                planId);
        for (Map<String, Object> r : rows) {
            double qty = d(r.get("q")) * household;
            jdbc.update("INSERT INTO shopping_items (list_id, food_id, name, quantity, unit, est_cost) VALUES (?, ?, ?, ?, ?, ?)",
                    listId, r.get("id"), r.get("name"), r2(qty), r.get("serving_desc"), r2(qty * d(r.get("price_kes"))));
        }
        return listId;
    }
}
