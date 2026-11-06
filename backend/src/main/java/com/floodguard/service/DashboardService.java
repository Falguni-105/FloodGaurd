package com.floodguard.service;

import com.floodguard.domain.*;
import com.floodguard.dto.Dtos.*;
import com.floodguard.repo.*;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {
    private final IncidentRepository incidents;
    private final LocalityRepository localities;
    private final FacilityRepository facilities;
    private final RescueResourceRepository resources;
    private final RoutingService routing;

    public DashboardService(IncidentRepository incidents, LocalityRepository localities, FacilityRepository facilities,
                            RescueResourceRepository resources, RoutingService routing) {
        this.incidents = incidents; this.localities = localities; this.facilities = facilities;
        this.resources = resources; this.routing = routing;
    }

    public static ResourceDto toDto(RescueResource r) {
        return new ResourceDto(r.getId(), r.getName(), r.getKind(), r.getTotal(), r.getAvailable(), r.getBase());
    }

    public DashboardSummary summary() {
        List<Incident> all = incidents.findAll();
        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (IncidentStatus s : IncidentStatus.values()) byStatus.put(s.name(), 0L);
        all.forEach(i -> byStatus.merge(i.getStatus().name(), 1L, Long::sum));

        Map<String, Long> activeSev = new LinkedHashMap<>();
        for (Severity s : Severity.values()) activeSev.put(s.name(), 0L);
        all.stream().filter(i -> IncidentStatus.ACTIVE.contains(i.getStatus()))
                .forEach(i -> activeSev.merge(i.getSeverity().name(), 1L, Long::sum));

        Map<String, Long> risk = new LinkedHashMap<>();
        for (RiskLevel r : RiskLevel.values()) risk.put(r.name(), 0L);
        List<Locality> locs = localities.findAll();
        locs.forEach(l -> risk.merge(l.getRiskLevel().name(), 1L, Long::sum));

        List<String> blockedNames = routing.roads().stream().filter(RoadDto::blocked).map(RoadDto::name).toList();

        Map<String, Long> openFacilities = facilities.findAll().stream().filter(Facility::isOpen)
                .collect(Collectors.groupingBy(f -> f.getType().name(), TreeMap::new, Collectors.counting()));

        List<LocalityRiskDto> top = locs.stream()
                .sorted(Comparator.comparingDouble(Locality::getRiskScore).reversed()).limit(5)
                .map(RiskService::toDto).toList();

        return new DashboardSummary((int) activeSev.values().stream().mapToLong(Long::longValue).sum(),
                byStatus, activeSev, risk, blockedNames.size(), blockedNames,
                resources.findAll().stream().map(DashboardService::toDto).toList(),
                openFacilities, top, Instant.now());
    }
}
