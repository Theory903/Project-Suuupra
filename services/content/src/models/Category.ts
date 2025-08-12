import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  _id: string;
  tenantId: string;
  name: string;
  slug: string;
  parentId?: string;
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual fields
  id: string;
  
  // Instance methods
  getFullPath(): Promise<string>;
  getAncestors(): Promise<ICategory[]>;
  getDescendants(): Promise<ICategory[]>;
}

const CategorySchema = new Schema<ICategory>({
  _id: { 
    type: String, 
    default: () => new Types.ObjectId().toString() 
  },
  tenantId: { 
    type: String, 
    required: true, 
    index: true 
  },
  name: { 
    type: String, 
    required: true, 
    maxlength: 100,
    trim: true
  },
  slug: { 
    type: String, 
    required: true, 
    maxlength: 100,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  parentId: { 
    type: String, 
    index: true,
    validate: {
      validator: function(value: string) {
        // Prevent self-reference
        return !value || value !== this._id;
      },
      message: 'Category cannot be its own parent'
    }
  },
  description: { 
    type: String, 
    maxlength: 500,
    trim: true
  },
  metadata: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  versionKey: false,
  collection: 'categories'
});

// Indexes
CategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, parentId: 1 });
CategorySchema.index({ tenantId: 1, name: 1 });

// Virtual for id field
CategorySchema.virtual('id').get(function() {
  return this._id;
});

// Pre-save middleware
CategorySchema.pre('save', async function(next) {
  if (this.isModified('parentId') && this.parentId) {
    // Check for circular references
    const ancestors = await this.getAncestors();
    const ancestorIds = ancestors.map(ancestor => ancestor._id);
    
    if (ancestorIds.includes(this._id)) {
      throw new Error('Circular reference detected in category hierarchy');
    }
  }
  
  // Generate slug if not provided
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  
  next();
});

// Instance methods
CategorySchema.methods.getFullPath = async function(): Promise<string> {
  const ancestors = await this.getAncestors();
  const pathParts = [...ancestors.map(cat => cat.name), this.name];
  return pathParts.join(' > ');
};

CategorySchema.methods.getAncestors = async function(): Promise<ICategory[]> {
  const ancestors: ICategory[] = [];
  let currentCategory = this;
  
  while (currentCategory.parentId) {
    const parent = await Category.findOne({ 
      _id: currentCategory.parentId, 
      tenantId: this.tenantId 
    });
    
    if (!parent) break;
    
    ancestors.unshift(parent);
    currentCategory = parent;
    
    // Prevent infinite loops
    if (ancestors.length > 10) break;
  }
  
  return ancestors;
};

CategorySchema.methods.getDescendants = async function(): Promise<ICategory[]> {
  const descendants: ICategory[] = [];
  
  const findChildren = async (parentId: string) => {
    const children = await Category.find({ 
      parentId, 
      tenantId: this.tenantId 
    });
    
    for (const child of children) {
      descendants.push(child);
      await findChildren(child._id);
    }
  };
  
  await findChildren(this._id);
  return descendants;
};

// Static methods
CategorySchema.statics.buildHierarchy = async function(tenantId: string): Promise<any[]> {
  const categories = await this.find({ tenantId }).sort({ name: 1 });
  const categoryMap = new Map();
  const rootCategories: any[] = [];
  
  // Create category map
  categories.forEach(cat => {
    categoryMap.set(cat._id, {
      ...cat.toJSON(),
      children: []
    });
  });
  
  // Build hierarchy
  categories.forEach(cat => {
    const categoryData = categoryMap.get(cat._id);
    
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      const parent = categoryMap.get(cat.parentId);
      parent.children.push(categoryData);
    } else {
      rootCategories.push(categoryData);
    }
  });
  
  return rootCategories;
};

// Transform output
CategorySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
