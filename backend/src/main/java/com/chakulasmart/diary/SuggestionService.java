package com.chakulasmart.diary;

import com.chakulasmart.catalog.RecipeCatalog;
import com.chakulasmart.catalog.RecipeCatalog.Recipe;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Rule-based recommendation engine. It scores every recipe for a given meal using:
 * the person's remaining budget, calorie needs, goal, favourite foods, allergies and what they ate recently.
 */
@Service
public class SuggestionService {

    public record Profile(String goal, int household, double budget, int meals, List<String> allergies,
                          List<String> favorites) {
    }

    public record Suggestion(Recipe recipe, double score, List<String> reasons) {
    }

    private static final Map<String, String> ALLERGY_ALIASES = Map.ofEntries(
            Map.entry("milk", "dairy"), Map.entry("lactose", "dairy"), Map.entry("peanut", "nuts"),
            Map.entry("peanuts", "nuts"), Map.entry("groundnut", "nuts"), Map.entry("groundnuts", "nuts"),
            Map.entry("wheat", "gluten"), Map.entry("eggs", "egg"), Map.entry("seafood", "fish"),
            Map.entry("tilapia", "fish"), Map.entry("omena", "fish"));

    private final JdbcTemplate jdbc;
    private final RecipeCatalog catalog;
    private final DiaryService diary;

    public SuggestionService(JdbcTemplate jdbc, RecipeCatalog catalog, DiaryService diary) {
        this.jdbc = jdbc;
        this.catalog = catalog;
        this.diary = diary;
    }

    public Profile profile(long userId) {
        Map<String, Object> p = jdbc.queryForMap(
                "SELECT goal, household_size, daily_budget, meals_per_day, allergies, favorite_foods FROM user_profiles WHERE user_id = ?",
                userId);
        return new Profile((String) p.get("goal"), ((Number) p.get("household_size")).intValue(),
                ((Number) p.get("daily_budget")).doubleValue(), ((Number) p.get("meals_per_day")).intValue(),
                tokens((String) p.get("allergies")), tokens((String) p.get("favorite_foods")));
    }

    static List<String> tokens(String s) {
        if (s == null || s.isBlank()) return List.of();
        return Arrays.stream(s.toLowerCase(Locale.ROOT).split("[,;\\n]"))
                .map(String::trim).filter(x -> !x.isEmpty()).toList();
    }

    public static boolean conflictsWithAllergy(Recipe r, List<String> allergies) {
        for (String raw : allergies) {
            String a = ALLERGY_ALIASES.getOrDefault(raw, raw);
            for (String tag : r.allergens()) {
                String t = tag.toLowerCase(Locale.ROOT);
                if (t.equals(a) || t.contains(a) || a.contains(t)) return true;
            }
            for (RecipeCatalog.Ingredient i : r.ingredients()) {
                if (i.name().toLowerCase(Locale.ROOT).contains(raw)) return true;
            }
        }
        return false;
    }

    /** Score one recipe. perMealBudget / idealCalories describe what a "good" meal looks like right now. */
    public Suggestion score(Recipe r, Profile p, double perMealBudget, double idealCalories, int timesUsedRecently) {
        double score = 50;
        List<String> why = new ArrayList<>();

        if (r.cost() <= perMealBudget) {
            score += 20 + Math.min(10, (perMealBudget - r.cost()) / 10.0);
            why.add("Fits your budget (about KSh " + Math.round(r.cost()) + ")");
        } else {
            score -= Math.min(40, (r.cost() - perMealBudget) * 0.6);
        }

        int favHits = 0;
        for (String fav : p.favorites()) {
            boolean hit = r.name().toLowerCase(Locale.ROOT).contains(fav)
                    || r.ingredients().stream().anyMatch(i -> i.name().toLowerCase(Locale.ROOT).contains(fav));
            if (hit) favHits++;
        }
        if (favHits > 0) {
            score += Math.min(20, favHits * 10);
            why.add("Uses foods you like");
        }

        switch (p.goal()) {
            case "GAIN_MUSCLE" -> {
                score += Math.min(20, r.protein() * 0.6);
                if (r.protein() >= 25) why.add("High in protein (" + Math.round(r.protein()) + " g)");
            }
            case "LOSE_WEIGHT" -> {
                if (r.calories() > 650) score -= 15;
                score += Math.min(15, r.fiber() * 1.5);
                if (r.fiber() >= 8) why.add("Fibre-rich, keeps you full");
            }
            case "SAVE_MONEY" -> score += Math.max(0, 15 - r.cost() / 10.0);
            case "MANAGE_CONDITION" -> {
                score += Math.min(15, r.fiber() * 1.2);
                if (r.tags().contains("high-fibre")) why.add("High fibre, gentle on blood sugar");
            }
            default -> {
                score += Math.min(10, r.fiber());
                if (r.fiber() >= 8) why.add("Good fibre content");
            }
        }

        score -= Math.min(25, Math.abs(r.calories() - idealCalories) / 20.0);
        if (Math.abs(r.calories() - idealCalories) < 120) why.add("About the right size for this meal");

        if (timesUsedRecently > 0) {
            score -= 15 * timesUsedRecently;
        } else {
            why.add("A change from your last few days");
        }
        return new Suggestion(r, Math.round(score * 10.0) / 10.0, why);
    }

    public List<Suggestion> suggest(long userId, String mealType, LocalDate date, int limit) {
        Profile p = profile(userId);
        Map<String, Object> day = diary.dayView(userId, date);
        @SuppressWarnings("unchecked")
        Map<String, Object> budget = (Map<String, Object>) day.get("budget");
        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) day.get("totals");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> logged = (List<Map<String, Object>>) day.get("meals");

        int remainingMeals = Math.max(1, p.meals() - logged.size());
        double remainingBudget = ((Number) budget.get("remaining")).doubleValue();
        double perMeal = Math.max(40, remainingBudget / remainingMeals);
        double remainingCal = DiaryService.calorieTarget(p.goal()) - ((Number) totals.get("calories")).doubleValue();
        double ideal = Math.max(250, Math.min(900, remainingCal / remainingMeals));
        if ("SNACK".equals(mealType)) {
            ideal = 250;
            perMeal = Math.min(perMeal, 60);
        }

        Set<Long> recent = new HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT recipe_id FROM meals WHERE user_id = ? AND recipe_id IS NOT NULL AND eaten_on >= ?",
                Long.class, userId, java.sql.Date.valueOf(date.minusDays(3))));

        final double fPerMeal = perMeal;
        final double fIdeal = ideal;
        return catalog.all().stream()
                .filter(r -> r.isFor(mealType))
                .filter(r -> !conflictsWithAllergy(r, p.allergies()))
                .map(r -> score(r, p, fPerMeal, fIdeal, recent.contains(r.id()) ? 1 : 0))
                .sorted(Comparator.comparingDouble(Suggestion::score).reversed())
                .limit(limit)
                .toList();
    }

    /** Which meal is next today, based on what is already recorded. */
    public static String nextMealType(List<String> alreadyLogged) {
        for (String t : List.of("BREAKFAST", "LUNCH", "DINNER")) {
            if (!alreadyLogged.contains(t)) return t;
        }
        return "SNACK";
    }
}
