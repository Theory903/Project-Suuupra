import Queue from 'bull';
import { redisClient } from './redis';
import pino from 'pino';

const logger = pino({ name: 'queues' });

// Queue configurations
const queueOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_QUEUE_DB || '1'),
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Video processing queue
export const videoProcessingQueue = new Queue('video processing', queueOptions);

// Thumbnail generation queue
export const thumbnailQueue = new Queue('thumbnail generation', queueOptions);

// Analytics aggregation queue
export const analyticsQueue = new Queue('analytics aggregation', queueOptions);

// Notification queue
export const notificationQueue = new Queue('notifications', queueOptions);

// Email queue
export const emailQueue = new Queue('email', queueOptions);

// Payout processing queue
export const payoutQueue = new Queue('payout processing', queueOptions);

// Content moderation queue
export const moderationQueue = new Queue('content moderation', queueOptions);

// Job processors
videoProcessingQueue.process('transcode', async (job) => {
  const { contentId, filePath, outputFormats } = job.data;
  logger.info(`Processing video transcoding for content ${contentId}`);
  
  // Implement video transcoding logic
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const path = require('path');
    const fs = require('fs').promises;
    const AWS = require('aws-sdk');
    
    // Configure AWS S3 for CDN upload
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-west-2'
    });
    
    const bucket = process.env.CDN_BUCKET || 'suuupra-content';
    const baseOutputPath = `/tmp/transcode_${contentId}`;
    
    // Ensure output directory exists
    await fs.mkdir(baseOutputPath, { recursive: true });
    
    // Define transcoding formats
    const formats = outputFormats || [
      { quality: '1080p', width: 1920, height: 1080, bitrate: '4000k' },
      { quality: '720p', width: 1280, height: 720, bitrate: '2500k' },
      { quality: '480p', width: 854, height: 480, bitrate: '1000k' },
      { quality: '360p', width: 640, height: 360, bitrate: '750k' }
    ];
    
    const transcodePromises = formats.map(async (format, index) => {
      const outputPath = path.join(baseOutputPath, `${format.quality}.mp4`);
      
      return new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .size(`${format.width}x${format.height}`)
          .videoBitrate(format.bitrate)
          .audioBitrate('128k')
          .format('mp4')
          .output(outputPath)
          .on('start', () => {
            logger.info(`Starting ${format.quality} transcode for ${contentId}`);
          })
          .on('progress', (progress) => {
            const overallProgress = ((index + progress.percent / 100) / formats.length) * 100;
            job.progress(Math.min(overallProgress, 95));
          })
          .on('end', async () => {
            try {
              // Upload to S3/CDN
              const fileBuffer = await fs.readFile(outputPath);
              const s3Key = `content/${contentId}/video/${format.quality}.mp4`;
              
              const uploadResult = await s3.upload({
                Bucket: bucket,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: 'video/mp4',
                ACL: 'public-read'
              }).promise();
              
              // Clean up local file
              await fs.unlink(outputPath);
              
              resolve({
                quality: format.quality,
                url: uploadResult.Location,
                size: fileBuffer.length,
                bitrate: format.bitrate
              });
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject)
          .run();
      });
    });
    
    const transcodeResults = await Promise.all(transcodePromises);
    
    // Update content metadata in database
    const updateQuery = `
      UPDATE content 
      SET video_urls = $1, processing_status = 'completed', updated_at = NOW()
      WHERE content_id = $2
    `;
    
    await job.data.db.query(updateQuery, [JSON.stringify(transcodeResults), contentId]);
    
    job.progress(100);
    return { contentId, status: 'completed', formats: transcodeResults };
    
  } catch (error) {
    logger.error(`Video transcoding failed for ${contentId}:`, error);
    throw error;
  }
});

thumbnailQueue.process('generate', async (job) => {
  const { contentId, videoPath, timestamps } = job.data;
  logger.info(`Generating thumbnails for content ${contentId}`);
  
  // Implement thumbnail generation logic
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const sharp = require('sharp');
    const path = require('path');
    const fs = require('fs').promises;
    const AWS = require('aws-sdk');
    
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-west-2'
    });
    
    const bucket = process.env.CDN_BUCKET || 'suuupra-content';
    const baseOutputPath = `/tmp/thumbnails_${contentId}`;
    
    await fs.mkdir(baseOutputPath, { recursive: true });
    
    // Generate thumbnails at different timestamps
    const defaultTimestamps = timestamps || ['00:00:05', '25%', '50%', '75%'];
    const thumbnailPromises = defaultTimestamps.map(async (timestamp, index) => {
      const rawPath = path.join(baseOutputPath, `thumb_${index}_raw.png`);
      const optimizedPath = path.join(baseOutputPath, `thumb_${index}.jpg`);
      
      // Extract frame using FFmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .screenshots({
            timestamps: [timestamp],
            filename: `thumb_${index}_raw.png`,
            folder: baseOutputPath,
            size: '1280x720'
          })
          .on('end', resolve)
          .on('error', reject);
      });
      
      // Optimize with Sharp
      const optimizedBuffer = await sharp(rawPath)
        .resize(1280, 720, { fit: 'cover' })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      
      // Upload to S3
      const s3Key = `content/${contentId}/thumbnails/thumb_${index}.jpg`;
      const uploadResult = await s3.upload({
        Bucket: bucket,
        Key: s3Key,
        Body: optimizedBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read'
      }).promise();
      
      // Clean up local files
      await Promise.all([
        fs.unlink(rawPath).catch(() => {}),
        fs.unlink(optimizedPath).catch(() => {})
      ]);
      
      job.progress(((index + 1) / defaultTimestamps.length) * 90);
      
      return {
        timestamp,
        url: uploadResult.Location,
        size: optimizedBuffer.length
      };
    });
    
    const thumbnails = await Promise.all(thumbnailPromises);
    
    // Update content metadata
    const updateQuery = `
      UPDATE content 
      SET thumbnail_urls = $1, updated_at = NOW()
      WHERE content_id = $2
    `;
    
    await job.data.db.query(updateQuery, [JSON.stringify(thumbnails), contentId]);
    
    job.progress(100);
    return { contentId, thumbnails };
    
  } catch (error) {
    logger.error(`Thumbnail generation failed for ${contentId}:`, error);
    throw error;
  }
});

analyticsQueue.process('aggregate', async (job) => {
  const { contentId, timeRange } = job.data;
  logger.info(`Aggregating analytics for content ${contentId}`);
  
  // Implement analytics aggregation logic
  try {
    const { Pool } = require('pg');
    
    // Connect to analytics database
    const analyticsDb = new Pool({
      connectionString: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL,
      max: 5,
    });
    
    const startTime = new Date();
    const endTime = timeRange ? new Date(timeRange.end) : new Date();
    const rangeStart = timeRange ? new Date(timeRange.start) : new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    
    // Aggregate view metrics
    const viewMetricsQuery = `
      SELECT 
        COUNT(*) as total_views,
        COUNT(DISTINCT user_id) as unique_viewers,
        AVG(watch_duration) as avg_watch_duration,
        SUM(watch_duration) as total_watch_time,
        DATE_TRUNC('hour', created_at) as hour
      FROM content_views 
      WHERE content_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour
    `;
    
    const viewMetrics = await analyticsDb.query(viewMetricsQuery, [contentId, rangeStart, endTime]);
    
    // Aggregate engagement metrics
    const engagementQuery = `
      SELECT 
        action_type,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users
      FROM content_interactions 
      WHERE content_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY action_type
    `;
    
    const engagementMetrics = await analyticsDb.query(engagementQuery, [contentId, rangeStart, endTime]);
    
    // Aggregate geographic data
    const geoQuery = `
      SELECT 
        country,
        region,
        COUNT(*) as views
      FROM content_views cv
      JOIN user_locations ul ON cv.user_id = ul.user_id
      WHERE cv.content_id = $1 
        AND cv.created_at >= $2 
        AND cv.created_at <= $3
      GROUP BY country, region
      ORDER BY views DESC
    `;
    
    const geoMetrics = await analyticsDb.query(geoQuery, [contentId, rangeStart, endTime]);
    
    // Aggregate device/platform data
    const deviceQuery = `
      SELECT 
        device_type,
        platform,
        COUNT(*) as views,
        AVG(watch_duration) as avg_duration
      FROM content_views 
      WHERE content_id = $1 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY device_type, platform
      ORDER BY views DESC
    `;
    
    const deviceMetrics = await analyticsDb.query(deviceQuery, [contentId, rangeStart, endTime]);
    
    // Calculate revenue metrics if applicable
    let revenueMetrics = null;
    if (job.data.includeRevenue) {
      const revenueQuery = `
        SELECT 
          SUM(amount) as total_revenue,
          COUNT(*) as total_transactions,
          AVG(amount) as avg_transaction_value
        FROM content_monetization 
        WHERE content_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
          AND status = 'completed'
      `;
      
      const revenueResult = await analyticsDb.query(revenueQuery, [contentId, rangeStart, endTime]);
      revenueMetrics = revenueResult.rows[0];
    }
    
    const aggregatedData = {
      content_id: contentId,
      time_range: { start: rangeStart, end: endTime },
      view_metrics: viewMetrics.rows,
      engagement_metrics: engagementMetrics.rows,
      geographic_data: geoMetrics.rows,
      device_metrics: deviceMetrics.rows,
      revenue_metrics: revenueMetrics,
      aggregated_at: new Date().toISOString()
    };
    
    // Store aggregated data
    const insertQuery = `
      INSERT INTO analytics_aggregations (
        content_id, time_range_start, time_range_end, 
        aggregated_data, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (content_id, time_range_start, time_range_end)
      DO UPDATE SET aggregated_data = $4, updated_at = NOW()
    `;
    
    await analyticsDb.query(insertQuery, [
      contentId, 
      rangeStart, 
      endTime, 
      JSON.stringify(aggregatedData)
    ]);
    
    await analyticsDb.end();
    
    job.progress(100);
    return { contentId, status: 'completed', aggregated_data: aggregatedData };
    
  } catch (error) {
    logger.error(`Analytics aggregation failed for ${contentId}:`, error);
    throw error;
  }
});

notificationQueue.process('send', async (job) => {
  const { userId, type, data } = job.data;
  logger.info(`Sending notification to user ${userId}`);
  
  // Implement notification sending logic
  try {
    const notificationHandlers = {
      push: async (userId: string, data: any) => {
        const { Pool } = require('pg');
        const webpush = require('web-push');
        
        // Configure web push
        webpush.setVapidDetails(
          'mailto:support@suuupra.com',
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY
        );
        
        const db = new Pool({ connectionString: process.env.DATABASE_URL });
        
        // Get user's push subscriptions
        const subscriptions = await db.query(
          'SELECT subscription_data FROM push_subscriptions WHERE user_id = $1 AND active = true',
          [userId]
        );
        
        const results = [];
        for (const sub of subscriptions.rows) {
          try {
            await webpush.sendNotification(
              JSON.parse(sub.subscription_data),
              JSON.stringify({
                title: data.title,
                body: data.message,
                icon: data.icon || '/icon-192x192.png',
                badge: '/badge-72x72.png',
                data: data.clickAction
              })
            );
            results.push({ status: 'sent' });
          } catch (error) {
            results.push({ status: 'failed', error: error.message });
          }
        }
        
        await db.end();
        return results;
      },
      
      inapp: async (userId: string, data: any) => {
        const { Pool } = require('pg');
        const db = new Pool({ connectionString: process.env.DATABASE_URL });
        
        // Store in-app notification
        await db.query(`
          INSERT INTO notifications (
            user_id, type, title, message, data, created_at, read_at
          ) VALUES ($1, $2, $3, $4, $5, NOW(), NULL)
        `, [userId, type, data.title, data.message, JSON.stringify(data)]);
        
        await db.end();
        return { status: 'stored' };
      },
      
      sms: async (userId: string, data: any) => {
        const twilio = require('twilio');
        const { Pool } = require('pg');
        
        const client = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        
        const db = new Pool({ connectionString: process.env.DATABASE_URL });
        
        // Get user's phone number
        const userResult = await db.query(
          'SELECT phone_number FROM users WHERE user_id = $1 AND phone_verified = true',
          [userId]
        );
        
        if (userResult.rows.length === 0) {
          await db.end();
          return { status: 'skipped', reason: 'No verified phone number' };
        }
        
        const phoneNumber = userResult.rows[0].phone_number;
        
        try {
          await client.messages.create({
            body: data.message,
            from: process.env.TWILIO_FROM_NUMBER,
            to: phoneNumber
          });
          
          await db.end();
          return { status: 'sent' };
        } catch (error) {
          await db.end();
          return { status: 'failed', error: error.message };
        }
      }
    };
    
    // Route to appropriate handler
    const handler = notificationHandlers[type as keyof typeof notificationHandlers];
    if (!handler) {
      throw new Error(`Unknown notification type: ${type}`);
    }
    
    const result = await handler(userId, data);
    job.progress(100);
    return { userId, type, status: 'processed', result };
    
  } catch (error) {
    logger.error(`Notification sending failed for user ${userId}:`, error);
    throw error;
  }
});

emailQueue.process('send', async (job) => {
  const { to, subject, template, data } = job.data;
  logger.info(`Sending email to ${to}`);
  
  // Implement email sending logic
  try {
    const sgMail = require('@sendgrid/mail');
    const handlebars = require('handlebars');
    const fs = require('fs').promises;
    const path = require('path');
    
    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Load and compile email template
    const templatePath = path.join(__dirname, '../templates/emails', `${template}.hbs`);
    let templateContent;
    
    try {
      templateContent = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      // Fall back to a default template if specific template not found
      templateContent = `
        <html>
          <body>
            <h2>{{subject}}</h2>
            <p>{{message}}</p>
            <hr>
            <p><small>Sent from Suuupra Platform</small></p>
          </body>
        </html>
      `;
    }
    
    const compiledTemplate = handlebars.compile(templateContent);
    const htmlContent = compiledTemplate({
      ...data,
      subject: subject
    });
    
    // Prepare email message
    const message = {
      to: to,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@suuupra.com',
        name: process.env.FROM_NAME || 'Suuupra Platform'
      },
      subject: subject,
      html: htmlContent,
      // Add text version
      text: data.message || subject,
      // Add tracking
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      // Add categories for analytics
      categories: ['creator-studio', template || 'general']
    };
    
    // Send email
    const result = await sgMail.send(message);
    
    job.progress(100);
    return { 
      to, 
      status: 'sent', 
      messageId: result[0].headers['x-message-id'],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error(`Email sending failed to ${to}:`, error);
    
    // For non-critical emails, we might want to retry
    if (error.code === 429) { // Rate limit
      throw new Error('Rate limited, will retry');
    }
    
    return { 
      to, 
      status: 'failed', 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
});

payoutQueue.process('process', async (job) => {
  const { creatorId, amount, payoutMethod } = job.data;
  logger.info(`Processing payout for creator ${creatorId}`);
  
  // Implement payout processing logic
  try {
    const { Pool } = require('pg');
    const axios = require('axios');
    
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 1. Validate payout eligibility
    const eligibilityCheck = await db.query(`
      SELECT 
        c.creator_id, 
        c.earnings_total,
        c.payouts_total,
        c.earnings_pending,
        c.minimum_payout_threshold,
        c.payout_schedule,
        cp.bank_account_verified,
        cp.tax_document_verified
      FROM creators c
      LEFT JOIN creator_profiles cp ON c.creator_id = cp.creator_id
      WHERE c.creator_id = $1 AND c.is_active = true
    `, [creatorId]);
    
    if (eligibilityCheck.rows.length === 0) {
      throw new Error('Creator not found or inactive');
    }
    
    const creator = eligibilityCheck.rows[0];
    const availableBalance = creator.earnings_total - creator.payouts_total;
    
    if (availableBalance < amount) {
      throw new Error(`Insufficient balance. Available: ${availableBalance}, Requested: ${amount}`);
    }
    
    if (amount < creator.minimum_payout_threshold) {
      throw new Error(`Amount below minimum threshold: ${creator.minimum_payout_threshold}`);
    }
    
    if (!creator.bank_account_verified || !creator.tax_document_verified) {
      throw new Error('Creator profile verification incomplete');
    }
    
    job.progress(25);
    
    // 2. Process payment via payments service
    const paymentsServiceUrl = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:8083';
    
    const payoutRequest = {
      creator_id: creatorId,
      amount: amount,
      currency: 'INR',
      payout_method: payoutMethod,
      metadata: {
        job_id: job.id,
        payout_type: 'creator_earnings',
        processor: 'creator_studio'
      }
    };
    
    const payoutResponse = await axios.post(
      `${paymentsServiceUrl}/api/v1/payouts`,
      payoutRequest,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    if (payoutResponse.status !== 201) {
      throw new Error(`Payout processing failed: ${payoutResponse.data.error}`);
    }
    
    const payoutResult = payoutResponse.data;
    job.progress(60);
    
    // 3. Record transaction in database
    const transactionResult = await db.query(`
      INSERT INTO creator_payouts (
        creator_id, 
        amount, 
        payout_method, 
        payout_reference,
        payout_status,
        processed_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING payout_id
    `, [
      creatorId,
      amount,
      payoutMethod,
      payoutResult.payout_id,
      payoutResult.status,
      new Date(),
      JSON.stringify(payoutResult.metadata || {})
    ]);
    
    const payoutId = transactionResult.rows[0].payout_id;
    
    // Update creator balance
    await db.query(`
      UPDATE creators 
      SET payouts_total = payouts_total + $1,
          earnings_pending = earnings_pending - $1,
          last_payout_at = NOW()
      WHERE creator_id = $2
    `, [amount, creatorId]);
    
    job.progress(80);
    
    // 4. Send confirmation notification
    try {
      const notificationServiceUrl = process.env.NOTIFICATIONS_SERVICE_URL || 'http://localhost:8087';
      
      const notificationRequest = {
        recipient_id: creatorId,
        type: 'payout_processed',
        channel: 'email',
        template: 'creator_payout_confirmation',
        data: {
          creator_id: creatorId,
          amount: amount,
          payout_method: payoutMethod,
          payout_id: payoutId,
          reference: payoutResult.payout_id,
          processed_at: new Date().toISOString()
        }
      };
      
      await axios.post(
        `${notificationServiceUrl}/api/v1/notifications`,
        notificationRequest,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );
    } catch (notificationError) {
      // Log notification failure but don't fail the payout
      logger.warn('Failed to send payout confirmation notification', {
        creatorId,
        payoutId,
        error: notificationError.message
      });
    }
    
    await db.end();
    job.progress(100);
    
    logger.info('Payout processing completed successfully', {
      creatorId,
      amount,
      payoutId,
      payoutReference: payoutResult.payout_id
    });
    
    return {
      creatorId,
      amount,
      payoutId,
      payoutReference: payoutResult.payout_id,
      status: 'completed',
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Payout processing failed', {
      creatorId,
      amount,
      error: error.message
    });
    throw error;
  }
  
  job.progress(100);
  return { creatorId, status: 'completed' };
});

moderationQueue.process('review', async (job) => {
  const { contentId, moderationType } = job.data;
  logger.info(`Reviewing content ${contentId} for moderation`);
  
  // Implement content moderation logic
  try {
    const { Pool } = require('pg');
    const axios = require('axios');
    
    const db = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 1. Get content details for analysis
    const contentResult = await db.query(`
      SELECT 
        content_id, title, description, content_url, content_type,
        creator_id, created_at, metadata
      FROM content 
      WHERE content_id = $1
    `, [contentId]);
    
    if (contentResult.rows.length === 0) {
      throw new Error('Content not found');
    }
    
    const content = contentResult.rows[0];
    
    // 2. Automated content analysis
    const moderationResults = {
      contentId,
      checks: {},
      flags: [],
      confidence: 0,
      recommendation: 'approved'
    };
    
    // Text content moderation (title, description)
    if (content.title || content.description) {
      const textToAnalyze = [content.title, content.description].filter(Boolean).join(' ');
      
      // Check for inappropriate content using external service (e.g., Perspective API)
      try {
        const moderationApiUrl = process.env.MODERATION_API_URL;
        if (moderationApiUrl) {
          const response = await axios.post(`${moderationApiUrl}/v1alpha1/comments:analyze`, {
            comment: { text: textToAnalyze },
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {}
            }
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.MODERATION_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          const scores = response.data.attributeScores;
          moderationResults.checks.text = scores;
          
          // Flag if any score is above threshold
          for (const [attribute, scoreData] of Object.entries(scores)) {
            const score = (scoreData as any).summaryScore.value;
            if (score > 0.7) {
              moderationResults.flags.push(`High ${attribute.toLowerCase()} score: ${score}`);
              moderationResults.confidence = Math.max(moderationResults.confidence, score);
            }
          }
        }
      } catch (error) {
        logger.warn('Text moderation API failed, using basic checks', { error: error.message });
        
        // Basic keyword filtering as fallback
        const inappropriateWords = process.env.BLOCKED_WORDS?.split(',') || ['spam', 'scam'];
        const lowerText = textToAnalyze.toLowerCase();
        
        for (const word of inappropriateWords) {
          if (lowerText.includes(word.toLowerCase())) {
            moderationResults.flags.push(`Contains blocked word: ${word}`);
            moderationResults.confidence = 0.8;
          }
        }
      }
    }
    
    // 3. Image/Video content moderation
    if (content.content_type.startsWith('image/') || content.content_type.startsWith('video/')) {
      // Simulate visual content analysis
      // In production, you would use services like AWS Rekognition, Google Vision API
      moderationResults.checks.visual = {
        nsfw_score: 0.1, // Low NSFW score
        violence_score: 0.05,
        moderation_labels: []
      };
      
      job.progress(50);
    }
    
    // 4. Determine final moderation decision
    if (moderationResults.flags.length > 0 && moderationResults.confidence > 0.7) {
      moderationResults.recommendation = 'rejected';
    } else if (moderationResults.flags.length > 0 || moderationResults.confidence > 0.4) {
      moderationResults.recommendation = 'needs_human_review';
    } else {
      moderationResults.recommendation = 'approved';
    }
    
    // 5. Update content status and store moderation results
    const newStatus = moderationResults.recommendation === 'approved' ? 'published' : 
                     moderationResults.recommendation === 'rejected' ? 'rejected' : 'under_review';
    
    await db.query(`
      UPDATE content 
      SET 
        moderation_status = $1,
        moderation_results = $2,
        moderated_at = NOW(),
        updated_at = NOW()
      WHERE content_id = $3
    `, [newStatus, JSON.stringify(moderationResults), contentId]);
    
    // 6. Create moderation record
    await db.query(`
      INSERT INTO content_moderation_logs (
        content_id, moderation_type, decision, confidence_score, 
        flags, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      contentId, 
      moderationType, 
      moderationResults.recommendation,
      moderationResults.confidence,
      JSON.stringify(moderationResults.flags),
      JSON.stringify(moderationResults.checks)
    ]);
    
    // 7. Queue human review if needed
    if (moderationResults.recommendation === 'needs_human_review') {
      await moderationQueue.add('human_review', {
        contentId,
        moderationResults,
        priority: moderationResults.confidence > 0.8 ? 'high' : 'normal'
      }, {
        delay: 0,
        priority: moderationResults.confidence > 0.8 ? 10 : 5
      });
    }
    
    await db.end();
    
    job.progress(100);
    return { 
      contentId, 
      status: moderationResults.recommendation,
      confidence: moderationResults.confidence,
      flags: moderationResults.flags
    };
    
  } catch (error) {
    logger.error(`Content moderation failed for ${contentId}:`, error);
    throw error;
  }
});

// Queue event handlers
const setupQueueEvents = (queue: Queue.Queue, queueName: string) => {
  queue.on('completed', (job, result) => {
    logger.info(`${queueName} job ${job.id} completed:`, result);
  });

  queue.on('failed', (job, err) => {
    logger.error(`${queueName} job ${job.id} failed:`, err);
  });

  queue.on('stalled', (job) => {
    logger.warn(`${queueName} job ${job.id} stalled`);
  });
};

export const initializeQueues = async () => {
  const queues = [
    { queue: videoProcessingQueue, name: 'Video Processing' },
    { queue: thumbnailQueue, name: 'Thumbnail Generation' },
    { queue: analyticsQueue, name: 'Analytics Aggregation' },
    { queue: notificationQueue, name: 'Notifications' },
    { queue: emailQueue, name: 'Email' },
    { queue: payoutQueue, name: 'Payout Processing' },
    { queue: moderationQueue, name: 'Content Moderation' },
  ];

  queues.forEach(({ queue, name }) => {
    setupQueueEvents(queue, name);
  });

  logger.info('All queues initialized successfully');
};
