import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalyticsEvent extends Document {
  _id: string;
  eventType: 'view' | 'like' | 'dislike' | 'share' | 'comment' | 'subscribe' | 'unsubscribe';
  contentId?: string;
  creatorId: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  metadata: {
    watchTime?: number;
    watchPercentage?: number;
    quality?: string;
    device?: string;
    browser?: string;
    os?: string;
    country?: string;
    city?: string;
    referrer?: string;
    ip?: string;
    userAgent?: string;
  };
  createdAt: Date;
}

export interface IDailyAnalytics extends Document {
  _id: string;
  date: string; // YYYY-MM-DD format
  contentId?: string;
  creatorId: string;
  metrics: {
    views: number;
    uniqueViews: number;
    likes: number;
    dislikes: number;
    shares: number;
    comments: number;
    subscribers: number;
    unsubscribes: number;
    watchTime: number;
    averageWatchTime: number;
    bounceRate: number;
    engagement: number;
  };
  demographics: {
    ageGroups: Map<string, number>;
    genders: Map<string, number>;
    countries: Map<string, number>;
    devices: Map<string, number>;
    browsers: Map<string, number>;
  };
  traffic: {
    sources: Map<string, number>;
    referrers: Map<string, number>;
    searchTerms: Map<string, number>;
  };
  revenue: {
    adRevenue: number;
    subscriptionRevenue: number;
    donationRevenue: number;
    totalRevenue: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IRealtimeAnalytics extends Document {
  _id: string;
  contentId?: string;
  creatorId: string;
  timestamp: Date;
  metrics: {
    currentViewers: number;
    totalViews: number;
    likes: number;
    dislikes: number;
    shares: number;
    comments: number;
    averageWatchTime: number;
    topCountries: string[];
    topDevices: string[];
    engagementRate: number;
  };
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>({
  eventType: {
    type: String,
    required: true,
    enum: ['view', 'like', 'dislike', 'share', 'comment', 'subscribe', 'unsubscribe'],
    index: true,
  },
  contentId: {
    type: String,
    index: true,
  },
  creatorId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  metadata: {
    watchTime: Number,
    watchPercentage: Number,
    quality: String,
    device: String,
    browser: String,
    os: String,
    country: String,
    city: String,
    referrer: String,
    ip: String,
    userAgent: String,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

const DailyAnalyticsSchema = new Schema<IDailyAnalytics>({
  date: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/,
    index: true,
  },
  contentId: {
    type: String,
    index: true,
  },
  creatorId: {
    type: String,
    required: true,
    index: true,
  },
  metrics: {
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    subscribers: { type: Number, default: 0 },
    unsubscribes: { type: Number, default: 0 },
    watchTime: { type: Number, default: 0 },
    averageWatchTime: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
  },
  demographics: {
    ageGroups: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    genders: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    countries: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    devices: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    browsers: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  traffic: {
    sources: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    referrers: {
      type: Map,
      of: Number,
      default: new Map(),
    },
    searchTerms: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  revenue: {
    adRevenue: { type: Number, default: 0 },
    subscriptionRevenue: { type: Number, default: 0 },
    donationRevenue: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

const RealtimeAnalyticsSchema = new Schema<IRealtimeAnalytics>({
  contentId: {
    type: String,
    index: true,
  },
  creatorId: {
    type: String,
    required: true,
    index: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 3600, // Expire after 1 hour
  },
  metrics: {
    currentViewers: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    averageWatchTime: { type: Number, default: 0 },
    topCountries: [String],
    topDevices: [String],
    engagementRate: { type: Number, default: 0 },
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound indexes
AnalyticsEventSchema.index({ creatorId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ contentId: 1, eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ userId: 1, eventType: 1, timestamp: -1 });

DailyAnalyticsSchema.index({ creatorId: 1, date: -1 });
DailyAnalyticsSchema.index({ contentId: 1, date: -1 });
DailyAnalyticsSchema.index({ date: -1, 'metrics.views': -1 });

RealtimeAnalyticsSchema.index({ creatorId: 1, timestamp: -1 });
RealtimeAnalyticsSchema.index({ contentId: 1, timestamp: -1 });

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
export const DailyAnalytics = mongoose.model<IDailyAnalytics>('DailyAnalytics', DailyAnalyticsSchema);
export const RealtimeAnalytics = mongoose.model<IRealtimeAnalytics>('RealtimeAnalytics', RealtimeAnalyticsSchema);
