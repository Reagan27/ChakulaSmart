package com.chakulasmart.billing;

import com.chakulasmart.util.M;
import java.util.List;
import java.util.Map;

/** Static catalogue of subscription plans. Prices are launch hypotheses, tune them after talking to users. */
public final class Plans {
    private Plans() {
    }

    public static final List<Map<String, Object>> ALL = List.of(
            M.of("code", "FREE", "role", "INDIVIDUAL", "name", "Free", "price_kes", 0,
                    "tagline", "Everything you need to start tracking",
                    "features", List.of("Food diary & budget tracker", "Kenyan food & recipe library", "Basic meal suggestions", "Shopping lists")),
            M.of("code", "FAMILY_PLUS", "role", "INDIVIDUAL", "name", "Family Plus", "price_kes", 250,
                    "tagline", "Plan the whole week for the whole family",
                    "features", List.of("Auto-generated weekly meal plans", "Spending history & reports", "PDF meal plans", "Priority vendor price matches")),
            M.of("code", "PRO_NUTRITIONIST", "role", "NUTRITIONIST", "name", "Professional", "price_kes", 750,
                    "tagline", "Run your practice from one dashboard",
                    "features", List.of("Unlimited consented clients", "Meal plans & PDF exports", "Client progress tracking", "Public directory listing")),
            M.of("code", "BUSINESS_PLUS", "role", "BUSINESS", "name", "Business Plus", "price_kes", 1000,
                    "tagline", "Get found by people planning their meals",
                    "features", List.of("Featured listing", "Unlimited products & offers", "Customer enquiries inbox", "Referral tracking (coming soon)")));

    public static Map<String, Object> find(String code) {
        return ALL.stream().filter(p -> p.get("code").equals(code)).findFirst().orElse(null);
    }
}
