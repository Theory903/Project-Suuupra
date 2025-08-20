'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, Shield, Zap, 
  User, AlertCircle, CheckCircle, Info, RefreshCw, LogOut,
  Smartphone, Key, Clock, Settings
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthService, handleApiError } from '@/lib/api';
import { toast } from 'sonner';

interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

interface UserSession {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
}

export default function ComprehensiveAuthPage() {
  // Form state
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'profile'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation state
  const [emailError, setEmailError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({ score: 0, feedback: [], isValid: false });
  const [passwordMatch, setPasswordMatch] = useState(true);
  
  // User state
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (password) {
      validatePassword();
    } else {
      setPasswordStrength({ score: 0, feedback: [], isValid: false });
    }
  }, [password]);

  useEffect(() => {
    if (activeTab === 'register') {
      setPasswordMatch(password === confirmPassword || confirmPassword === '');
    }
  }, [password, confirmPassword, activeTab]);

  const checkAuthStatus = async () => {
    try {
      if (AuthService.isAuthenticated()) {
        const userData = await AuthService.getCurrentUser();
        setUser(userData);
        setIsAuthenticated(true);
        setActiveTab('profile');
        await loadUserSessions();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const loadUserSessions = async () => {
    try {
      const sessionData = await AuthService.getSessions();
      setSessions(sessionData || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    setEmailError(isValid ? '' : 'Please enter a valid email address');
    return isValid;
  };

  const validatePassword = async () => {
    if (!password) return;
    try {
      const strength = await AuthService.validatePasswordStrength(password);
      setPasswordStrength(strength);
    } catch (error) {
      console.error('Password validation failed:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) return;
    
    setIsLoading(true);
    try {
      const result = await AuthService.login(email, password, rememberMe);
      setUser(result.user);
      setIsAuthenticated(true);
      
      toast.success(`Welcome back, ${result.user.name || result.user.email}!`);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      const apiError = handleApiError(error);
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) return;
    
    if (!passwordStrength.isValid) {
      toast.error('Please create a stronger password');
      return;
    }
    
    if (!passwordMatch) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await AuthService.register({ email, password, name });
      setUser(result.user);
      setIsAuthenticated(true);
      
      toast.success(`Welcome to Suuupra, ${name}! Account created successfully.`);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } catch (error) {
      const apiError = handleApiError(error);
      toast.error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await AuthService.logout();
      setUser(null);
      setIsAuthenticated(false);
      setSessions([]);
      setActiveTab('login');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Logout failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await AuthService.revokeSession(sessionId);
      await loadUserSessions();
      toast.success('Session revoked successfully');
    } catch (error) {
      console.error('Session revoke failed:', error);
      toast.error('Failed to revoke session');
    }
  };

  const getPasswordStrengthColor = (score: number): string => {
    if (score < 2) return 'bg-red-500';
    if (score < 3) return 'bg-orange-500';
    if (score < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthLabel = (score: number): string => {
    if (score < 2) return 'Weak';
    if (score < 3) return 'Fair';
    if (score < 4) return 'Good';
    return 'Strong';
  };

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="container mx-auto px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Welcome back, {user.name || user.email}!
                </h1>
                <p className="text-gray-400 mt-2">Manage your account and security settings</p>
              </div>
              <Button
                onClick={handleLogout}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* User Profile Card */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <User className="w-5 h-5 mr-2" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">User ID</label>
                    <p className="text-white font-mono text-sm">{user.id}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Email</label>
                    <p className="text-white">{user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Roles</label>
                    <div className="flex gap-2 mt-1">
                      {user.roles?.map((role: string) => (
                        <Badge key={role} className="bg-blue-600">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Sessions */}
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Active Sessions
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadUserSessions}
                      className="ml-auto"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions.length > 0 ? (
                    <div className="space-y-3">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                          <div>
                            <p className="text-white text-sm">{session.device}</p>
                            <p className="text-gray-400 text-xs">{session.location} • {session.lastActive}</p>
                          </div>
                          {!session.current && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevokeSession(session.id)}
                            >
                              Revoke
                            </Button>
                          )}
                          {session.current && (
                            <Badge className="bg-green-600">Current</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2" />
                      <p>No active sessions found</p>
                      <Button onClick={loadUserSessions} className="mt-4">
                        Refresh Sessions
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button className="bg-purple-600 hover:bg-purple-700 h-16 flex-col">
                <Key className="w-5 h-5 mb-2" />
                Setup MFA
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 h-16 flex-col">
                <Shield className="w-5 h-5 mb-2" />
                Passkeys
              </Button>
              <Button className="bg-cyan-600 hover:bg-cyan-700 h-16 flex-col">
                <Settings className="w-5 h-5 mb-2" />
                Settings
              </Button>
              <Button
                onClick={() => router.push('/dashboard')}
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-16 flex-col"
              >
                <ArrowRight className="w-5 h-5 mb-2" />
                Dashboard
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* Left Side - Authentication Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-4"
            >
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Suuupra
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Badge className="bg-white/10 backdrop-blur-md border-white/20 text-white mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                Next-Gen EdTech Platform
              </Badge>
              <h1 className="text-2xl font-bold mb-2">
                {activeTab === 'login' ? 'Welcome Back' : 'Join Suuupra'}
              </h1>
              <p className="text-gray-400">
                {activeTab === 'login' 
                  ? 'Sign in to continue your learning journey' 
                  : 'Create your account and start learning'}
              </p>
            </motion.div>
          </div>

          {/* Auth Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-white/5 backdrop-blur-md border-white/10">
              <CardHeader>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                  <TabsList className="grid w-full grid-cols-2 bg-white/10">
                    <TabsTrigger value="login" className="text-white data-[state=active]:bg-blue-600">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="register" className="text-white data-[state=active]:bg-purple-600">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              
              <CardContent>
                <AnimatePresence mode="wait">
                  {activeTab === 'login' && (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onSubmit={handleLogin}
                      className="space-y-4"
                    >
                      {/* Email Field */}
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-gray-300">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => validateEmail(email)}
                            placeholder="Enter your email"
                            className={`pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 ${
                              emailError ? 'border-red-500' : ''
                            }`}
                            required
                          />
                          {emailError && (
                            <p className="text-red-400 text-xs mt-1 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {emailError}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Password Field */}
                      <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium text-gray-300">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Remember Me */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="rememberMe"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label htmlFor="rememberMe" className="text-sm text-gray-300">
                          Remember me for 30 days
                        </label>
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={isLoading || !!emailError}
                        className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-6 rounded-lg transition-all duration-300"
                      >
                        {isLoading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Signing In...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            Sign In
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </div>
                        )}
                      </Button>

                      {/* Forgot Password */}
                      <div className="text-center">
                        <Link
                          href="/forgot-password"
                          className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                          Forgot your password?
                        </Link>
                      </div>
                    </motion.form>
                  )}

                  {activeTab === 'register' && (
                    <motion.form
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onSubmit={handleRegister}
                      className="space-y-4"
                    >
                      {/* Name Field */}
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium text-gray-300">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your full name"
                            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-400"
                            required
                          />
                        </div>
                      </div>

                      {/* Email Field */}
                      <div className="space-y-2">
                        <label htmlFor="reg-email" className="text-sm font-medium text-gray-300">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="reg-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => validateEmail(email)}
                            placeholder="Enter your email"
                            className={`pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-400 ${
                              emailError ? 'border-red-500' : ''
                            }`}
                            required
                          />
                          {emailError && (
                            <p className="text-red-400 text-xs mt-1 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {emailError}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Password Field with Strength Indicator */}
                      <div className="space-y-2">
                        <label htmlFor="reg-password" className="text-sm font-medium text-gray-300">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="reg-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a strong password"
                            className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-400"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        {/* Password Strength Indicator */}
                        {password && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-400">Password Strength</span>
                              <span className={`text-xs font-medium ${
                                passwordStrength.score < 2 ? 'text-red-400' :
                                passwordStrength.score < 3 ? 'text-orange-400' :
                                passwordStrength.score < 4 ? 'text-yellow-400' : 'text-green-400'
                              }`}>
                                {getPasswordStrengthLabel(passwordStrength.score)}
                              </span>
                            </div>
                            <Progress 
                              value={(passwordStrength.score / 5) * 100} 
                              className="h-2"
                            />
                            {passwordStrength.feedback.length > 0 && (
                              <ul className="text-xs text-gray-400 space-y-1">
                                {passwordStrength.feedback.map((feedback, index) => (
                                  <li key={index} className="flex items-center">
                                    <Info className="w-3 h-3 mr-1" />
                                    {feedback}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Confirm Password Field */}
                      <div className="space-y-2">
                        <label htmlFor="confirm-password" className="text-sm font-medium text-gray-300">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm your password"
                            className={`pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:border-purple-400 ${
                              !passwordMatch ? 'border-red-500' : ''
                            }`}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {!passwordMatch && confirmPassword && (
                          <p className="text-red-400 text-xs flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Passwords do not match
                          </p>
                        )}
                        {passwordMatch && confirmPassword && (
                          <p className="text-green-400 text-xs flex items-center">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Passwords match
                          </p>
                        )}
                      </div>

                      {/* Submit Button */}
                      <Button
                        type="submit"
                        disabled={isLoading || !!emailError || !passwordStrength.isValid || !passwordMatch || !name.trim()}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold py-6 rounded-lg transition-all duration-300"
                      >
                        {isLoading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating Account...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            Create Account
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </div>
                        )}
                      </Button>

                      {/* Terms */}
                      <p className="text-xs text-gray-400 text-center">
                        By creating an account, you agree to our{' '}
                        <Link href="/terms" className="text-blue-400 hover:text-blue-300">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="/privacy" className="text-blue-400 hover:text-blue-300">
                          Privacy Policy
                        </Link>
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Right Side - Features & Stats */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-r from-cyan-500/20 to-pink-500/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center p-12">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-12"
          >
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
              Transform Your Learning Experience
            </h2>
            <p className="text-xl text-gray-300 leading-relaxed">
              Join our comprehensive EdTech platform powered by cutting-edge microservices architecture, 
              AI-driven personalization, and industry-leading security.
            </p>
          </motion.div>

          {/* Security Features */}
          <div className="space-y-6">
            {[
              {
                icon: Shield,
                title: 'Enterprise Security',
                description: 'Advanced encryption, MFA, and OAuth2/OIDC standards'
              },
              {
                icon: Zap,
                title: 'Lightning Performance',
                description: 'Optimized APIs with < 3ms response times'
              },
              {
                icon: Sparkles,
                title: 'AI-Powered Learning',
                description: 'Personalized education with advanced AI tutoring'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex items-start space-x-4"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Platform Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-12 p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-white">Platform Stats</h4>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Live
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">1M+</div>
                <div className="text-sm text-gray-400">Active Users</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">99.9%</div>
                <div className="text-sm text-gray-400">Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-cyan-400">13</div>
                <div className="text-sm text-gray-400">Microservices</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pink-400">&lt;3ms</div>
                <div className="text-sm text-gray-400">Response Time</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
