package com.suuupra.identity.auth.jwt;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final com.suuupra.identity.auth.service.SessionService sessionService;
    private final com.suuupra.identity.auth.service.AccessTokenDenylistService denylistService;

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService, com.suuupra.identity.auth.service.SessionService sessionService, com.suuupra.identity.auth.service.AccessTokenDenylistService denylistService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.sessionService = sessionService;
        this.denylistService = denylistService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            if (jwtService.isTokenValid(token)) {
                try {
                    String subject = jwtService.extractSubject(token);
                    String jti = jwtService.extractJti(token);
                    if (denylistService.isRevoked(jti)) {
                        filterChain.doFilter(request, response);
                        return;
                    }
                    // Set tenant context from claim if present
                    try {
                        String tenant = jwtService.extractTenant(token);
                        if (tenant != null) {
                            com.suuupra.identity.common.util.TenantContext.setTenant(tenant);
                        }
                    } catch (Exception ignored) {}
                    // Enforce session-version revocation
                    int tokenVersion = jwtService.extractSessionVersion(token);
                    String sid = jwtService.extractSessionId(token);
                    if (sid != null && tokenVersion > 0) {
                        int current = sessionService.getCurrentVersion(sid);
                        if (tokenVersion != current) {
                            filterChain.doFilter(request, response);
                            return;
                        }
                    }
                    UserDetails userDetails = userDetailsService.loadUserByUsername(subject);
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } catch (Exception ignored) {
                }
            }
        }
        filterChain.doFilter(request, response);
    }
}
