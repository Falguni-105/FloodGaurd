package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter @Setter @NoArgsConstructor
public class RescueResource {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private ResourceKind kind;
    private int total;
    private int available;
    private String base;

    public RescueResource(String name, ResourceKind kind, int total, String base) {
        this.name = name; this.kind = kind; this.total = total; this.available = total; this.base = base;
    }
}
