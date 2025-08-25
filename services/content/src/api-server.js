/**
 * Content API Server - Comprehensive Course Catalog
 * Uses only Node.js built-in modules for maximum compatibility
 */

const http = require('http');
const url = require('url');

// Comprehensive mock data for courses - 27 courses across categories
const mockCourses = [
  // Web Development (6 courses)
  { 
    id: '1', 
    title: 'Complete React Development', 
    description: 'Master React from fundamentals to advanced patterns including hooks, context, and performance optimization', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['React', 'JavaScript', 'Frontend', 'Hooks'], 
    level: 'Intermediate', 
    instructor: 'Sarah Johnson', 
    authorName: 'Sarah Johnson', 
    duration: 2400, 
    price: 89, 
    originalPrice: 129, 
    rating: 4.9, 
    enrollmentCount: 12543, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-01T00:00:00Z', 
    updatedAt: '2024-01-15T00:00:00Z' 
  },
  { 
    id: '2', 
    title: 'Full-Stack Development Bootcamp', 
    description: 'Complete full-stack development from zero to hero with Node.js, Express, MongoDB, and React', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['Full-Stack', 'Node.js', 'MongoDB', 'Express'], 
    level: 'Beginner', 
    instructor: 'Alex Rodriguez', 
    authorName: 'Alex Rodriguez', 
    duration: 4800, 
    price: 199, 
    originalPrice: 299, 
    rating: 4.9, 
    enrollmentCount: 15672, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-01T00:00:00Z', 
    updatedAt: '2024-01-15T00:00:00Z' 
  },
  { 
    id: '3', 
    title: 'Vue.js Masterclass 2024', 
    description: 'Build modern, reactive applications with Vue.js 3, Composition API, and Pinia', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['Vue.js', 'JavaScript', 'Frontend', 'Pinia'], 
    level: 'Intermediate', 
    instructor: 'Emma Wilson', 
    authorName: 'Emma Wilson', 
    duration: 2100, 
    price: 79, 
    originalPrice: 119, 
    rating: 4.7, 
    enrollmentCount: 8920, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-05T00:00:00Z', 
    updatedAt: '2024-01-20T00:00:00Z' 
  },
  { 
    id: '4', 
    title: 'Angular Complete Guide', 
    description: 'Comprehensive Angular course from basics to enterprise applications with TypeScript', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['Angular', 'TypeScript', 'Frontend', 'Enterprise'], 
    level: 'Advanced', 
    instructor: 'Thomas Mueller', 
    authorName: 'Thomas Mueller', 
    duration: 3600, 
    price: 129, 
    originalPrice: 179, 
    rating: 4.6, 
    enrollmentCount: 6543, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-10T00:00:00Z', 
    updatedAt: '2024-01-25T00:00:00Z' 
  },
  { 
    id: '5', 
    title: 'Modern CSS & Sass Mastery', 
    description: 'Create stunning layouts with CSS Grid, Flexbox, animations, and Sass preprocessing', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['CSS', 'Sass', 'Flexbox', 'Grid'], 
    level: 'Beginner', 
    instructor: 'Lisa Chen', 
    authorName: 'Lisa Chen', 
    duration: 1800, 
    price: 59, 
    originalPrice: 89, 
    rating: 4.5, 
    enrollmentCount: 11234, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-15T00:00:00Z', 
    updatedAt: '2024-01-30T00:00:00Z' 
  },
  { 
    id: '6', 
    title: 'Next.js 14 & React Server Components', 
    description: 'Build production-ready applications with Next.js 14, App Router, and Server Components', 
    type: 'course', 
    category: 'Web Development', 
    tags: ['Next.js', 'React', 'Server Components', 'App Router'], 
    level: 'Advanced', 
    instructor: 'Jordan Smith', 
    authorName: 'Jordan Smith', 
    duration: 3000, 
    price: 159, 
    originalPrice: 229, 
    rating: 4.8, 
    enrollmentCount: 5432, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-01-20T00:00:00Z', 
    updatedAt: '2024-02-05T00:00:00Z' 
  },

  // Data Science (5 courses)
  { 
    id: '7', 
    title: 'AI & Machine Learning Fundamentals', 
    description: 'Comprehensive AI and ML course with Python, scikit-learn, and hands-on projects', 
    type: 'course', 
    category: 'Data Science', 
    tags: ['AI', 'Machine Learning', 'Python', 'scikit-learn'], 
    level: 'Intermediate', 
    instructor: 'Dr. Michael Chen', 
    authorName: 'Dr. Michael Chen', 
    duration: 3600, 
    price: 149, 
    originalPrice: 199, 
    rating: 4.8, 
    enrollmentCount: 8932, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-02-01T00:00:00Z', 
    updatedAt: '2024-02-15T00:00:00Z' 
  },
  { 
    id: '8', 
    title: 'Data Science with Python', 
    description: 'Master data analysis, visualization, and machine learning with Python, Pandas, and Matplotlib', 
    type: 'course', 
    category: 'Data Science', 
    tags: ['Python', 'Pandas', 'Data Analysis', 'Matplotlib'], 
    level: 'Beginner', 
    instructor: 'Emily White', 
    authorName: 'Emily White', 
    duration: 3200, 
    price: 99, 
    originalPrice: 139, 
    rating: 4.6, 
    enrollmentCount: 7500, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-02-05T00:00:00Z', 
    updatedAt: '2024-02-20T00:00:00Z' 
  },
  { 
    id: '9', 
    title: 'Deep Learning with TensorFlow', 
    description: 'Master neural networks, CNNs, RNNs, and advanced deep learning with TensorFlow 2.0', 
    type: 'course', 
    category: 'Data Science', 
    tags: ['Deep Learning', 'TensorFlow', 'Neural Networks', 'CNN'], 
    level: 'Advanced', 
    instructor: 'Dr. Raj Patel', 
    authorName: 'Dr. Raj Patel', 
    duration: 4200, 
    price: 179, 
    originalPrice: 249, 
    rating: 4.9, 
    enrollmentCount: 5432, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-02-10T00:00:00Z', 
    updatedAt: '2024-02-25T00:00:00Z' 
  },
  { 
    id: '10', 
    title: 'Statistics for Data Science', 
    description: 'Essential statistics concepts, hypothesis testing, and statistical modeling for data science', 
    type: 'course', 
    category: 'Data Science', 
    tags: ['Statistics', 'R', 'Hypothesis Testing', 'Statistical Modeling'], 
    level: 'Beginner', 
    instructor: 'Professor Jane Smith', 
    authorName: 'Professor Jane Smith', 
    duration: 2700, 
    price: 89, 
    originalPrice: 129, 
    rating: 4.4, 
    enrollmentCount: 9876, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-02-15T00:00:00Z', 
    updatedAt: '2024-03-01T00:00:00Z' 
  },
  { 
    id: '11', 
    title: 'Big Data Analytics with Apache Spark', 
    description: 'Process and analyze big data using Apache Spark, PySpark, and distributed computing', 
    type: 'course', 
    category: 'Data Science', 
    tags: ['Big Data', 'Apache Spark', 'PySpark', 'Distributed Computing'], 
    level: 'Advanced', 
    instructor: 'Carlos Silva', 
    authorName: 'Carlos Silva', 
    duration: 3900, 
    price: 199, 
    originalPrice: 279, 
    rating: 4.7, 
    enrollmentCount: 4321, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-02-20T00:00:00Z', 
    updatedAt: '2024-03-05T00:00:00Z' 
  },

  // Mobile Development (4 courses)
  { 
    id: '12', 
    title: 'React Native Complete Course', 
    description: 'Build cross-platform mobile apps with React Native, Expo, and native modules', 
    type: 'course', 
    category: 'Mobile Development', 
    tags: ['React Native', 'Mobile', 'Cross-platform', 'Expo'], 
    level: 'Intermediate', 
    instructor: 'Jessica Park', 
    authorName: 'Jessica Park', 
    duration: 3000, 
    price: 119, 
    originalPrice: 169, 
    rating: 4.7, 
    enrollmentCount: 9876, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-03-01T00:00:00Z', 
    updatedAt: '2024-03-15T00:00:00Z' 
  },
  { 
    id: '13', 
    title: 'iOS Development with Swift', 
    description: 'Create native iOS apps with Swift, SwiftUI, and Core Data', 
    type: 'course', 
    category: 'Mobile Development', 
    tags: ['Swift', 'iOS', 'SwiftUI', 'Core Data'], 
    level: 'Intermediate', 
    instructor: 'Mark Johnson', 
    authorName: 'Mark Johnson', 
    duration: 3300, 
    price: 139, 
    originalPrice: 189, 
    rating: 4.8, 
    enrollmentCount: 7654, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-03-05T00:00:00Z', 
    updatedAt: '2024-03-20T00:00:00Z' 
  },
  { 
    id: '14', 
    title: 'Android Development with Kotlin', 
    description: 'Build modern Android apps with Kotlin, Jetpack Compose, and MVVM architecture', 
    type: 'course', 
    category: 'Mobile Development', 
    tags: ['Kotlin', 'Android', 'Jetpack Compose', 'MVVM'], 
    level: 'Intermediate', 
    instructor: 'Kevin Zhang', 
    authorName: 'Kevin Zhang', 
    duration: 3150, 
    price: 129, 
    originalPrice: 179, 
    rating: 4.6, 
    enrollmentCount: 8234, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-03-10T00:00:00Z', 
    updatedAt: '2024-03-25T00:00:00Z' 
  },
  { 
    id: '15', 
    title: 'Flutter Development Complete Guide', 
    description: 'Cross-platform mobile development with Flutter, Dart, and Firebase integration', 
    type: 'course', 
    category: 'Mobile Development', 
    tags: ['Flutter', 'Dart', 'Cross-platform', 'Firebase'], 
    level: 'Beginner', 
    instructor: 'Anna Garcia', 
    authorName: 'Anna Garcia', 
    duration: 2800, 
    price: 109, 
    originalPrice: 149, 
    rating: 4.5, 
    enrollmentCount: 6789, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-03-15T00:00:00Z', 
    updatedAt: '2024-03-30T00:00:00Z' 
  },

  // DevOps (4 courses)
  { 
    id: '16', 
    title: 'Cloud Computing with AWS', 
    description: 'Master AWS services including EC2, S3, Lambda, RDS, and cloud architecture patterns', 
    type: 'course', 
    category: 'DevOps', 
    tags: ['AWS', 'Cloud', 'EC2', 'Lambda'], 
    level: 'Intermediate', 
    instructor: 'David Lee', 
    authorName: 'David Lee', 
    duration: 4000, 
    price: 179, 
    originalPrice: 249, 
    rating: 4.8, 
    enrollmentCount: 11200, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-04-01T00:00:00Z', 
    updatedAt: '2024-04-15T00:00:00Z' 
  },
  { 
    id: '17', 
    title: 'Docker & Kubernetes Mastery', 
    description: 'Containerization with Docker and orchestration with Kubernetes for scalable deployments', 
    type: 'course', 
    category: 'DevOps', 
    tags: ['Docker', 'Kubernetes', 'Containers', 'Orchestration'], 
    level: 'Advanced', 
    instructor: 'Carlos Martinez', 
    authorName: 'Carlos Martinez', 
    duration: 3500, 
    price: 159, 
    originalPrice: 219, 
    rating: 4.7, 
    enrollmentCount: 8765, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-04-05T00:00:00Z', 
    updatedAt: '2024-04-20T00:00:00Z' 
  },
  { 
    id: '18', 
    title: 'CI/CD Pipeline Development', 
    description: 'Build automated deployment pipelines with Jenkins, GitLab CI, and GitHub Actions', 
    type: 'course', 
    category: 'DevOps', 
    tags: ['CI/CD', 'Jenkins', 'GitLab', 'GitHub Actions'], 
    level: 'Intermediate', 
    instructor: 'Priya Singh', 
    authorName: 'Priya Singh', 
    duration: 2400, 
    price: 119, 
    originalPrice: 169, 
    rating: 4.6, 
    enrollmentCount: 5643, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-04-10T00:00:00Z', 
    updatedAt: '2024-04-25T00:00:00Z' 
  },
  { 
    id: '19', 
    title: 'Infrastructure as Code with Terraform', 
    description: 'Automate infrastructure provisioning with Terraform, Ansible, and cloud best practices', 
    type: 'course', 
    category: 'DevOps', 
    tags: ['Terraform', 'Ansible', 'Infrastructure as Code', 'Automation'], 
    level: 'Advanced', 
    instructor: 'Robert Kim', 
    authorName: 'Robert Kim', 
    duration: 3000, 
    price: 149, 
    originalPrice: 199, 
    rating: 4.5, 
    enrollmentCount: 4321, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-04-15T00:00:00Z', 
    updatedAt: '2024-04-30T00:00:00Z' 
  },

  // Design (4 courses)
  { 
    id: '20', 
    title: 'UI/UX Design Masterclass', 
    description: 'Complete guide to user interface and experience design with Figma, user research, and prototyping', 
    type: 'course', 
    category: 'Design', 
    tags: ['UI/UX', 'Figma', 'Prototyping', 'User Research'], 
    level: 'Beginner', 
    instructor: 'Emily Watson', 
    authorName: 'Emily Watson', 
    duration: 2100, 
    price: 99, 
    originalPrice: 149, 
    rating: 4.8, 
    enrollmentCount: 11234, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-05-01T00:00:00Z', 
    updatedAt: '2024-05-15T00:00:00Z' 
  },
  { 
    id: '21', 
    title: 'Graphic Design with Adobe Creative Suite', 
    description: 'Master Photoshop, Illustrator, and InDesign for professional graphic design', 
    type: 'course', 
    category: 'Design', 
    tags: ['Adobe', 'Photoshop', 'Illustrator', 'InDesign'], 
    level: 'Intermediate', 
    instructor: 'Marcus Brown', 
    authorName: 'Marcus Brown', 
    duration: 3600, 
    price: 139, 
    originalPrice: 199, 
    rating: 4.7, 
    enrollmentCount: 9876, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-05-05T00:00:00Z', 
    updatedAt: '2024-05-20T00:00:00Z' 
  },
  { 
    id: '22', 
    title: 'Web Design & User Experience', 
    description: 'Create beautiful and functional web designs with responsive layouts and accessibility', 
    type: 'course', 
    category: 'Design', 
    tags: ['Web Design', 'UX', 'Responsive', 'Accessibility'], 
    level: 'Beginner', 
    instructor: 'Sophie Turner', 
    authorName: 'Sophie Turner', 
    duration: 2400, 
    price: 89, 
    originalPrice: 129, 
    rating: 4.6, 
    enrollmentCount: 8765, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-05-10T00:00:00Z', 
    updatedAt: '2024-05-25T00:00:00Z' 
  },
  { 
    id: '23', 
    title: 'Motion Graphics with After Effects', 
    description: 'Create stunning animations, motion graphics, and visual effects for video content', 
    type: 'course', 
    category: 'Design', 
    tags: ['After Effects', 'Animation', 'Motion Graphics', 'Video'], 
    level: 'Advanced', 
    instructor: 'Jake Miller', 
    authorName: 'Jake Miller', 
    duration: 2700, 
    price: 129, 
    originalPrice: 179, 
    rating: 4.5, 
    enrollmentCount: 5432, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-05-15T00:00:00Z', 
    updatedAt: '2024-05-30T00:00:00Z' 
  },

  // Business (4 courses)
  { 
    id: '24', 
    title: 'Digital Marketing Mastery', 
    description: 'Complete digital marketing strategy including SEO, social media, PPC, and analytics', 
    type: 'course', 
    category: 'Business', 
    tags: ['Digital Marketing', 'SEO', 'Social Media', 'PPC'], 
    level: 'Beginner', 
    instructor: 'Rachel Adams', 
    authorName: 'Rachel Adams', 
    duration: 2400, 
    price: 99, 
    originalPrice: 139, 
    rating: 4.6, 
    enrollmentCount: 12543, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-06-01T00:00:00Z', 
    updatedAt: '2024-06-15T00:00:00Z' 
  },
  { 
    id: '25', 
    title: 'Entrepreneurship Essentials', 
    description: 'Start and scale your own business with business planning, funding, and growth strategies', 
    type: 'course', 
    category: 'Business', 
    tags: ['Entrepreneurship', 'Business Plan', 'Startup', 'Growth'], 
    level: 'Beginner', 
    instructor: 'Tony Stark', 
    authorName: 'Tony Stark', 
    duration: 2100, 
    price: 89, 
    originalPrice: 119, 
    rating: 4.7, 
    enrollmentCount: 8932, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-06-05T00:00:00Z', 
    updatedAt: '2024-06-20T00:00:00Z' 
  },
  { 
    id: '26', 
    title: 'Project Management Professional', 
    description: 'Master project management with Agile, Scrum, Kanban methodologies and industry tools', 
    type: 'course', 
    category: 'Business', 
    tags: ['Project Management', 'Agile', 'Scrum', 'Kanban'], 
    level: 'Intermediate', 
    instructor: 'Linda Taylor', 
    authorName: 'Linda Taylor', 
    duration: 3000, 
    price: 149, 
    originalPrice: 199, 
    rating: 4.8, 
    enrollmentCount: 7654, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-06-10T00:00:00Z', 
    updatedAt: '2024-06-25T00:00:00Z' 
  },
  { 
    id: '27', 
    title: 'Financial Analysis & Excel Modeling', 
    description: 'Advanced financial analysis, Excel modeling, and investment valuation techniques', 
    type: 'course', 
    category: 'Business', 
    tags: ['Financial Analysis', 'Excel', 'Modeling', 'Investment'], 
    level: 'Advanced', 
    instructor: 'Michael Scott', 
    authorName: 'Michael Scott', 
    duration: 2700, 
    price: 119, 
    originalPrice: 169, 
    rating: 4.4, 
    enrollmentCount: 6543, 
    thumbnailUrl: '/api/placeholder/400/300', 
    status: 'published', 
    createdAt: '2024-06-15T00:00:00Z', 
    updatedAt: '2024-06-30T00:00:00Z' 
  }
];

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseQueryString(searchParams) {
  const params = {};
  if (searchParams) {
    searchParams.split('&').forEach(param => {
      const [key, value] = param.split('=');
      if (key && value) {
        params[key] = decodeURIComponent(value);
      }
    });
  }
  return params;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (pathname === '/health') {
    sendJSON(res, 200, {
      status: 'healthy',
      service: 'content',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      totalCourses: mockCourses.length,
      categories: [...new Set(mockCourses.map(c => c.category))]
    });
    return;
  }

  // List content (courses) endpoint
  if (pathname === '/api/v1/content' && req.method === 'GET') {
    const page = parseInt(query.page || '0');
    const limit = parseInt(query.limit || '20');
    const search = query.search ? query.search.toLowerCase() : '';
    const category = query.category || '';
    const level = query.level || '';
    const featured = query.featured === 'true';

    let filteredCourses = mockCourses.filter(course => {
      const matchesSearch = search ? 
        course.title.toLowerCase().includes(search) || 
        course.description.toLowerCase().includes(search) ||
        course.tags.some(tag => tag.toLowerCase().includes(search)) : true;
      
      const matchesCategory = category ? course.category === category : true;
      const matchesLevel = level ? course.level === level : true;
      const matchesFeatured = featured ? course.rating >= 4.7 : true;
      
      return matchesSearch && matchesCategory && matchesLevel && matchesFeatured;
    });

    const total = filteredCourses.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedCourses = filteredCourses.slice(page * limit, (page + 1) * limit);

    sendJSON(res, 200, {
      success: true,
      data: paginatedCourses,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages - 1,
          hasPrev: page > 0
        },
        filters: {
          search,
          category,
          level,
          featured
        },
        requestId: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Get single content item (course) endpoint
  if (pathname.match(/^\/api\/v1\/content\/(.+)$/) && req.method === 'GET') {
    const id = pathname.split('/').pop();
    const course = mockCourses.find(c => c.id === id);

    if (course) {
      sendJSON(res, 200, { 
        success: true, 
        data: course,
        meta: {
          requestId: `req_${Date.now()}`,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      sendJSON(res, 404, { 
        success: false, 
        error: { 
          code: 'NOT_FOUND', 
          message: 'Course not found' 
        },
        meta: {
          requestId: `req_${Date.now()}`,
          timestamp: new Date().toISOString()
        }
      });
    }
    return;
  }

  // Search content endpoint
  if (pathname === '/api/v1/search' && req.method === 'GET') {
    const q = query.q ? query.q.toLowerCase() : '';
    const limit = parseInt(query.limit || '10');
    const category = query.category || '';

    const results = mockCourses
      .filter(course => {
        const matchesQuery = course.title.toLowerCase().includes(q) || 
                            course.description.toLowerCase().includes(q) || 
                            course.tags.some(tag => tag.toLowerCase().includes(q)) ||
                            course.instructor.toLowerCase().includes(q);
        
        const matchesCategory = category ? course.category === category : true;
        
        return matchesQuery && matchesCategory;
      })
      .slice(0, limit)
      .map(course => ({
        id: course.id,
        title: course.title,
        description: course.description,
        type: course.type,
        category: course.category,
        instructor: course.instructor,
        rating: course.rating,
        thumbnailUrl: course.thumbnailUrl,
        price: course.price,
        level: course.level
      }));

    sendJSON(res, 200, {
      success: true,
      data: {
        results,
        total: results.length,
        searchTime: '2ms'
      },
      meta: {
        query: q,
        category,
        pagination: {
          page: 0,
          limit: limit,
          total: results.length,
          totalPages: Math.ceil(results.length / limit)
        },
        requestId: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Get course categories
  if (pathname === '/api/v1/categories' && req.method === 'GET') {
    const categories = {};
    
    mockCourses.forEach(course => {
      if (categories[course.category]) {
        categories[course.category]++;
      } else {
        categories[course.category] = 1;
      }
    });

    const categoryList = Object.entries(categories).map(([name, count]) => ({
      name,
      count,
      slug: name.toLowerCase().replace(/\s+/g, '-')
    }));

    sendJSON(res, 200, {
      success: true,
      data: categoryList,
      meta: {
        total: categoryList.length,
        requestId: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  // Default response for unmatched routes
  if (pathname.startsWith('/api/v1/')) {
    sendJSON(res, 404, {
      success: false,
      error: {
        code: 'ENDPOINT_NOT_FOUND',
        message: 'API endpoint not found'
      },
      service: 'content',
      timestamp: new Date().toISOString(),
      path: pathname,
      method: req.method,
      version: '1.0.0',
      availableEndpoints: [
        'GET /health',
        'GET /api/v1/content',
        'GET /api/v1/content/:id', 
        'GET /api/v1/search',
        'GET /api/v1/categories'
      ]
    });
    return;
  }

  // Default 404 for non-API routes
  sendJSON(res, 404, {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    },
    service: 'content',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 8089;

server.listen(PORT, () => {
  console.log(`Content API server running on port ${PORT}`);
  console.log(`Available courses: ${mockCourses.length}`);
  console.log(`Categories: ${[...new Set(mockCourses.map(c => c.category))].join(', ')}`);
});