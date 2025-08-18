#!/usr/bin/env ts-node

import { connectDB, disconnectDB } from '@/models';
import { Content } from '@/models/Content';
import { Category } from '@/models/Category';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const TENANT_ID = 'tenant-demo';
const USER_ID = 'user-demo';

async function seedDatabase(): Promise<void> {
  try {
    logger.info('Starting database seeding...');
    
    await connectDB();
    
    // Clear existing data
    await Content.deleteMany({ tenantId: TENANT_ID });
    await Category.deleteMany({ tenantId: TENANT_ID });
    
    // Create categories
    const categories = [
      {
        _id: 'cat-programming',
        tenantId: TENANT_ID,
        name: 'Programming',
        slug: 'programming',
        description: 'Programming tutorials and guides',
        metadata: {}
      },
      {
        _id: 'cat-javascript',
        tenantId: TENANT_ID,
        name: 'JavaScript',
        slug: 'javascript',
        parentId: 'cat-programming',
        description: 'JavaScript programming tutorials',
        metadata: {}
      },
      {
        _id: 'cat-design',
        tenantId: TENANT_ID,
        name: 'Design',
        slug: 'design',
        description: 'UI/UX Design resources',
        metadata: {}
      }
    ];
    
    await Category.insertMany(categories);
    logger.info(`Created ${categories.length} categories`);
    
    // Create sample content
    const contents = [
      {
        _id: 'content-1',
        tenantId: TENANT_ID,
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
        createdBy: USER_ID,
        publishedAt: new Date('2024-01-01'),
        etag: uuidv4(),
        deleted: false
      },
      {
        _id: 'content-2',
        tenantId: TENANT_ID,
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
          duration: 1800
        },
        fileInfo: {
          filename: 'react-patterns.mp4',
          contentType: 'video/mp4',
          fileSize: 157286400,
          s3Key: 'content/tenant-demo/2024/01/02/content-2/react-patterns.mp4',
          cdnUrl: 'https://cdn.suuupra.com/content/tenant-demo/2024/01/02/content-2/react-patterns.mp4',
          checksumSha256: 'abc123def456...',
          uploadedAt: new Date('2024-01-02')
        },
        createdBy: USER_ID,
        publishedAt: new Date('2024-01-02'),
        etag: uuidv4(),
        deleted: false
      },
      {
        _id: 'content-3',
        tenantId: TENANT_ID,
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
        createdBy: USER_ID,
        etag: uuidv4(),
        deleted: false
      }
    ];
    
    await Content.insertMany(contents);
    logger.info(`Created ${contents.length} content items`);
    
    logger.info('Database seeding completed successfully');
    
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

export default seedDatabase;
