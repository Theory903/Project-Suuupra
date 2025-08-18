import mongoose, { Document, Schema } from 'mongoose';

export interface IContent extends Document {
  _id: string;
  creatorId: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  status: 'processing' | 'private' | 'public' | 'archived' | 'failed';
  uploadDate: Date;
  publishDate?: Date;
  s3Key: string;
  originalFilename: string;
  fileSize: number;
  duration?: number;
  thumbnailUrl?: string;
  previewUrl?: string;
  transcodingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  videoQualities: {
    quality: string;
    url: string;
    fileSize: number;
    bitrate: number;
  }[];
  monetization: {
    isMonetized: boolean;
    adRevenue: boolean;
    sponsorship: boolean;
    subscription: boolean;
    price?: number;
  };
  analytics: {
    views: number;
    likes: number;
    dislikes: number;
    shares: number;
    comments: number;
    watchTime: number;
    avgWatchTime: number;
    retention: number[];
    demographics: {
      ageGroups: Map<string, number>;
      genders: Map<string, number>;
      countries: Map<string, number>;
    };
  };
  metadata: {
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
    aspectRatio?: string;
  };
  moderation: {
    status: 'pending' | 'approved' | 'rejected' | 'flagged';
    flags: string[];
    reviewedBy?: string;
    reviewedAt?: Date;
    notes?: string;
  };
  visibility: {
    isPublic: boolean;
    isListed: boolean;
    allowComments: boolean;
    allowLikes: boolean;
    restrictedCountries: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>({
  creatorId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 2000,
    trim: true,
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50,
  }],
  category: {
    type: String,
    required: true,
    enum: [
      'education',
      'entertainment',
      'gaming',
      'music',
      'sports',
      'technology',
      'lifestyle',
      'news',
      'comedy',
      'documentary',
      'other'
    ],
  },
  status: {
    type: String,
    enum: ['processing', 'private', 'public', 'archived', 'failed'],
    default: 'processing',
    index: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  publishDate: {
    type: Date,
    index: true,
  },
  s3Key: {
    type: String,
    required: true,
  },
  originalFilename: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // in seconds
  },
  thumbnailUrl: {
    type: String,
  },
  previewUrl: {
    type: String,
  },
  transcodingStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  videoQualities: [{
    quality: {
      type: String,
      enum: ['360p', '480p', '720p', '1080p', '1440p', '2160p'],
    },
    url: String,
    fileSize: Number,
    bitrate: Number,
  }],
  monetization: {
    isMonetized: {
      type: Boolean,
      default: false,
    },
    adRevenue: {
      type: Boolean,
      default: false,
    },
    sponsorship: {
      type: Boolean,
      default: false,
    },
    subscription: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      min: 0,
    },
  },
  analytics: {
    views: {
      type: Number,
      default: 0,
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    dislikes: {
      type: Number,
      default: 0,
    },
    shares: {
      type: Number,
      default: 0,
    },
    comments: {
      type: Number,
      default: 0,
    },
    watchTime: {
      type: Number,
      default: 0,
    },
    avgWatchTime: {
      type: Number,
      default: 0,
    },
    retention: [Number],
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
    },
  },
  metadata: {
    width: Number,
    height: Number,
    fps: Number,
    codec: String,
    bitrate: Number,
    aspectRatio: String,
  },
  moderation: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'flagged'],
      default: 'pending',
    },
    flags: [String],
    reviewedBy: String,
    reviewedAt: Date,
    notes: String,
  },
  visibility: {
    isPublic: {
      type: Boolean,
      default: true,
    },
    isListed: {
      type: Boolean,
      default: true,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    allowLikes: {
      type: Boolean,
      default: true,
    },
    restrictedCountries: [String],
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

// Indexes
ContentSchema.index({ creatorId: 1, status: 1 });
ContentSchema.index({ creatorId: 1, uploadDate: -1 });
ContentSchema.index({ status: 1, publishDate: -1 });
ContentSchema.index({ category: 1, status: 1, publishDate: -1 });
ContentSchema.index({ tags: 1, status: 1 });
ContentSchema.index({ 'analytics.views': -1, status: 1 });
ContentSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for formatted duration
ContentSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return null;
  
  const hours = Math.floor(this.duration / 3600);
  const minutes = Math.floor((this.duration % 3600) / 60);
  const seconds = this.duration % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Pre-save middleware
ContentSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'public' && !this.publishDate) {
    this.publishDate = new Date();
  }
  next();
});

export const Content = mongoose.model<IContent>('Content', ContentSchema);
