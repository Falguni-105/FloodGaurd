package com.floodguard.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    SecurityFilterChain chain(HttpSecurity http, JwtAuthFilter jwtFilter) throws Exception {
        http
            .csrf(c -> c.disable())                       // stateless token API, no cookies
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // public: auth, live map data, facilities, route finder, websocket handshake
                .requestMatchers("/ws/**", "/api/auth/**", "/api/risk/map", "/api/risk/model",
                                 "/api/facilities/**", "/api/incidents/public", "/api/roads",
                                 "/api/rescue/route", "/actuator/health").permitAll()
                // authority-only
                .requestMatchers("/api/dashboard/**", "/api/rescue/plan", "/api/resources/**",
                                 "/api/risk/refresh", "/api/risk/simulate", "/api/files/**")
                    .hasAnyRole("AUTHORITY", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/incidents").hasAnyRole("AUTHORITY", "ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/incidents/**").hasAnyRole("AUTHORITY", "ADMIN")
                // any logged-in user: report an incident, list own reports
                .anyRequest().authenticated())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${floodguard.cors.allowed-origins}") String origins) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(Arrays.asList(origins.split("\\s*,\\s*")));
        cfg.setAllowedMethods(List.of("GET", "POST", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
