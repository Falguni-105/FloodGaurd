package com.floodguard.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "app_user")
@Getter @Setter @NoArgsConstructor
public class AppUser {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 30)
    private String username;
    @Column(nullable = false)
    private String passwordHash;
    @Column(nullable = false, length = 80)
    private String fullName;
    @Enumerated(EnumType.STRING) @Column(nullable = false)
    private Role role;
}
