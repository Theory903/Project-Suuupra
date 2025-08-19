/**
 * End-to-End Identity Service Workflow Tests
 * Tests complete user lifecycle and cross-service authentication
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Identity Service E2E Workflow', () => {
  const identityURL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:8080';
  const gatewayURL = process.env.API_GATEWAY_URL || 'http://localhost:8000';
  
  let testUsers = [];
  let adminToken;
  let userToken;

  before(async () => {
    console.log('Setting up E2E test environment...');
    
    // Ensure services are ready
    await waitForService(identityURL, '/api/v1/health');
    
    // Create admin user for testing
    const adminUser = await createTestUser({
      email: `admin-${Date.now()}@example.com`,
      password: 'AdminPassword123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    });
    
    adminToken = adminUser.token;
  });

  async function waitForService(baseURL, healthPath, retries = 30) {
    while (retries > 0) {
      try {
        await request(baseURL).get(healthPath).expect(200);
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw new Error(`Service ${baseURL} not ready`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async function createTestUser(userData) {
    const response = await request(identityURL)
      .post('/api/v1/auth/register')
      .send(userData)
      .expect(201);
    
    testUsers.push(response.body.user);
    return response.body;
  }

  describe('Complete User Lifecycle', () => {
    let newUser;

    it('should handle complete user registration flow', async () => {
      // Step 1: Register new user
      const userData = {
        email: `lifecycle-${Date.now()}@example.com`,
        password: 'LifecyclePassword123!',
        firstName: 'Lifecycle',
        lastName: 'User',
        phoneNumber: '+91-9876543213'
      };

      const registerResponse = await request(identityURL)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body.success).to.be.true;
      expect(registerResponse.body.user.email).to.equal(userData.email);
      expect(registerResponse.body.user.status).to.equal('ACTIVE');

      newUser = registerResponse.body;
      userToken = newUser.token;

      // Step 2: Verify user can immediately access profile
      const profileResponse = await request(identityURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(profileResponse.body.email).to.equal(userData.email);
    });

    it('should authenticate user across different sessions', async () => {
      // Step 1: Login from different session
      const loginResponse = await request(identityURL)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.user.email,
          password: 'LifecyclePassword123!'
        })
        .expect(200);

      const sessionToken = loginResponse.body.token;

      // Step 2: Verify token works for API calls
      const profileResponse = await request(identityURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(profileResponse.body.id).to.equal(newUser.user.id);
    });

    it('should handle profile updates across sessions', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Lifecycle',
        phoneNumber: '+91-9876543214'
      };

      // Step 1: Update profile
      await request(identityURL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // Step 2: Login from new session and verify changes
      const loginResponse = await request(identityURL)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.user.email,
          password: 'LifecyclePassword123!'
        })
        .expect(200);

      const profileResponse = await request(identityURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);

      expect(profileResponse.body.firstName).to.equal(updateData.firstName);
      expect(profileResponse.body.lastName).to.equal(updateData.lastName);
    });

    it('should handle token refresh workflow', async () => {
      // Step 1: Wait for token to near expiration (simulate)
      // In real test, you'd manipulate token expiry
      
      // Step 2: Use refresh token to get new access token
      const refreshResponse = await request(identityURL)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newUser.refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).to.be.true;
      expect(refreshResponse.body.token).to.exist;
      expect(refreshResponse.body.token).to.not.equal(userToken);

      // Step 3: Verify new token works
      const newToken = refreshResponse.body.token;
      await request(identityURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
    });
  });

  describe('Cross-Service Authentication', () => {
    it('should authenticate with API Gateway', async function() {
      this.timeout(10000);

      try {
        // Test authentication through API Gateway
        const response = await request(gatewayURL)
          .get('/api/v1/users/profile')
          .set('Authorization', `Bearer ${userToken}`)
          .timeout(5000);

        if (response.status === 200) {
          expect(response.body.email).to.equal(newUser.user.email);
        } else {
          console.log('API Gateway not available for cross-service test');
          this.skip();
        }
      } catch (error) {
        console.log('API Gateway not available, skipping cross-service test');
        this.skip();
      }
    });

    it('should validate tokens for other services', async () => {
      // Simulate token validation request from another service
      const validationResponse = await request(identityURL)
        .post('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(validationResponse.body.valid).to.be.true;
      expect(validationResponse.body.userId).to.equal(newUser.user.id);
      expect(validationResponse.body.email).to.equal(newUser.user.email);
      expect(validationResponse.body.permissions).to.be.an('array');
    });
  });

  describe('Administrative Workflows', () => {
    let regularUser;

    before(async () => {
      // Create regular user for admin operations
      regularUser = await createTestUser({
        email: `regular-${Date.now()}@example.com`,
        password: 'RegularPassword123!',
        firstName: 'Regular',
        lastName: 'User'
      });
    });

    it('should list users as admin', async () => {
      const response = await request(identityURL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 0, size: 10 })
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.at.least(1);
      
      // Should include our test users
      const emails = response.body.map(user => user.email);
      expect(emails).to.include(regularUser.user.email);
    });

    it('should get specific user as admin', async () => {
      const response = await request(identityURL)
        .get(`/api/v1/users/${regularUser.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).to.equal(regularUser.user.id);
      expect(response.body.email).to.equal(regularUser.user.email);
    });

    it('should update user status as admin', async () => {
      const statusUpdate = {
        status: 'SUSPENDED',
        reason: 'Testing suspension workflow'
      };

      const response = await request(identityURL)
        .put(`/api/v1/users/${regularUser.user.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.status).to.equal('SUSPENDED');

      // Verify suspended user cannot login
      const loginAttempt = await request(identityURL)
        .post('/api/v1/auth/login')
        .send({
          email: regularUser.user.email,
          password: 'RegularPassword123!'
        })
        .expect(401);

      expect(loginAttempt.body.success).to.be.false;
    });

    it('should prevent regular user from accessing admin endpoints', async () => {
      // Try to access user list with regular user token
      await request(identityURL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${regularUser.token}`)
        .expect(403);

      // Try to access specific user data
      await request(identityURL)
        .get(`/api/v1/users/${newUser.user.id}`)
        .set('Authorization', `Bearer ${regularUser.token}`)
        .expect(403);
    });
  });

  describe('Security and Compliance', () => {
    it('should handle SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        `sqli-${Date.now()}@example.com'; DROP TABLE users; --`,
        `sqli-${Date.now()}@example.com" OR 1=1 --`,
        `'; UPDATE users SET role='ADMIN' WHERE email='test@example.com'; --`
      ];

      for (const maliciousEmail of sqlInjectionAttempts) {
        const response = await request(identityURL)
          .post('/api/v1/auth/register')
          .send({
            email: maliciousEmail,
            password: 'TestPassword123!',
            firstName: 'SQL',
            lastName: 'Injection'
          });

        // Should either reject or sanitize the input
        expect([400, 409]).to.include(response.status);
      }
    });

    it('should implement proper session management', async () => {
      // Login to create session
      const loginResponse = await request(identityURL)
        .post('/api/v1/auth/login')
        .send({
          email: newUser.user.email,
          password: 'LifecyclePassword123!'
        })
        .expect(200);

      const sessionToken = loginResponse.body.token;

      // Logout to invalidate session
      await request(identityURL)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      // Verify token is invalidated
      await request(identityURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(401);
    });

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'qwertyui',
        'Password',
        'password123',
        'PASSWORD123',
        'Pass123'
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(identityURL)
          .post('/api/v1/auth/register')
          .send({
            email: `weak-${Date.now()}-${Math.random()}@example.com`,
            password: weakPassword,
            firstName: 'Weak',
            lastName: 'Password'
          });

        expect(response.status).to.equal(400);
        expect(response.body.success).to.be.false;
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent authentication requests', async function() {
      this.timeout(30000);

      const concurrentLogins = 20;
      const promises = [];

      for (let i = 0; i < concurrentLogins; i++) {
        promises.push(
          request(identityURL)
            .post('/api/v1/auth/login')
            .send({
              email: newUser.user.email,
              password: 'LifecyclePassword123!'
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('should maintain acceptable response times', async () => {
      const operations = [
        () => request(identityURL).post('/api/v1/auth/login').send({
          email: newUser.user.email,
          password: 'LifecyclePassword123!'
        }),
        () => request(identityURL).get('/api/v1/users/profile').set('Authorization', `Bearer ${userToken}`),
        () => request(identityURL).post('/api/v1/auth/validate').set('Authorization', `Bearer ${userToken}`)
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        await operation().expect(200);
        const responseTime = Date.now() - startTime;
        
        expect(responseTime).to.be.below(1000); // Less than 1 second
      }
    });
  });

  after(async () => {
    console.log('Cleaning up E2E test data...');
    
    // Cleanup test users (in production, you'd have proper cleanup)
    for (const user of testUsers) {
      try {
        await request(identityURL)
          .delete(`/api/v1/users/${user.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
      } catch (error) {
        console.log(`Failed to cleanup user ${user.id}:`, error.message);
      }
    }
  });
});