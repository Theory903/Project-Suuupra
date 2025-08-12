import { Category, ICategory } from '@/models/Category';
import { logger, ContextLogger } from '@/utils/logger';
import { NotFoundError, ValidationError } from '@/types';

export class CategoryService {
  private contextLogger: ContextLogger;

  constructor() {
    this.contextLogger = new ContextLogger({ service: 'category' });
  }

  // Find category by ID
  public async findById(id: string): Promise<ICategory | null> {
    try {
      const category = await Category.findById(id);
      return category;
    } catch (error) {
      this.contextLogger.error('Error finding category by ID', error as Error, { categoryId: id });
      throw error;
    }
  }

  // Get category path (for hierarchical categories)
  public async getCategoryPath(categoryId: string): Promise<string> {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Category', categoryId);
      }

      const path = [category.name];
      let currentCategory = category;

      // Traverse up the hierarchy
      while (currentCategory.parentId) {
        const parent = await Category.findById(currentCategory.parentId);
        if (!parent) break;
        
        path.unshift(parent.name);
        currentCategory = parent;
      }

      return path.join(' > ');
    } catch (error) {
      this.contextLogger.error('Error getting category path', error as Error, { categoryId });
      throw error;
    }
  }

  // Get all categories for a tenant
  public async getCategories(tenantId: string): Promise<ICategory[]> {
    try {
      const categories = await Category.find({ tenantId }).sort({ name: 1 });
      return categories;
    } catch (error) {
      this.contextLogger.error('Error getting categories', error as Error, { tenantId });
      throw error;
    }
  }

  // Create category
  public async createCategory(
    tenantId: string,
    name: string,
    slug: string,
    description?: string,
    parentId?: string,
    metadata?: Record<string, any>
  ): Promise<ICategory> {
    try {
      // Validate parent category exists
      if (parentId) {
        const parent = await Category.findOne({ _id: parentId, tenantId });
        if (!parent) {
          throw new ValidationError('Parent category not found');
        }
      }

      // Check for duplicate slug within tenant
      const existing = await Category.findOne({ tenantId, slug });
      if (existing) {
        throw new ValidationError('Category slug already exists');
      }

      const category = new Category({
        tenantId,
        name,
        slug,
        description,
        parentId,
        metadata: metadata || {}
      });

      await category.save();
      
      this.contextLogger.info('Category created', {
        categoryId: category._id,
        tenantId,
        name
      });

      return category;
    } catch (error) {
      this.contextLogger.error('Error creating category', error as Error, {
        tenantId,
        name,
        slug
      });
      throw error;
    }
  }

  // Update category
  public async updateCategory(
    categoryId: string,
    tenantId: string,
    updates: Partial<{
      name: string;
      slug: string;
      description: string;
      parentId: string;
      metadata: Record<string, any>;
    }>
  ): Promise<ICategory> {
    try {
      const category = await Category.findOne({ _id: categoryId, tenantId });
      if (!category) {
        throw new NotFoundError('Category', categoryId);
      }

      // Validate parent category if being updated
      if (updates.parentId) {
        const parent = await Category.findOne({ _id: updates.parentId, tenantId });
        if (!parent) {
          throw new ValidationError('Parent category not found');
        }

        // Prevent circular references
        if (await this.wouldCreateCircularReference(categoryId, updates.parentId)) {
          throw new ValidationError('Cannot create circular category reference');
        }
      }

      // Check for duplicate slug if being updated
      if (updates.slug && updates.slug !== category.slug) {
        const existing = await Category.findOne({ tenantId, slug: updates.slug });
        if (existing) {
          throw new ValidationError('Category slug already exists');
        }
      }

      Object.assign(category, updates);
      await category.save();

      this.contextLogger.info('Category updated', {
        categoryId,
        tenantId,
        updates: Object.keys(updates)
      });

      return category;
    } catch (error) {
      this.contextLogger.error('Error updating category', error as Error, {
        categoryId,
        tenantId
      });
      throw error;
    }
  }

  // Delete category (soft delete)
  public async deleteCategory(categoryId: string, tenantId: string): Promise<void> {
    try {
      const category = await Category.findOne({ _id: categoryId, tenantId });
      if (!category) {
        throw new NotFoundError('Category', categoryId);
      }

      // Check if category has children
      const children = await Category.find({ parentId: categoryId, tenantId });
      if (children.length > 0) {
        throw new ValidationError('Cannot delete category with child categories');
      }

      // Check if category is used by content
      const { Content } = await import('@/models/Content');
      const contentCount = await Content.countDocuments({ categoryId, deleted: false });
      if (contentCount > 0) {
        throw new ValidationError('Cannot delete category that is used by content');
      }

      await Category.findByIdAndDelete(categoryId);

      this.contextLogger.info('Category deleted', {
        categoryId,
        tenantId
      });
    } catch (error) {
      this.contextLogger.error('Error deleting category', error as Error, {
        categoryId,
        tenantId
      });
      throw error;
    }
  }

  // Build category tree
  public async getCategoryTree(tenantId: string): Promise<any[]> {
    try {
      const categories = await Category.find({ tenantId }).sort({ name: 1 });
      
      // Build tree structure
      const categoryMap = new Map();
      const rootCategories: any[] = [];

      // First pass: create map
      categories.forEach(category => {
        categoryMap.set(category._id.toString(), {
          ...category.toJSON(),
          children: []
        });
      });

      // Second pass: build tree
      categories.forEach(category => {
        const categoryNode = categoryMap.get(category._id.toString());
        
        if (category.parentId) {
          const parent = categoryMap.get(category.parentId.toString());
          if (parent) {
            parent.children.push(categoryNode);
          }
        } else {
          rootCategories.push(categoryNode);
        }
      });

      return rootCategories;
    } catch (error) {
      this.contextLogger.error('Error building category tree', error as Error, { tenantId });
      throw error;
    }
  }

  // Check for circular references
  private async wouldCreateCircularReference(categoryId: string, parentId: string): Promise<boolean> {
    let currentParentId = parentId;
    const visited = new Set<string>();

    while (currentParentId && !visited.has(currentParentId)) {
      if (currentParentId === categoryId) {
        return true; // Circular reference detected
      }

      visited.add(currentParentId);
      const parent = await Category.findById(currentParentId);
      currentParentId = parent?.parentId?.toString() || '';
    }

    return false;
  }
}
