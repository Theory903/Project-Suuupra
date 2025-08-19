/**
 * End-to-End Content Service Workflow Tests
 * Tests the complete content lifecycle from creation to consumption
 */

const request = require('supertest');
const { expect } = require('chai');

describe('Content Service E2E Workflow', () => {
  const baseURL = process.env.CONTENT_SERVICE_URL || 'http://localhost:8004';
  let authToken;
  let courseId;
  let contentId;

  before(async () => {
    // Setup: Get authentication token
    const authResponse = await request(process.env.IDENTITY_SERVICE_URL || 'http://localhost:8080')
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!'
      });
    
    authToken = authResponse.body.token;
    expect(authToken).to.exist;
  });

  describe('Complete Content Lifecycle', () => {
    it('should create a new course', async () => {
      const courseData = {
        title: 'Advanced JavaScript Concepts',
        description: 'Deep dive into advanced JavaScript programming concepts',
        category: 'programming',
        level: 'advanced',
        duration_hours: 40,
        price: 4999,
        tags: ['javascript', 'programming', 'advanced'],
        instructor: {
          name: 'John Doe',
          bio: 'Senior JavaScript Developer'
        }
      };

      const response = await request(baseURL)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${authToken}`)
        .send(courseData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.title).to.equal(courseData.title);
      expect(response.body.status).to.equal('draft');
      
      courseId = response.body.id;
    });

    it('should upload course content', async () => {
      const contentData = {
        course_id: courseId,
        title: 'Introduction to Closures',
        type: 'video',
        order: 1,
        duration: 1800, // 30 minutes
        metadata: {
          video_url: 'https://example.com/video1.mp4',
          transcript: 'Introduction to JavaScript closures...'
        }
      };

      const response = await request(baseURL)
        .post('/api/v1/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contentData)
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.course_id).to.equal(courseId);
      expect(response.body.status).to.equal('processing');
      
      contentId = response.body.id;
    });

    it('should process and approve content', async () => {
      // Simulate content processing completion
      const response = await request(baseURL)
        .patch(`/api/v1/content/${contentId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(response.body.status).to.equal('approved');
    });

    it('should publish the course', async () => {
      const response = await request(baseURL)
        .patch(`/api/v1/courses/${courseId}/publish`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).to.equal('published');
      expect(response.body.published_at).to.exist;
    });

    it('should search for published courses', async () => {
      const response = await request(baseURL)
        .get('/api/v1/courses/search')
        .query({
          q: 'JavaScript',
          category: 'programming',
          level: 'advanced'
        })
        .expect(200);

      expect(response.body.results).to.be.an('array');
      expect(response.body.total).to.be.at.least(1);
      
      const foundCourse = response.body.results.find(course => course.id === courseId);
      expect(foundCourse).to.exist;
    });

    it('should get course details with content', async () => {
      const response = await request(baseURL)
        .get(`/api/v1/courses/${courseId}`)
        .expect(200);

      expect(response.body.id).to.equal(courseId);
      expect(response.body.content).to.be.an('array');
      expect(response.body.content).to.have.length.at.least(1);
      expect(response.body.content[0].id).to.equal(contentId);
    });

    it('should track content progress', async () => {
      const progressData = {
        content_id: contentId,
        progress_percentage: 50,
        time_spent: 900, // 15 minutes
        completed: false
      };

      const response = await request(baseURL)
        .post('/api/v1/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send(progressData)
        .expect(201);

      expect(response.body.progress_percentage).to.equal(50);
      expect(response.body.completed).to.be.false;
    });

    it('should complete content and update progress', async () => {
      const progressData = {
        content_id: contentId,
        progress_percentage: 100,
        time_spent: 1800, // 30 minutes
        completed: true
      };

      const response = await request(baseURL)
        .put('/api/v1/progress')
        .set('Authorization', `Bearer ${authToken}`)
        .send(progressData)
        .expect(200);

      expect(response.body.progress_percentage).to.equal(100);
      expect(response.body.completed).to.be.true;
      expect(response.body.completed_at).to.exist;
    });

    it('should get user learning analytics', async () => {
      const response = await request(baseURL)
        .get('/api/v1/analytics/learning')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).to.have.property('total_courses_enrolled');
      expect(response.body).to.have.property('completed_content_count');
      expect(response.body).to.have.property('total_learning_time');
      expect(response.body.learning_streak).to.be.a('number');
    });
  });

  describe('Content Management Workflows', () => {
    it('should handle content moderation workflow', async () => {
      // Report content for moderation
      const reportResponse = await request(baseURL)
        .post(`/api/v1/content/${contentId}/report`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'inappropriate_content',
          description: 'Content contains outdated information'
        })
        .expect(201);

      expect(reportResponse.body.status).to.equal('reported');

      // Moderate content (admin action)
      const moderateResponse = await request(baseURL)
        .patch(`/api/v1/content/${contentId}/moderate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          action: 'approve',
          notes: 'Content reviewed and approved'
        })
        .expect(200);

      expect(moderateResponse.body.moderation_status).to.equal('approved');
    });

    it('should version content updates', async () => {
      const updateData = {
        title: 'Introduction to Closures - Updated',
        metadata: {
          video_url: 'https://example.com/video1-v2.mp4',
          transcript: 'Updated introduction to JavaScript closures...'
        }
      };

      const response = await request(baseURL)
        .put(`/api/v1/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.version).to.be.at.least(2);
      expect(response.body.title).to.equal(updateData.title);
    });

    it('should handle content collaboration', async () => {
      // Add collaborator to course
      const collaboratorResponse = await request(baseURL)
        .post(`/api/v1/courses/${courseId}/collaborators`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          user_email: 'collaborator@example.com',
          role: 'editor',
          permissions: ['edit_content', 'review_progress']
        })
        .expect(201);

      expect(collaboratorResponse.body.role).to.equal('editor');

      // Get course collaborators
      const listResponse = await request(baseURL)
        .get(`/api/v1/courses/${courseId}/collaborators`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body).to.be.an('array');
      expect(listResponse.body).to.have.length.at.least(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk content operations', async () => {
      const bulkContentData = Array.from({ length: 10 }, (_, i) => ({
        course_id: courseId,
        title: `Lesson ${i + 2}`,
        type: 'video',
        order: i + 2,
        duration: 1200,
        metadata: {
          video_url: `https://example.com/video${i + 2}.mp4`
        }
      }));

      const response = await request(baseURL)
        .post('/api/v1/content/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: bulkContentData })
        .expect(201);

      expect(response.body.created_count).to.equal(10);
      expect(response.body.failed_count).to.equal(0);
    });

    it('should paginate large result sets', async () => {
      const response = await request(baseURL)
        .get('/api/v1/courses')
        .query({
          page: 1,
          limit: 5,
          sort_by: 'created_at',
          sort_order: 'desc'
        })
        .expect(200);

      expect(response.body.results).to.have.length.at.most(5);
      expect(response.body.pagination).to.have.property('total');
      expect(response.body.pagination).to.have.property('pages');
      expect(response.body.pagination).to.have.property('current_page');
    });

    it('should handle concurrent access gracefully', async () => {
      // Simulate concurrent content access
      const concurrentRequests = Array.from({ length: 20 }, () =>
        request(baseURL)
          .get(`/api/v1/content/${contentId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(concurrentRequests);
      
      responses.forEach(response => {
        expect(response.status).to.equal(200);
        expect(response.body.id).to.equal(contentId);
      });
    });
  });

  after(async () => {
    // Cleanup: Delete test data
    if (courseId) {
      await request(baseURL)
        .delete(`/api/v1/courses/${courseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ force: true });
    }
  });
});