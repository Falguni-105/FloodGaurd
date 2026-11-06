package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

/** A city locality with its static terrain/drainage attributes and its latest predicted flood risk. */
@Entity
@Getter @Setter @NoArgsConstructor
public class Locality {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String name;
    private double latitude;
    private double longitude;

    // static attributes (model inputs)
    private double elevationM;
    private double slopeDeg;
    private double drainageCapacityMmh;
    private double riverDistanceKm;
    private int historicalFloods;
    private double imperviousRatio;

    // latest weather (model inputs)
    private double rainfall24hMm;
    private double rainfallIntensityMmh;
    private double rainfall3dayMm;

    // latest prediction
    @Enumerated(EnumType.STRING)
    private RiskLevel riskLevel = RiskLevel.LOW;
    private double riskScore;
    private String riskSource;
    private String weatherSource;
    private Instant riskUpdatedAt;
}
