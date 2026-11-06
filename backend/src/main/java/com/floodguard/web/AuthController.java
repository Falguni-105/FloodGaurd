package com.floodguard.web;

import com.floodguard.domain.AppUser;
import com.floodguard.domain.Role;
import com.floodguard.dto.Dtos.*;
import com.floodguard.repo.UserRepository;
import com.floodguard.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users; this.encoder = encoder; this.jwt = jwt;
    }

    /** Public self-registration always creates a CITIZEN; authority accounts are provisioned by admins. */
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        if (users.existsByUsername(req.username())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken");
        }
        AppUser u = new AppUser();
        u.setUsername(req.username());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setFullName(req.fullName().strip());
        u.setRole(Role.CITIZEN);
        users.save(u);
        return ResponseEntity.status(HttpStatus.CREATED).body(response(u));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        AppUser u = users.findByUsername(req.username()).orElse(null);
        if (u == null || !encoder.matches(req.password(), u.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid username or password");
        }
        return response(u);
    }

    private AuthResponse response(AppUser u) {
        return new AuthResponse(jwt.generate(u.getUsername(), u.getRole().name()), u.getUsername(), u.getFullName(), u.getRole().name());
    }
}
