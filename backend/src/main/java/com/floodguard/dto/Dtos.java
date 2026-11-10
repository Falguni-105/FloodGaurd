package com.floodguard.dto;

import com.floodguard.domain.*;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class Dtos {
    private Dtos() {}

    // ---- auth ----
    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 120) @Pattern(regexp = "^[A-Za-z0-9_@.+ -]+$", message = "Must be a valid email or username (letters, digits, @, ., -, _)") String username,
            @NotBlank @Size(min = 6, max = 100, message = "Password must be at least 6 characters") String password,
            @NotBlank @Size(max = 120) String fullName) {}
    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}
    public record AuthResponse(String token, String username, String fullName, String role) {}

    // ---- risk ----
    public record LocalityRiskDto(Long id, String name, double latitude, double longitude, double elevationM,
                                  String riskLevel, double riskScore,
                                  double rainfall24hMm, double rainfallIntensityMmh, double rainfall3dayMm,
                                  String weatherSource, String riskSource, Instant updatedAt) {}
    public record SimulationRequest(
            @NotNull @DecimalMin("0") @DecimalMax("1000") Double rainfall24hMm,
            @DecimalMin("0") @DecimalMax("500") Double rainfallIntensityMmh,
            @DecimalMin("0") @DecimalMax("2000") Double rainfall3dayMm,
            Boolean persist) {}

    // ---- incidents ----
    public record IncidentDto(Long id, IncidentType type, String description, double latitude, double longitude,
                              Severity severity, IncidentStatus status, String reporter, boolean hasImage,
                              String imageFile, String assignedTo, Instant createdAt, Instant updatedAt,
                              String locality, double priority) {}
    /** What anonymous visitors may see: no free-text description, no reporter, no photo. */
    public record PublicIncidentDto(Long id, IncidentType type, Severity severity, IncidentStatus status,
                                    double latitude, double longitude, Instant createdAt, String locality) {}
    public record UpdateIncidentRequest(IncidentStatus status, @Size(max = 80) String assignedTo) {}

    // ---- infrastructure ----
    public record FacilityDto(Long id, String name, FacilityType type, double latitude, double longitude, int capacity, boolean open) {}
    public record NearbyFacility(FacilityDto facility, double distanceKm) {}
    public record RoadDto(Long id, String name, double fromLat, double fromLon, double toLat, double toLon,
                          double lengthM, boolean blocked) {}
    public record ResourceDto(Long id, String name, ResourceKind kind, int total, int available, String base) {}
    public record ResourceUpdate(@NotNull @Min(0) Integer available) {}

    // ---- routing / dispatch ----
    public record RouteResult(boolean found, String message, double distanceKm, int etaMinutes,
                              List<double[]> path, List<String> roads, boolean detoured, double extraKmVsNormal) {}
    public record PlanItem(int rank, IncidentDto incident, String rescueBase, RouteResult routeFromBase,
                           String nearestHospital, Double hospitalKm, String nearestShelter, Double shelterKm,
                           boolean accessible) {}

    // ---- dashboard ----
    public record DashboardSummary(int activeIncidents, Map<String, Long> incidentsByStatus,
                                   Map<String, Long> activeBySeverity, Map<String, Long> localitiesByRisk,
                                   int blockedRoads, List<String> blockedRoadNames,
                                   List<ResourceDto> resources, Map<String, Long> openFacilities,
                                   List<LocalityRiskDto> highestRisk, Instant generatedAt) {}
}
