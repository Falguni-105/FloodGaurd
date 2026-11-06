package com.floodguard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.floodguard.domain.Locality;
import com.floodguard.domain.RiskLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.util.LinkedHashMap;
import java.util.Map;

/** Calls the Python/scikit-learn service. If it is down, falls back to a transparent rule-based score. */
@Service
@Slf4j
public class MlClient {
    public record Prediction(RiskLevel level, double score, String source) {}

    private final RestClient http;
    private final String mlUrl;

    public MlClient(RestClient http, @Value("${floodguard.ml.url}") String mlUrl) {
        this.http = http; this.mlUrl = mlUrl;
    }

    public Prediction predict(Locality l, double r24, double intensity, double r3) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rainfall_24h_mm", r24);
        body.put("rainfall_intensity_mmh", intensity);
        body.put("rainfall_3day_mm", r3);
        body.put("elevation_m", l.getElevationM());
        body.put("slope_deg", l.getSlopeDeg());
        body.put("drainage_capacity_mmh", l.getDrainageCapacityMmh());
        body.put("river_distance_km", l.getRiverDistanceKm());
        body.put("historical_floods", l.getHistoricalFloods());
        body.put("impervious_ratio", l.getImperviousRatio());
        try {
            JsonNode n = http.post().uri(mlUrl + "/predict").contentType(MediaType.APPLICATION_JSON)
                    .body(body).retrieve().body(JsonNode.class);
            return new Prediction(RiskLevel.valueOf(n.get("risk_level").asText()), n.get("risk_score").asDouble(), "ml-model");
        } catch (Exception e) {
            log.warn("ML service unavailable ({}); using rule-based fallback for {}", e.getMessage(), l.getName());
            return fallback(l, r24, intensity, r3);
        }
    }

    public JsonNode metrics() {
        try {
            return http.get().uri(mlUrl + "/metrics").retrieve().body(JsonNode.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** Same hydrological intuition the model was trained on; used only when the ML service is unreachable. */
    static Prediction fallback(Locality l, double r24, double intensity, double r3) {
        double overload = Math.max(0, intensity - l.getDrainageCapacityMmh()) / 30.0;
        double volume = r24 / 120.0 + 0.4 * r3 / 300.0;
        double lowLying = Math.exp(-(l.getElevationM() - 150) / 250.0);
        double flat = Math.exp(-l.getSlopeDeg() / 6.0);
        double river = Math.exp(-l.getRiverDistanceKm() / 1.5);
        double history = l.getHistoricalFloods() / 6.0;
        double runoff = 0.5 + l.getImperviousRatio();
        double s = 1.4 * volume * runoff + 1.6 * overload + 0.9 * lowLying + 0.5 * flat + 0.8 * river + 0.6 * history;
        RiskLevel level = s < 1.9 ? RiskLevel.LOW : s < 3.0 ? RiskLevel.MODERATE : RiskLevel.HIGH;
        double score = Math.round(Math.min(100, s / 4.5 * 100) * 10) / 10.0;
        return new Prediction(level, score, "fallback-rules");
    }
}
