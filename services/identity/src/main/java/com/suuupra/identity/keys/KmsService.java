package com.suuupra.identity.keys;

public interface KmsService {
    byte[] wrap(byte[] plaintext);
    byte[] unwrap(byte[] ciphertext);
}


