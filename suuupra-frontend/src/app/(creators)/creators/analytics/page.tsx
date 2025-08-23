'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { 
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  BookOpen,
  Eye,
  Star,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Award,
  Clock
} from 'lucide-react';

export default function CreatorAnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');

  const overallStats = [
    { 
      label: 'Total Revenue', 
      value: '$12,847', 
      change: '+12.5%', 
      trend: 'up',
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400'
    },
    { 
      label: 'Active Students', 
      value: '2,847', 
      change: '+8.2%', 
      trend: 'up',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400'
    },
    { 
      label: 'Course Views', 
      value: '18,429', 
      change: '+15.3%', 
      trend: 'up',
      icon: Eye,
      color: 'text-purple-600 dark:text-purple-400'
    },
    { 
      label: 'Avg Rating', 
      value: '4.8', 
      change: '+0.2', 
      trend: 'up',
      icon: Star,
      color: 'text-yellow-600 dark:text-yellow-400'
    }
  ];

  const coursePerformance = [
    {
      id: '1',
      title: 'Complete React Development Bootcamp',
      students: 1247,
      revenue: 8934,
      rating: 4.9,
      completion: 78,
      views: 12847,
      trend: 'up'
    },
    {
      id: '2',
      title: 'Advanced JavaScript Concepts',
      students: 892,
      revenue: 2156,
      rating: 4.7,
      completion: 85,
      views: 8934,
      trend: 'up'
    },
    {
      id: '3',
      title: 'Node.js Backend Development',
      students: 634,
      revenue: 1567,
      rating: 4.6,
      completion: 72,
      views: 5678,
      trend: 'down'
    },
    {
      id: '4',
      title: 'UI/UX Design Fundamentals',
      students: 456,
      revenue: 890,
      rating: 4.8,
      completion: 91,
      views: 3456,
      trend: 'up'
    }
  ];

  const revenueData = [
    { month: 'Jan', revenue: 2400, students: 240 },
    { month: 'Feb', revenue: 3200, students: 320 },
    { month: 'Mar', revenue: 2800, students: 280 },
    { month: 'Apr', revenue: 4100, students: 410 },
    { month: 'May', revenue: 3600, students: 360 },
    { month: 'Jun', revenue: 4800, students: 480 }
  ];

  const topCountries = [
    { country: 'United States', students: 847, percentage: 29.8 },
    { country: 'India', students: 623, percentage: 21.9 },
    { country: 'United Kingdom', students: 412, percentage: 14.5 },
    { country: 'Canada', students: 298, percentage: 10.5 },
    { country: 'Germany', students: 234, percentage: 8.2 },
    { country: 'Others', students: 433, percentage: 15.1 }
  ];

  const engagementMetrics = [
    { metric: 'Avg. Watch Time', value: '12m 34s', change: '+2m 15s', trend: 'up' },
    { metric: 'Completion Rate', value: '78.5%', change: '+5.2%', trend: 'up' },
    { metric: 'Discussion Posts', value: '1,247', change: '+18.3%', trend: 'up' },
    { metric: 'Q&A Responses', value: '892', change: '-3.1%', trend: 'down' }
  ];

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (trend: string) => {
    return trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Creator Analytics"
        description="Track your content performance and student engagement"
        action={
          <div className="flex items-center space-x-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        }
      />

      {/* Overall Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {overallStats.map((stat, index) => {
          const TrendIcon = getTrendIcon(stat.trend);
          return (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <div className={`flex items-center text-sm ${getTrendColor(stat.trend)}`}>
                      <TrendIcon className="w-4 h-4 mr-1" />
                      <span>{stat.change}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Revenue & Student Growth</span>
          </CardTitle>
          <CardDescription>
            Monthly revenue and new student acquisitions over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Revenue chart visualization would be here</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Integration with charting library (Chart.js, Recharts, etc.)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Course Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5" />
            <span>Course Performance</span>
          </CardTitle>
          <CardDescription>
            Detailed performance metrics for each of your courses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {coursePerformance.map((course) => {
              const TrendIcon = getTrendIcon(course.trend);
              return (
                <div key={course.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{course.title}</h3>
                    <div className={`flex items-center ${getTrendColor(course.trend)}`}>
                      <TrendIcon className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Students</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{course.students.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Revenue</p>
                      <p className="font-semibold text-gray-900 dark:text-white">${course.revenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Rating</p>
                      <p className="font-semibold text-gray-900 dark:text-white flex items-center">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                        {course.rating}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Completion</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{course.completion}%</p>
                    </div>
                    <div>
                      <p className="text-gray-600 dark:text-gray-400">Views</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{course.views.toLocaleString()}</p>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-2" />
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Student Geography */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>Student Geography</span>
            </CardTitle>
            <CardDescription>
              Where your students are located
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCountries.map((country, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{country.country}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">{country.students}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{country.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Engagement Metrics</span>
            </CardTitle>
            <CardDescription>
              How students interact with your content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {engagementMetrics.map((metric, index) => {
                const TrendIcon = getTrendIcon(metric.trend);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{metric.metric}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
                    </div>
                    <div className={`flex items-center text-sm ${getTrendColor(metric.trend)}`}>
                      <TrendIcon className="w-4 h-4 mr-1" />
                      <span>{metric.change}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals and Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Goals & Achievements</span>
          </CardTitle>
          <CardDescription>
            Track your progress towards creator milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">5K Students</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">2,847 / 5,000</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '57%' }} />
              </div>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">$15K Revenue</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">$12,847 / $15,000</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '86%' }} />
              </div>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Award className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Top Rated</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">4.8 / 5.0 rating</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '96%' }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to help you improve your content performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button variant="outline" className="justify-start">
              <Filter className="w-4 h-4 mr-2" />
              Custom Report
            </Button>
            <Button variant="outline" className="justify-start">
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Report
            </Button>
            <Button variant="outline" className="justify-start">
              <Target className="w-4 h-4 mr-2" />
              Set Goals
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
