/**
 * Mock Data Generators and Service Dependencies
 * 
 * Provides comprehensive mock data for all Suuupra services with realistic
 * edge cases, boundary conditions, and error scenarios.
 */

const crypto = require('crypto');

class MockDataGenerator {
    constructor() {
        this.users = this.generateMockUsers();
        this.courses = this.generateMockCourses();
        this.payments = this.generateMockPayments();
        this.orders = this.generateMockOrders();
        this.streams = this.generateMockStreams();
    }

    // User Management Mocks
    generateMockUsers() {
        const roles = ['ADMIN', 'TEACHER', 'STUDENT', 'CREATOR'];
        const statuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'];
        
        return Array.from({ length: 100 }, (_, i) => ({
            id: `user_${i + 1}`,
            email: `user${i + 1}@test.com`,
            firstName: `Test${i + 1}`,
            lastName: `User`,
            role: roles[i % roles.length],
            status: statuses[i % statuses.length],
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            preferences: {
                language: ['en', 'hi', 'es'][i % 3],
                timezone: 'Asia/Kolkata',
                notifications: Math.random() > 0.5
            },
            profile: {
                avatar: `https://api.dicebear.com/6.x/avataaars/svg?seed=user${i}`,
                bio: `This is test user ${i + 1}`,
                skills: ['programming', 'design', 'marketing'].slice(0, Math.floor(Math.random() * 3) + 1)
            }
        }));
    }

    // Content Management Mocks
    generateMockCourses() {
        const categories = ['programming', 'design', 'business', 'marketing', 'data-science'];
        const difficulties = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
        
        return Array.from({ length: 50 }, (_, i) => ({
            id: `course_${i + 1}`,
            title: `Test Course ${i + 1}`,
            description: `Comprehensive course covering topic ${i + 1} with hands-on examples`,
            category: categories[i % categories.length],
            difficulty: difficulties[i % difficulties.length],
            price: Math.floor(Math.random() * 10000) + 1000, // 1000-11000 INR
            duration: Math.floor(Math.random() * 100) + 20, // 20-120 hours
            instructor: `instructor_${(i % 10) + 1}`,
            rating: (Math.random() * 2 + 3).toFixed(1), // 3.0-5.0
            enrollments: Math.floor(Math.random() * 10000),
            tags: ['online', 'certification', 'project-based'].slice(0, Math.floor(Math.random() * 3) + 1),
            thumbnailUrl: `https://picsum.photos/400/300?random=${i}`,
            videoUrl: `https://test-cdn.suuupra.com/courses/${i}/intro.mp4`,
            materials: Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, j) => ({
                id: `material_${i}_${j}`,
                type: ['video', 'document', 'quiz', 'assignment'][j % 4],
                title: `Lesson ${j + 1}`,
                duration: Math.floor(Math.random() * 60) + 5,
                url: `https://test-cdn.suuupra.com/courses/${i}/lesson_${j}.mp4`
            })),
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            isPublished: Math.random() > 0.2
        }));
    }

    // Payment System Mocks
    generateMockPayments() {
        const methods = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
        const statuses = ['SUCCESS', 'FAILED', 'PENDING', 'REFUNDED'];
        const currencies = ['INR', 'USD', 'EUR'];
        
        return Array.from({ length: 200 }, (_, i) => ({
            id: `payment_${i + 1}`,
            orderId: `order_${Math.floor(i / 2) + 1}`,
            userId: `user_${(i % 50) + 1}`,
            amount: (Math.random() * 50000 + 100).toFixed(2),
            currency: currencies[i % currencies.length],
            method: methods[i % methods.length],
            status: statuses[i % statuses.length],
            gatewayTransactionId: `txn_${crypto.randomUUID()}`,
            merchantTransactionId: `merchant_${i + 1}`,
            upiId: i % 2 === 0 ? `user${i}@paytm` : null,
            cardDetails: i % 4 === 1 ? {
                last4: '1234',
                brand: 'VISA',
                network: 'VISA'
            } : null,
            metadata: {
                ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
                userAgent: 'Mozilla/5.0 (compatible; TestClient/1.0)',
                merchantId: 'MERCHANT_001'
            },
            timestamps: {
                initiated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                completed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000 + 60000),
                webhook: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000 + 120000)
            },
            fees: {
                gateway: (Math.random() * 10).toFixed(2),
                platform: (Math.random() * 5).toFixed(2)
            },
            riskScore: Math.floor(Math.random() * 100),
            fraudChecks: {
                velocity: Math.random() > 0.9 ? 'FLAGGED' : 'PASSED',
                device: Math.random() > 0.95 ? 'FLAGGED' : 'PASSED',
                location: Math.random() > 0.98 ? 'FLAGGED' : 'PASSED'
            }
        }));
    }

    // Commerce System Mocks
    generateMockOrders() {
        const statuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'REFUNDED'];
        const types = ['COURSE_PURCHASE', 'SUBSCRIPTION', 'LIVE_CLASS', 'CERTIFICATION'];
        
        return Array.from({ length: 100 }, (_, i) => ({
            id: `order_${i + 1}`,
            userId: `user_${(i % 50) + 1}`,
            type: types[i % types.length],
            status: statuses[i % statuses.length],
            items: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, j) => ({
                id: `item_${i}_${j}`,
                type: types[j % types.length],
                productId: `course_${(i + j) % 50 + 1}`,
                quantity: 1,
                price: (Math.random() * 5000 + 500).toFixed(2),
                discount: (Math.random() * 500).toFixed(2)
            })),
            subtotal: (Math.random() * 10000 + 1000).toFixed(2),
            tax: (Math.random() * 1000 + 100).toFixed(2),
            discount: (Math.random() * 1000).toFixed(2),
            total: null, // Will be calculated
            paymentDetails: {
                method: 'UPI',
                status: 'COMPLETED',
                transactionId: `txn_${crypto.randomUUID()}`
            },
            billing: {
                name: `Test User ${i + 1}`,
                email: `user${i + 1}@test.com`,
                phone: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
                address: {
                    line1: `${Math.floor(Math.random() * 999) + 1} Test Street`,
                    city: 'Mumbai',
                    state: 'Maharashtra',
                    pincode: '400001',
                    country: 'IN'
                }
            },
            timestamps: {
                created: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
                updated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            },
            coupon: i % 5 === 0 ? `DISCOUNT${Math.floor(Math.random() * 50) + 10}` : null
        }));
    }

    // Live Streaming Mocks
    generateMockStreams() {
        const statuses = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'];
        const types = ['CLASS', 'WEBINAR', 'WORKSHOP', 'MASS_LIVE'];
        
        return Array.from({ length: 30 }, (_, i) => ({
            id: `stream_${i + 1}`,
            title: `Live Stream ${i + 1}`,
            description: `Educational live stream covering topic ${i + 1}`,
            type: types[i % types.length],
            status: statuses[i % statuses.length],
            instructorId: `instructor_${(i % 5) + 1}`,
            maxParticipants: Math.floor(Math.random() * 1000) + 100,
            currentViewers: Math.floor(Math.random() * 500),
            peakViewers: Math.floor(Math.random() * 800) + 200,
            rtmpUrl: `rtmp://live.suuupra.com/live/stream_${i + 1}`,
            hlsUrl: `https://cdn.suuupra.com/live/stream_${i + 1}/index.m3u8`,
            thumbnailUrl: `https://picsum.photos/640/360?random=${i + 100}`,
            scheduledStart: new Date(Date.now() + (Math.random() - 0.5) * 30 * 24 * 60 * 60 * 1000),
            actualStart: new Date(Date.now() + (Math.random() - 0.5) * 30 * 24 * 60 * 60 * 1000 + 300000),
            duration: Math.floor(Math.random() * 180) + 30, // 30-210 minutes
            settings: {
                allowChat: true,
                allowQuestions: Math.random() > 0.5,
                recordSession: Math.random() > 0.3,
                requireRegistration: Math.random() > 0.5
            },
            analytics: {
                totalViews: Math.floor(Math.random() * 5000),
                avgWatchTime: Math.floor(Math.random() * 3600), // seconds
                chatMessages: Math.floor(Math.random() * 500),
                questions: Math.floor(Math.random() * 50),
                polls: Math.floor(Math.random() * 10)
            },
            quality: {
                resolution: ['1080p', '720p', '480p', '360p'][i % 4],
                bitrate: Math.floor(Math.random() * 3000) + 1000,
                fps: [30, 60][i % 2]
            }
        }));
    }

    // Edge Case Generators
    generateEdgeCaseData() {
        return {
            // Authentication Edge Cases
            auth: {
                invalidTokens: [
                    '', // Empty token
                    'invalid-token',
                    'Bearer ',
                    'Bearer invalid',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature', // Malformed JWT
                    'a'.repeat(2048), // Extremely long token
                ],
                expiredToken: this.generateExpiredJWT(),
                validButUnauthorizedToken: this.generateUnauthorizedJWT()
            },
            
            // Input Validation Edge Cases
            inputs: {
                maliciousStrings: [
                    '<script>alert("xss")</script>',
                    '"; DROP TABLE users; --',
                    '{{7*7}}', // Template injection
                    '../../../etc/passwd',
                    '%0a%0dSet-Cookie:malicious=true',
                    '\x00\x01\x02', // Null bytes
                    'A'.repeat(1000000), // Very long string
                    '{{constructor.constructor("return process")()}}' // Node.js injection
                ],
                boundaryNumbers: [
                    -2147483648, // MIN_INT
                    2147483647,  // MAX_INT
                    -1,
                    0,
                    0.1,
                    Number.MAX_SAFE_INTEGER,
                    Number.MIN_SAFE_INTEGER,
                    Infinity,
                    -Infinity,
                    NaN
                ],
                specialCharacters: [
                    '!@#$%^&*()_+-=[]{}|;:,.<>?',
                    '汉字', // Unicode
                    '🚀🎯✅❌', // Emojis
                    'test\x00null', // Null bytes
                    'test\nline\break',
                    'test\ttab'
                ],
                invalidEmails: [
                    'invalid',
                    '@domain.com',
                    'user@',
                    'user@domain',
                    'user..user@domain.com',
                    'user@domain..com',
                    'user name@domain.com', // Space in local part
                    'user@domain.com.', // Trailing dot
                    'a'.repeat(255) + '@domain.com' // Too long
                ],
                invalidPhoneNumbers: [
                    '123',
                    '+91123',
                    'phone-number',
                    '+91 98765 43210', // With spaces
                    '+91-9876543210', // With dashes
                    '+919876543210123', // Too long
                    ''
                ]
            },
            
            // File Upload Edge Cases
            files: {
                maliciousFiles: [
                    {
                        name: 'test.jpg.exe',
                        content: Buffer.from('MZ\x90\x00'), // PE header
                        mimeType: 'image/jpeg'
                    },
                    {
                        name: '../../../etc/passwd',
                        content: Buffer.from('test content'),
                        mimeType: 'text/plain'
                    },
                    {
                        name: 'test.php',
                        content: Buffer.from('<?php system($_GET["cmd"]); ?>'),
                        mimeType: 'application/x-php'
                    }
                ],
                oversizedFile: {
                    name: 'large.txt',
                    content: Buffer.alloc(100 * 1024 * 1024, 'A'), // 100MB
                    mimeType: 'text/plain'
                },
                emptyFile: {
                    name: 'empty.txt',
                    content: Buffer.alloc(0),
                    mimeType: 'text/plain'
                }
            },
            
            // Database Edge Cases
            database: {
                sqlInjectionPayloads: [
                    "'; DROP TABLE users; --",
                    "' OR '1'='1",
                    "' UNION SELECT * FROM users --",
                    "'; UPDATE users SET password='hacked' WHERE '1'='1' --"
                ],
                nosqlInjectionPayloads: [
                    { "$where": "function() { return true; }" },
                    { "$regex": ".*" },
                    { "$gt": "" }
                ]
            },
            
            // Network Edge Cases
            network: {
                slowRequests: true, // Simulate slow network
                timeoutRequests: true, // Simulate timeouts
                intermittentFailures: true, // Random failures
                highConcurrency: true // Many simultaneous requests
            }
        };
    }

    // Mock External Services
    createMockServices() {
        return {
            // Mock Payment Gateway
            paymentGateway: {
                processPayment: (paymentData) => {
                    // Simulate different payment scenarios
                    const scenarios = ['success', 'failed', 'pending', 'timeout'];
                    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
                    
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            switch (scenario) {
                                case 'success':
                                    resolve({
                                        status: 'SUCCESS',
                                        transactionId: crypto.randomUUID(),
                                        gatewayResponse: 'Payment processed successfully'
                                    });
                                    break;
                                case 'failed':
                                    resolve({
                                        status: 'FAILED',
                                        error: 'Insufficient funds',
                                        errorCode: 'INSUFFICIENT_FUNDS'
                                    });
                                    break;
                                case 'pending':
                                    resolve({
                                        status: 'PENDING',
                                        transactionId: crypto.randomUUID()
                                    });
                                    break;
                                case 'timeout':
                                    // Don't resolve - simulate timeout
                                    break;
                            }
                        }, Math.random() * 5000); // Random delay 0-5s
                    });
                }
            },
            
            // Mock SMS Service
            smsService: {
                sendSMS: (phone, message) => {
                    return Promise.resolve({
                        success: Math.random() > 0.1, // 90% success rate
                        messageId: crypto.randomUUID(),
                        cost: 0.05
                    });
                }
            },
            
            // Mock Email Service
            emailService: {
                sendEmail: (to, subject, body) => {
                    return Promise.resolve({
                        success: Math.random() > 0.05, // 95% success rate
                        messageId: crypto.randomUUID()
                    });
                }
            },
            
            // Mock Video Processing Service
            videoProcessor: {
                transcode: (videoUrl, formats) => {
                    return Promise.resolve({
                        jobId: crypto.randomUUID(),
                        status: 'PROCESSING',
                        estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000)
                    });
                }
            },
            
            // Mock CDN Service
            cdn: {
                uploadFile: (file, path) => {
                    return Promise.resolve({
                        url: `https://cdn.suuupra.com/${path}`,
                        etag: crypto.randomUUID(),
                        size: file.size
                    });
                }
            }
        };
    }

    // JWT Token Generators
    generateExpiredJWT() {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ 
            sub: 'user123', 
            exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
        })).toString('base64url');
        const signature = crypto.createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url');
        
        return `${header}.${payload}.${signature}`;
    }
    
    generateUnauthorizedJWT() {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ 
            sub: 'unauthorized-user', 
            role: 'GUEST',
            exp: Math.floor(Date.now() / 1000) + 3600
        })).toString('base64url');
        const signature = crypto.createHmac('sha256', 'secret').update(`${header}.${payload}`).digest('base64url');
        
        return `${header}.${payload}.${signature}`;
    }

    // Get random mock data
    getRandomUser() {
        return this.users[Math.floor(Math.random() * this.users.length)];
    }
    
    getRandomCourse() {
        return this.courses[Math.floor(Math.random() * this.courses.length)];
    }
    
    getRandomPayment() {
        return this.payments[Math.floor(Math.random() * this.payments.length)];
    }
    
    getRandomOrder() {
        return this.orders[Math.floor(Math.random() * this.orders.length)];
    }
    
    getRandomStream() {
        return this.streams[Math.floor(Math.random() * this.streams.length)];
    }
}

module.exports = MockDataGenerator;