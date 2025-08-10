package com.suuupra.identity.config;

import com.suuupra.identity.auth.jwt.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.suuupra.identity.security.ResourceIndicatorFilter;
import com.suuupra.identity.security.DPoPVerifierFilter;
import com.suuupra.identity.security.RateLimiterFilter;
import com.suuupra.identity.security.MtlsEnforcementFilter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.context.annotation.Lazy;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ResourceIndicatorFilter resourceIndicatorFilter;
    private final DPoPVerifierFilter dPoPVerifierFilter;
    private final RateLimiterFilter rateLimiterFilter;
    private final UserDetailsService userDetailsService;
    private final MtlsEnforcementFilter mtlsEnforcementFilter;

    public SecurityConfig(@Lazy UserDetailsService userDetailsService, JwtAuthenticationFilter jwtAuthenticationFilter, ResourceIndicatorFilter resourceIndicatorFilter, DPoPVerifierFilter dPoPVerifierFilter, RateLimiterFilter rateLimiterFilter, MtlsEnforcementFilter mtlsEnforcementFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.userDetailsService = userDetailsService;
        this.resourceIndicatorFilter = resourceIndicatorFilter;
        this.dPoPVerifierFilter = dPoPVerifierFilter;
        this.rateLimiterFilter = rateLimiterFilter;
        this.mtlsEnforcementFilter = mtlsEnforcementFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, @Value("${security.require-ssl:false}") boolean requireSsl) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(h -> h
                .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31536000))
                .contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                .frameOptions(f -> f.sameOrigin())
            )
            .cors(cors -> cors.configurationSource(unused -> {
                var config = new org.springframework.web.cors.CorsConfiguration();
                config.setAllowedOriginPatterns(java.util.List.of("https://*.suuupra.com", "https://localhost:*"));
                config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                config.setAllowedHeaders(java.util.List.of("*"));
                config.setAllowCredentials(true);
                return config;
            }))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/actuator/**",
                    "/v3/api-docs/**",
                    "/swagger-ui/**",
                    "/api/v1/auth/**",
                    "/api/v1/webauthn/**",
                    "/.well-known/**",
                    "/oidc/**"
                ).permitAll()
                .anyRequest().authenticated())
            .httpBasic(h -> h.disable());
        if (requireSsl) {
            http.requiresChannel(ch -> ch.anyRequest().requiresSecure());
        }

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(rateLimiterFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(resourceIndicatorFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterAfter(dPoPVerifierFilter, ResourceIndicatorFilter.class);
        http.addFilterAfter(mtlsEnforcementFilter, DPoPVerifierFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Argon2id with sensible defaults (salt=16, hash=32, parallelism=1, memory=32MB, iterations=2)
        return new Argon2PasswordEncoder(16, 32, 1, 1 << 15, 2);
    }

    @Bean
    public AuthenticationManager authenticationManager() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setPasswordEncoder(passwordEncoder());
        provider.setUserDetailsService(userDetailsService);
        return new ProviderManager(provider);
    }
}
