package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A node of the road graph (junction / bridge / locality centre). */
@Entity
@Getter @Setter @NoArgsConstructor
public class Junction {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    private double latitude;
    private double longitude;

    public Junction(String name, double latitude, double longitude) {
        this.name = name; this.latitude = latitude; this.longitude = longitude;
    }
}
