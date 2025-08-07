/**
 * What: Credential proxying for AWS SigV4 and GCP Service Account tokens
 * Why: Enable secure upstream authentication without exposing credentials to clients
 * How: Sign requests with cloud provider credentials, inject auth headers
 */

import crypto from 'crypto';
import { FastifyRequest } from 'fastify';

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
}

export interface GCPCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri?: string;
}

export interface CredentialProxyConfig {
  aws?: AWSCredentials;
  gcp?: GCPCredentials;
  enabledProviders: Array<'aws' | 'gcp'>;
}

export interface SignedHeaders {
  [key: string]: string;
}

export class CredentialProxy {
  private config: CredentialProxyConfig;
  private gcpTokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(config: CredentialProxyConfig) {
    this.config = config;
  }

  async signRequest(
    request: FastifyRequest,
    provider: 'aws' | 'gcp',
    serviceName?: string
  ): Promise<SignedHeaders> {
    if (!this.config.enabledProviders.includes(provider)) {
      throw new Error(`Provider ${provider} is not enabled`);
    }

    switch (provider) {
      case 'aws':
        return await this.signAWSRequest(request, serviceName);
      case 'gcp':
        return await this.signGCPRequest(request, serviceName);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async signAWSRequest(request: FastifyRequest, serviceName = 'execute-api'): Promise<SignedHeaders> {
    if (!this.config.aws) {
      throw new Error('AWS credentials not configured');
    }

    const { accessKeyId, secretAccessKey, sessionToken, region } = this.config.aws;
    const method = request.method.toUpperCase();
    const url = new URL(request.url, 'https://example.com'); // Base URL doesn't matter for signing
    const host = url.hostname;
    const pathname = url.pathname;
    const queryString = url.search.slice(1); // Remove leading '?'
    
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    
    // Canonical headers
    const canonicalHeaders = new Map<string, string>();
    canonicalHeaders.set('host', host);
    canonicalHeaders.set('x-amz-date', amzDate);
    
    if (sessionToken) {
      canonicalHeaders.set('x-amz-security-token', sessionToken);
    }

    // Add content-related headers if present
    const contentType = request.headers['content-type'];
    if (contentType) {
      canonicalHeaders.set('content-type', contentType);
    }

    // Calculate payload hash
    const body = request.body ? JSON.stringify(request.body) : '';
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    canonicalHeaders.set('x-amz-content-sha256', payloadHash);

    // Sort headers and create signed headers list
    const sortedHeaders = Array.from(canonicalHeaders.keys()).sort();
    const signedHeaders = sortedHeaders.join(';');
    const canonicalHeadersString = sortedHeaders
      .map(key => `${key}:${canonicalHeaders.get(key)}\n`)
      .join('');

    // Create canonical request
    const canonicalRequest = [
      method,
      pathname,
      queryString,
      canonicalHeadersString,
      signedHeaders,
      payloadHash
    ].join('\n');

    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${serviceName}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const signingKey = this.getAWSSigningKey(secretAccessKey, dateStamp, region, serviceName);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    // Create authorization header
    const authorizationHeader = [
      `${algorithm} Credential=${accessKeyId}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`
    ].join(', ');

    // Return signed headers
    const result: SignedHeaders = {
      'Authorization': authorizationHeader,
      'X-Amz-Date': amzDate,
      'X-Amz-Content-Sha256': payloadHash,
    };

    if (sessionToken) {
      result['X-Amz-Security-Token'] = sessionToken;
    }

    if (contentType) {
      result['Content-Type'] = contentType;
    }

    return result;
  }

  private getAWSSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  }

  private async signGCPRequest(request: FastifyRequest, serviceName?: string): Promise<SignedHeaders> {
    if (!this.config.gcp) {
      throw new Error('GCP credentials not configured');
    }

    const accessToken = await this.getGCPAccessToken();
    
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': request.headers['content-type'] || 'application/json',
    };
  }

  private async getGCPAccessToken(): Promise<string> {
    if (!this.config.gcp) {
      throw new Error('GCP credentials not configured');
    }

    const { clientEmail, privateKey, projectId } = this.config.gcp;
    const cacheKey = clientEmail;
    
    // Check cache
    const cached = this.gcpTokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    // Create JWT for token request
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600, // 1 hour
      iat: now,
    };

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    // Sign JWT
    const jwt = this.createJWT(header, payload, privateKey);
    
    // Request access token
    const tokenResponse = await this.requestGCPAccessToken(jwt);
    
    // Cache token
    this.gcpTokenCache.set(cacheKey, {
      token: tokenResponse.access_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000) - 60000, // 1 minute buffer
    });

    return tokenResponse.access_token;
  }

  private createJWT(header: any, payload: any, privateKey: string): string {
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(signatureInput), privateKey);
    const encodedSignature = signature.toString('base64url');
    
    return `${signatureInput}.${encodedSignature}`;
  }

  private async requestGCPAccessToken(jwt: string): Promise<{ access_token: string; expires_in: number }> {
    const tokenUri = this.config.gcp?.tokenUri || 'https://oauth2.googleapis.com/token';
    
    const response = await fetch(tokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get GCP access token: ${error}`);
    }

    return await response.json();
  }

  updateAWSCredentials(credentials: AWSCredentials): void {
    this.config.aws = credentials;
  }

  updateGCPCredentials(credentials: GCPCredentials): void {
    this.config.gcp = credentials;
    // Clear token cache when credentials change
    this.gcpTokenCache.clear();
  }

  clearTokenCache(): void {
    this.gcpTokenCache.clear();
  }

  getTokenCacheStats(): {
    gcpTokens: number;
  } {
    return {
      gcpTokens: this.gcpTokenCache.size,
    };
  }
}

// Global credential proxy instance
let credentialProxy: CredentialProxy | null = null;

export function initializeCredentialProxy(config: CredentialProxyConfig): CredentialProxy {
  credentialProxy = new CredentialProxy(config);
  return credentialProxy;
}

export function getCredentialProxy(): CredentialProxy {
  if (!credentialProxy) {
    throw new Error('Credential proxy not initialized');
  }
  return credentialProxy;
}

// Helper function to extract cloud provider from route config
export function getCloudProvider(serviceUrl: string): 'aws' | 'gcp' | null {
  const url = new URL(serviceUrl);
  const hostname = url.hostname.toLowerCase();
  
  if (hostname.includes('amazonaws.com') || hostname.includes('aws.com')) {
    return 'aws';
  }
  
  if (hostname.includes('googleapis.com') || hostname.includes('gcp.com') || hostname.includes('google.com')) {
    return 'gcp';
  }
  
  return null;
}

// Helper function to extract AWS service name from URL
export function extractAWSServiceName(serviceUrl: string): string {
  const url = new URL(serviceUrl);
  const hostname = url.hostname.toLowerCase();
  
  // Extract service from hostname patterns like:
  // service.region.amazonaws.com
  // service-name.region.amazonaws.com
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[parts.length - 2] === 'amazonaws') {
    const servicePart = parts[0];
    // Handle composite service names
    return servicePart.split('-')[0];
  }
  
  return 'execute-api'; // Default for API Gateway
}

// Common AWS service configurations
export const AWS_SERVICES = {
  API_GATEWAY: 'execute-api',
  LAMBDA: 'lambda',
  S3: 's3',
  DYNAMODB: 'dynamodb',
  SQS: 'sqs',
  SNS: 'sns',
  KINESIS: 'kinesis',
  CLOUDWATCH: 'monitoring',
} as const;

// Common GCP service scopes
export const GCP_SCOPES = {
  CLOUD_PLATFORM: 'https://www.googleapis.com/auth/cloud-platform',
  COMPUTE: 'https://www.googleapis.com/auth/compute',
  STORAGE: 'https://www.googleapis.com/auth/devstorage.read_write',
  PUBSUB: 'https://www.googleapis.com/auth/pubsub',
  BIGQUERY: 'https://www.googleapis.com/auth/bigquery',
} as const;
