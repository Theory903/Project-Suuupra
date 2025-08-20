'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, handleApiError } from '@/lib/api';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name?: string;
  roles: string[];
  status?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (userData: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      if (AuthService.isAuthenticated()) {
        await refreshProfile();
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    try {
      const result = await AuthService.login(email, password, rememberMe);
      setUser(result.user);
      setIsAuthenticated(true);
      
      // Track login analytics
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'user_login',
            userId: result.user.id,
            timestamp: new Date().toISOString()
          })
        });
      } catch (analyticsError) {
        console.warn('Analytics tracking failed:', analyticsError);
      }
      
    } catch (error) {
      throw error; // Re-throw for component handling
    }
  };

  const register = async (userData: { email: string; password: string; name: string }) => {
    try {
      const result = await AuthService.register(userData);
      setUser(result.user);
      setIsAuthenticated(true);
      
      // Track registration analytics
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'user_register',
            userId: result.user.id,
            timestamp: new Date().toISOString()
          })
        });
      } catch (analyticsError) {
        console.warn('Analytics tracking failed:', analyticsError);
      }
      
    } catch (error) {
      throw error; // Re-throw for component handling
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Profile refresh failed:', error);
      await logout();
      throw error;
    }
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => user?.roles?.includes(role)) || false;
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshProfile,
    hasRole,
    hasAnyRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Higher-order component for protected routes
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRoles?: string[]
) => {
  const AuthenticatedComponent = (props: P) => {
    const { isAuthenticated, isLoading, hasAnyRole, user } = useAuth();

    if (isLoading) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth';
      }
      return null;
    }

    if (requiredRoles && !hasAnyRole(requiredRoles)) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-gray-400 mb-4">
              You don't have permission to access this page.
            </p>
            <p className="text-sm text-gray-500">
              Required roles: {requiredRoles.join(', ')}
            </p>
            <p className="text-sm text-gray-500">
              Your roles: {user?.roles?.join(', ') || 'None'}
            </p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return AuthenticatedComponent;
};
