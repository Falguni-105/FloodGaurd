package com.floodguard.web;

import com.floodguard.domain.Facility;
import com.floodguard.domain.FacilityType;
import com.floodguard.domain.RescueResource;
import com.floodguard.dto.Dtos.*;
import com.floodguard.repo.FacilityRepository;
import com.floodguard.repo.RescueResourceRepository;
import com.floodguard.service.*;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Comparator;
import java.util.List;

/** Facilities, rescue routing/dispatch, resources, dashboard and incident photos. */
@RestController
@RequestMapping("/api")
public class MiscController {
    private final FacilityRepository facilities;
    private final RescueResourceRepository resources;
    private final RoutingService routing;
    private final DashboardService dashboard;
    private final FileStorageService files;

    public MiscController(FacilityRepository facilities, RescueResourceRepository resources, RoutingService routing,
                          DashboardService dashboard, FileStorageService files) {
        this.facilities = facilities; this.resources = resources; this.routing = routing;
        this.dashboard = dashboard; this.files = files;
    }

    private static FacilityDto dto(Facility f) {
        return new FacilityDto(f.getId(), f.getName(), f.getType(), f.getLatitude(), f.getLongitude(), f.getCapacity(), f.isOpen());
    }

    @GetMapping("/facilities")
    public List<FacilityDto> facilities(@RequestParam(required = false) FacilityType type) {
        return facilities.findAll().stream().filter(f -> type == null || f.getType() == type).map(MiscController::dto).toList();
    }

    @GetMapping("/facilities/nearest")
    public List<NearbyFacility> nearest(@RequestParam double lat, @RequestParam double lon,
                                        @RequestParam FacilityType type, @RequestParam(defaultValue = "3") int limit) {
        return facilities.findAll().stream().filter(f -> f.getType() == type && f.isOpen())
                .map(f -> new NearbyFacility(dto(f), Math.round(GeoUtil.haversineM(lat, lon, f.getLatitude(), f.getLongitude()) / 10.0) / 100.0))
                .sorted(Comparator.comparingDouble(NearbyFacility::distanceKm))
                .limit(Math.max(1, Math.min(limit, 10))).toList();
    }

    @GetMapping("/roads")
    public List<RoadDto> roads() { return routing.roads(); }

    @GetMapping("/rescue/route")
    public RouteResult route(@RequestParam double fromLat, @RequestParam double fromLon,
                             @RequestParam double toLat, @RequestParam double toLon) {
        return routing.route(fromLat, fromLon, toLat, toLon);
    }

    @GetMapping("/rescue/plan")
    public List<PlanItem> plan() { return routing.plan(); }

    @GetMapping("/resources")
    public List<ResourceDto> resources() { return resources.findAll().stream().map(DashboardService::toDto).toList(); }

    @PatchMapping("/resources/{id}")
    public ResourceDto updateResource(@PathVariable Long id, @Valid @RequestBody ResourceUpdate req) {
        RescueResource r = resources.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (req.available() > r.getTotal()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "available cannot exceed total");
        r.setAvailable(req.available());
        return DashboardService.toDto(resources.save(r));
    }

    @GetMapping("/dashboard/summary")
    public DashboardSummary summary() { return dashboard.summary(); }

    @GetMapping("/files/{name}")
    public ResponseEntity<Resource> file(@PathVariable String name) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(FileStorageService.contentTypeOf(name))).body(files.load(name));
    }
}
