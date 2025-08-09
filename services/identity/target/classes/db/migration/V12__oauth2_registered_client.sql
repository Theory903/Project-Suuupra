-- Spring Authorization Server: Registered Client table (PostgreSQL)
-- Reference: https://github.com/spring-projects/spring-authorization-server/blob/main/samples/db/registered-client-schema.sql

CREATE TABLE IF NOT EXISTS oauth2_registered_client (
    id                                      VARCHAR(100)    PRIMARY KEY,
    client_id                               VARCHAR(100)    NOT NULL,
    client_id_issued_at                     TIMESTAMP       NOT NULL,
    client_secret                           VARCHAR(200)    DEFAULT NULL,
    client_secret_expires_at                TIMESTAMP       DEFAULT NULL,
    client_name                             VARCHAR(200)    NOT NULL,
    client_authentication_methods           VARCHAR(1000)   NOT NULL,
    authorization_grant_types               VARCHAR(1000)   NOT NULL,
    redirect_uris                           VARCHAR(1000)   DEFAULT NULL,
    scopes                                  VARCHAR(1000)   NOT NULL,
    client_settings                         VARCHAR(2000)   NOT NULL,
    token_settings                          VARCHAR(2000)   NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth2_registered_client_client_id_idx
    ON oauth2_registered_client (client_id);


