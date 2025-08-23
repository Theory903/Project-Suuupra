'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Search, 
  BookOpen, 
  Video, 
  Clock, 
  Star,
  TrendingUp,
  Award,
  Play,
  Users,
  Filter,
  ArrowRight,
  Bookmark,
  Download,
  CheckCircle
} from 'lucide-react';

export default function LearnPage() {
  const categories = [
    { name: 'Web Development', count: 245, color: 'from-blue-500 to-cyan-500', icon: '💻' },
    { name: 'Data Science', count: 189, color: 'from-purple-500 to-pink-500', icon: '📊' },
    { name: 'Design', count: 156, color: 'from-green-500 to-emerald-500', icon: '🎨' },
    { name: 'Business', count: 134, color: 'from-orange-500 to-red-500', icon: '💼' },
    { name: 'AI & ML', count: 98, color: 'from-indigo-500 to-purple-500', icon: '🤖' },
    { name: 'Mobile Dev', count: 87, color: 'from-pink-500 to-rose-500', icon: '📱' },
  ];

  const recentCourses = [
    {
      id: '1',
      title: 'Advanced React Patterns',
      instructor: 'Sarah Johnson',
      progress: 65,
      totalLessons: 24,
      completedLessons: 16,
      duration: '8h 30m',
      lastAccessed: '2 hours ago',
      thumbnail: '/courses/react-advanced.jpg'
    },
    {
      id: '2',
      title: 'Python for Data Science',
      instructor: 'Dr. Michael Chen',
      progress: 30,
      totalLessons: 32,
      completedLessons: 10,
      duration: '12h 45m',
      lastAccessed: '1 day ago',
      thumbnail: '/courses/python-ds.jpg'
    },
    {
      id: '3',
      title: 'UI/UX Design Fundamentals',
      instructor: 'Emma Wilson',
      progress: 85,
      totalLessons: 18,
      completedLessons: 15,
      duration: '6h 20m',
      lastAccessed: '3 days ago',
      thumbnail: '/courses/ux-design.jpg'
    }
  ];

  const recommendedCourses = [
    {
      id: '4',
      title: 'Full-Stack JavaScript',
      instructor: 'Alex Rodriguez',
      rating: 4.9,
      students: 15672,
      duration: '25h 30m',
      level: 'Intermediate',
      price: 89,
      originalPrice: 129,
      tags: ['JavaScript', 'Node.js', 'React']
    },
    {
      id: '5',
      title: 'Machine Learning Basics',
      instructor: 'Dr. Lisa Zhang',
      rating: 4.8,
      students: 12543,
      duration: '18h 45m',
      level: 'Beginner',
      price: 79,
      originalPrice: 119,
      tags: ['Python', 'ML', 'TensorFlow']
    },
    {
      id: '6',
      title: 'Advanced CSS & Animations',
      instructor: 'David Kim',
      rating: 4.7,
      students: 9876,
      duration: '12h 15m',
      level: 'Advanced',
      price: 69,
      originalPrice: 99,
      tags: ['CSS', 'Animation', 'Frontend']
    }
  ];

  const learningPaths = [
    {
      name: 'Frontend Developer',
      courses: 8,
      duration: '120 hours',
      level: 'Beginner to Advanced',
      description: 'Master modern frontend development with React, TypeScript, and more',
      progress: 25
    },
    {
      name: 'Data Scientist',
      courses: 12,
      duration: '180 hours',
      level: 'Intermediate',
      description: 'Learn data analysis, machine learning, and statistical modeling',
      progress: 0
    },
    {
      name: 'Full-Stack Developer',
      courses: 15,
      duration: '200 hours',
      level: 'Beginner to Advanced',
      description: 'Complete web development from frontend to backend and databases',
      progress: 10
    }
  ];

  const stats = [
    { label: 'Courses Completed', value: '12', icon: Award },
    { label: 'Hours Learned', value: '156', icon: Clock },
    { label: 'Certificates Earned', value: '8', icon: CheckCircle },
    { label: 'Current Streak', value: '15 days', icon: TrendingUp }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Learning Hub"
        description="Continue your learning journey and discover new courses"
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
                placeholder="Search courses, skills, or instructors..."
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Continue Learning */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Continue Learning</h2>
          <Link href="/learn/courses">
            <Button variant="outline">
              View All Courses
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recentCourses.map((course) => (
            <Card key={course.id} className="group hover:shadow-lg transition-all duration-300">
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 relative rounded-t-lg">
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="lg" className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
                    <Play className="w-5 h-5 mr-2" />
                    Continue
                  </Button>
                </div>
                <div className="absolute top-4 right-4">
                  <Badge className="bg-white/90 text-gray-800">
                    {Math.round(course.progress)}% Complete
                  </Badge>
                </div>
              </div>
              
              <CardHeader>
                <CardTitle className="line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {course.title}
                </CardTitle>
                <CardDescription>by {course.instructor}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span>{course.completedLessons} of {course.totalLessons} lessons</span>
                      <span>{course.duration}</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Last accessed {course.lastAccessed}
                    </span>
                    <Link href={`/learn/courses/${course.id}`}>
                      <Button size="sm">Continue</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Learning Paths */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Learning Paths</h2>
          <Link href="/learn/paths">
            <Button variant="outline">
              View All Paths
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {learningPaths.map((path, index) => (
            <Card key={index} className="hover:shadow-lg transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{path.name}</CardTitle>
                  <Badge variant="secondary">{path.level}</Badge>
                </div>
                <CardDescription className="mt-2">
                  {path.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>{path.courses} courses</span>
                    <span>{path.duration}</span>
                  </div>
                  
                  {path.progress > 0 && (
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{path.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
                          style={{ width: `${path.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  <Button className="w-full" variant={path.progress > 0 ? "default" : "outline"}>
                    {path.progress > 0 ? 'Continue Path' : 'Start Path'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Browse by Category */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Browse by Category</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category, index) => (
            <Link key={index} href={`/learn/courses?category=${category.name.toLowerCase().replace(' ', '-')}`}>
              <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer text-center">
                <CardContent className="p-6">
                  <div className="text-4xl mb-3">{category.icon}</div>
                  <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {category.count} courses
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recommended Courses */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recommended for You</h2>
          <Link href="/learn/courses">
            <Button variant="outline">
              View More
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedCourses.map((course) => (
            <Card key={course.id} className="group hover:shadow-lg transition-all duration-300">
              <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 relative rounded-t-lg">
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="lg" className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
                    <Play className="w-5 h-5 mr-2" />
                    Preview
                  </Button>
                </div>
                <div className="absolute top-4 left-4">
                  <Badge className="bg-white/90 text-gray-800">
                    {course.level}
                  </Badge>
                </div>
                <div className="absolute top-4 right-4">
                  <Button variant="ghost" size="sm" className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30">
                    <Bookmark className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <CardHeader>
                <CardTitle className="line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {course.title}
                </CardTitle>
                <CardDescription>by {course.instructor}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                      <span className="font-medium">{course.rating}</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>{(course.students / 1000).toFixed(1)}k</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{course.duration}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {course.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        ${course.price}
                      </span>
                      <span className="text-sm text-gray-500 line-through">
                        ${course.originalPrice}
                      </span>
                    </div>
                    <Link href={`/learn/courses/${course.id}`}>
                      <Button size="sm">Enroll Now</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Shortcuts to help you learn more effectively
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/library/bookmarks">
              <Button variant="outline" className="w-full justify-start">
                <Bookmark className="w-4 h-4 mr-2" />
                Bookmarks
              </Button>
            </Link>
            <Link href="/library/downloads">
              <Button variant="outline" className="w-full justify-start">
                <Download className="w-4 h-4 mr-2" />
                Downloads
              </Button>
            </Link>
            <Link href="/learn/videos">
              <Button variant="outline" className="w-full justify-start">
                <Video className="w-4 h-4 mr-2" />
                Video Library
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline" className="w-full justify-start">
                <TrendingUp className="w-4 h-4 mr-2" />
                My Progress
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
