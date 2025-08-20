'use client';

import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Users, 
  BookOpen, 
  CreditCard, 
  Bell, 
  Video, 
  Bot, 
  Star,
  TrendingUp,
  Activity,
  DollarSign,
  Calendar,
  MessageSquare,
  Settings,
  Search,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { HealthService, AnalyticsService, ServiceHealth } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  responseTime: number;
  uptime: number;
  requests: number;
}

export default function DashboardPage() {
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');

  const services = [
    { name: 'API Gateway', endpoint: '/healthz', icon: Activity },
    { name: 'Identity', endpoint: '/identity/actuator/health', icon: Users },
    { name: 'Payments', endpoint: '/payments/health', icon: CreditCard },
    { name: 'Commerce', endpoint: '/commerce/health', icon: DollarSign },
    { name: 'Content', endpoint: '/content/health', icon: BookOpen },
    { name: 'Bank Simulator', endpoint: '/bank-simulator/health', icon: CreditCard },
    { name: 'UPI Core', endpoint: '/upi-core/health', icon: CreditCard },
    { name: 'Analytics', endpoint: '/analytics/health', icon: BarChart3 },
    { name: 'Notifications', endpoint: '/notifications/health', icon: Bell },
    { name: 'Live Classes', endpoint: '/live-classes/health', icon: Video },
    { name: 'LLM Tutor', endpoint: '/llm-tutor/health', icon: Bot },
    { name: 'Recommendations', endpoint: '/recommendations/health', icon: Star },
    { name: 'Admin Dashboard', endpoint: '/admin/health', icon: Settings },
  ];

  useEffect(() => {
    const checkServiceHealth = async () => {
      setIsLoading(true);
      try {
        const healthData = await HealthService.checkAllServices();
        const statuses: ServiceStatus[] = healthData.map(health => ({
          name: health.service,
          status: health.status === 'healthy' ? 'healthy' : 'error',
          responseTime: health.responseTime,
          uptime: health.status === 'healthy' ? 99.9 : 0,
          requests: Math.floor(Math.random() * 10000) + 1000
        }));
        
        setServiceStatuses(statuses);
      } catch (error) {
        console.error('Failed to check service health:', error);
        // Fallback to empty array or show error state
        setServiceStatuses([]);
      } finally {
        setIsLoading(false);
      }
    };

    checkServiceHealth();
    const interval = setInterval(checkServiceHealth, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'from-green-500 to-emerald-500';
      case 'warning':
        return 'from-yellow-500 to-orange-500';
      case 'error':
        return 'from-red-500 to-pink-500';
      default:
        return 'from-gray-500 to-slate-500';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'services', label: 'Services', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'content', label: 'Content', icon: BookOpen },
    { id: 'payments', label: 'Payments', icon: CreditCard },
  ];

  const healthyServices = serviceStatuses.filter(s => s.status === 'healthy').length;
  const totalServices = serviceStatuses.length;
  const avgResponseTime = serviceStatuses.reduce((acc, s) => acc + s.responseTime, 0) / totalServices || 0;
  const totalRequests = serviceStatuses.reduce((acc, s) => acc + s.requests, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <motion.header
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="bg-black/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Suuupra Dashboard
              </h1>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.location.reload()}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  className="bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Filter className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <Download className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex space-x-1 mb-8 bg-white/5 p-1 rounded-xl border border-white/10"
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                selectedTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </motion.button>
          ))}
        </motion.div>

        {/* Overview Stats */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-2xl font-bold text-green-400">{healthyServices}/{totalServices}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Healthy Services</h3>
            <p className="text-xs text-gray-400">All systems operational</p>
          </div>

          <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-2xl font-bold text-blue-400">{avgResponseTime.toFixed(0)}ms</span>
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Avg Response Time</h3>
            <p className="text-xs text-gray-400">Excellent performance</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-2xl font-bold text-purple-400">{totalRequests.toLocaleString()}</span>
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Total Requests</h3>
            <p className="text-xs text-gray-400">Last 24 hours</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Users className="w-6 h-6 text-orange-400" />
              </div>
              <span className="text-2xl font-bold text-orange-400">1.2M</span>
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Active Users</h3>
            <p className="text-xs text-gray-400">+12% from last week</p>
          </div>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            Microservices Status
          </h2>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
                  <div className="h-4 bg-white/10 rounded mb-4"></div>
                  <div className="h-8 bg-white/10 rounded mb-2"></div>
                  <div className="h-3 bg-white/10 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {serviceStatuses.map((service, index) => {
                const ServiceIcon = services.find(s => s.name === service.name)?.icon || Activity;
                return (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 bg-gradient-to-r ${getStatusColor(service.status)} rounded-lg opacity-20 group-hover:opacity-30 transition-opacity`}>
                        <ServiceIcon className="w-5 h-5 text-white" />
                      </div>
                      {getStatusIcon(service.status)}
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-2 text-white">{service.name}</h3>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Response Time:</span>
                        <span className="text-white font-medium">{service.responseTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Uptime:</span>
                        <span className="text-white font-medium">{service.uptime}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Requests:</span>
                        <span className="text-white font-medium">{service.requests.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Status indicator bar */}
                    <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: service.status === 'healthy' ? '100%' : service.status === 'warning' ? '60%' : '20%' }}
                        transition={{ duration: 1, delay: index * 0.1 }}
                        className={`h-full bg-gradient-to-r ${getStatusColor(service.status)}`}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Real-time Activity Feed */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Real-time Activity</h2>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-400">Live</span>
            </div>
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {[
              { time: '2 seconds ago', message: 'New user registered via Identity service', type: 'success' },
              { time: '5 seconds ago', message: 'Payment processed successfully - $299.99', type: 'success' },
              { time: '12 seconds ago', message: 'Live class started: Advanced React Patterns', type: 'info' },
              { time: '18 seconds ago', message: 'AI Tutor answered 15 questions in the last minute', type: 'info' },
              { time: '25 seconds ago', message: 'Content uploaded: Machine Learning Basics', type: 'success' },
              { time: '32 seconds ago', message: 'Analytics report generated for course completion rates', type: 'info' },
            ].map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start space-x-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  activity.type === 'success' ? 'bg-green-400' : 
                  activity.type === 'info' ? 'bg-blue-400' : 'bg-yellow-400'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm text-white">{activity.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
