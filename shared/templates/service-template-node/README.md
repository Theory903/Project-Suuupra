# Resource Service DPoP alignment

- Validate cnf.jkt in access token matches DPoP jkt on each request
- Return DPoP-Nonce challenge when missing/invalid
- Enforce audience/resource indicators and HTTPS/mTLS per policy
