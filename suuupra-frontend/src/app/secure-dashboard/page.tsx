'use client';

import { motion } from 'framer-motion';
import { 
  Shield, Users, BookOpen, CreditCard, BarChart3, 
  Settings, Bell, LogOut, Crown, Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth, withAuth } from '@/contexts/AuthContext';
import SessionManager from '@/components/SessionManager';

function SecureDashboard() {
  const { user, logout, hasRole } = useAuth();

  const dashboardStats = [
    { label: 'Courses Enrolled', value: '12', icon: BookOpen, color: 'from-blue-500 to-cyan-500' },
    { label: 'Hours Learned', value: '247', icon: BarChart3, color: 'from-purple-500 to-pink-500' },
    { label: 'Certificates', value: '8', icon: Crown, color: 'from-yellow-500 to-orange-500' },
    { label: 'Active Sessions', value: '3', icon: Shield, color: 'from-green-500 to-emerald-500' },
  ];

  const quickActions = [
    { label: 'Account Settings', icon: Settings, href: '/settings' },
    { label: 'Notifications', icon: Bell, href: '/notifications' },
    { label: 'Security', icon: Key, href: '/security' },
    { label: 'Billing', icon: CreditCard, href: '/billing' },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Welcome back, {user?.name || user?.email}!
            </h1>
            <p className="text-gray-400 mt-2">Here&apos;s what&apos;s happening with your learning journey</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Account Active
              </Badge>
              {user?.roles?.map((role) => (
                <Badge key={role} className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">User ID</p>
              <p className="text-xs font-mono text-gray-300">{user?.id}</p>
            </div>
            <Button
              onClick={logout}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {dashboardStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <Card className="bg-white/5 border-white/10 hover:border-white/20 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">{stat.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-lg bg-gradient-to-r ${stat.color}`}>
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Session Manager - Full Width on Large Screens */}
          <div className="lg:col-span-2">
            <SessionManager />
          </div>
          
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your account and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {quickActions.map((action, index) => (
                    <motion.div
                      key={action.label}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                    >
                      <Button
                        className="w-full justify-start bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white"
                        asChild
                      >
                        <a href={action.href}>
                          <action.icon className="w-4 h-4 mr-3" />
                          {action.label}
                        </a>
                      </Button>
                    </motion.div>
                  ))}
                </div>
                
                {/* Admin Actions */}
                {hasRole('ADMIN') && (
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-medium text-yellow-400 mb-3 flex items-center">
                      <Crown className="w-4 h-4 mr-2" />
                      Admin Actions
                    </h4>
                    <div className="space-y-2">
                      <Button
                        className="w-full justify-start bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-300"
                        size="sm"
                      >
                        <Users className="w-4 h-4 mr-3" />
                        Manage Users
                      </Button>
                      <Button
                        className="w-full justify-start bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300"
                        size="sm"
                      >
                        <Shield className="w-4 h-4 mr-3" />
                        Security Settings
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* API Testing Section (Development) */}
        {process.env.NODE_ENV === 'development' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <Card className="bg-purple-500/10 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-purple-300">Development Tools</CardTitle>
                <CardDescription className="text-purple-200/70">
                  Test Identity service APIs and authentication flows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    onClick={async () => {
                      try {
                        const result = await AuthService.introspectToken();
                        console.log('Token introspection:', result);
                        alert(`Token Active: ${result.active}\nSubject: ${result.sub}`);
                      } catch (error) {
                        console.error('Introspection failed:', error);
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Test Token Introspection
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      try {
                        await AuthService.refreshToken();
                        alert('Token refreshed successfully!');
                      } catch (error) {
                        console.error('Token refresh failed:', error);
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Test Token Refresh
                  </Button>
                  
                  <Button
                    onClick={async () => {
                      try {
                        await AuthService.revokeCurrentToken();
                        alert('Current token revoked! You will be logged out.');
                        await logout();
                      } catch (error) {
                        console.error('Token revocation failed:', error);
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Revoke Current Token
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Export with authentication protection
export default withAuth(SecureDashboard);
