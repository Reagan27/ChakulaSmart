package com.chakulasmart.planner;

import com.chakulasmart.config.CurrentUser;
import com.chakulasmart.util.M;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
@RequestMapping("/api/plans")
public class PlannerController {

    public record GenerateReq(LocalDate weekStart, Long forUserId) {
    }

    private final PlannerService planner;
    private final PdfService pdf;

    public PlannerController(PlannerService planner, PdfService pdf) {
        this.planner = planner;
        this.pdf = pdf;
    }

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal CurrentUser me,
                                          @RequestParam(name = "mine", defaultValue = "true") boolean mine) {
        return planner.list(me, mine);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@AuthenticationPrincipal CurrentUser me, @RequestBody PlannerService.PlanReq req) {
        return M.of("id", planner.create(me, req));
    }

    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> generate(@AuthenticationPrincipal CurrentUser me, @RequestBody GenerateReq req) {
        return M.of("id", planner.generate(me, req.forUserId(), req.weekStart()));
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        return planner.detail(me, id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        planner.delete(me, id);
    }

    @PostMapping("/{id}/shopping-list")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> shopping(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        return M.of("id", planner.shoppingListFromPlan(me, id));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(@AuthenticationPrincipal CurrentUser me, @PathVariable("id") long id) {
        byte[] bytes = pdf.mealPlan(planner.detail(me, id));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"chakulasmart-meal-plan-" + id + ".pdf\"")
                .body(bytes);
    }
}
