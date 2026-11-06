package com.floodguard.service;

import com.floodguard.domain.*;
import com.floodguard.dto.Dtos.*;
import com.floodguard.repo.IncidentRepository;
import com.floodguard.repo.LocalityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class IncidentService {
    private final IncidentRepository incidents;
    private final LocalityRepository localities;
    private final FileStorageService files;
    private final SimpMessagingTemplate ws;

    public IncidentService(IncidentRepository incidents, LocalityRepository localities,
                           FileStorageService files, SimpMessagingTemplate ws) {
        this.incidents = incidents; this.localities = localities; this.files = files; this.ws = ws;
    }

    public IncidentDto create(IncidentType type, String description, double lat, double lon,
                              Severity severity, MultipartFile image, String reporter) {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coordinates");
        }
        if (description == null || description.isBlank() || description.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description is required (max 1000 characters)");
        }
        Incident i = new Incident();
        i.setType(type); i.setDescription(description.strip());
        i.setLatitude(lat); i.setLongitude(lon); i.setSeverity(severity);
        i.setStatus(IncidentStatus.OPEN);
        i.setReporter(reporter);
        i.setImageFile(files.store(image));
        Locality nearest = nearestLocality(lat, lon, localities.findAll());
        i.setLocalityId(nearest == null ? null : nearest.getId());
        i.setCreatedAt(Instant.now()); i.setUpdatedAt(i.getCreatedAt());
        i = incidents.save(i);
        changed();
        return toDto(i, nearest);
    }

    public IncidentDto update(Long id, UpdateIncidentRequest req) {
        Incident i = incidents.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req.status() != null) i.setStatus(req.status());
        if (req.assignedTo() != null) i.setAssignedTo(req.assignedTo().isBlank() ? null : req.assignedTo().strip());
        // assigning a team to an open incident moves it forward automatically
        if (req.status() == null && i.getAssignedTo() != null && i.getStatus() == IncidentStatus.OPEN) {
            i.setStatus(IncidentStatus.ASSIGNED);
        }
        i.setUpdatedAt(Instant.now());
        incidents.save(i);
        changed();
        return toDto(i, localities.findById(i.getLocalityId() == null ? -1L : i.getLocalityId()).orElse(null));
    }

    public List<IncidentDto> all(boolean activeOnly) {
        List<Incident> list = activeOnly ? incidents.findByStatusIn(IncidentStatus.ACTIVE) : incidents.findAllByOrderByCreatedAtDesc();
        return toDtos(list).stream().sorted(Comparator.comparingDouble(IncidentDto::priority).reversed()).toList();
    }

    public List<IncidentDto> activeByPriority() { return all(true); }

    public List<IncidentDto> mine(String username) {
        return toDtos(incidents.findByReporterOrderByCreatedAtDesc(username));
    }

    public List<PublicIncidentDto> publicActive() {
        Map<Long, Locality> loc = localityMap();
        return incidents.findByStatusIn(IncidentStatus.ACTIVE).stream()
                .map(i -> new PublicIncidentDto(i.getId(), i.getType(), i.getSeverity(), i.getStatus(),
                        i.getLatitude(), i.getLongitude(), i.getCreatedAt(), localityName(i, loc)))
                .toList();
    }

    // ---- helpers ----
    private List<IncidentDto> toDtos(List<Incident> list) {
        Map<Long, Locality> loc = localityMap();
        return list.stream().map(i -> toDto(i, i.getLocalityId() == null ? null : loc.get(i.getLocalityId()))).toList();
    }

    private Map<Long, Locality> localityMap() {
        return localities.findAll().stream().collect(Collectors.toMap(Locality::getId, Function.identity()));
    }

    private static String localityName(Incident i, Map<Long, Locality> loc) {
        Locality l = i.getLocalityId() == null ? null : loc.get(i.getLocalityId());
        return l == null ? null : l.getName();
    }

    private static Locality nearestLocality(double lat, double lon, List<Locality> all) {
        return all.stream().min(Comparator.comparingDouble(l -> GeoUtil.haversineM(lat, lon, l.getLatitude(), l.getLongitude()))).orElse(null);
    }

    /**
     * Priority 0-100: severity dominates; life-threatening types, the predicted flood risk of the
     * surrounding locality and how long the report has been waiting add to it.
     */
    static double priority(Incident i, Locality loc) {
        double sev = switch (i.getSeverity()) { case LOW -> 15; case MEDIUM -> 35; case HIGH -> 60; case CRITICAL -> 85; };
        double type = (i.getType() == IncidentType.PEOPLE_TRAPPED || i.getType() == IncidentType.MEDICAL_EMERGENCY) ? 10 : 0;
        double risk = loc == null ? 0 : 0.1 * loc.getRiskScore();
        double waitMin = Duration.between(i.getCreatedAt(), Instant.now()).toMinutes();
        double age = Math.min(10, Math.max(0, waitMin) / 12.0);
        return Math.round(Math.min(100, sev + type + risk + age) * 10) / 10.0;
    }

    private IncidentDto toDto(Incident i, Locality loc) {
        return new IncidentDto(i.getId(), i.getType(), i.getDescription(), i.getLatitude(), i.getLongitude(),
                i.getSeverity(), i.getStatus(), i.getReporter(), i.getImageFile() != null, i.getImageFile(),
                i.getAssignedTo(), i.getCreatedAt(), i.getUpdatedAt(), loc == null ? null : loc.getName(), priority(i, loc));
    }

    private void changed() {
        ws.convertAndSend("/topic/incidents", Map.of("event", "INCIDENTS_CHANGED"));
    }
}
