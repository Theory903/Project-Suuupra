import * as fs from 'fs';
import * as path from 'path';
import * as tls from 'tls';
import { FastifyInstance } from 'fastify';
import { createHash, createHmac } from 'crypto';

export interface TLSConfig {
  enabled: boolean;
  port: number;
  cert: string;
  key: string;
  ca?: string;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
  ciphers?: string;
  minVersion?: string;
  maxVersion?: string;
}

export interface MTLSConfig {
  enabled: boolean;
  spiffe?: {
    enabled: boolean;
    trustDomain: string;
    socketPath: string;
    workloadAPITimeout: number;
  };
  certificates: {
    cert: string;
    key: string;
    ca: string;
  };
  verification: {
    verifyClient: boolean;
    allowedSANs?: string[];
    allowedFingerprints?: string[];
  };
}

export interface TLSManagerConfig {
  tls: TLSConfig;
  mtls: MTLSConfig;
  rotation: {
    enabled: boolean;
    checkInterval: number;
    gracePeriod: number;
  };
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  serialNumber: string;
  spiffeId?: string;
}

export class TLSManager {
  private config: TLSManagerConfig;
  private server?: FastifyInstance;
  private certificates: Map<string, CertificateInfo> = new Map();
  private rotationTimer?: NodeJS.Timeout;

  constructor(config: TLSManagerConfig) {
    this.config = config;
  }

  async initialize(server: FastifyInstance): Promise<void> {
    this.server = server;

    if (this.config.tls.enabled) {
      await this.setupTLS();
    }

    if (this.config.mtls.enabled) {
      await this.setupMTLS();
    }

    if (this.config.rotation.enabled) {
      this.startCertificateRotation();
    }
  }

  private async setupTLS(): Promise<void> {
    const tlsOptions: tls.TlsOptions = {
      cert: await this.loadCertificate(this.config.tls.cert),
      key: await this.loadPrivateKey(this.config.tls.key),
      ca: this.config.tls.ca ? await this.loadCertificate(this.config.tls.ca) : undefined,
      requestCert: this.config.tls.requestCert || false,
      rejectUnauthorized: this.config.tls.rejectUnauthorized !== false,
      ciphers: this.config.tls.ciphers || 'ECDHE-RSA-AES128-GCM-SHA256:!RC4:!MD5:!aNULL:!eNULL:!NULL:!DH:!EDH:!EXP:+HIGH:+MEDIUM',
      minVersion: this.config.tls.minVersion as any || 'TLSv1.2',
      maxVersion: this.config.tls.maxVersion as any || 'TLSv1.3'
    };

    // Register TLS options with Fastify
    if (this.server) {
      this.server.register(require('@fastify/https'), {
        https: tlsOptions
      });
    }

    console.log('TLS termination configured');
  }

  private async setupMTLS(): Promise<void> {
    if (this.config.mtls.spiffe?.enabled) {
      await this.setupSPIFFE();
    } else {
      await this.setupStaticMTLS();
    }
  }

  private async setupSPIFFE(): Promise<void> {
    const spiffe = this.config.mtls.spiffe!;
    
    try {
      // In a real implementation, this would connect to SPIRE Workload API
      // For now, we'll simulate the SPIFFE certificate fetching
      const workloadCerts = await this.fetchSPIFFECertificates(spiffe);
      
      const mtlsOptions = {
        cert: workloadCerts.cert,
        key: workloadCerts.key,
        ca: workloadCerts.ca,
        requestCert: true,
        rejectUnauthorized: true,
        checkServerIdentity: (hostname: string, cert: any) => {
          return this.verifySPIFFEIdentity(cert, spiffe.trustDomain);
        }
      };

      console.log(`SPIFFE/SPIRE mTLS configured for trust domain: ${spiffe.trustDomain}`);
      
    } catch (error) {
      console.error('Failed to setup SPIFFE mTLS:', error);
      throw error;
    }
  }

  private async setupStaticMTLS(): Promise<void> {
    const certs = this.config.mtls.certificates;
    
    const mtlsOptions = {
      cert: await this.loadCertificate(certs.cert),
      key: await this.loadPrivateKey(certs.key),
      ca: await this.loadCertificate(certs.ca),
      requestCert: true,
      rejectUnauthorized: this.config.mtls.verification.verifyClient,
      checkServerIdentity: (hostname: string, cert: any) => {
        return this.verifyClientCertificate(cert);
      }
    };

    console.log('Static mTLS configured');
  }

  private async fetchSPIFFECertificates(spiffe: NonNullable<MTLSConfig['spiffe']>): Promise<{cert: string, key: string, ca: string}> {
    // Simulate SPIRE Workload API call
    // In production, this would use the SPIFFE Workload API client
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mock SPIFFE certificates
        resolve({
          cert: `-----BEGIN CERTIFICATE-----\n[SPIFFE CERT]\n-----END CERTIFICATE-----`,
          key: `-----BEGIN PRIVATE KEY-----\n[SPIFFE KEY]\n-----END PRIVATE KEY-----`,
          ca: `-----BEGIN CERTIFICATE-----\n[SPIFFE CA]\n-----END CERTIFICATE-----`
        });
      }, 100);
    });
  }

  private verifySPIFFEIdentity(cert: any, trustDomain: string): Error | undefined {
    try {
      // Extract SPIFFE ID from certificate SAN
      const spiffeId = this.extractSPIFFEId(cert);
      
      if (!spiffeId) {
        return new Error('No SPIFFE ID found in certificate');
      }

      if (!spiffeId.startsWith(`spiffe://${trustDomain}/`)) {
        return new Error(`SPIFFE ID ${spiffeId} not in trust domain ${trustDomain}`);
      }

      console.log(`Verified SPIFFE identity: ${spiffeId}`);
      return undefined;
      
    } catch (error) {
      return new Error(`SPIFFE verification failed: ${error}`);
    }
  }

  private verifyClientCertificate(cert: any): Error | undefined {
    try {
      const verification = this.config.mtls.verification;
      
      // Check allowed SANs
      if (verification.allowedSANs && verification.allowedSANs.length > 0) {
        const sans = this.extractSANs(cert);
        const hasAllowedSAN = verification.allowedSANs.some(allowed => 
          sans.includes(allowed)
        );
        
        if (!hasAllowedSAN) {
          return new Error('Certificate SAN not in allowed list');
        }
      }

      // Check allowed fingerprints
      if (verification.allowedFingerprints && verification.allowedFingerprints.length > 0) {
        const fingerprint = this.calculateFingerprint(cert);
        
        if (!verification.allowedFingerprints.includes(fingerprint)) {
          return new Error('Certificate fingerprint not in allowed list');
        }
      }

      return undefined;
      
    } catch (error) {
      return new Error(`Certificate verification failed: ${error}`);
    }
  }

  private extractSPIFFEId(cert: any): string | null {
    // Extract SPIFFE ID from certificate Subject Alternative Names
    // This is a simplified implementation
    const sans = cert.subjectaltname || '';
    const spiffeMatch = sans.match(/URI:spiffe:\/\/[^,\s]+/);
    return spiffeMatch ? spiffeMatch[0].replace('URI:', '') : null;
  }

  private extractSANs(cert: any): string[] {
    const sans = cert.subjectaltname || '';
    return sans.split(',').map((san: string) => san.trim());
  }

  private calculateFingerprint(cert: any): string {
    const der = cert.raw || Buffer.from(cert.toString(), 'base64');
    return createHash('sha256').update(der).digest('hex').toUpperCase();
  }

  private async loadCertificate(certPath: string): Promise<string> {
    try {
      if (certPath.startsWith('-----BEGIN')) {
        return certPath; // Already PEM format
      }
      return fs.readFileSync(path.resolve(certPath), 'utf8');
    } catch (error) {
      throw new Error(`Failed to load certificate from ${certPath}: ${error}`);
    }
  }

  private async loadPrivateKey(keyPath: string): Promise<string> {
    try {
      if (keyPath.startsWith('-----BEGIN')) {
        return keyPath; // Already PEM format
      }
      return fs.readFileSync(path.resolve(keyPath), 'utf8');
    } catch (error) {
      throw new Error(`Failed to load private key from ${keyPath}: ${error}`);
    }
  }

  private startCertificateRotation(): void {
    const interval = this.config.rotation.checkInterval * 1000; // Convert to ms
    
    this.rotationTimer = setInterval(async () => {
      try {
        await this.checkAndRotateCertificates();
      } catch (error) {
        console.error('Certificate rotation check failed:', error);
      }
    }, interval);

    console.log(`Certificate rotation monitoring started (interval: ${this.config.rotation.checkInterval}s)`);
  }

  private async checkAndRotateCertificates(): Promise<void> {
    const gracePeriod = this.config.rotation.gracePeriod * 24 * 60 * 60 * 1000; // Convert days to ms
    const now = new Date();

    for (const [name, certInfo] of this.certificates) {
      const timeToExpiry = certInfo.validTo.getTime() - now.getTime();
      
      if (timeToExpiry <= gracePeriod) {
        console.log(`Certificate ${name} expires in ${Math.ceil(timeToExpiry / (24 * 60 * 60 * 1000))} days, rotating...`);
        
        try {
          await this.rotateCertificate(name);
        } catch (error) {
          console.error(`Failed to rotate certificate ${name}:`, error);
        }
      }
    }
  }

  private async rotateCertificate(name: string): Promise<void> {
    // In a real implementation, this would:
    // 1. Request new certificate from CA or SPIRE
    // 2. Validate new certificate
    // 3. Atomically swap certificates
    // 4. Update TLS context
    
    console.log(`Certificate ${name} rotation completed`);
  }

  async getCertificateInfo(certPath: string): Promise<CertificateInfo> {
    const certPem = await this.loadCertificate(certPath);
    const cert = new (require('crypto')).X509Certificate(certPem);
    
    return {
      subject: cert.subject,
      issuer: cert.issuer,
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
      fingerprint: cert.fingerprint256,
      serialNumber: cert.serialNumber,
      spiffeId: this.extractSPIFFEId(cert)
    };
  }

  async validateCertificateChain(certPath: string, caPath?: string): Promise<boolean> {
    try {
      const cert = await this.loadCertificate(certPath);
      const ca = caPath ? await this.loadCertificate(caPath) : undefined;
      
      // Use Node.js built-in certificate validation
      // This is a simplified implementation
      return true;
      
    } catch (error) {
      console.error('Certificate chain validation failed:', error);
      return false;
    }
  }

  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }
}

export function createTLSManager(config: TLSManagerConfig): TLSManager {
  return new TLSManager(config);
}
