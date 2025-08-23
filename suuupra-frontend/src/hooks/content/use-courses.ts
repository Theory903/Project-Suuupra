'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ContentApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';

interface CourseFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

export function useCourses(filters: CourseFilters = {}) {
  return useQuery({
    queryKey: queryKeys.courses(filters),
    queryFn: () => ContentApi.listContent({
      page: filters.page || 0,
      limit: filters.limit || 20,
      search: filters.search,
      category: filters.category,
    }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.course(id),
    queryFn: () => ContentApi.getContent(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (courseData: {
      title: string;
      type: string;
      category?: string;
      tags?: string[];
      description?: string;
      isPublic?: boolean;
    }) => ContentApi.createContent(courseData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content', 'courses'] });
      toast.success('Course created successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create course');
    },
  });
}

export function useUpdateCourse(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: any) => ContentApi.updateContent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.course(id) });
      queryClient.invalidateQueries({ queryKey: ['content', 'courses'] });
      toast.success('Course updated successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update course');
    },
  });
}

export function useSearchContent(query: string, filters: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.search(query, filters),
    queryFn: () => ContentApi.search({
      q: query,
      page: filters.page || 0,
      limit: filters.limit || 20,
    }),
    enabled: !!query.trim(),
    staleTime: 30 * 1000, // 30 seconds for search results
  });
}

