package com.suuupra.identity.keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.DecryptRequest;
import software.amazon.awssdk.services.kms.model.EncryptRequest;

@Component
@Profile("aws-kms")
public class AwsKmsService implements KmsService {

    private final KmsClient kms;
    private final String keyId;

    public AwsKmsService(@Value("${kms.key-id}") String keyId, @Value("${aws.region:us-east-1}") String region) {
        this.kms = KmsClient.builder().region(Region.of(region)).build();
        this.keyId = keyId;
    }

    @Override
    public byte[] wrap(byte[] plaintext) {
        var req = EncryptRequest.builder().keyId(keyId).plaintext(SdkBytes.fromByteArray(plaintext)).build();
        return kms.encrypt(req).ciphertextBlob().asByteArray();
    }

    @Override
    public byte[] unwrap(byte[] ciphertext) {
        var req = DecryptRequest.builder().ciphertextBlob(SdkBytes.fromByteArray(ciphertext)).build();
        return kms.decrypt(req).plaintext().asByteArray();
    }
}


