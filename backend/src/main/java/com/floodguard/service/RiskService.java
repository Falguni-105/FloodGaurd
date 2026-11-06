package com.floodguard.service;

import com.floodguard.domain.Locality;
import com.floodguard.dto.Dtos.LocalityRiskDto;
import com.floodguard.dto.Dtos.SimulationRequest;
import com.floodguard.repo.LocalityRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class RiskService {
    private final LocalityRepository localities;
    private final WeatherService weather;
    private final MlClient ml;
    private final SimpMessagingTemplate ws;

    public RiskService(LocalityRepository localities, WeatherService weather, MlClient ml, SimpMessagingTemplate ws) {
        this.localities = localities; this.weather = weather; this.ml = ml; this.ws = ws;
    }

    public static LocalityRiskDto toDto(Locality l) {
        return new LocalityRiskDto(l.getId(), l.getName(), l.getLatitude(), l.getLongitude(), l.getElevationM(),
                l.getRiskLevel().name(), l.getRiskScore(), l.getRainfall24hMm(), l.getRainfallIntensityMmh(),
                l.getRainfall3dayMm(), l.getWeatherSource(), l.getRiskSource(), l.getRiskUpdatedAt());
    }

    public List<LocalityRiskDto> map() {
        return localities.findAll().stream()
                .sorted(Comparator.comparingDouble(Locality::getRiskScore).reversed())
                .map(RiskService::toDto).toList();
    }

    /** Pull fresh rainfall for each locality, re-score it with the ML model, and tell connected clients. */
    @Scheduled(fixedDelayString = "${floodguard.weather.refresh-minutes}",
               initialDelayString = "${floodguard.weather.refresh-minutes}", timeUnit = TimeUnit.MINUTES)
    public synchronized List<LocalityRiskDto> refreshAll() {
        for (Locality l : localities.findAll()) {
            Optional<WeatherService.Rain> rain = weather.fetch(l.getLatitude(), l.getLongitude());
            if (rain.isPresent()) {
                l.setRainfall24hMm(rain.get().rainfall24hMm());
                l.setRainfallIntensityMmh(rain.get().peakIntensityMmh());
                l.setRainfall3dayMm(rain.get().rainfall3dayMm());
                l.setWeatherSource("open-meteo");
            } else if (l.getWeatherSource() == null) {
                l.setWeatherSource("none (no weather data yet)");
            }
            score(l);
            localities.save(l);
        }
        notifyClients();
        return map();
    }

    /** What-if: apply a rainfall scenario to every locality. Only stored if persist=true. */
    public synchronized List<LocalityRiskDto> simulate(SimulationRequest req) {
        double r24 = req.rainfall24hMm();
        double intensity = req.rainfallIntensityMmh() != null ? req.rainfallIntensityMmh() : Math.min(150, r24 / 6.0);
        double r3 = req.rainfall3dayMm() != null ? req.rainfall3dayMm() : r24 * 1.5;
        boolean persist = Boolean.TRUE.equals(req.persist());
        List<Locality> all = localities.findAll();
        for (Locality l : all) {
            l.setRainfall24hMm(r24); l.setRainfallIntensityMmh(intensity); l.setRainfall3dayMm(r3);
            l.setWeatherSource("manual-simulation");
            score(l);
        }
        if (persist) { localities.saveAll(all); notifyClients(); }
        return all.stream().sorted(Comparator.comparingDouble(Locality::getRiskScore).reversed())
                .map(RiskService::toDto).toList();
    }

    private void score(Locality l) {
        MlClient.Prediction p = ml.predict(l, l.getRainfall24hMm(), l.getRainfallIntensityMmh(), l.getRainfall3dayMm());
        l.setRiskLevel(p.level());
        l.setRiskScore(p.score());
        l.setRiskSource(p.source());
        l.setRiskUpdatedAt(Instant.now());
    }

    private void notifyClients() {
        ws.convertAndSend("/topic/risk", Map.of("event", "RISK_UPDATED"));
    }
}
