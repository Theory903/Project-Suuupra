/**
 * Unit Tests for Authentication Service
 * Tests core authentication logic and JWT token handling
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('Authentication Service Unit Tests', () => {
  let authService;
  let mockUserRepository;
  let mockJwtService;
  let mockPasswordService;

  beforeEach(() => {
    // Mock dependencies
    mockUserRepository = {
      findByEmail: sinon.stub(),
      save: sinon.stub(),
      findById: sinon.stub()
    };

    mockJwtService = {
      generateToken: sinon.stub(),
      verifyToken: sinon.stub(),
      generateRefreshToken: sinon.stub()
    };

    mockPasswordService = {
      hash: sinon.stub(),
      compare: sinon.stub()
    };

    // Initialize service with mocked dependencies
    authService = new AuthService({
      userRepository: mockUserRepository,
      jwtService: mockJwtService,
      passwordService: mockPasswordService
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      // Arrange
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        phoneNumber: '+91-9876543210'
      };

      mockUserRepository.findByEmail.resolves(null);
      mockPasswordService.hash.resolves('hashedPassword');
      mockUserRepository.save.resolves({
        id: 'user_123',
        ...registerData,
        password: 'hashedPassword'
      });
      mockJwtService.generateToken.returns('access_token');
      mockJwtService.generateRefreshToken.returns('refresh_token');

      // Act
      const result = await authService.register(registerData);

      // Assert
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('token', 'access_token');
      expect(result).to.have.property('refreshToken', 'refresh_token');
      expect(result.user).to.have.property('email', registerData.email);
      expect(mockPasswordService.hash).to.have.been.calledWith(registerData.password);
    });

    it('should reject registration for existing email', async () => {
      // Arrange
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      mockUserRepository.findByEmail.resolves({ id: 'existing_user' });

      // Act & Assert
      try {
        await authService.register(registerData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('User already exists');
      }
    });

    it('should validate password strength', async () => {
      // Arrange
      const weakPasswordData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Act & Assert
      try {
        await authService.register(weakPasswordData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Password does not meet requirements');
      }
    });

    it('should validate email format', async () => {
      // Arrange
      const invalidEmailData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Act & Assert
      try {
        await authService.register(invalidEmailData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid email format');
      }
    });
  });

  describe('User Login', () => {
    it('should login user with valid credentials', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const user = {
        id: 'user_123',
        email: loginData.email,
        password: 'hashedPassword',
        status: 'ACTIVE'
      };

      mockUserRepository.findByEmail.resolves(user);
      mockPasswordService.compare.resolves(true);
      mockJwtService.generateToken.returns('access_token');
      mockJwtService.generateRefreshToken.returns('refresh_token');

      // Act
      const result = await authService.login(loginData);

      // Assert
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('token', 'access_token');
      expect(result).to.have.property('refreshToken', 'refresh_token');
      expect(mockPasswordService.compare).to.have.been.calledWith(
        loginData.password,
        user.password
      );
    });

    it('should reject login for non-existent user', async () => {
      // Arrange
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!'
      };

      mockUserRepository.findByEmail.resolves(null);

      // Act & Assert
      try {
        await authService.login(loginData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid credentials');
      }
    });

    it('should reject login for incorrect password', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      const user = {
        id: 'user_123',
        email: loginData.email,
        password: 'hashedPassword',
        status: 'ACTIVE'
      };

      mockUserRepository.findByEmail.resolves(user);
      mockPasswordService.compare.resolves(false);

      // Act & Assert
      try {
        await authService.login(loginData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid credentials');
      }
    });

    it('should reject login for inactive user', async () => {
      // Arrange
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const user = {
        id: 'user_123',
        email: loginData.email,
        password: 'hashedPassword',
        status: 'INACTIVE'
      };

      mockUserRepository.findByEmail.resolves(user);

      // Act & Assert
      try {
        await authService.login(loginData);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Account is not active');
      }
    });
  });

  describe('Token Management', () => {
    it('should validate valid JWT token', async () => {
      // Arrange
      const token = 'valid_jwt_token';
      const decodedToken = {
        userId: 'user_123',
        email: 'test@example.com',
        role: 'USER',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockJwtService.verifyToken.returns(decodedToken);

      // Act
      const result = await authService.validateToken(token);

      // Assert
      expect(result).to.have.property('valid', true);
      expect(result).to.have.property('userId', 'user_123');
      expect(result).to.have.property('email', 'test@example.com');
      expect(result).to.have.property('role', 'USER');
    });

    it('should reject expired JWT token', async () => {
      // Arrange
      const token = 'expired_jwt_token';

      mockJwtService.verifyToken.throws(new Error('Token expired'));

      // Act & Assert
      try {
        await authService.validateToken(token);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Token expired');
      }
    });

    it('should refresh valid refresh token', async () => {
      // Arrange
      const refreshToken = 'valid_refresh_token';
      const decodedRefreshToken = {
        userId: 'user_123',
        tokenType: 'refresh'
      };

      const user = {
        id: 'user_123',
        email: 'test@example.com',
        status: 'ACTIVE'
      };

      mockJwtService.verifyToken.returns(decodedRefreshToken);
      mockUserRepository.findById.resolves(user);
      mockJwtService.generateToken.returns('new_access_token');

      // Act
      const result = await authService.refreshToken({ refreshToken });

      // Assert
      expect(result).to.have.property('success', true);
      expect(result).to.have.property('token', 'new_access_token');
    });
  });

  describe('Security Features', () => {
    it('should implement rate limiting for failed login attempts', async () => {
      // Arrange
      const email = 'test@example.com';
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login({ email, password: 'wrong' });
        } catch (e) {
          // Expected to fail
        }
      }

      // Act & Assert
      try {
        await authService.login({ email, password: 'wrong' });
        expect.fail('Should have been rate limited');
      } catch (error) {
        expect(error.message).to.include('Too many failed attempts');
      }
    });

    it('should sanitize user input', async () => {
      // Arrange
      const maliciousInput = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: '<script>alert("xss")</script>',
        lastName: 'DROP TABLE users;'
      };

      mockUserRepository.findByEmail.resolves(null);
      mockPasswordService.hash.resolves('hashedPassword');
      mockUserRepository.save.resolves({
        id: 'user_123',
        ...maliciousInput,
        firstName: 'alert("xss")', // Sanitized
        lastName: 'DROP TABLE users;', // Sanitized
        password: 'hashedPassword'
      });

      // Act
      const result = await authService.register(maliciousInput);

      // Assert
      expect(result.user.firstName).to.not.include('<script>');
      expect(result.user.lastName).to.not.include('DROP TABLE');
    });
  });
});