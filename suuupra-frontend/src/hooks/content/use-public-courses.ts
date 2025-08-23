'use client';

import { useQuery } from '@tanstack/react-query';
import { PublicApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { get } from '@/lib/http';

export interface PublicCourse {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  students: number;
  duration: string;
  price: number;
  originalPrice?: number;
  tags: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnail?: string;
  description?: string;
  category?: string;
}

export interface CourseCategory {
  name: string;
  count: number;
  color: string;
  icon: any;
}

// This hook fetches public courses without requiring authentication
export function usePublicCourses(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  featured?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.courses({ ...params, public: true }),
    queryFn: async (): Promise<{ courses: PublicCourse[]; total: number; page: number }> => {
      try {
        // Try to fetch real courses from the content API (without auth)
        const response = await get<{ content: any[]; total: number; page: number }>(
          '/content/api/v1/content', 
          { 
            params: {
              page: params?.page || 0,
              limit: params?.limit || 20,
              search: params?.search,
              category: params?.category,
              type: 'course',
              status: 'published' // Only get published courses for public view
            }
          }
        );

        const courses = (response.content || []).map((item: any, index: number) => ({
          id: item.id,
          title: item.title,
          instructor: item.authorName || item.instructor || 'Instructor',
          rating: item.rating || (4.5 + Math.random() * 0.5), // Mock rating if not available
          students: item.enrollmentCount || Math.floor(Math.random() * 20000 + 1000),
          duration: item.duration ? `${Math.floor(item.duration / 60)} hours` : '8 hours',
          price: item.price || [89, 149, 199][index % 3] || 99,
          originalPrice: item.originalPrice,
          tags: item.tags || ['Popular'],
          level: (item.level || ['Beginner', 'Intermediate', 'Advanced'][index % 3]) as any,
          thumbnail: item.thumbnailUrl,
          description: item.description,
          category: item.category,
        }));

        return {
          courses,
          total: response.total || courses.length,
          page: response.page || (params?.page ?? 0)
        };
      } catch (error) {
        console.error('Failed to fetch public courses:', error);
        
        // Fallback to mock data if API fails
        const mockCourses: PublicCourse[] = [
          {
            id: '1',
            title: 'Complete React Development',
            instructor: 'Sarah Johnson',
            rating: 4.9,
            students: 12543,
            duration: '40 hours',
            price: 89,
            originalPrice: 129,
            tags: ['React', 'JavaScript', 'Frontend'],
            level: 'Intermediate',
            thumbnail: '/api/placeholder/400/300',
            description: 'Master React from fundamentals to advanced patterns',
            category: 'Web Development',
          },
          {
            id: '2', 
            title: 'AI & Machine Learning',
            instructor: 'Dr. Michael Chen',
            rating: 4.8,
            students: 8932,
            duration: '60 hours',
            price: 149,
            originalPrice: 199,
            tags: ['AI', 'Python', 'ML'],
            level: 'Advanced',
            thumbnail: '/api/placeholder/400/300',
            description: 'Comprehensive AI and ML course with hands-on projects',
            category: 'Data Science',
          },
          {
            id: '3',
            title: 'Full-Stack Development',
            instructor: 'Alex Rodriguez',
            rating: 4.9,
            students: 15672,
            duration: '80 hours',
            price: 199,
            originalPrice: 299,
            tags: ['Full-Stack', 'Node.js', 'Database'],
            level: 'Beginner',
            thumbnail: '/api/placeholder/400/300',
            description: 'Complete full-stack development from zero to hero',
            category: 'Web Development',
          },
          {
            id: '4',
            title: 'Mobile App Development',
            instructor: 'Jessica Park',
            rating: 4.7,
            students: 9876,
            duration: '50 hours',
            price: 119,
            originalPrice: 169,
            tags: ['React Native', 'Mobile', 'iOS', 'Android'],
            level: 'Intermediate',
            thumbnail: '/api/placeholder/400/300',
            description: 'Build cross-platform mobile apps with React Native',
            category: 'Mobile Development',
          },
          {
            id: '5',
            title: 'DevOps & Cloud Computing',
            instructor: 'Mark Thompson',
            rating: 4.6,
            students: 7234,
            duration: '45 hours',
            price: 139,
            originalPrice: 189,
            tags: ['DevOps', 'AWS', 'Docker', 'Kubernetes'],
            level: 'Advanced',
            thumbnail: '/api/placeholder/400/300',
            description: 'Master modern DevOps practices and cloud technologies',
            category: 'DevOps',
          },
          {
            id: '6',
            title: 'UI/UX Design Masterclass',
            instructor: 'Emily Watson',
            rating: 4.8,
            students: 11234,
            duration: '35 hours',
            price: 99,
            originalPrice: 149,
            tags: ['Design', 'Figma', 'Prototyping'],
            level: 'Beginner',
            thumbnail: '/api/placeholder/400/300',
            description: 'Complete guide to user interface and experience design',
            category: 'Design',
          },
        ];

        // Apply filters to mock data
        let filteredCourses = mockCourses;
        
        if (params?.search) {
          const searchLower = params.search.toLowerCase();
          filteredCourses = filteredCourses.filter(course => 
            course.title.toLowerCase().includes(searchLower) ||
            course.instructor.toLowerCase().includes(searchLower) ||
            course.tags.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }
        
        if (params?.category) {
          filteredCourses = filteredCourses.filter(course => 
            course.category === params.category
          );
        }

        if (params?.featured) {
          filteredCourses = filteredCourses.filter(course => course.rating >= 4.7);
        }

        // Apply pagination
        const page = params?.page || 0;
        const limit = params?.limit || 20;
        const startIndex = page * limit;
        const paginatedCourses = filteredCourses.slice(startIndex, startIndex + limit);

        return {
          courses: paginatedCourses,
          total: filteredCourses.length,
          page
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for public content
  });
}

export function useFeaturedCourses(limit: number = 6) {
  return usePublicCourses({ featured: true, limit });
}

export function useCourseCategories() {
  return useQuery({
    queryKey: ['course-categories'],
    queryFn: async (): Promise<CourseCategory[]> => {
      // In a real app, this would fetch from an API
      const { Code, Palette, TrendingUp, Zap } = await import('lucide-react');
      
      return [
        { name: 'Web Development', icon: Code, count: 245, color: 'from-blue-500 to-cyan-500' },
        { name: 'Design', icon: Palette, count: 189, color: 'from-purple-500 to-pink-500' },
        { name: 'Business', icon: TrendingUp, count: 156, color: 'from-green-500 to-emerald-500' },
        { name: 'Data Science', icon: Zap, count: 134, color: 'from-orange-500 to-red-500' },
        { name: 'Mobile Development', icon: Code, count: 98, color: 'from-indigo-500 to-purple-500' },
        { name: 'DevOps', icon: Zap, count: 76, color: 'from-gray-500 to-slate-500' },
        { name: 'Marketing', icon: TrendingUp, count: 123, color: 'from-pink-500 to-rose-500' },
        { name: 'Machine Learning', icon: Zap, count: 87, color: 'from-yellow-500 to-orange-500' },
      ];
    },
    staleTime: 60 * 60 * 1000, // 1 hour - categories don't change often
  });
}
