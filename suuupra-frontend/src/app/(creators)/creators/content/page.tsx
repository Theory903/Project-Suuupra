'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Search, 
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  BookOpen,
  Video,
  FileText,
  Users,
  TrendingUp,
  Calendar,
  Star,
  Download,
  Upload,
  Copy,
  Settings
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  type: 'course' | 'lesson' | 'article' | 'quiz';
  status: 'draft' | 'published' | 'archived';
  students: number;
  rating: number;
  revenue: number;
  lastModified: string;
  thumbnail?: string;
}

export default function CreatorContentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const contentItems: ContentItem[] = [
    {
      id: '1',
      title: 'Complete React Development Bootcamp',
      type: 'course',
      status: 'published',
      students: 12543,
      rating: 4.9,
      revenue: 89567,
      lastModified: '2024-01-15'
    },
    {
      id: '2',
      title: 'Advanced React Hooks',
      type: 'lesson',
      status: 'published',
      students: 8932,
      rating: 4.8,
      revenue: 0,
      lastModified: '2024-01-12'
    },
    {
      id: '3',
      title: 'State Management Best Practices',
      type: 'article',
      status: 'draft',
      students: 0,
      rating: 0,
      revenue: 0,
      lastModified: '2024-01-10'
    },
    {
      id: '4',
      title: 'React Performance Quiz',
      type: 'quiz',
      status: 'published',
      students: 5674,
      rating: 4.7,
      revenue: 0,
      lastModified: '2024-01-08'
    },
    {
      id: '5',
      title: 'Next.js Fundamentals',
      type: 'course',
      status: 'draft',
      students: 0,
      rating: 0,
      revenue: 0,
      lastModified: '2024-01-05'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Published</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Draft</Badge>;
      case 'archived':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'course': return BookOpen;
      case 'lesson': return Video;
      case 'article': return FileText;
      case 'quiz': return Settings;
      default: return BookOpen;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'course': return 'text-blue-600 dark:text-blue-400';
      case 'lesson': return 'text-purple-600 dark:text-purple-400';
      case 'article': return 'text-green-600 dark:text-green-400';
      case 'quiz': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredContent = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = [
    { label: 'Total Content', value: contentItems.length.toString(), icon: BookOpen },
    { label: 'Published', value: contentItems.filter(item => item.status === 'published').length.toString(), icon: Eye },
    { label: 'Total Students', value: contentItems.reduce((sum, item) => sum + item.students, 0).toLocaleString(), icon: Users },
    { label: 'Total Revenue', value: `$${contentItems.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}`, icon: TrendingUp }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Content Management"
        description="Create, edit, and manage your courses and content"
        action={
          <Link href="/creators/content/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Content
            </Button>
          </Link>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="course">Courses</option>
                <option value="lesson">Lessons</option>
                <option value="article">Articles</option>
                <option value="quiz">Quizzes</option>
              </select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content List */}
      <div className="space-y-4">
        {filteredContent.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No content found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Start creating your first course or content'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                <Link href="/creators/content/new">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Content
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredContent.map((item) => {
            const TypeIcon = getTypeIcon(item.type);
            return (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center`}>
                        <TypeIcon className={`w-6 h-6 ${getTypeColor(item.type)}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </h3>
                          {getStatusBadge(item.status)}
                          <Badge variant="secondary" className="capitalize">
                            {item.type}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            {item.students.toLocaleString()} students
                          </span>
                          {item.rating > 0 && (
                            <span className="flex items-center">
                              <Star className="w-4 h-4 mr-1 fill-yellow-400 text-yellow-400" />
                              {item.rating}
                            </span>
                          )}
                          {item.revenue > 0 && (
                            <span className="flex items-center">
                              <TrendingUp className="w-4 h-4 mr-1" />
                              ${item.revenue.toLocaleString()} revenue
                            </span>
                          )}
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Modified {new Date(item.lastModified).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {item.status === 'published' && (
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      )}
                      <Link href={`/creators/content/${item.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </Button>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to help you manage your content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/creators/content/new?type=course">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="w-4 h-4 mr-2" />
                New Course
              </Button>
            </Link>
            <Link href="/creators/content/new?type=lesson">
              <Button variant="outline" className="w-full justify-start">
                <Video className="w-4 h-4 mr-2" />
                New Lesson
              </Button>
            </Link>
            <Link href="/creators/videos/upload">
              <Button variant="outline" className="w-full justify-start">
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </Button>
            </Link>
            <Link href="/creators/analytics">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                View Analytics
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Content Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Content Templates</CardTitle>
          <CardDescription>
            Get started quickly with pre-built templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Programming Course</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Complete course structure for programming topics</p>
            </div>
            
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-3">
                <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Video Tutorial</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Step-by-step video lesson template</p>
            </div>
            
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Article Series</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Multi-part article template with exercises</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
