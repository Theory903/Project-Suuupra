// MongoDB initialization script for development
db = db.getSiblingDB('content_dev');

// Create sample categories
db.categories.insertMany([
  {
    _id: 'cat-programming',
    tenantId: 'tenant-demo',
    name: 'Programming',
    slug: 'programming',
    description: 'Programming tutorials and guides',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'cat-javascript',
    tenantId: 'tenant-demo',
    name: 'JavaScript',
    slug: 'javascript',
    parentId: 'cat-programming',
    description: 'JavaScript programming tutorials',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: 'cat-design',
    tenantId: 'tenant-demo',
    name: 'Design',
    slug: 'design',
    description: 'UI/UX Design resources',
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Create sample content
db.contents.insertMany([
  {
    _id: 'content-1',
    tenantId: 'tenant-demo',
    title: 'Introduction to Node.js',
    description: 'Learn the basics of Node.js development',
    contentType: 'article',
    status: 'published',
    version: '1.0.0',
    categoryId: 'cat-javascript',
    tags: ['nodejs', 'javascript', 'backend', 'tutorial'],
    metadata: {
      viewCount: 150,
      engagementScore: 4.5,
      estimatedReadTime: 10
    },
    createdBy: 'user-demo',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    publishedAt: new Date('2024-01-01'),
    etag: 'etag-1',
    deleted: false
  },
  {
    _id: 'content-2',
    tenantId: 'tenant-demo',
    title: 'Advanced React Patterns',
    description: 'Explore advanced patterns in React development',
    contentType: 'video',
    status: 'published',
    version: '1.2.0',
    categoryId: 'cat-javascript',
    tags: ['react', 'javascript', 'frontend', 'patterns'],
    metadata: {
      viewCount: 89,
      engagementScore: 4.8,
      duration: 1800 // 30 minutes in seconds
    },
    fileInfo: {
      filename: 'react-patterns.mp4',
      contentType: 'video/mp4',
      fileSize: 157286400, // ~150MB
      s3Key: 'content/tenant-demo/2024/01/02/content-2/react-patterns.mp4',
      cdnUrl: 'https://cdn.suuupra.com/content/tenant-demo/2024/01/02/content-2/react-patterns.mp4',
      checksumSha256: 'abc123def456...',
      uploadedAt: new Date('2024-01-02')
    },
    createdBy: 'user-demo',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-15'),
    publishedAt: new Date('2024-01-02'),
    etag: 'etag-2',
    deleted: false
  },
  {
    _id: 'content-3',
    tenantId: 'tenant-demo',
    title: 'CSS Grid Layout Guide',
    description: 'Complete guide to CSS Grid layout system',
    contentType: 'article',
    status: 'draft',
    version: '1.0.0',
    categoryId: 'cat-design',
    tags: ['css', 'layout', 'grid', 'frontend'],
    metadata: {
      viewCount: 0,
      engagementScore: 0.0
    },
    createdBy: 'user-demo',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    etag: 'etag-3',
    deleted: false
  },
  {
    _id: 'content-4',
    tenantId: 'tenant-demo',
    title: 'TypeScript Best Practices',
    description: 'Best practices for TypeScript development',
    contentType: 'document',
    status: 'pending_approval',
    version: '1.0.0',
    categoryId: 'cat-javascript',
    tags: ['typescript', 'javascript', 'best-practices'],
    metadata: {
      viewCount: 0,
      engagementScore: 0.0
    },
    fileInfo: {
      filename: 'typescript-best-practices.pdf',
      contentType: 'application/pdf',
      fileSize: 2097152, // 2MB
      s3Key: 'content/tenant-demo/2024/01/04/content-4/typescript-best-practices.pdf',
      checksumSha256: 'def456abc123...',
      uploadedAt: new Date('2024-01-04')
    },
    createdBy: 'user-demo',
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    etag: 'etag-4',
    deleted: false
  }
]);

// Create indexes
db.contents.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, contentType: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, categoryId: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, tags: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, createdBy: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, deleted: 1, createdAt: -1 });

// Text search index
db.contents.createIndex({ 
  title: 'text', 
  description: 'text', 
  tags: 'text' 
}, {
  weights: { title: 10, description: 5, tags: 1 },
  name: 'content_text_index'
});

// Categories indexes
db.categories.createIndex({ tenantId: 1, slug: 1 }, { unique: true });
db.categories.createIndex({ tenantId: 1, parentId: 1 });

print('MongoDB initialization completed for development environment with sample data');
