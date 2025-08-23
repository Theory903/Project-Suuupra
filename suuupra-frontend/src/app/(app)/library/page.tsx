'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import { 
  BookOpen,
  Clock,
  Star,
  Download,
  Bookmark,
  TrendingUp,
  Play,
  CheckCircle,
  Calendar,
  Filter,
  Search,
  Grid,
  List,
  ArrowRight,
  Award,
  Eye,
  Heart,
  MoreVertical,
  Trash2,
  Share2,
  Activity
} from 'lucide-react';

export default function LibraryPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTab, setSelectedTab] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  // Mock library data
  const libraryStats = {
    totalCourses: 24,
    completedCourses: 8,
    inProgressCourses: 12,
    bookmarkedItems: 45,
    downloadedContent: 18,
    totalLearningTime: '156h 32m',
    certificatesEarned: 8
  };

  const libraryItems = [
    {
      id: '1',
      type: 'course',
      title: 'Complete React Development Bootcamp',
      instructor: 'Sarah Johnson',
      progress: 85,
      totalLessons: 50,
      completedLessons: 42,
      duration: '40 hours',
      rating: 4.9,
      lastAccessed: '2024-01-20',
      enrolledDate: '2024-01-01',
      category: 'Web Development',
      level: 'Intermediate',
      thumbnail: '/courses/react-bootcamp.jpg',
      isBookmarked: true,
      isDownloaded: true,
      certificate: false,
      status: 'in_progress'
    },
    {
      id: '2',
      type: 'course',
      title: 'Python for Data Science',
      instructor: 'Dr. Michael Chen',
      progress: 100,
      totalLessons: 30,
      completedLessons: 30,
      duration: '35 hours',
      rating: 4.8,
      lastAccessed: '2024-01-18',
      enrolledDate: '2023-12-15',
      category: 'Data Science',
      level: 'Beginner',
      thumbnail: '/courses/python-data-science.jpg',
      isBookmarked: false,
      isDownloaded: true,
      certificate: true,
      status: 'completed'
    },
    {
      id: '3',
      type: 'course',
      title: 'UI/UX Design Fundamentals',
      instructor: 'Emma Wilson',
      progress: 60,
      totalLessons: 25,
      completedLessons: 15,
      duration: '28 hours',
      rating: 4.9,
      lastAccessed: '2024-01-19',
      enrolledDate: '2024-01-10',
      category: 'Design',
      level: 'Beginner',
      thumbnail: '/courses/ux-design.jpg',
      isBookmarked: true,
      isDownloaded: false,
      certificate: false,
      status: 'in_progress'
    },
    {
      id: '4',
      type: 'course',
      title: 'Advanced JavaScript Concepts',
      instructor: 'Alex Rodriguez',
      progress: 0,
      totalLessons: 35,
      completedLessons: 0,
      duration: '45 hours',
      rating: 4.7,
      lastAccessed: null,
      enrolledDate: '2024-01-15',
      category: 'Web Development',
      level: 'Advanced',
      thumbnail: '/courses/js-advanced.jpg',
      isBookmarked: false,
      isDownloaded: false,
      certificate: false,
      status: 'not_started'
    }
  ];

  const recentActivity = [
    {
      id: '1',
      type: 'lesson_completed',
      title: 'Completed "React Hooks Deep Dive"',
      course: 'Complete React Development Bootcamp',
      timestamp: '2024-01-20T14:30:00Z'
    },
    {
      id: '2',
      type: 'course_completed',
      title: 'Completed "Python for Data Science"',
      course: 'Python for Data Science',
      timestamp: '2024-01-18T16:45:00Z'
    },
    {
      id: '3',
      type: 'certificate_earned',
      title: 'Earned certificate for "Python for Data Science"',
      course: 'Python for Data Science',
      timestamp: '2024-01-18T16:50:00Z'
    },
    {
      id: '4',
      type: 'course_bookmarked',
      title: 'Bookmarked "UI/UX Design Fundamentals"',
      course: 'UI/UX Design Fundamentals',
      timestamp: '2024-01-17T10:20:00Z'
    }
  ];

  const filteredItems = libraryItems.filter(item => {
    switch (selectedTab) {
      case 'in_progress':
        return item.status === 'in_progress';
      case 'completed':
        return item.status === 'completed';
      case 'bookmarked':
        return item.isBookmarked;
      case 'downloaded':
        return item.isDownloaded;
      default:
        return true;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>;
      case 'not_started':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Not Started</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Library"
        description="Access your enrolled courses, bookmarks, and downloads"
        action={
          <div className="flex items-center space-x-2">
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="recent">Recently Accessed</option>
              <option value="progress">Progress</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="enrolled">Date Enrolled</option>
            </select>
          </div>
        }
      />

      {/* Library Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{libraryStats.totalCourses}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Courses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{libraryStats.completedCourses}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{libraryStats.totalLearningTime}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Learning Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{libraryStats.certificatesEarned}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/library/progress">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Learning Progress</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Track your course progress</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/library/bookmarks">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <Bookmark className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Bookmarks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{libraryStats.bookmarkedItems} saved items</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/library/downloads">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Downloads</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{libraryStats.downloadedContent} offline items</p>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {[
            { id: 'all', label: 'All Courses', count: libraryItems.length },
            { id: 'in_progress', label: 'In Progress', count: libraryItems.filter(i => i.status === 'in_progress').length },
            { id: 'completed', label: 'Completed', count: libraryItems.filter(i => i.status === 'completed').length },
            { id: 'bookmarked', label: 'Bookmarked', count: libraryItems.filter(i => i.isBookmarked).length },
            { id: 'downloaded', label: 'Downloaded', count: libraryItems.filter(i => i.isDownloaded).length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              <Badge variant="secondary" className="text-xs">
                {tab.count}
              </Badge>
            </button>
          ))}
        </nav>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {viewMode === 'grid' ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 relative rounded-t-lg">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="absolute top-2 right-2 flex space-x-1">
                      {item.isBookmarked && (
                        <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                          <Bookmark className="w-3 h-3 text-white fill-current" />
                        </div>
                      )}
                      {item.isDownloaded && (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                          <Download className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {item.certificate && (
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <Award className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="absolute top-2 left-2">
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">by {item.instructor}</p>
                    </div>
                    
                    {item.progress > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                          <span>{item.completedLessons} of {item.totalLessons} lessons</span>
                          <span>{item.progress}%</span>
                        </div>
                        <Progress value={item.progress} className="h-2" />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                        <span>{item.rating}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span>{item.duration}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Link href={`/learn/courses/${item.id}`} className="flex-1">
                        <Button className="w-full" size="sm">
                          {item.status === 'completed' ? 'Review' : item.status === 'in_progress' ? 'Continue' : 'Start'}
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">by {item.instructor}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(item.status)}
                            <Button variant="outline" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {item.progress > 0 && (
                          <div className="mb-2">
                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                              <span>{item.completedLessons} of {item.totalLessons} lessons</span>
                              <span>{item.progress}%</span>
                            </div>
                            <Progress value={item.progress} className="h-2" />
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                              <span>{item.rating}</span>
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              <span>{item.duration}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {item.category}
                            </Badge>
                            <div className="flex space-x-1">
                              {item.isBookmarked && <Bookmark className="w-4 h-4 text-yellow-500 fill-current" />}
                              {item.isDownloaded && <Download className="w-4 h-4 text-green-500" />}
                              {item.certificate && <Award className="w-4 h-4 text-purple-500" />}
                            </div>
                          </div>
                          
                          <Link href={`/learn/courses/${item.id}`}>
                            <Button size="sm">
                              {item.status === 'completed' ? 'Review' : item.status === 'in_progress' ? 'Continue' : 'Start'}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                      {activity.type === 'lesson_completed' && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      {activity.type === 'course_completed' && <Award className="w-4 h-4 text-green-600 dark:text-green-400" />}
                      {activity.type === 'certificate_earned' && <Award className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                      {activity.type === 'course_bookmarked' && <Bookmark className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Learning Streak */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Learning Streak</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                  15 days
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Keep it up! You're on fire 🔥
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 14 }, (_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-sm ${
                        i < 10 
                          ? 'bg-orange-500' 
                          : i < 12 
                          ? 'bg-orange-300' 
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Search className="w-4 h-4 mr-2" />
                Browse Courses
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Download className="w-4 h-4 mr-2" />
                Manage Downloads
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Award className="w-4 h-4 mr-2" />
                View Certificates
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                Learning Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

