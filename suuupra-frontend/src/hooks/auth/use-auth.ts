'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AuthService } from '@/lib/api';
import { queryKeys } from '@/lib/query-client';
import { toast } from 'sonner';
import { setAuthCookie, redirectToDashboard, clearAuthCookies } from '@/app/actions/auth';

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Get current user profile
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: AuthService.getCurrentUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: ({ email, password, rememberMe }: { 
      email: string; 
      password: string; 
      rememberMe?: boolean;
    }) => AuthService.login(email, password, rememberMe),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.profile(), data.user);
      toast.success('Welcome back!');
      
      // Set server-side cookie and redirect
      await setAuthCookie(data.token);
      await redirectToDashboard();
    },
    onError: (error: unknown) => {
      const message = error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response &&
        error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data &&
        typeof error.response.data.message === 'string' ? error.response.data.message : 'Login failed';
      toast.error(message);
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: (userData: {
      email: string;
      password: string;
      name: string;
      role?: string;
    }) => AuthService.register(userData),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.profile(), data.user);
      toast.success('Account created successfully!');
      
      // Set server-side cookie and redirect
      await setAuthCookie(data.token);
      await redirectToDashboard();
    },
    onError: (error: unknown) => {
      const message = error && typeof error === 'object' && 'response' in error && 
        error.response && typeof error.response === 'object' && 'data' in error.response &&
        error.response.data && typeof error.response.data === 'object' && 'message' in error.response.data &&
        typeof error.response.data.message === 'string' ? error.response.data.message : 'Registration failed';
      toast.error(message);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: AuthService.logout,
    onSuccess: async () => {
      queryClient.clear();
      await clearAuthCookies();
      toast.success('Logged out successfully');
      router.push('/auth/sign-in');
    },
    onError: async () => {
      // Force logout even if API call fails
      queryClient.clear();
      await clearAuthCookies();
      router.push('/auth/sign-in');
    },
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginLoading: loginMutation.isPending,
    isRegisterLoading: registerMutation.isPending,
    isLogoutLoading: logoutMutation.isPending,
  };
}

