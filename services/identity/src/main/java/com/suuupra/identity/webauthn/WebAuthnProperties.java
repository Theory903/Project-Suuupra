package com.suuupra.identity.webauthn;

import com.yubico.webauthn.data.ResidentKeyRequirement;
import com.yubico.webauthn.data.UserVerificationRequirement;
import com.yubico.webauthn.data.AuthenticatorAttachment;
import com.yubico.webauthn.data.AttestationConveyancePreference;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "security.webauthn")
public class WebAuthnProperties {
    private String rpId = "identity.suuupra.local";
    private String rpName = "Suuupra Identity";
    private List<String> origins;
    private ResidentKeyRequirement residentKey = ResidentKeyRequirement.PREFERRED;
    private UserVerificationRequirement userVerification = UserVerificationRequirement.PREFERRED;
    private AuthenticatorAttachment authenticatorAttachment; // null=any
    private AttestationConveyancePreference attestation = AttestationConveyancePreference.NONE;

    public String getRpId() { return rpId; }
    public void setRpId(String rpId) { this.rpId = rpId; }
    public String getRpName() { return rpName; }
    public void setRpName(String rpName) { this.rpName = rpName; }
    public List<String> getOrigins() { return origins; }
    public void setOrigins(List<String> origins) { this.origins = origins; }
    public ResidentKeyRequirement getResidentKey() { return residentKey; }
    public void setResidentKey(ResidentKeyRequirement residentKey) { this.residentKey = residentKey; }
    public UserVerificationRequirement getUserVerification() { return userVerification; }
    public void setUserVerification(UserVerificationRequirement userVerification) { this.userVerification = userVerification; }
    public AuthenticatorAttachment getAuthenticatorAttachment() { return authenticatorAttachment; }
    public void setAuthenticatorAttachment(AuthenticatorAttachment authenticatorAttachment) { this.authenticatorAttachment = authenticatorAttachment; }
    public AttestationConveyancePreference getAttestation() { return attestation; }
    public void setAttestation(AttestationConveyancePreference attestation) { this.attestation = attestation; }
}


