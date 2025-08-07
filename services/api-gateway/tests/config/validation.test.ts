import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigValidator, ConfigMigrator, CompatibilityTester, SUPPORTED_VERSIONS } from '../../src/config/validation';
import { GatewayConfig, RouteConfig } from '../../src/types/gateway';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validateGatewayConfig', () => {
    it('should validate a valid gateway configuration', () => {
      const validConfig: GatewayConfig = {
        version: '2.0.0',
        server: {
          port: 3000,
          host: '0.0.0.0',
          cors: {
            enabled: true,
            origins: ['*']
          }
        },
        routes: [
          {
            id: 'test-route',
            matcher: {
              pathPrefix: '/api/test',
              methods: ['GET', 'POST']
            },
            target: {
              serviceName: 'test-service',
              discovery: {
                type: 'static',
                endpoints: ['http://localhost:8080']
              }
            },
            policy: {
              auth: {
                enabled: false
              },
              rateLimit: {
                enabled: true,
                requests: 100,
                window: 60,
                keys: ['ip']
              }
            }
          }
        ],
        services: [
          {
            name: 'test-service',
            discovery: {
              type: 'static',
              endpoints: ['http://localhost:8080']
            }
          }
        ],
        features: {
          prometheusMetrics: true,
          rateLimiting: true,
          circuitBreakers: true
        },
        admin: {
          apiEnabled: true,
          hotReloadEnabled: true,
          secretsManagementEnabled: false
        }
      };

      const result = validator.validateGatewayConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with invalid version', () => {
      const invalidConfig = {
        version: 'invalid-version',
        server: { port: 3000 },
        routes: [],
        services: []
      };

      const result = validator.validateGatewayConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('version'));
    });

    it('should reject configuration with duplicate route IDs', () => {
      const configWithDuplicates: GatewayConfig = {
        version: '2.0.0',
        server: { port: 3000 },
        routes: [
          {
            id: 'duplicate-id',
            matcher: { methods: ['GET'] },
            target: { serviceName: 'service1', discovery: { type: 'static' } },
            policy: {}
          },
          {
            id: 'duplicate-id',
            matcher: { methods: ['POST'] },
            target: { serviceName: 'service2', discovery: { type: 'static' } },
            policy: {}
          }
        ],
        services: [
          { name: 'service1', discovery: { type: 'static' } },
          { name: 'service2', discovery: { type: 'static' } }
        ]
      };

      const result = validator.validateGatewayConfig(configWithDuplicates);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Duplicate route ID: duplicate-id'));
    });

    it('should reject configuration with missing service reference', () => {
      const configWithMissingService: GatewayConfig = {
        version: '2.0.0',
        server: { port: 3000 },
        routes: [
          {
            id: 'test-route',
            matcher: { methods: ['GET'] },
            target: { serviceName: 'missing-service', discovery: { type: 'static' } },
            policy: {}
          }
        ],
        services: []
      };

      const result = validator.validateGatewayConfig(configWithMissingService);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('references unknown service: missing-service'));
    });

    it('should detect path conflicts', () => {
      const configWithConflicts: GatewayConfig = {
        version: '2.0.0',
        server: { port: 3000 },
        routes: [
          {
            id: 'route1',
            matcher: { pathPrefix: '/api', methods: ['GET'] },
            target: { serviceName: 'service1', discovery: { type: 'static' } },
            policy: {}
          },
          {
            id: 'route2',
            matcher: { pathPrefix: '/api/users', methods: ['GET'] },
            target: { serviceName: 'service1', discovery: { type: 'static' } },
            policy: {}
          }
        ],
        services: [
          { name: 'service1', discovery: { type: 'static' } }
        ]
      };

      const result = validator.validateGatewayConfig(configWithConflicts);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Path conflict'));
    });

    it('should validate policy consistency', () => {
      const configWithInconsistentPolicy: GatewayConfig = {
        version: '2.0.0',
        server: { port: 3000 },
        routes: [
          {
            id: 'test-route',
            matcher: { methods: ['GET'] },
            target: { serviceName: 'service1', discovery: { type: 'static' } },
            policy: {
              auth: {
                enabled: true
                // No auth methods configured
              },
              rateLimit: {
                enabled: true,
                requests: 10,
                window: 60,
                burst: 20, // Burst > requests
                keys: ['ip']
              }
            }
          }
        ],
        services: [
          { name: 'service1', discovery: { type: 'static' } }
        ]
      };

      const result = validator.validateGatewayConfig(configWithInconsistentPolicy);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('auth enabled but no auth methods'));
      expect(result.errors).toContain(expect.stringContaining('burst limit greater than request limit'));
    });
  });

  describe('validate individual components', () => {
    it('should validate route configuration', () => {
      const validRoute: RouteConfig = {
        id: 'test-route',
        matcher: {
          pathPrefix: '/api/test',
          methods: ['GET']
        },
        target: {
          serviceName: 'test-service',
          discovery: {
            type: 'k8s',
            namespace: 'default',
            service: 'test-service',
            port: 8080
          }
        },
        policy: {
          auth: {
            enabled: true,
            jwt: {
              enabled: true,
              issuer: 'https://auth.example.com',
              audience: 'api-gateway',
              jwksUri: 'https://auth.example.com/.well-known/jwks.json'
            }
          }
        }
      };

      const result = validator.validate('route', validRoute);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid route configuration', () => {
      const invalidRoute = {
        id: '', // Empty ID
        matcher: {
          methods: [] // Empty methods array
        },
        target: {
          serviceName: 'test-service'
          // Missing discovery
        },
        policy: {}
      };

      const result = validator.validate('route', invalidRoute);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('ConfigMigrator', () => {
  let migrator: ConfigMigrator;

  beforeEach(() => {
    migrator = new ConfigMigrator();
  });

  describe('migrate', () => {
    it('should migrate from 1.0.0 to 1.1.0', () => {
      const oldConfig = {
        version: '1.0.0',
        server: { port: 3000 },
        routes: [
          {
            id: 'test-route',
            matcher: { methods: ['GET'] },
            target: { serviceName: 'test-service', discovery: { type: 'static' } },
            policy: {
              authentication: {
                enabled: true,
                jwt: {
                  enabled: true,
                  issuer: 'https://auth.example.com'
                }
              }
            }
          }
        ],
        services: [
          { name: 'test-service', discovery: { type: 'static' } }
        ]
      };

      const result = migrator.migrate(oldConfig, '1.0.0', '1.1.0');
      expect(result.valid).toBe(true);
      expect(result.migratedConfig.version).toBe('1.1.0');
      expect(result.migratedConfig.features).toBeDefined();
      expect(result.migratedConfig.routes[0].policy.auth).toBeDefined();
      expect(result.migratedConfig.routes[0].policy.authentication).toBeUndefined();
    });

    it('should migrate from 1.1.0 to 2.0.0', () => {
      const oldConfig = {
        version: '1.1.0',
        server: { port: 3000 },
        routes: [],
        services: [],
        features: {
          prometheusMetrics: true,
          rateLimiting: true
        }
      };

      const result = migrator.migrate(oldConfig, '1.1.0', '2.0.0');
      expect(result.valid).toBe(true);
      expect(result.migratedConfig.version).toBe('2.0.0');
      expect(result.migratedConfig.admin).toBeDefined();
      expect(result.migratedConfig.features.waf).toBe(false);
      expect(result.migratedConfig.features.streaming).toBe(false);
    });

    it('should handle invalid migration paths', () => {
      const config = { version: '1.0.0' };
      const result = migrator.migrate(config, '1.0.0', '3.0.0');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No migration path available');
    });
  });
});

describe('CompatibilityTester', () => {
  let tester: CompatibilityTester;

  beforeEach(() => {
    tester = new CompatibilityTester();
  });

  describe('testBackwardCompatibility', () => {
    it('should detect breaking changes when routes are removed', () => {
      const oldConfig = {
        routes: [
          { id: 'route1', matcher: { methods: ['GET'] } },
          { id: 'route2', matcher: { methods: ['POST'] } }
        ],
        services: []
      };

      const newConfig = {
        routes: [
          { id: 'route1', matcher: { methods: ['GET'] } }
          // route2 removed
        ],
        services: []
      };

      const result = tester.testBackwardCompatibility(oldConfig, newConfig);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'breaking',
          category: 'route',
          message: 'Route route2 was removed',
          impact: 'high'
        })
      );
    });

    it('should detect breaking changes when services are removed', () => {
      const oldConfig = {
        routes: [],
        services: [
          { name: 'service1' },
          { name: 'service2' }
        ]
      };

      const newConfig = {
        routes: [],
        services: [
          { name: 'service1' }
          // service2 removed
        ]
      };

      const result = tester.testBackwardCompatibility(oldConfig, newConfig);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'breaking',
          category: 'service',
          message: 'Service service2 was removed',
          impact: 'high'
        })
      );
    });

    it('should detect auth policy changes', () => {
      const oldConfig = {
        routes: [
          {
            id: 'route1',
            policy: {
              auth: { enabled: true }
            }
          }
        ],
        services: []
      };

      const newConfig = {
        routes: [
          {
            id: 'route1',
            policy: {
              auth: { enabled: false }
            }
          }
        ],
        services: []
      };

      const result = tester.testBackwardCompatibility(oldConfig, newConfig);
      expect(result.compatible).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'breaking',
          category: 'auth',
          message: 'Authentication disabled for route route1',
          impact: 'medium'
        })
      );
    });

    it('should detect rate limit decreases', () => {
      const oldConfig = {
        routes: [
          {
            id: 'route1',
            policy: {
              rateLimit: {
                enabled: true,
                requests: 100
              }
            }
          }
        ],
        services: []
      };

      const newConfig = {
        routes: [
          {
            id: 'route1',
            policy: {
              rateLimit: {
                enabled: true,
                requests: 50
              }
            }
          }
        ],
        services: []
      };

      const result = tester.testBackwardCompatibility(oldConfig, newConfig);
      expect(result.compatible).toBe(true); // Rate limit changes are warnings, not breaking
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          category: 'rateLimit',
          message: 'Rate limit decreased for route route1: 100 -> 50',
          impact: 'medium'
        })
      );
    });

    it('should report compatible configurations', () => {
      const oldConfig = {
        routes: [
          { id: 'route1', policy: { auth: { enabled: true } } }
        ],
        services: [
          { name: 'service1' }
        ]
      };

      const newConfig = {
        routes: [
          { id: 'route1', policy: { auth: { enabled: true } } },
          { id: 'route2', policy: {} } // New route added
        ],
        services: [
          { name: 'service1' },
          { name: 'service2' } // New service added
        ]
      };

      const result = tester.testBackwardCompatibility(oldConfig, newConfig);
      expect(result.compatible).toBe(true);
      expect(result.issues.filter(i => i.type === 'breaking')).toHaveLength(0);
    });
  });
});

describe('Version Support', () => {
  it('should have valid version definitions', () => {
    expect(SUPPORTED_VERSIONS).toBeDefined();
    expect(SUPPORTED_VERSIONS.length).toBeGreaterThan(0);

    for (const version of SUPPORTED_VERSIONS) {
      expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(version.compatibleWith).toBeInstanceOf(Array);
      expect(version.compatibleWith.length).toBeGreaterThan(0);
      expect(version.compatibleWith).toContain(version.version);
    }
  });

  it('should have proper version ordering', () => {
    const versions = SUPPORTED_VERSIONS.map(v => v.version);
    const sortedVersions = [...versions].sort((a, b) => {
      const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
      const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
      
      if (aMajor !== bMajor) return aMajor - bMajor;
      if (aMinor !== bMinor) return aMinor - bMinor;
      return aPatch - bPatch;
    });

    expect(versions).toEqual(sortedVersions);
  });
});

describe('Integration Tests', () => {
  let validator: ConfigValidator;
  let migrator: ConfigMigrator;
  let tester: CompatibilityTester;

  beforeEach(() => {
    validator = new ConfigValidator();
    migrator = new ConfigMigrator();
    tester = new CompatibilityTester();
  });

  it('should handle complete migration and validation workflow', () => {
    // Start with old configuration
    const oldConfig = {
      version: '1.0.0',
      server: { port: 3000 },
      routes: [
        {
          id: 'api-route',
          matcher: { pathPrefix: '/api', methods: ['GET', 'POST'] },
          target: { serviceName: 'api-service', discovery: { type: 'static' } },
          policy: {
            authentication: {
              enabled: true,
              jwt: { enabled: true }
            }
          }
        }
      ],
      services: [
        { name: 'api-service', discovery: { type: 'static' } }
      ]
    };

    // Migrate to latest version
    const migrationResult = migrator.migrate(oldConfig, '1.0.0', '2.0.0');
    expect(migrationResult.valid).toBe(true);

    // Validate migrated configuration
    const validationResult = validator.validateGatewayConfig(migrationResult.migratedConfig);
    expect(validationResult.valid).toBe(true);

    // Test backward compatibility
    const compatibilityResult = tester.testBackwardCompatibility(oldConfig, migrationResult.migratedConfig);
    expect(compatibilityResult.compatible).toBe(true);
  });

  it('should handle validation errors in migrated configuration', () => {
    const invalidOldConfig = {
      version: '1.0.0',
      server: { port: 3000 },
      routes: [
        {
          id: 'invalid-route',
          matcher: { methods: ['INVALID_METHOD'] }, // This will cause validation to fail
          target: { serviceName: 'service1', discovery: { type: 'static' } },
          policy: {}
        }
      ],
      services: []
    };

    // Migration might succeed
    const migrationResult = migrator.migrate(invalidOldConfig, '1.0.0', '1.1.0');
    
    if (migrationResult.valid) {
      // But validation should catch the error
      const validationResult = validator.validateGatewayConfig(migrationResult.migratedConfig);
      expect(validationResult.valid).toBe(false);
    }
  });
});
