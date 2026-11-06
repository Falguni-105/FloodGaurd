package com.floodguard.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/** Fetches observed hourly rainfall from the free Open-Meteo API (no API key required). */
@Service
@Slf4j
public class WeatherService {
    public record Rain(double rainfall24hMm, double peakIntensityMmh, double rainfall3dayMm) {}

    private final RestClient http;
    private final String baseUrl;
    private final boolean enabled;

    public WeatherService(RestClient http,
                          @Value("${floodguard.weather.base-url}") String baseUrl,
                          @Value("${floodguard.weather.enabled}") boolean enabled) {
        this.http = http; this.baseUrl = baseUrl; this.enabled = enabled;
    }

    public Optional<Rain> fetch(double lat, double lon) {
        if (!enabled) return Optional.empty();
        try {
            JsonNode root = http.get()
                    .uri(baseUrl + "?latitude={lat}&longitude={lon}&hourly=precipitation&past_days=3&forecast_days=1&timezone=GMT", lat, lon)
                    .retrieve().body(JsonNode.class);
            if (root == null) return Optional.empty();
            JsonNode times = root.path("hourly").path("time");
            JsonNode precip = root.path("hourly").path("precipitation");
            if (!times.isArray() || !precip.isArray()) return Optional.empty();

            LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.HOURS);
            double sum24 = 0, sum72 = 0, peak = 0;
            for (int i = 0; i < times.size() && i < precip.size(); i++) {
                if (precip.get(i).isNull()) continue;
                long hoursAgo = Duration.between(LocalDateTime.parse(times.get(i).asText()), now).toHours();
                double mm = precip.get(i).asDouble();
                if (hoursAgo >= 0 && hoursAgo < 72) sum72 += mm;
                if (hoursAgo >= 0 && hoursAgo < 24) { sum24 += mm; peak = Math.max(peak, mm); }
            }
            return Optional.of(new Rain(round(sum24), round(peak), round(sum72)));
        } catch (Exception e) {
            log.warn("Open-Meteo unavailable ({}); keeping last known rainfall", e.getMessage());
            return Optional.empty();
        }
    }

    private static double round(double v) { return Math.round(v * 10) / 10.0; }
}
