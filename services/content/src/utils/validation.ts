import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from '@/types';

// Initialize AJV with formats
const ajv = new Ajv({ 
  allErrors: true, 
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true
});
addFormats(ajv);

// Content validation schemas
export const contentSchemas = {
  create: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^(?!\\s*$).+'
      },
      description: {
        type: 'string',
        maxLength: 2000
      },
      contentType: {
        type: 'string',
        enum: ['video', 'article', 'quiz', 'document']
      },
      categoryId: {
        type: 'string',
        format: 'uuid'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
          pattern: '^[a-zA-Z0-9\\s-_]+$'
        },
        maxItems: 20,
        uniqueItems: true
      },
      metadata: {
        type: 'object',
        additionalProperties: true
      },
      idempotencyKey: {
        type: 'string',
        format: 'uuid'
      }
    },
    required: ['title', 'contentType', 'idempotencyKey'],
    additionalProperties: false
  },

  update: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^(?!\\s*$).+'
      },
      description: {
        type: 'string',
        maxLength: 2000
      },
      categoryId: {
        type: 'string',
        format: 'uuid'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 50,
          pattern: '^[a-zA-Z0-9\\s-_]+$'
        },
        maxItems: 20,
        uniqueItems: true
      },
      metadata: {
        type: 'object',
        additionalProperties: true
      },
      versionBump: {
        type: 'string',
        enum: ['major', 'minor', 'patch'],
        default: 'patch'
      }
    },
    additionalProperties: false,
    minProperties: 1
  },

  search: {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        minLength: 1,
        maxLength: 500
      },
      page: {
        type: 'integer',
        minimum: 1,
        default: 1
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20
      },
      sort: {
        type: 'string',
        enum: ['created_at', 'updated_at', 'title', 'views', 'relevance'],
        default: 'relevance'
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc'
      },
      filters: {
        type: 'object',
        properties: {
          contentType: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['video', 'article', 'quiz', 'document']
            }
          },
          category: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          tags: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          dateRange: {
            type: 'object',
            properties: {
              from: {
                type: 'string',
                format: 'date-time'
              },
              to: {
                type: 'string',
                format: 'date-time'
              }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    },
    required: ['q'],
    additionalProperties: false
  }
};

// Category validation schemas
export const categorySchemas = {
  create: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^(?!\\s*$).+'
      },
      slug: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z0-9-]+$'
      },
      parentId: {
        type: 'string',
        format: 'uuid'
      },
      description: {
        type: 'string',
        maxLength: 500
      },
      metadata: {
        type: 'object',
        additionalProperties: true
      }
    },
    required: ['name'],
    additionalProperties: false
  },

  update: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^(?!\\s*$).+'
      },
      slug: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-z0-9-]+$'
      },
      parentId: {
        type: 'string',
        format: 'uuid'
      },
      description: {
        type: 'string',
        maxLength: 500
      },
      metadata: {
        type: 'object',
        additionalProperties: true
      }
    },
    additionalProperties: false,
    minProperties: 1
  }
};

// Upload validation schemas
export const uploadSchemas = {
  initiate: {
    type: 'object',
    properties: {
      filename: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^[^<>:"/\\\\|?*\\x00-\\x1f]+$'
      },
      contentType: {
        type: 'string',
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9!#$&\\-\\^_]*\\/[a-zA-Z0-9][a-zA-Z0-9!#$&\\-\\^_.]*$'
      },
      fileSize: {
        type: 'integer',
        minimum: 1,
        maximum: 10737418240 // 10GB
      },
      checksumSha256: {
        type: 'string',
        pattern: '^[a-fA-F0-9]{64}$'
      }
    },
    required: ['filename', 'contentType', 'fileSize', 'checksumSha256'],
    additionalProperties: false
  },

  complete: {
    type: 'object',
    properties: {
      parts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            partNumber: {
              type: 'integer',
              minimum: 1,
              maximum: 10000
            },
            etag: {
              type: 'string',
              minLength: 1
            }
          },
          required: ['partNumber', 'etag'],
          additionalProperties: false
        },
        minItems: 1
      }
    },
    required: ['parts'],
    additionalProperties: false
  }
};

// Common query validation schemas
export const querySchemas = {
  pagination: {
    type: 'object',
    properties: {
      page: {
        type: 'integer',
        minimum: 1,
        default: 1
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 20
      },
      sort: {
        type: 'string'
      },
      order: {
        type: 'string',
        enum: ['asc', 'desc'],
        default: 'desc'
      }
    },
    additionalProperties: true
  },

  idParam: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      }
    },
    required: ['id'],
    additionalProperties: false
  }
};

// Compile validators
const validators = {
  content: {
    create: ajv.compile(contentSchemas.create),
    update: ajv.compile(contentSchemas.update),
    search: ajv.compile(contentSchemas.search)
  },
  category: {
    create: ajv.compile(categorySchemas.create),
    update: ajv.compile(categorySchemas.update)
  },
  upload: {
    initiate: ajv.compile(uploadSchemas.initiate),
    complete: ajv.compile(uploadSchemas.complete)
  },
  query: {
    pagination: ajv.compile(querySchemas.pagination),
    idParam: ajv.compile(querySchemas.idParam)
  }
};

// Validation helper function
export function validate<T>(validator: any, data: any): T {
  const valid = validator(data);
  
  if (!valid) {
    const errors = validator.errors?.map((error: any) => ({
      field: error.instancePath.replace('/', '') || error.params?.missingProperty,
      message: error.message,
      value: error.data
    })) || [];
    
    throw new ValidationError('Validation failed', { errors });
  }
  
  return data as T;
}

// Validation middleware factory
export function validationMiddleware(
  schema: 'content.create' | 'content.update' | 'content.search' |
         'category.create' | 'category.update' |
         'upload.initiate' | 'upload.complete' |
         'query.pagination' | 'query.idParam',
  target: 'body' | 'query' | 'params' = 'body'
) {
  return (req: any, res: any, next: any) => {
    try {
      const [group, action] = schema.split('.');
      const validator = (validators as any)[group][action];
      
      if (!validator) {
        throw new Error(`Validator not found: ${schema}`);
      }
      
      const data = req[target];
      req[target] = validate(validator, data);
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

// File validation utilities
export function validateFileType(contentType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(contentType);
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size > 0 && size <= maxSize;
}

export function validateFileName(filename: string): boolean {
  // Check for dangerous characters and patterns
  const dangerousPatterns = [
    /^\./, // Hidden files
    /\.\.|\/|\\/, // Path traversal
    /[<>:"|?*\x00-\x1f]/, // Invalid characters
    /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i // Windows reserved names
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(filename));
}

export function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255);
}

// Content sanitization
export function sanitizeHtml(html: string): string {
  // This would typically use DOMPurify, but we'll implement basic sanitization
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export { validators };
