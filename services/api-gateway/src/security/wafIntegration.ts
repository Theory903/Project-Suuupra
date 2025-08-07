import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';

export interface WAFRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | string;
  field: 'uri' | 'headers' | 'body' | 'query' | 'method' | 'ip';
  action: 'block' | 'detect' | 'rate_limit';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  enabled: boolean;
}

export interface WAFConfig {
  enabled: boolean;
  mode: 'detect' | 'block';
  engine: 'modsecurity' | 'coraza' | 'builtin';
  rules: {
    crs: boolean; // OWASP Core Rule Set
    custom: WAFRule[];
  };
  limits: {
    maxRequestSize: number;
    maxHeaderSize: number;
    maxBodySize: number;
  };
  logging: {
    enabled: boolean;
    logBlocked: boolean;
    logDetected: boolean;
    includePayload: boolean;
  };
  whitelist: {
    ips: string[];
    paths: string[];
    userAgents: string[];
  };
}

export interface WAFViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  field: string;
  value: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  path: string;
  action: 'blocked' | 'detected';
}

export interface WAFResult {
  allowed: boolean;
  violations: WAFViolation[];
  score: number;
  action: 'allow' | 'block' | 'rate_limit';
  reason?: string;
}

export class WAFIntegration {
  private config: WAFConfig;
  private rules: Map<string, WAFRule> = new Map();
  private violationLog: WAFViolation[] = [];

  constructor(config: WAFConfig) {
    this.config = config;
    this.loadRules();
  }

  private loadRules(): void {
    // Load OWASP CRS rules if enabled
    if (this.config.rules.crs) {
      this.loadOWASPCRS();
    }

    // Load custom rules
    for (const rule of this.config.rules.custom) {
      this.rules.set(rule.id, rule);
    }

    console.log(`WAF loaded ${this.rules.size} rules`);
  }

  private loadOWASPCRS(): void {
    // Common OWASP Core Rule Set patterns
    const crsRules: WAFRule[] = [
      {
        id: 'CRS-920-100',
        name: 'HTTP Request Smuggling',
        description: 'Detects HTTP Request Smuggling attacks',
        pattern: /Content-Length:.*Content-Length:|Transfer-Encoding:.*chunked.*Transfer-Encoding:/i,
        field: 'headers',
        action: 'block',
        severity: 'high',
        tags: ['http-smuggling', 'protocol-violation'],
        enabled: true
      },
      {
        id: 'CRS-932-100',
        name: 'Remote Command Execution',
        description: 'Detects Unix command injection',
        pattern: /(\||;|&|`|\$\(|\${|<\(|>\()/,
        field: 'body',
        action: 'block',
        severity: 'critical',
        tags: ['rce', 'command-injection'],
        enabled: true
      },
      {
        id: 'CRS-941-100',
        name: 'XSS Attack',
        description: 'Detects Cross-Site Scripting attempts',
        pattern: /<script[^>]*>.*?<\/script>|javascript:|on\w+\s*=|<iframe|<object|<embed/i,
        field: 'body',
        action: 'block',
        severity: 'high',
        tags: ['xss', 'injection'],
        enabled: true
      },
      {
        id: 'CRS-942-100',
        name: 'SQL Injection',
        description: 'Detects SQL injection attempts',
        pattern: /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b|'.*or.*'|".*or.*"|;.*drop\b|;.*delete\b)/i,
        field: 'body',
        action: 'block',
        severity: 'critical',
        tags: ['sqli', 'injection'],
        enabled: true
      },
      {
        id: 'CRS-913-100',
        name: 'Scanner Detection',
        description: 'Detects security scanners',
        pattern: /(nmap|nikto|sqlmap|dirb|gobuster|wfuzz|burp|acunetix)/i,
        field: 'headers',
        action: 'detect',
        severity: 'medium',
        tags: ['scanner', 'recon'],
        enabled: true
      },
      {
        id: 'CRS-920-200',
        name: 'HTTP Protocol Violation',
        description: 'Detects malformed HTTP requests',
        pattern: /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+.{1000,}/,
        field: 'uri',
        action: 'block',
        severity: 'medium',
        tags: ['protocol-violation'],
        enabled: true
      }
    ];

    for (const rule of crsRules) {
      this.rules.set(rule.id, rule);
    }
  }

  async inspectRequest(request: FastifyRequest): Promise<WAFResult> {
    if (!this.config.enabled) {
      return { allowed: true, violations: [], score: 0, action: 'allow' };
    }

    const violations: WAFViolation[] = [];
    let totalScore = 0;

    // Check whitelist first
    if (this.isWhitelisted(request)) {
      return { allowed: true, violations: [], score: 0, action: 'allow' };
    }

    // Check size limits
    const sizeLimitViolations = this.checkSizeLimits(request);
    violations.push(...sizeLimitViolations);

    // Run rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const violation = await this.checkRule(rule, request);
      if (violation) {
        violations.push(violation);
        totalScore += this.getSeverityScore(rule.severity);
      }
    }

    // Determine action
    const result: WAFResult = {
      allowed: violations.length === 0 || this.config.mode === 'detect',
      violations,
      score: totalScore,
      action: this.determineAction(violations, totalScore)
    };

    // Log violations
    if (this.config.logging.enabled && violations.length > 0) {
      this.logViolations(violations);
    }

    return result;
  }

  private isWhitelisted(request: FastifyRequest): boolean {
    const ip = this.getClientIP(request);
    const path = request.url;
    const userAgent = request.headers['user-agent'] || '';

    // Check IP whitelist
    if (this.config.whitelist.ips.includes(ip)) {
      return true;
    }

    // Check path whitelist
    if (this.config.whitelist.paths.some(whitelistedPath => 
      path.startsWith(whitelistedPath))) {
      return true;
    }

    // Check user agent whitelist
    if (this.config.whitelist.userAgents.some(whitelistedUA => 
      userAgent.includes(whitelistedUA))) {
      return true;
    }

    return false;
  }

  private checkSizeLimits(request: FastifyRequest): WAFViolation[] {
    const violations: WAFViolation[] = [];
    const ip = this.getClientIP(request);
    const userAgent = request.headers['user-agent'] || '';

    // Check request size
    const requestSize = JSON.stringify(request.headers).length + 
                       (request.body ? JSON.stringify(request.body).length : 0);
    
    if (requestSize > this.config.limits.maxRequestSize) {
      violations.push({
        id: this.generateViolationId(),
        ruleId: 'SIZE-001',
        ruleName: 'Request Size Limit',
        severity: 'medium',
        message: `Request size ${requestSize} exceeds limit ${this.config.limits.maxRequestSize}`,
        field: 'request',
        value: requestSize.toString(),
        timestamp: new Date(),
        ip,
        userAgent,
        path: request.url,
        action: this.config.mode === 'block' ? 'blocked' : 'detected'
      });
    }

    return violations;
  }

  private async checkRule(rule: WAFRule, request: FastifyRequest): Promise<WAFViolation | null> {
    const fieldValue = this.extractFieldValue(rule.field, request);
    if (!fieldValue) return null;

    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'i') : rule.pattern;
    const match = pattern.test(fieldValue);

    if (match) {
      return {
        id: this.generateViolationId(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        message: rule.description,
        field: rule.field,
        value: this.sanitizeValue(fieldValue),
        timestamp: new Date(),
        ip: this.getClientIP(request),
        userAgent: request.headers['user-agent'] || '',
        path: request.url,
        action: rule.action === 'block' && this.config.mode === 'block' ? 'blocked' : 'detected'
      };
    }

    return null;
  }

  private extractFieldValue(field: string, request: FastifyRequest): string {
    switch (field) {
      case 'uri':
        return request.url;
      case 'method':
        return request.method;
      case 'ip':
        return this.getClientIP(request);
      case 'headers':
        return JSON.stringify(request.headers);
      case 'query':
        return JSON.stringify(request.query);
      case 'body':
        return request.body ? JSON.stringify(request.body) : '';
      default:
        return '';
    }
  }

  private getClientIP(request: FastifyRequest): string {
    return (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           (request.headers['x-real-ip'] as string) ||
           request.ip ||
           'unknown';
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'low': return 1;
      case 'medium': return 3;
      case 'high': return 5;
      case 'critical': return 10;
      default: return 1;
    }
  }

  private determineAction(violations: WAFViolation[], score: number): 'allow' | 'block' | 'rate_limit' {
    if (violations.length === 0) {
      return 'allow';
    }

    if (this.config.mode === 'detect') {
      return 'allow';
    }

    // Check for critical violations
    const hasCritical = violations.some(v => v.severity === 'critical');
    if (hasCritical) {
      return 'block';
    }

    // Check score threshold
    if (score >= 10) {
      return 'block';
    } else if (score >= 5) {
      return 'rate_limit';
    }

    return 'allow';
  }

  private sanitizeValue(value: string): string {
    // Remove sensitive data and truncate for logging
    return value.length > 200 ? value.substring(0, 200) + '...' : value;
  }

  private generateViolationId(): string {
    return createHash('md5')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex')
      .substring(0, 8);
  }

  private logViolations(violations: WAFViolation[]): void {
    for (const violation of violations) {
      this.violationLog.push(violation);
      
      if (this.config.logging.logBlocked && violation.action === 'blocked') {
        console.warn(`WAF BLOCKED: ${violation.ruleName} - ${violation.message}`, {
          ip: violation.ip,
          path: violation.path,
          ruleId: violation.ruleId
        });
      }
      
      if (this.config.logging.logDetected && violation.action === 'detected') {
        console.info(`WAF DETECTED: ${violation.ruleName} - ${violation.message}`, {
          ip: violation.ip,
          path: violation.path,
          ruleId: violation.ruleId
        });
      }
    }

    // Keep only recent violations (last 1000)
    if (this.violationLog.length > 1000) {
      this.violationLog = this.violationLog.slice(-1000);
    }
  }

  async createFastifyHook() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const result = await this.inspectRequest(request);
      
      if (!result.allowed) {
        const statusCode = result.action === 'rate_limit' ? 429 : 403;
        
        reply.code(statusCode).send({
          error: 'Request blocked by WAF',
          reason: result.reason || 'Security policy violation',
          requestId: request.id,
          timestamp: new Date().toISOString()
        });
        
        return;
      }

      // Add WAF headers for debugging
      reply.header('x-waf-score', result.score.toString());
      reply.header('x-waf-violations', result.violations.length.toString());
    };
  }

  getViolations(limit: number = 100): WAFViolation[] {
    return this.violationLog.slice(-limit);
  }

  getStats() {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentViolations = this.violationLog.filter(v => v.timestamp >= hourAgo);
    
    return {
      totalRules: this.rules.size,
      totalViolations: this.violationLog.length,
      recentViolations: recentViolations.length,
      topRules: this.getTopTriggeredRules(recentViolations),
      topIPs: this.getTopViolatingIPs(recentViolations)
    };
  }

  private getTopTriggeredRules(violations: WAFViolation[]): Array<{ruleId: string, count: number}> {
    const ruleCounts = new Map<string, number>();
    
    for (const violation of violations) {
      ruleCounts.set(violation.ruleId, (ruleCounts.get(violation.ruleId) || 0) + 1);
    }
    
    return Array.from(ruleCounts.entries())
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getTopViolatingIPs(violations: WAFViolation[]): Array<{ip: string, count: number}> {
    const ipCounts = new Map<string, number>();
    
    for (const violation of violations) {
      ipCounts.set(violation.ip, (ipCounts.get(violation.ip) || 0) + 1);
    }
    
    return Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  updateRule(rule: WAFRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }
}

export function createWAFIntegration(config: WAFConfig): WAFIntegration {
  return new WAFIntegration(config);
}
