import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface ICreator extends Document {
  _id: string;
  username: string;
  email: string;
  password: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  website?: string;
  socialLinks: {
    twitter?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };
  verification: {
    isVerified: boolean;
    verifiedAt?: Date;
    verificationBadge?: string;
  };
  profile: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    country?: string;
    language?: string;
    timezone?: string;
  };
  analytics: {
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
    totalWatchTime: number;
    subscriberCount: number;
    averageRating: number;
    contentCount: number;
  };
  monetization: {
    isEnabled: boolean;
    enabledAt?: Date;
    payoutMethod: 'stripe' | 'paypal' | 'bank' | null;
    payoutDetails: {
      stripeAccountId?: string;
      paypalEmail?: string;
      bankDetails?: {
        accountNumber: string;
        routingNumber: string;
        accountHolderName: string;
      };
    };
    earnings: {
      totalEarned: number;
      pendingPayout: number;
      lastPayoutDate?: Date;
      lifetimeEarnings: number;
    };
    adRevenue: {
      enabled: boolean;
      cpm: number;
      totalRevenue: number;
    };
    subscriptions: {
      enabled: boolean;
      monthlyPrice: number;
      subscriberCount: number;
      totalRevenue: number;
    };
    donations: {
      enabled: boolean;
      totalReceived: number;
    };
  };
  settings: {
    privacy: {
      showEmail: boolean;
      showAnalytics: boolean;
      allowMessages: boolean;
    };
    notifications: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      commentNotifications: boolean;
      subscriptionNotifications: boolean;
    };
    content: {
      defaultVisibility: 'public' | 'private';
      autoPublish: boolean;
      allowComments: boolean;
      moderateComments: boolean;
    };
  };
  subscription: {
    plan: 'free' | 'creator' | 'pro' | 'enterprise';
    startDate?: Date;
    endDate?: Date;
    features: string[];
    storageUsed: number;
    storageLimit: number;
    bandwidthUsed: number;
    bandwidthLimit: number;
  };
  status: {
    isActive: boolean;
    isSuspended: boolean;
    suspensionReason?: string;
    suspendedAt?: Date;
    lastLoginAt?: Date;
    lastActiveAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const CreatorSchema = new Schema<ICreator>({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    index: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  bio: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  avatarUrl: {
    type: String,
  },
  bannerUrl: {
    type: String,
  },
  website: {
    type: String,
    match: /^https?:\/\/.+/,
  },
  socialLinks: {
    twitter: {
      type: String,
      match: /^https?:\/\/(www\.)?twitter\.com\/.+/,
    },
    instagram: {
      type: String,
      match: /^https?:\/\/(www\.)?instagram\.com\/.+/,
    },
    youtube: {
      type: String,
      match: /^https?:\/\/(www\.)?youtube\.com\/.+/,
    },
    tiktok: {
      type: String,
      match: /^https?:\/\/(www\.)?tiktok\.com\/.+/,
    },
  },
  verification: {
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    verificationBadge: {
      type: String,
      enum: ['verified', 'partner', 'premium'],
    },
  },
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    dateOfBirth: Date,
    country: {
      type: String,
      maxlength: 2,
    },
    language: {
      type: String,
      default: 'en',
      maxlength: 5,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  analytics: {
    totalViews: {
      type: Number,
      default: 0,
    },
    totalLikes: {
      type: Number,
      default: 0,
    },
    totalShares: {
      type: Number,
      default: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    totalWatchTime: {
      type: Number,
      default: 0,
    },
    subscriberCount: {
      type: Number,
      default: 0,
      index: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    contentCount: {
      type: Number,
      default: 0,
    },
  },
  monetization: {
    isEnabled: {
      type: Boolean,
      default: false,
    },
    enabledAt: Date,
    payoutMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'bank', null],
      default: null,
    },
    payoutDetails: {
      stripeAccountId: String,
      paypalEmail: String,
      bankDetails: {
        accountNumber: String,
        routingNumber: String,
        accountHolderName: String,
      },
    },
    earnings: {
      totalEarned: {
        type: Number,
        default: 0,
      },
      pendingPayout: {
        type: Number,
        default: 0,
      },
      lastPayoutDate: Date,
      lifetimeEarnings: {
        type: Number,
        default: 0,
      },
    },
    adRevenue: {
      enabled: {
        type: Boolean,
        default: false,
      },
      cpm: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },
    subscriptions: {
      enabled: {
        type: Boolean,
        default: false,
      },
      monthlyPrice: {
        type: Number,
        default: 0,
        min: 0,
      },
      subscriberCount: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },
    donations: {
      enabled: {
        type: Boolean,
        default: false,
      },
      totalReceived: {
        type: Number,
        default: 0,
      },
    },
  },
  settings: {
    privacy: {
      showEmail: {
        type: Boolean,
        default: false,
      },
      showAnalytics: {
        type: Boolean,
        default: false,
      },
      allowMessages: {
        type: Boolean,
        default: true,
      },
    },
    notifications: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      commentNotifications: {
        type: Boolean,
        default: true,
      },
      subscriptionNotifications: {
        type: Boolean,
        default: true,
      },
    },
    content: {
      defaultVisibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
      },
      autoPublish: {
        type: Boolean,
        default: false,
      },
      allowComments: {
        type: Boolean,
        default: true,
      },
      moderateComments: {
        type: Boolean,
        default: false,
      },
    },
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'creator', 'pro', 'enterprise'],
      default: 'free',
    },
    startDate: Date,
    endDate: Date,
    features: [String],
    storageUsed: {
      type: Number,
      default: 0,
    },
    storageLimit: {
      type: Number,
      default: 5 * 1024 * 1024 * 1024, // 5GB for free plan
    },
    bandwidthUsed: {
      type: Number,
      default: 0,
    },
    bandwidthLimit: {
      type: Number,
      default: 100 * 1024 * 1024 * 1024, // 100GB for free plan
    },
  },
  status: {
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    suspensionReason: String,
    suspendedAt: Date,
    lastLoginAt: Date,
    lastActiveAt: Date,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    },
  },
});

// Indexes
CreatorSchema.index({ username: 1 });
CreatorSchema.index({ email: 1 });
CreatorSchema.index({ 'analytics.subscriberCount': -1 });
CreatorSchema.index({ 'verification.isVerified': 1 });
CreatorSchema.index({ 'status.isActive': 1, 'status.isSuspended': 1 });
CreatorSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
CreatorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
CreatorSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last active timestamp
CreatorSchema.methods.updateLastActive = function() {
  this.status.lastActiveAt = new Date();
  return this.save();
};

export const Creator = mongoose.model<ICreator>('Creator', CreatorSchema);
