package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
public class Facility {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private FacilityType type;
    private double latitude;
    private double longitude;
    private int capacity;
    private boolean open = true;

    public Facility(String name, FacilityType type, double latitude, double longitude, int capacity) {
        this.name = name; this.type = type; this.latitude = latitude; this.longitude = longitude; this.capacity = capacity;
    }
}
