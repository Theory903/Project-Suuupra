'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import {
  PenTool,
  Video,
  Users,
  DollarSign,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Plus,
  BarChart3,
  Calendar,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export default function CreatorDashboardPage() {
  // Mock data - in real app, this would come from API
  const stats = {
    totalContent: 24,
    totalViews: 125430,
    totalEarnings: 8750,
    subscribers: 3420,
  };

  const recentContent = [
    {
      id: '1',
      title: 'Advanced React Patterns',
      type: 'Course',
      status: 'Published',
      views: 1250,
      likes: 89,
      comments: 23,
      earnings: 450,
      publishedAt: '2 days ago',
    },
    {
      id: '2',
      title: 'JavaScript ES2024 Features',
      type: 'Video',
      status: 'Processing',
      views: 0,
      likes: 0,
      comments: 0,
      earnings: 0,
      publishedAt: 'Processing...',
    },
    {
      id: '3',
      title: 'Building Scalable APIs',
      type: 'Course',
      status: 'Draft',
      views: 0,
      likes: 0,
      comments: 0,
      earnings: 0,
      publishedAt: 'Draft',
    },
  ];

  const upcomingStreams = [
    {
      id: '1',
      title: 'Live Coding: React Performance',
      scheduledTime: '2:00 PM Today',
      expectedViewers: 150,
    },
    {
      id: '2',
      title: 'Q&A: Web Development Career',
      scheduledTime: '10:00 AM Tomorrow',
      expectedViewers: 200,
    },
  ];

  const analytics = {
    viewsThisMonth: 15420,
    viewsGrowth: 12.5,
    earningsThisMonth: 1250,
    earningsGrowth: 8.3,
    subscribersGrowth: 15.2,
  };

  return (
    <div>
      <PageHeader
        title="Creator Studio"
        description="Manage your content, track performance, and grow your audience."
        action={{
          label: 'Create Content',
          onClick: () => {},
        }}
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Content</CardTitle>
            <PenTool className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContent}</div>
            <p className="text-xs text-muted-foreground">
              +3 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.viewsGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalEarnings}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.earningsGrowth}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subscribers}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.subscribersGrowth}% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Content</CardTitle>
                  <CardDescription>
                    Your latest published and draft content
                  </CardDescription>
                </div>
                <Link href="/creators/content/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentContent.map((content) => (
                <div key={content.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                    {content.type === 'Course' ? (
                      <PenTool className="h-6 w-6 text-gray-500" />
                    ) : (
                      <Video className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {content.title}
                      </h3>
                      <Badge
                        variant={
                          content.status === 'Published' ? 'default' :
                          content.status === 'Processing' ? 'secondary' : 'outline'
                        }
                      >
                        {content.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {content.type} • {content.publishedAt}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        {content.views.toLocaleString()}
                      </div>
                      <div className="flex items-center">
                        <Heart className="h-4 w-4 mr-1" />
                        {content.likes}
                      </div>
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {content.comments}
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        ${content.earnings}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link href={`/creators/content/${content.id}`}>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </Link>
                    <Button size="sm">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="text-center pt-4">
                <Link href="/creators/content">
                  <Button variant="outline">
                    View All Content
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/creators/content/new">
                <Button className="w-full justify-start">
                  <PenTool className="h-4 w-4 mr-2" />
                  Create Course
                </Button>
              </Link>
              <Link href="/creators/videos/upload">
                <Button variant="outline" className="w-full justify-start">
                  <Video className="h-4 w-4 mr-2" />
                  Upload Video
                </Button>
              </Link>
              <Link href="/creators/live/new">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Stream
                </Button>
              </Link>
              <Link href="/creators/analytics">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Upcoming Streams */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Upcoming Streams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingStreams.map((stream) => (
                <div key={stream.id} className="space-y-2">
                  <h4 className="font-medium text-sm">{stream.title}</h4>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {stream.scheduledTime}
                    </div>
                    <div className="flex items-center">
                      <Users className="h-3 w-3 mr-1" />
                      ~{stream.expectedViewers}
                    </div>
                  </div>
                  <Button size="sm" className="w-full">
                    Manage Stream
                  </Button>
                </div>
              ))}
              <div className="text-center pt-2">
                <Link href="/creators/live">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Streams
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                This Month
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Views</span>
                  <span className="text-sm text-gray-600">
                    {analytics.viewsThisMonth.toLocaleString()}
                  </span>
                </div>
                <Progress value={75} className="h-2" />
                <p className="text-xs text-green-600 mt-1">
                  +{analytics.viewsGrowth}% from last month
                </p>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Earnings</span>
                  <span className="text-sm text-gray-600">
                    ${analytics.earningsThisMonth}
                  </span>
                </div>
                <Progress value={60} className="h-2" />
                <p className="text-xs text-green-600 mt-1">
                  +{analytics.earningsGrowth}% from last month
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">New Subscribers</span>
                  <span className="text-sm text-gray-600">+127</span>
                </div>
                <Progress value={85} className="h-2" />
                <p className="text-xs text-green-600 mt-1">
                  +{analytics.subscribersGrowth}% from last month
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
