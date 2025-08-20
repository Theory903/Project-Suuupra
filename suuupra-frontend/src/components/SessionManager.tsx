'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Smartphone, Monitor, Tablet, Globe, MapPin, Clock, 
  AlertCircle, RefreshCw, Trash2, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthService } from '@/lib/api';
import { toast } from 'sonner';

interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  location: {
    city: string;
    country: string;
    ip: string;
  };
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
  userAgent: string;
}

export default function SessionManager() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const sessionData = await AuthService.getSessions();
      
      // Mock enhanced session data (in real app, backend would provide this)
      const enhancedSessions: Session[] = sessionData.map((session: any, index: number) => ({
        id: session.id || `session-${index}`,
        device: getDeviceType(session.userAgent || ''),
        browser: getBrowser(session.userAgent || ''),
        os: getOS(session.userAgent || ''),
        location: {
          city: session.location?.city || 'Unknown',
          country: session.location?.country || 'Unknown',
          ip: session.ip || '127.0.0.1'
        },
        createdAt: session.createdAt || new Date().toISOString(),
        lastActiveAt: session.lastActiveAt || new Date().toISOString(),
        isCurrent: session.isCurrent || index === 0,
        userAgent: session.userAgent || navigator.userAgent
      }));
      
      setSessions(enhancedSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      setIsRevoking(sessionId);
      await AuthService.revokeSession(sessionId);
      await loadSessions();
      toast.success('Session revoked successfully');
    } catch (error) {
      console.error('Failed to revoke session:', error);
      toast.error('Failed to revoke session');
    } finally {
      setIsRevoking(null);
    }
  };

  const revokeAllOtherSessions = async () => {
    try {
      setIsLoading(true);
      const otherSessions = sessions.filter(s => !s.isCurrent);
      
      await Promise.all(
        otherSessions.map(session => AuthService.revokeSession(session.id))
      );
      
      await loadSessions();
      toast.success(`Revoked ${otherSessions.length} other sessions`);
    } catch (error) {
      console.error('Failed to revoke other sessions:', error);
      toast.error('Failed to revoke other sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceType = (userAgent: string): string => {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      if (/iPad/.test(userAgent)) return 'Tablet';
      return 'Mobile';
    }
    return 'Desktop';
  };

  const getBrowser = (userAgent: string): string => {
    if (/Chrome/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent)) return 'Safari';
    if (/Edge/.test(userAgent)) return 'Edge';
    return 'Unknown';
  };

  const getOS = (userAgent: string): string => {
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iOS/.test(userAgent)) return 'iOS';
    return 'Unknown';
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'Mobile': return Smartphone;
      case 'Tablet': return Tablet;
      default: return Monitor;
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 border-white/10 rounded-xl p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center text-white">
              <Shield className="w-5 h-5 mr-2" />
              Active Sessions
            </CardTitle>
            <CardDescription className="text-gray-400">
              Manage your active login sessions across devices
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadSessions}
              disabled={isLoading}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {sessions.filter(s => !s.isCurrent).length > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={revokeAllOtherSessions}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Revoke Others
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">No active sessions found</p>
            <Button onClick={loadSessions} size="sm">
              Refresh Sessions
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session, index) => {
              const DeviceIcon = getDeviceIcon(session.device);
              
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    session.isCurrent 
                      ? 'bg-blue-500/10 border-blue-500/30' 
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${
                        session.isCurrent ? 'bg-blue-500/20' : 'bg-white/10'
                      }`}>
                        <DeviceIcon className="w-5 h-5 text-white" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-medium">
                            {session.browser} on {session.os}
                          </p>
                          {session.isCurrent && (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-400">
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {session.location.city}, {session.location.country}
                          </div>
                          <div className="flex items-center">
                            <Globe className="w-3 h-3 mr-1" />
                            {session.location.ip}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            Last active: {formatTimeAgo(session.lastActiveAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {!session.isCurrent && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => revokeSession(session.id)}
                        disabled={isRevoking === session.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {isRevoking === session.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {session.isCurrent && (
                    <div className="mt-3 p-2 bg-blue-500/10 rounded border border-blue-500/20">
                      <p className="text-xs text-blue-300 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        This is your current session
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
        
        {/* Security Notice */}
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <p className="text-yellow-300 font-medium text-sm">Security Notice</p>
              <p className="text-yellow-200/80 text-xs mt-1">
                If you see any suspicious sessions, revoke them immediately and change your password.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
