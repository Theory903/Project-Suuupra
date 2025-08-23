'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BookOpen,
  Clock,
  TrendingUp,
  Users,
  Award,
  Play,
  Calendar,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { 
  useDashboardStats,
  useRecentCourses,
  useUpcomingClasses,
  useCourseRecommendations 
} from '@/hooks/analytics/use-dashboard-data';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: recentCourses, isLoading: coursesLoading, error: coursesError } = useRecentCourses();
  const { data: upcomingClasses, isLoading: classesLoading, error: classesError } = useUpcomingClasses();
  const { data: recommendations, isLoading: recommendationsLoading, error: recommendationsError } = useCourseRecommendations();

  if (statsError || coursesError || classesError || recommendationsError) {
    return (
      <div>
        <PageHeader
          title="Welcome back!"
          description="Continue your learning journey and track your progress."
        />
        <EmptyState
          title="Failed to load dashboard data"
          description="There was an error loading your dashboard. Please try refreshing the page."
          action={{
            label: 'Refresh',
            onClick: () => window.location.reload(),
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <PageHeader
        title="Welcome back!"
        description="Continue your learning journey and track your progress."
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses Enrolled</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSkeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.coursesEnrolled || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSkeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.coursesCompleted || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +3 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Learned</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSkeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.hoursLearned || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +12 from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSkeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.certificatesEarned || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              +1 this month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Continue Learning */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Continue Learning</CardTitle>
              <CardDescription>
                Pick up where you left off
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {coursesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 p-4">
                      <LoadingSkeleton className="w-16 h-16 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <LoadingSkeleton className="h-4 w-3/4" />
                        <LoadingSkeleton className="h-3 w-1/2" />
                        <LoadingSkeleton className="h-2 w-full" />
                        <LoadingSkeleton className="h-3 w-2/3" />
                      </div>
                      <LoadingSkeleton className="h-8 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentCourses && recentCourses.length > 0 ? (
                recentCourses.map((course) => (
                  <div key={course.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0 bg-cover bg-center" 
                         style={{ backgroundImage: course.thumbnail ? `url(${course.thumbnail})` : undefined }} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {course.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        by {course.instructor}
                      </p>
                      <div className="flex items-center space-x-2 mb-2">
                        <Progress value={course.progress} className="flex-1" />
                        <span className="text-sm text-gray-500">{course.progress}%</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Next: {course.nextLesson}
                      </p>
                    </div>
                    <Link href={`/learn/courses/${course.id}`}>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Continue
                      </Button>
                    </Link>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No courses in progress"
                  description="Start learning by enrolling in a course."
                  action={{
                    label: 'Browse Courses',
                    onClick: () => window.location.href = '/learn/courses',
                  }}
                />
              )}
              <div className="text-center pt-4">
                <Link href="/learn/courses">
                  <Button variant="outline">
                    View All Courses
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Live Classes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Upcoming Classes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {classesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <LoadingSkeleton className="h-4 w-full" />
                      <LoadingSkeleton className="h-3 w-2/3" />
                      <LoadingSkeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : upcomingClasses && upcomingClasses.length > 0 ? (
                upcomingClasses.map((class_) => (
                  <div key={class_.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{class_.title}</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400">by {class_.instructor}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {class_.date}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{class_.time}</span>
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {class_.participants}
                      </div>
                    </div>
                    {class_.date === 'Today' && (
                      <Link href={class_.joinUrl || `/live/classes/${class_.id}`}>
                        <Button size="sm" className="w-full">
                          Join Now
                        </Button>
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-2">No upcoming classes</p>
                  <Link href="/live/classes">
                    <Button variant="outline" size="sm">
                      Explore Classes
                    </Button>
                  </Link>
                </div>
              )}
              <div className="text-center pt-2">
                <Link href="/live/classes">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Classes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* AI Tutor Quick Access */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2" />
                AI Tutor
              </CardTitle>
              <CardDescription>
                Get instant help with your studies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ask questions about your current courses or get help with assignments.
                </p>
                <Link href="/tutor">
                  <Button className="w-full">
                    Start Conversation
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recommendations */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recommended for You</CardTitle>
          <CardDescription>
            Based on your learning progress and interests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recommendationsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <LoadingSkeleton className="aspect-video rounded-lg mb-4" />
                  <LoadingSkeleton className="h-4 w-3/4 mb-2" />
                  <LoadingSkeleton className="h-3 w-full mb-3" />
                  <div className="flex items-center justify-between mb-3">
                    <LoadingSkeleton className="h-3 w-16" />
                    <LoadingSkeleton className="h-3 w-20" />
                  </div>
                  <LoadingSkeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
          ) : recommendations && recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendations.map((course) => (
                <div key={course.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 bg-cover bg-center"
                       style={{ backgroundImage: course.thumbnail ? `url(${course.thumbnail})` : undefined }} />
                  <h3 className="font-semibold mb-2">{course.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    by {course.instructor}
                  </p>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center">
                      <span className="text-yellow-500">★</span>
                      <span className="ml-1">{course.rating}</span>
                    </div>
                    <span className="text-gray-500">${course.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {course.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Link href={`/learn/courses/${course.id}`}>
                    <Button size="sm" className="w-full">
                      View Course
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recommendations available"
              description="Complete more courses to get personalized recommendations."
              action={{
                label: 'Browse Courses',
                onClick: () => window.location.href = '/learn/courses',
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}