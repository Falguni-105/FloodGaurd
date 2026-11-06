package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An (undirected) road segment between two junctions. */
@Entity
@Getter @Setter @NoArgsConstructor
public class RoadEdge {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long fromId;
    private Long toId;
    @Column(nullable = false)
    private String name;
    private double lengthM;

    public RoadEdge(Long fromId, Long toId, String name, double lengthM) {
        this.fromId = fromId; this.toId = toId; this.name = name; this.lengthM = lengthM;
    }
}
