/**
 * Integration Tests for Identity Service
 * Tests complete authentication flows with real database interactions
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Identity Service Integration Tests', () => {
  const baseURL = process.env.IDENTITY_SERVICE_URL || 'http://localhost:8080';
  let testUser;
  let authToken;
  let refreshToken;

  before(async () => {
    // Setup test environment
    console.log('Setting up integration test environment...');
    
    // Wait for service to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        await request(baseURL).get('/api/v1/health').expect(200);
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw new Error('Service not ready for testing');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  });

  describe('Complete Authentication Flow', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Integration',
        lastName: 'Test',
        phoneNumber: '+91-9876543210'
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('token');
      expect(response.body).to.have.property('refreshToken');
      expect(response.body.user).to.have.property('email', userData.email);
      expect(response.body.user).to.have.property('firstName', userData.firstName);
      expect(response.body.user).to.have.property('role', 'USER');
      expect(response.body.user).to.have.property('status', 'ACTIVE');

      testUser = {
        ...userData,
        id: response.body.user.id
      };
      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it('should reject duplicate email registration', async () => {
      const duplicateUserData = {
        email: testUser.email,
        password: 'AnotherPassword456!',
        firstName: 'Duplicate',
        lastName: 'User'
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/register')
        .send(duplicateUserData)
        .expect(409);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('already exists');
    });

    it('should validate registration input', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: 'Test'
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body).to.have.property('errors');
      expect(response.body.errors).to.be.an('array');
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('token');
      expect(response.body).to.have.property('refreshToken');
      expect(response.body).to.have.property('expiresIn');
      expect(response.body.user).to.have.property('email', testUser.email);

      // Update tokens
      authToken = response.body.token;
      refreshToken = response.body.refreshToken;
    });

    it('should reject invalid credentials', async () => {
      const invalidLogin = {
        email: testUser.email,
        password: 'WrongPassword123!'
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/login')
        .send(invalidLogin)
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body.message).to.include('Invalid credentials');
    });

    it('should validate JWT token', async () => {
      const response = await request(baseURL)
        .post('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('valid', true);
      expect(response.body).to.have.property('userId', testUser.id);
      expect(response.body).to.have.property('email', testUser.email);
      expect(response.body).to.have.property('role', 'USER');
      expect(response.body).to.have.property('permissions');
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(baseURL)
        .post('/api/v1/auth/validate')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body).to.have.property('valid', false);
    });

    it('should refresh JWT token', async () => {
      const response = await request(baseURL)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body).to.have.property('token');
      expect(response.body.token).to.not.equal(authToken);

      // Update token for subsequent tests
      authToken = response.body.token;
    });

    it('should logout user successfully', async () => {
      const response = await request(baseURL)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.message).to.include('Logout successful');
    });
  });

  describe('User Profile Management', () => {
    beforeEach(async () => {
      // Login to get fresh token
      const loginResponse = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.token;
    });

    it('should get user profile', async () => {
      const response = await request(baseURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('id', testUser.id);
      expect(response.body).to.have.property('email', testUser.email);
      expect(response.body).to.have.property('firstName', testUser.firstName);
      expect(response.body).to.have.property('lastName', testUser.lastName);
      expect(response.body).to.have.property('phoneNumber', testUser.phoneNumber);
      expect(response.body).to.have.property('createdAt');
      expect(response.body).to.have.property('updatedAt');
    });

    it('should update user profile', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+91-9876543211'
      };

      const response = await request(baseURL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).to.have.property('firstName', updateData.firstName);
      expect(response.body).to.have.property('lastName', updateData.lastName);
      expect(response.body).to.have.property('phoneNumber', updateData.phoneNumber);
      expect(response.body).to.have.property('updatedAt');

      // Verify changes persist
      const profileResponse = await request(baseURL)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(profileResponse.body.firstName).to.equal(updateData.firstName);
      expect(profileResponse.body.lastName).to.equal(updateData.lastName);
    });

    it('should validate profile update data', async () => {
      const invalidUpdate = {
        phoneNumber: 'invalid-phone-number'
      };

      const response = await request(baseURL)
        .put('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle concurrent login attempts', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      // Simulate concurrent login attempts
      const promises = Array.from({ length: 10 }, () =>
        request(baseURL)
          .post('/api/v1/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.body).to.have.property('success', true);
      });
    });

    it('should implement rate limiting for failed attempts', async () => {
      const invalidLogin = {
        email: testUser.email,
        password: 'WrongPassword'
      };

      // Make multiple failed attempts
      const failedAttempts = [];
      for (let i = 0; i < 6; i++) {
        try {
          const response = await request(baseURL)
            .post('/api/v1/auth/login')
            .send(invalidLogin);
          failedAttempts.push(response.status);
        } catch (error) {
          failedAttempts.push(error.status || 500);
        }
      }

      // Last attempt should be rate limited
      expect(failedAttempts[failedAttempts.length - 1]).to.equal(429);
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt',
        'header.payload',
        'header.payload.signature.extra',
        '',
        null,
        undefined
      ];

      for (const token of malformedTokens) {
        const response = await request(baseURL)
          .post('/api/v1/auth/validate')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body).to.have.property('valid', false);
      }
    });

    it('should sanitize XSS attempts in registration', async () => {
      const xssAttempt = {
        email: `xss-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: '<script>alert("XSS")</script>',
        lastName: '<img src=x onerror=alert("XSS")>',
        phoneNumber: '+91-9876543212'
      };

      const response = await request(baseURL)
        .post('/api/v1/auth/register')
        .send(xssAttempt)
        .expect(201);

      // Check that dangerous scripts are sanitized
      expect(response.body.user.firstName).to.not.include('<script>');
      expect(response.body.user.lastName).to.not.include('<img');
    });
  });

  describe('Performance Tests', () => {
    it('should handle high load authentication', async function() {
      this.timeout(30000); // 30 second timeout

      const concurrentUsers = 50;
      const promises = [];

      for (let i = 0; i < concurrentUsers; i++) {
        const userData = {
          email: `load-test-${i}-${Date.now()}@example.com`,
          password: 'LoadTestPassword123!',
          firstName: `User${i}`,
          lastName: 'LoadTest'
        };

        promises.push(
          request(baseURL)
            .post('/api/v1/auth/register')
            .send(userData)
        );
      }

      const responses = await Promise.all(promises);
      
      // Check that most requests succeeded
      const successCount = responses.filter(r => r.status === 201).length;
      expect(successCount).to.be.at.least(concurrentUsers * 0.8); // 80% success rate
    });

    it('should respond within acceptable time limits', async () => {
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };

      const startTime = Date.now();
      
      await request(baseURL)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).to.be.below(2000); // Less than 2 seconds
    });
  });

  after(async () => {
    // Cleanup test data
    console.log('Cleaning up integration test data...');
    // Note: In a real scenario, you'd clean up test users from the database
  });
});