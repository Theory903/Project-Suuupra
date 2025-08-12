import { Content, IContent } from '@/models/Content';
import { Types } from 'mongoose';

describe('Content Model', () => {
  describe('Schema Validation', () => {
    it('should create content with required fields', async () => {
      const contentData = {
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      };

      const content = new Content(contentData);
      await content.save();

      expect(content._id).toBeValidObjectId();
      expect(content.tenantId).toBe('test-tenant');
      expect(content.title).toBe('Test Content');
      expect(content.contentType).toBe('article');
      expect(content.status).toBe('draft'); // default value
      expect(content.version).toBe('1.0.0'); // default value
      expect(content.deleted).toBe(false); // default value
      expect(content.etag).toBeDefined();
      expect(content.createdAt).toBeInstanceOf(Date);
      expect(content.updatedAt).toBeInstanceOf(Date);
    });

    it('should fail validation with missing required fields', async () => {
      const content = new Content({});

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate content type enum', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'invalid-type' as any,
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        status: 'invalid-status' as any,
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate version format', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        version: 'invalid-version',
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate title length', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'a'.repeat(256), // exceeds maxlength
        contentType: 'article',
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate description length', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        description: 'a'.repeat(2001), // exceeds maxlength
        contentType: 'article',
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });

    it('should validate tags array', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        tags: ['valid-tag', 'a'.repeat(51)], // second tag exceeds maxlength
        createdBy: 'test-user'
      });

      await expect(content.save()).rejects.toThrow();
    });
  });

  describe('Middleware', () => {
    it('should generate new ETag on save', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      });

      await content.save();
      const originalETag = content.etag;

      content.title = 'Updated Title';
      await content.save();

      expect(content.etag).not.toBe(originalETag);
      expect(content.updatedAt.getTime()).toBeGreaterThan(content.createdAt.getTime());
    });

    it('should set publishedAt when status changes to published', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      });

      await content.save();
      expect(content.publishedAt).toBeUndefined();

      content.status = 'published';
      await content.save();

      expect(content.publishedAt).toBeInstanceOf(Date);
    });

    it('should normalize tags', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        tags: ['  tag1  ', 'TAG2', 'tag1', '', 'tag3'],
        createdBy: 'test-user'
      });

      await content.save();

      expect(content.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  describe('Instance Methods', () => {
    let content: IContent;

    beforeEach(async () => {
      content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      });
      await content.save();
    });

    describe('generateETag', () => {
      it('should generate a valid ETag', () => {
        const etag = content.generateETag();
        expect(etag).toBeValidObjectId();
      });
    });

    describe('canBeEditedBy', () => {
      it('should allow content creator to edit', () => {
        const canEdit = content.canBeEditedBy('test-user', ['creator']);
        expect(canEdit).toBe(true);
      });

      it('should allow admin to edit any content', () => {
        const canEdit = content.canBeEditedBy('other-user', ['admin']);
        expect(canEdit).toBe(true);
      });

      it('should allow moderator to edit any content', () => {
        const canEdit = content.canBeEditedBy('other-user', ['moderator']);
        expect(canEdit).toBe(true);
      });

      it('should not allow other users to edit', () => {
        const canEdit = content.canBeEditedBy('other-user', ['creator']);
        expect(canEdit).toBe(false);
      });
    });

    describe('toSearchDocument', () => {
      it('should convert to search document format', () => {
        const searchDoc = content.toSearchDocument();

        expect(searchDoc).toMatchObject({
          id: content._id,
          tenant_id: content.tenantId,
          title: content.title,
          description: content.description,
          content_type: content.contentType,
          status: content.status,
          version: content.version,
          tags: content.tags,
          metadata: content.metadata,
          created_by: content.createdBy,
          created_at: content.createdAt,
          updated_at: content.updatedAt,
          view_count: 0,
          engagement_score: 0.0
        });
      });

      it('should include file_info when present', async () => {
        content.fileInfo = {
          filename: 'test.mp4',
          contentType: 'video/mp4',
          fileSize: 1048576,
          s3Key: 'test/key',
          cdnUrl: 'https://cdn.example.com/test',
          checksumSha256: 'abc123',
          uploadedAt: new Date()
        };
        await content.save();

        const searchDoc = content.toSearchDocument();

        expect(searchDoc.file_info).toMatchObject({
          filename: 'test.mp4',
          content_type: 'video/mp4',
          file_size: 1048576
        });
      });
    });
  });

  describe('Virtual Fields', () => {
    it('should have id virtual field', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      });

      await content.save();

      expect(content.id).toBe(content._id);
    });
  });

  describe('JSON Transformation', () => {
    it('should transform _id to id in JSON output', async () => {
      const content = new Content({
        tenantId: 'test-tenant',
        title: 'Test Content',
        contentType: 'article',
        createdBy: 'test-user'
      });

      await content.save();
      const json = content.toJSON();

      expect(json.id).toBe(content._id);
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });

  describe('Indexes', () => {
    it('should have proper indexes for query performance', async () => {
      const indexes = await Content.collection.getIndexes();
      const indexNames = Object.keys(indexes);

      // Check for compound indexes
      expect(indexNames).toContain('tenantId_1_status_1_createdAt_-1');
      expect(indexNames).toContain('tenantId_1_contentType_1_createdAt_-1');
      expect(indexNames).toContain('tenantId_1_categoryId_1_createdAt_-1');
      expect(indexNames).toContain('tenantId_1_tags_1_createdAt_-1');
      expect(indexNames).toContain('tenantId_1_createdBy_1_createdAt_-1');
      expect(indexNames).toContain('tenantId_1_deleted_1_createdAt_-1');

      // Check for text search index
      expect(indexNames).toContain('content_text_index');
    });
  });
});
