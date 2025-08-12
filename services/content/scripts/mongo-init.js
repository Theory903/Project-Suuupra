// MongoDB initialization script for production
db = db.getSiblingDB('content_prod');

// Create application user
db.createUser({
  user: 'contentservice',
  pwd: 'contentservice-password',
  roles: [
    {
      role: 'readWrite',
      db: 'content_prod'
    }
  ]
});

// Create indexes for better performance
db.contents.createIndex({ tenantId: 1, status: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, contentType: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, categoryId: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, tags: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, createdBy: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, deleted: 1, createdAt: -1 });
db.contents.createIndex({ tenantId: 1, publishedAt: -1 }, { 
  partialFilterExpression: { status: 'published', deleted: false } 
});

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
db.categories.createIndex({ tenantId: 1, name: 1 });

// Upload sessions indexes
db.upload_sessions.createIndex({ contentId: 1 });
db.upload_sessions.createIndex({ uploadId: 1 }, { unique: true });
db.upload_sessions.createIndex({ status: 1, expiresAt: 1 });
db.upload_sessions.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days

print('MongoDB initialization completed for production environment');
