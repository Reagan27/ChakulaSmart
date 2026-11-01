package com.chakulasmart.diary;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.util.M;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/diary")
public class DiaryController {

    public record WeightReq(LocalDate loggedOn, double weightKg) {
    }

    private final DiaryService diary;
    private final SuggestionService suggestions;

    public DiaryController(DiaryService diary, SuggestionService suggestions) {
        this.diary = diary;
        this.suggestions = suggestions;
    }

    @GetMapping("/day")
    public Map<String, Object> day(@AuthenticationPrincipal CurrentUser me,
                                   @RequestParam(name = "date", required = false)
                                   @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return diary.dayView(me.id(), date == null ? LocalDate.now() : date);
    }

    @PostMapping("/meals")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> log(@AuthenticationPrincipal CurrentUser me, @RequestBody DiaryService.MealReq req) {
        long id = diary.logMeal(me.id(), req);
        return M.of("id", id);
    }

    @DeleteMapping("/meals/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        diary.deleteMeal(me.id(), id);
    }

    @GetMapping("/history")
    public Map<String, Object> history(@AuthenticationPrincipal CurrentUser me,
                                       @RequestParam(name = "days", defaultValue = "14") int days) {
        return diary.history(me.id(), days);
    }

    /** Top recipe ideas for the next (or a chosen) meal. */
    @GetMapping("/suggestions")
    @SuppressWarnings("unchecked")
    public Map<String, Object> suggest(@AuthenticationPrincipal CurrentUser me,
                                       @RequestParam(name = "meal_type", required = false) String mealType,
                                       @RequestParam(name = "date", required = false)
                                       @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                       @RequestParam(name = "limit", defaultValue = "5") int limit) {
        LocalDate d = date == null ? LocalDate.now() : date;
        String type = mealType;
        if (type == null || type.isBlank()) {
            List<Map<String, Object>> meals = (List<Map<String, Object>>) diary.dayView(me.id(), d).get("meals");
            type = SuggestionService.nextMealType(meals.stream().map(m -> (String) m.get("meal_type")).toList());
        }
        type = type.toUpperCase();
        return M.of("meal_type", type, "suggestions", suggestions.suggest(me.id(), type, d, Math.min(Math.max(limit, 1), 10)));
    }

    @GetMapping("/weight")
    public List<Map<String, Object>> weights(@AuthenticationPrincipal CurrentUser me) {
        return diary.weights(me.id());
    }

    @PostMapping("/weight")
    @ResponseStatus(HttpStatus.CREATED)
    public List<Map<String, Object>> logWeight(@AuthenticationPrincipal CurrentUser me, @RequestBody WeightReq r) {
        diary.logWeight(me.id(), r.loggedOn(), r.weightKg());
        return diary.weights(me.id());
    }
}
