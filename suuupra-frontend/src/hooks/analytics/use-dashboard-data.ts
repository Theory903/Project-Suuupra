'use client';

import { useQuery } from '@tanstack/react-query';
import { AuthService, RecommendationService } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';

export interface DashboardStats {
  coursesEnrolled: number;
  coursesCompleted: number;
  hoursLearned: number;
  certificatesEarned: number;
  currentStreak: number;
  totalPoints: number;
}

export interface RecentCourse {
  id: string;
  title: string;
  progress: number;
  nextLesson: string;
  instructor: string;
  thumbnail: string;
  lastAccessed?: string;
}

export interface UpcomingClass {
  id: string;
  title: string;
  instructor: string;
  time: string;
  date: string;
  participants: number;
  joinUrl?: string;
}

export interface CourseRecommendation {
  id: string;
  title: string;
  instructor: string;
  rating: number;
  duration: string;
  price: number;
  thumbnail: string;
  tags: string[];
}

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboard('user-stats'),
    queryFn: async (): Promise<DashboardStats> => {
      // For now, return mock data. In production, this would call a real analytics API
      // TODO: Replace with real API call when user progress tracking is implemented
      return {
        coursesEnrolled: 12,
        coursesCompleted: 8,
        hoursLearned: 156,
        certificatesEarned: 5,
        currentStreak: 15,
        totalPoints: 2450,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRecentCourses() {
  return useQuery({
    queryKey: queryKeys.courses({ recent: true, limit: 3 }),
    queryFn: async (): Promise<RecentCourse[]> => {
      try {
        const user = await AuthService.getCurrentUser();
        
        // In a real implementation, this would fetch user's enrolled courses with progress
        // For now, we'll use the content API to get some real courses and add mock progress
        const { courses } = await import('@/lib/api').then(api => api.ContentService.getCourses({ limit: 3 }));
        
        return courses.map((course, index) => ({
          id: course.id,
          title: course.title,
          progress: [75, 45, 90][index] || 0,
          nextLesson: [
            'Custom Hooks Deep Dive',
            'Neural Networks Introduction', 
            'Deployment Strategies'
          ][index] || 'Next Lesson',
          instructor: course.instructor || 'Instructor',
          thumbnail: course.thumbnail || '/api/placeholder/300/200',
          lastAccessed: new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString(),
        }));
      } catch (error) {
        console.error('Failed to fetch recent courses:', error);
        // Fallback to mock data
        return [
          {
            id: '1',
            title: 'Advanced React Patterns',
            progress: 75,
            nextLesson: 'Custom Hooks Deep Dive',
            instructor: 'Sarah Johnson',
            thumbnail: '/api/placeholder/300/200',
            lastAccessed: new Date().toISOString(),
          },
          {
            id: '2', 
            title: 'Machine Learning Fundamentals',
            progress: 45,
            nextLesson: 'Neural Networks Introduction',
            instructor: 'Dr. Michael Chen',
            thumbnail: '/api/placeholder/300/200',
            lastAccessed: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '3',
            title: 'Full-Stack Development',
            progress: 90,
            nextLesson: 'Deployment Strategies', 
            instructor: 'Alex Rodriguez',
            thumbnail: '/api/placeholder/300/200',
            lastAccessed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useUpcomingClasses() {
  return useQuery({
    queryKey: queryKeys.liveRooms({ status: 'scheduled', upcoming: true }),
    queryFn: async (): Promise<UpcomingClass[]> => {
      try {
        const { LiveClassService } = await import('@/lib/api');
        const sessions = await LiveClassService.getSessions({ status: 'upcoming' });
        
        return sessions.map(session => ({
          id: session.id,
          title: session.title,
          instructor: session.instructorName || 'Instructor',
          time: new Date(session.scheduledStartTime || Date.now()).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          date: new Date(session.scheduledStartTime || Date.now()).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          }),
          participants: session.maxParticipants || 0,
          joinUrl: session.joinUrl,
        }));
      } catch (error) {
        console.error('Failed to fetch upcoming classes:', error);
        // Fallback to mock data
        return [
          {
            id: '1',
            title: 'JavaScript Fundamentals Q&A',
            instructor: 'Emma Wilson',
            time: '2:00 PM',
            date: 'Today',
            participants: 234,
          },
          {
            id: '2',
            title: 'React Best Practices Workshop',
            instructor: 'David Kim',
            time: '10:00 AM',
            date: 'Tomorrow', 
            participants: 156,
          },
          {
            id: '3',
            title: 'AI in Web Development',
            instructor: 'Lisa Zhang',
            time: '3:00 PM',
            date: 'Dec 15',
            participants: 89,
          },
        ];
      }
    },
    staleTime: 1 * 60 * 1000, // 1 minute for live data
  });
}

export function useCourseRecommendations() {
  return useQuery({
    queryKey: queryKeys.recommendations('dashboard', 'courses'),
    queryFn: async (): Promise<CourseRecommendation[]> => {
      try {
        const user = await AuthService.getCurrentUser();
        const recommendations = await RecommendationService.getUserRecommendations(user.id, { 
          type: 'courses', 
          limit: 3 
        });
        
        return recommendations.map(rec => ({
          id: rec.itemId,
          title: rec.title,
          instructor: rec.metadata?.instructor || 'Instructor',
          rating: rec.score || 4.5,
          duration: rec.metadata?.duration || '8 hours',
          price: rec.metadata?.price || 99,
          thumbnail: rec.metadata?.thumbnail || '/api/placeholder/300/200',
          tags: rec.metadata?.tags || ['Popular'],
        }));
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        // Fallback to mock data
        return [
          {
            id: '1',
            title: 'TypeScript Mastery',
            instructor: 'Jennifer Lee',
            rating: 4.9,
            duration: '8 hours',
            price: 99,
            thumbnail: '/api/placeholder/300/200',
            tags: ['Popular', 'TypeScript'],
          },
          {
            id: '2',
            title: 'Advanced CSS Techniques',
            instructor: 'Mark Stevens',
            rating: 4.7,
            duration: '6 hours',
            price: 79,
            thumbnail: '/api/placeholder/300/200',
            tags: ['CSS', 'Design'],
          },
          {
            id: '3',
            title: 'Node.js Backend Development',
            instructor: 'Rachel Green',
            rating: 4.8,
            duration: '12 hours',
            price: 129,
            thumbnail: '/api/placeholder/300/200',
            tags: ['Backend', 'Node.js'],
          },
        ];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
