'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import {
  Users,
  BookOpen,
  DollarSign,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Server,
  Database,
  Cpu,
  HardDrive,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  // Mock data - in real app, this would come from API
  const stats = {
    totalUsers: 125430,
    activeUsers: 89234,
    totalCourses: 1250,
    pendingContent: 23,
    totalRevenue: 875000,
    monthlyRevenue: 125000,
    systemHealth: 98.5,
  };

  const systemServices = [
    { name: 'API Gateway', status: 'healthy', uptime: '99.9%', responseTime: '45ms' },
    { name: 'Identity Service', status: 'healthy', uptime: '99.8%', responseTime: '32ms' },
    { name: 'Commerce Service', status: 'warning', uptime: '98.5%', responseTime: '120ms' },
    { name: 'Content Service', status: 'healthy', uptime: '99.7%', responseTime: '67ms' },
    { name: 'Payment Service', status: 'healthy', uptime: '99.9%', responseTime: '89ms' },
    { name: 'Analytics Service', status: 'healthy', uptime: '99.6%', responseTime: '156ms' },
  ];

  const recentAlerts = [
    {
      id: '1',
      type: 'warning',
      message: 'High memory usage on Commerce Service',
      time: '5 minutes ago',
      severity: 'medium',
    },
    {
      id: '2',
      type: 'info',
      message: 'Scheduled maintenance completed successfully',
      time: '2 hours ago',
      severity: 'low',
    },
    {
      id: '3',
      type: 'error',
      message: 'Payment webhook timeout (resolved)',
      time: '6 hours ago',
      severity: 'high',
    },
  ];

  const pendingActions = [
    { id: '1', type: 'Content Review', count: 12, priority: 'high' },
    { id: '2', type: 'User Reports', count: 8, priority: 'medium' },
    { id: '3', type: 'Refund Requests', count: 5, priority: 'high' },
    { id: '4', type: 'Creator Applications', count: 15, priority: 'low' },
  ];

  const resourceUsage = {
    cpu: 65,
    memory: 78,
    storage: 45,
    bandwidth: 82,
  };

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Monitor system health, manage users, and oversee platform operations."
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers.toLocaleString()} active this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Content</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCourses}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingContent} pending review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ${stats.monthlyRevenue.toLocaleString()} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.systemHealth}%</div>
            <p className="text-xs text-green-600">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* System Status */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>System Services</CardTitle>
                  <CardDescription>
                    Real-time status of all microservices
                  </CardDescription>
                </div>
                <Link href="/admin/system">
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {systemServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {service.status === 'healthy' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : service.status === 'warning' ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <Badge
                        variant={
                          service.status === 'healthy' ? 'default' :
                          service.status === 'warning' ? 'secondary' : 'destructive'
                        }
                      >
                        {service.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Uptime: {service.uptime}</span>
                      <span>Response: {service.responseTime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resource Usage */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Resource Usage</CardTitle>
              <CardDescription>Current system resource utilization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <Cpu className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{resourceUsage.cpu}%</div>
                  <div className="text-sm text-gray-600">CPU</div>
                  <Progress value={resourceUsage.cpu} className="mt-2" />
                </div>
                <div className="text-center">
                  <Server className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{resourceUsage.memory}%</div>
                  <div className="text-sm text-gray-600">Memory</div>
                  <Progress value={resourceUsage.memory} className="mt-2" />
                </div>
                <div className="text-center">
                  <HardDrive className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold">{resourceUsage.storage}%</div>
                  <div className="text-sm text-gray-600">Storage</div>
                  <Progress value={resourceUsage.storage} className="mt-2" />
                </div>
                <div className="text-center">
                  <Database className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold">{resourceUsage.bandwidth}%</div>
                  <div className="text-sm text-gray-600">Bandwidth</div>
                  <Progress value={resourceUsage.bandwidth} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentAlerts.map((alert) => (
                <div key={alert.id} className="space-y-2">
                  <div className="flex items-start space-x-2">
                    {alert.type === 'error' ? (
                      <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    ) : alert.type === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500">{alert.time}</span>
                        <Badge
                          variant={
                            alert.severity === 'high' ? 'destructive' :
                            alert.severity === 'medium' ? 'secondary' : 'outline'
                          }
                          className="text-xs"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" className="w-full">
                  View All Alerts
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pending Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Pending Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingActions.map((action) => (
                <div key={action.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">{action.type}</p>
                    <p className="text-xs text-gray-500">{action.count} items</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        action.priority === 'high' ? 'destructive' :
                        action.priority === 'medium' ? 'secondary' : 'outline'
                      }
                      className="text-xs"
                    >
                      {action.priority}
                    </Badge>
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/users">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </Link>
              <Link href="/admin/content">
                <Button variant="outline" className="w-full justify-start">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Review Content
                </Button>
              </Link>
              <Link href="/admin/financial">
                <Button variant="outline" className="w-full justify-start">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Financial Reports
                </Button>
              </Link>
              <Link href="/admin/system">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="h-4 w-4 mr-2" />
                  System Monitor
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

