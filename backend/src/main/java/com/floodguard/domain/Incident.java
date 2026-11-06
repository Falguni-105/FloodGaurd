package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

@Entity
@Getter @Setter @NoArgsConstructor
public class Incident {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private IncidentType type;
    @Column(length = 1000, nullable = false)
    private String description;
    private double latitude;
    private double longitude;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Severity severity;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private IncidentStatus status = IncidentStatus.OPEN;
    private String reporter;
    private String imageFile;
    private String assignedTo;
    private Long localityId;
    private Instant createdAt;
    private Instant updatedAt;
}
