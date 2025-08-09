package com.suuupra.identity.webauthn;

import com.suuupra.identity.auth.service.AuthService;
import com.suuupra.identity.webauthn.entity.WebAuthnCredential;
import com.suuupra.identity.webauthn.repository.WebAuthnCredentialRepository;
import com.yubico.webauthn.AssertionRequest;
import com.yubico.webauthn.AssertionResult;
import com.yubico.webauthn.CredentialRepository;
import com.yubico.webauthn.FinishAssertionOptions;
import com.yubico.webauthn.FinishRegistrationOptions;
import com.yubico.webauthn.RegisteredCredential;
import com.yubico.webauthn.RelyingParty;
import com.yubico.webauthn.RegistrationResult;
import com.yubico.webauthn.StartAssertionOptions;
import com.yubico.webauthn.StartRegistrationOptions;
import com.yubico.webauthn.data.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.Base64;
import java.util.stream.Collectors;

@Service
public class WebAuthnService implements CredentialRepository {

    private final WebAuthnCredentialRepository credentialRepository;
    private final RelyingParty relyingParty;
    private final StringRedisTemplate redis;
    private final AuthService authService;
    private final WebAuthnProperties props;
    private final Counter regSuccess;
    private final Counter regFailure;
    private final Counter assertSuccess;
    private final Counter assertFailure;

    public WebAuthnService(WebAuthnCredentialRepository credentialRepository,
                           StringRedisTemplate redis,
                           AuthService authService,
                           WebAuthnProperties props,
                           MeterRegistry meterRegistry) {
        this.credentialRepository = credentialRepository;
        this.redis = redis;
        this.authService = authService;
        this.props = props;
        this.relyingParty = RelyingParty.builder()
            .identity(RelyingPartyIdentity.builder().id(props.getRpId()).name(props.getRpName()).build())
            .credentialRepository(this)
            .origins(new HashSet<>(props.getOrigins()))
            .build();
        this.regSuccess = Counter.builder("webauthn_register_success_total").register(meterRegistry);
        this.regFailure = Counter.builder("webauthn_register_failure_total").register(meterRegistry);
        this.assertSuccess = Counter.builder("webauthn_assert_success_total").register(meterRegistry);
        this.assertFailure = Counter.builder("webauthn_assert_failure_total").register(meterRegistry);
    }

    public PublicKeyCredentialCreationOptions startRegistration(UUID userId, String username, String displayName) {
        UserIdentity user = UserIdentity.builder()
            .name(username)
            .displayName(displayName)
            .id(new ByteArray(uuidToBytes(userId)))
            .build();
        PublicKeyCredentialCreationOptions options = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(user)
                .authenticatorSelection(
                    AuthenticatorSelectionCriteria.builder()
                        .residentKey(props.getResidentKey())
                        .userVerification(props.getUserVerification())
                        .authenticatorAttachment(Optional.ofNullable(props.getAuthenticatorAttachment()))
                        .build()
                )
                .build()
        );
        cache("webauthn:reg:challenge:" + userId, options.getChallenge().getBase64Url());
        return options;
    }

    public RegistrationResult finishRegistration(UUID userId, String credentialJson) {
        try {
            String challengeB64 = get("webauthn:reg:challenge:" + userId);
            if (challengeB64 == null || challengeB64.isBlank()) {
                throw new IllegalStateException("registration challenge not found");
            }

            PublicKeyCredentialCreationOptions options = PublicKeyCredentialCreationOptions.builder()
                .rp(RelyingPartyIdentity.builder().id(props.getRpId()).name(props.getRpName()).build())
                .user(UserIdentity.builder().name("user").displayName("user").id(new ByteArray(uuidToBytes(userId))).build())
                .challenge(new ByteArray(Base64.getUrlDecoder().decode(challengeB64)))
                .pubKeyCredParams(List.of(
                    PublicKeyCredentialParameters.builder().alg(COSEAlgorithmIdentifier.ES256).type(PublicKeyCredentialType.PUBLIC_KEY).build()
                ))
                .attestation(props.getAttestation())
                .build();

            RegistrationResult result;
            try {
                PublicKeyCredential<AuthenticatorAttestationResponse, ClientRegistrationExtensionOutputs> pkc =
                    PublicKeyCredential.parseRegistrationResponseJson(credentialJson);
                result = relyingParty.finishRegistration(
                    FinishRegistrationOptions.builder().request(options).response(pkc).build()
                );
                WebAuthnCredential cred = new WebAuthnCredential();
                cred.setUserId(userId);
                cred.setUserHandle(uuidToBytes(userId));
                cred.setCredentialId(pkc.getId().getBase64Url());
                cred.setPublicKeyCose(result.getPublicKeyCose().getBase64Url());
                cred.setSignCount(result.getSignatureCount());
                cred.setAttestationType(result.getAttestationType().name());
                credentialRepository.save(cred);
                regSuccess.increment();
            } catch (IOException | com.yubico.webauthn.exception.RegistrationFailedException e) {
                regFailure.increment();
                throw new RuntimeException("WebAuthn registration verification failed", e);
            }
            return result;
        } finally {
            delete("webauthn:reg:challenge:" + userId);
        }
    }

    public PublicKeyCredentialRequestOptions startAssertion(String username) {
        var assertion = relyingParty.startAssertion(StartAssertionOptions.builder().username(username).build());
        cache("webauthn:assert:challenge:" + username, assertion.getPublicKeyCredentialRequestOptions().getChallenge().getBase64Url());
        return assertion.getPublicKeyCredentialRequestOptions();
    }

    public AssertionResult finishAssertion(String username, String credentialJson) {
        try {
            String challengeB64 = get("webauthn:assert:challenge:" + username);
            if (challengeB64 == null || challengeB64.isBlank()) {
                throw new IllegalStateException("assertion challenge not found");
            }

            PublicKeyCredentialRequestOptions requestOptions = PublicKeyCredentialRequestOptions.builder()
                .challenge(new ByteArray(Base64.getUrlDecoder().decode(challengeB64)))
                .allowCredentials(Optional.of(new ArrayList<>(getCredentialIdsForUsername(username))))
                .userVerification(props.getUserVerification())
                .build();

            try {
                PublicKeyCredential<AuthenticatorAssertionResponse, ClientAssertionExtensionOutputs> pkc =
                    PublicKeyCredential.parseAssertionResponseJson(credentialJson);
                AssertionResult result = relyingParty.finishAssertion(
                    FinishAssertionOptions.builder()
                        .request(AssertionRequest.builder().publicKeyCredentialRequestOptions(requestOptions).build())
                        .response(pkc)
                        .build()
                );
                if (result.isSuccess()) {
                    String credId = pkc.getId().getBase64Url();
                    credentialRepository.findByCredentialId(credId).ifPresent(c -> {
                        c.setSignCount(result.getSignatureCount());
                        credentialRepository.save(c);
                    });
                    assertSuccess.increment();
                } else {
                    assertFailure.increment();
                }
                return result;
            } catch (IOException | com.yubico.webauthn.exception.AssertionFailedException e) {
                assertFailure.increment();
                throw new RuntimeException("WebAuthn assertion verification failed", e);
            }
        } finally {
            delete("webauthn:assert:challenge:" + username);
        }
    }

    private void cache(String key, String value) {
        redis.opsForValue().set(key, value, Duration.ofMinutes(10));
    }

    private void delete(String key) {
        redis.delete(key);
    }

    private String get(String key) {
        return redis.opsForValue().get(key);
    }

    private static byte[] uuidToBytes(UUID uuid) {
        return ByteBuffer.allocate(16)
            .putLong(uuid.getMostSignificantBits())
            .putLong(uuid.getLeastSignificantBits())
            .array();
    }

    // CredentialRepository
    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        UUID userId = authService.getUserIdByEmail(username);
        return credentialRepository.findAllByUserId(userId).stream()
            .map(c -> PublicKeyCredentialDescriptor.builder()
                .id(new ByteArray(Base64.getUrlDecoder().decode(c.getCredentialId())))
                .build())
            .collect(Collectors.toSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        UUID userId = authService.getUserIdByEmail(username);
        return Optional.of(new ByteArray(uuidToBytes(userId)));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        byte[] bytes = userHandle.getBytes();
        if (bytes == null || bytes.length != 16) return Optional.empty();
        ByteBuffer bb = ByteBuffer.wrap(bytes);
        UUID userId = new UUID(bb.getLong(), bb.getLong());
        // We rely on AuthService to resolve email
        try {
            String email = authService.loadUserByUsernameById(userId);
            return Optional.ofNullable(email);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        String id = Base64.getUrlEncoder().withoutPadding().encodeToString(credentialId.getBytes());
        return credentialRepository.findByCredentialId(id).map(c -> RegisteredCredential.builder()
            .credentialId(new ByteArray(Base64.getUrlDecoder().decode(c.getCredentialId())))
            .userHandle(new ByteArray(c.getUserHandle()))
            .publicKeyCose(new ByteArray(Base64.getUrlDecoder().decode(c.getPublicKeyCose())))
            .signatureCount(c.getSignCount())
            .build());
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return Collections.emptySet();
    }
}
