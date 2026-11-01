package com.chakulasmart.planner;

import com.chakulasmart.catalog.RecipeCatalog.Recipe;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class PdfService {
    private static final String[] DAYS = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
    private static final Color GREEN = new Color(22, 101, 52);
    private static final Color LEAF = new Color(220, 252, 231);

    @SuppressWarnings("unchecked")
    public byte[] mealPlan(Map<String, Object> plan) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
        PdfWriter.getInstance(doc, out);
        doc.open();

        Font h1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, GREEN);
        Font h2 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, Color.WHITE);
        Font body = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(31, 41, 55));
        Font bold = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(31, 41, 55));
        Font small = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(107, 114, 128));

        doc.add(new Paragraph("ChakulaSmart", h1));
        doc.add(new Paragraph("Eat better. Spend smarter. Live healthier.", small));
        doc.add(new Paragraph(" "));
        doc.add(new Paragraph(String.valueOf(plan.get("title")), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, new Color(31, 41, 55))));
        doc.add(new Paragraph("Week starting " + plan.get("week_start") + "  |  For: " + plan.get("for_name")
                + "  |  Prepared by: " + plan.get("owner_name"), small));
        if (plan.get("note") != null && !String.valueOf(plan.get("note")).isBlank()) {
            doc.add(new Paragraph("Note: " + plan.get("note"), body));
        }
        doc.add(new Paragraph(" "));

        List<Map<String, Object>> entries = (List<Map<String, Object>>) plan.get("entries");
        List<Map<String, Object>> days = (List<Map<String, Object>>) plan.get("days");
        for (int d = 0; d < 7; d++) {
            final int di = d;
            List<Map<String, Object>> todays = entries.stream().filter(e -> ((Number) e.get("day_index")).intValue() == di).toList();
            if (todays.isEmpty()) continue;
            PdfPTable t = new PdfPTable(new float[]{1.2f, 4f, 1.2f, 1.2f});
            t.setWidthPercentage(100);
            t.setSpacingAfter(8);
            PdfPCell head = new PdfPCell(new Phrase(DAYS[d], h2));
            head.setColspan(4);
            head.setBackgroundColor(GREEN);
            head.setPadding(6);
            head.setBorder(0);
            t.addCell(head);
            for (Map<String, Object> e : todays) {
                Recipe r = (Recipe) e.get("recipe");
                if (r == null) continue;
                t.addCell(cell(String.valueOf(e.get("meal_type")), bold, null));
                t.addCell(cell(r.name(), body, null));
                t.addCell(cell(Math.round(r.calories()) + " kcal", body, null));
                t.addCell(cell("KSh " + Math.round(r.cost()), body, null));
            }
            Map<String, Object> dayInfo = days.get(d);
            PdfPCell total = cell("Day total: KSh " + Math.round(((Number) dayInfo.get("cost")).doubleValue())
                    + "  |  " + Math.round(((Number) dayInfo.get("calories")).doubleValue()) + " kcal (per person)", small, LEAF);
            total.setColspan(4);
            total.setHorizontalAlignment(Element.ALIGN_RIGHT);
            t.addCell(total);
            doc.add(t);
        }
        doc.add(new Paragraph("Estimated per person for the week: KSh " + Math.round(((Number) plan.get("total_cost_per_person")).doubleValue())
                + "  (average KSh " + Math.round(((Number) plan.get("avg_daily_cost_per_person")).doubleValue()) + " per day)", bold));
        doc.add(new Paragraph("Prices are estimates; nutrition values are approximate. This plan is general guidance and not a substitute for medical advice.", small));
        doc.close();
        return out.toByteArray();
    }

    private static PdfPCell cell(String text, Font f, Color bg) {
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setPadding(5);
        c.setBorderColor(new Color(229, 231, 235));
        if (bg != null) c.setBackgroundColor(bg);
        return c;
    }
}
