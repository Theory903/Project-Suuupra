package com.suuupra.identity.config;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.suuupra.identity.auth.jwt.JwtService;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.oauth2.server.authorization.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.web.SecurityFilterChain;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;

@Configuration
public class AuthorizationServerConfig {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ClientsProperties clientsProperties;

    public AuthorizationServerConfig(JwtService jwtService, UserRepository userRepository, ClientsProperties clientsProperties) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.clientsProperties = clientsProperties;
    }

    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(HttpSecurity http) throws Exception {
        OAuth2AuthorizationServerConfigurer authorizationServerConfigurer = new OAuth2AuthorizationServerConfigurer();
        http
            .securityMatcher(authorizationServerConfigurer.getEndpointsMatcher())
            .authorizeHttpRequests(authorize -> authorize
                // Allow discovery and JWKs to be publicly accessible
                .requestMatchers("/.well-known/**", "/oauth2/jwks", "/oauth2/authorize", "/oauth2/token").permitAll()
                .anyRequest().authenticated()
            )
            .csrf(csrf -> csrf.ignoringRequestMatchers(authorizationServerConfigurer.getEndpointsMatcher()))
            .apply(authorizationServerConfigurer)
                .oidc(Customizer.withDefaults()); // Enable OpenID Connect 1.0

        return http.build();
    }

    @Bean
    public RegisteredClientRepository registeredClientRepository() {
        var list = clientsProperties.getClients().stream().map(c -> {
            RegisteredClient.Builder b = RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(c.getClientId());
            if (c.getClientSecret() != null && !c.getClientSecret().isBlank()) {
                b.clientSecret(c.getClientSecret());
            } else {
                b.clientAuthenticationMethod(auth -> {}); // public client
            }
            for (String g : c.getGrants()) {
                if ("authorization_code".equalsIgnoreCase(g)) b.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE);
                if ("refresh_token".equalsIgnoreCase(g)) b.authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN);
                if ("client_credentials".equalsIgnoreCase(g)) b.authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS);
            }
            for (String ru : c.getRedirectUris()) b.redirectUri(ru);
            for (String s : c.getScopes()) b.scope(s);
            return b.build();
        }).toList();
        return new InMemoryRegisteredClientRepository(list);
    }

    @Bean
    public AuthorizationServerSettings authorizationServerSettings(
        @Value("${security.jwt.issuer:suuupra-identity}") String issuer
    ) {
        return AuthorizationServerSettings.builder()
            .issuer(issuer)
            .build();
    }

    @Bean
    public JWKSource<SecurityContext> jwkSource() {
        // Reuse ES256 key pair from JwtService
        ECKey ecJwk = new ECKey.Builder(Curve.P_256, jwtService.getEcPublicKey())
            .privateKey(jwtService.getEcPrivateKey())
            .keyID(jwtService.getCurrentKeyId())
            .build();
        JWKSet jwkSet = new JWKSet(ecJwk);
        return (jwkSelector, securityContext) -> jwkSelector.select(jwkSet);
    }

    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> tokenCustomizer() {
        return context -> {
            if (context.getPrincipal() == null) return;
            String username = context.getPrincipal().getName();
            User user = userRepository.findByEmail(username).orElse(null);
            if (user == null) return;
            Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
            context.getClaims().claim("roles", roles);
        };
    }
}


