package com.floodguard.web;

import com.floodguard.domain.IncidentType;
import com.floodguard.domain.Severity;
import com.floodguard.dto.Dtos.*;
import com.floodguard.service.IncidentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentService incidents;

    public IncidentController(IncidentService incidents) { this.incidents = incidents; }

    /** Citizen report: multipart form with GPS coordinates, description and an optional photo. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<IncidentDto> report(@RequestParam IncidentType type,
                                              @RequestParam String description,
                                              @RequestParam double latitude,
                                              @RequestParam double longitude,
                                              @RequestParam Severity severity,
                                              @RequestParam(required = false) MultipartFile image,
                                              Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(incidents.create(type, description, latitude, longitude, severity, image, auth.getName()));
    }

    @GetMapping("/mine")
    public List<IncidentDto> mine(Authentication auth) { return incidents.mine(auth.getName()); }

    /** Public: active incidents without descriptions/photos/reporter identity. */
    @GetMapping("/public")
    public List<PublicIncidentDto> publicActive() { return incidents.publicActive(); }

    /** Authorities: all incidents, highest priority first. */
    @GetMapping
    public List<IncidentDto> all(@RequestParam(defaultValue = "false") boolean activeOnly) { return incidents.all(activeOnly); }

    @PatchMapping("/{id}")
    public IncidentDto update(@PathVariable Long id, @Valid @RequestBody UpdateIncidentRequest req) {
        return incidents.update(id, req);
    }
}
