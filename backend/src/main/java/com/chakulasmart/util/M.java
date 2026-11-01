package com.chakulasmart.util;

import java.util.LinkedHashMap;
import java.util.Map;

/** Tiny helpers: ordered map literal + number conversion/rounding. */
public final class M {
    private M() {
    }

    public static Map<String, Object> of(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    public static double d(Object o) {
        return o == null ? 0.0 : ((Number) o).doubleValue();
    }

    public static long l(Object o) {
        return o == null ? 0L : ((Number) o).longValue();
    }

    public static double r1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    public static double r2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
