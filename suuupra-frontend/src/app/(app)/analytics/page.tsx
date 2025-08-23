'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import { 
  TrendingUp,
  TrendingDown,
  Clock,
  BookOpen,
  Award,
  Target,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Users,
  Star,
  Download,
  Filter,
  Eye,
  Play,
  CheckCircle,
  Zap,
  Brain,
  Trophy,
  Flame
} from 'lucide-react';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('learning_time');

  // Mock analytics data
  const overallStats = [
    { 
      label: 'Total Learning Time', 
      value: '156h 32m', 
      change: '+12.5%', 
      trend: 'up',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400'
    },
    { 
      label: 'Courses Completed', 
      value: '12', 
      change: '+3', 
      trend: 'up',
      icon: BookOpen,
      color: 'text-green-600 dark:text-green-400'
    },
    { 
      label: 'Certificates Earned', 
      value: '8', 
      change: '+2', 
      trend: 'up',
      icon: Award,
      color: 'text-purple-600 dark:text-purple-400'
    },
    { 
      label: 'Current Streak', 
      value: '15 days', 
      change: '+5', 
      trend: 'up',
      icon: Flame,
      color: 'text-orange-600 dark:text-orange-400'
    }
  ];

  const learningProgress = [
    {
      course: 'Complete React Development Bootcamp',
      instructor: 'Sarah Johnson',
      progress: 85,
      timeSpent: '34h 20m',
      lessonsCompleted: 42,
      totalLessons: 50,
      lastAccessed: '2024-01-20',
      rating: 4.9,
      category: 'Web Development'
    },
    {
      course: 'Python for Data Science',
      instructor: 'Dr. Michael Chen',
      progress: 60,
      timeSpent: '28h 15m',
      lessonsCompleted: 18,
      totalLessons: 30,
      lastAccessed: '2024-01-19',
      rating: 4.8,
      category: 'Data Science'
    },
    {
      course: 'UI/UX Design Fundamentals',
      instructor: 'Emma Wilson',
      progress: 95,
      timeSpent: '22h 45m',
      lessonsCompleted: 19,
      totalLessons: 20,
      lastAccessed: '2024-01-18',
      rating: 4.9,
      category: 'Design'
    },
    {
      course: 'Advanced JavaScript Concepts',
      instructor: 'Alex Rodriguez',
      progress: 40,
      timeSpent: '15h 30m',
      lessonsCompleted: 12,
      totalLessons: 30,
      lastAccessed: '2024-01-17',
      rating: 4.7,
      category: 'Web Development'
    }
  ];

  const skillsProgress = [
    { skill: 'React', level: 'Advanced', progress: 85, courses: 3, certificates: 2 },
    { skill: 'JavaScript', level: 'Expert', progress: 95, courses: 5, certificates: 3 },
    { skill: 'Python', level: 'Intermediate', progress: 60, courses: 2, certificates: 1 },
    { skill: 'UI/UX Design', level: 'Advanced', progress: 80, courses: 2, certificates: 2 },
    { skill: 'Data Science', level: 'Beginner', progress: 35, courses: 1, certificates: 0 },
    { skill: 'Node.js', level: 'Intermediate', progress: 55, courses: 2, certificates: 1 }
  ];

  const weeklyActivity = [
    { day: 'Mon', hours: 2.5, lessons: 3 },
    { day: 'Tue', hours: 1.8, lessons: 2 },
    { day: 'Wed', hours: 3.2, lessons: 4 },
    { day: 'Thu', hours: 2.1, lessons: 3 },
    { day: 'Fri', hours: 1.5, lessons: 2 },
    { day: 'Sat', hours: 4.2, lessons: 6 },
    { day: 'Sun', hours: 3.8, lessons: 5 }
  ];

  const achievements = [
    {
      id: '1',
      title: 'Fast Learner',
      description: 'Completed 5 courses in a month',
      icon: Zap,
      color: 'from-yellow-400 to-orange-500',
      earned: true,
      date: '2024-01-15'
    },
    {
      id: '2',
      title: 'Dedicated Student',
      description: 'Maintained a 15-day learning streak',
      icon: Flame,
      color: 'from-red-400 to-pink-500',
      earned: true,
      date: '2024-01-20'
    },
    {
      id: '3',
      title: 'Knowledge Seeker',
      description: 'Explored 5 different categories',
      icon: Brain,
      color: 'from-purple-400 to-indigo-500',
      earned: true,
      date: '2024-01-10'
    },
    {
      id: '4',
      title: 'Master Achiever',
      description: 'Earned 10 certificates',
      icon: Trophy,
      color: 'from-green-400 to-emerald-500',
      earned: false,
      progress: 80
    }
  ];

  const categoryBreakdown = [
    { category: 'Web Development', hours: 68, percentage: 43.5, courses: 6 },
    { category: 'Data Science', hours: 35, percentage: 22.4, courses: 3 },
    { category: 'Design', hours: 28, percentage: 17.9, courses: 2 },
    { category: 'Business', hours: 15, percentage: 9.6, courses: 2 },
    { category: 'Mobile Development', hours: 10, percentage: 6.4, courses: 1 }
  ];

  const goals = [
    {
      id: '1',
      title: 'Complete React Bootcamp',
      target: 100,
      current: 85,
      deadline: '2024-02-01',
      type: 'course'
    },
    {
      id: '2',
      title: 'Learn 20 hours this month',
      target: 20,
      current: 16.5,
      deadline: '2024-01-31',
      type: 'time'
    },
    {
      id: '3',
      title: 'Earn 3 certificates',
      target: 3,
      current: 2,
      deadline: '2024-02-15',
      type: 'certificate'
    }
  ];

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (trend: string) => {
    return trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getSkillLevelColor = (level: string) => {
    switch (level) {
      case 'Expert': return 'text-purple-600 dark:text-purple-400';
      case 'Advanced': return 'text-blue-600 dark:text-blue-400';
      case 'Intermediate': return 'text-green-600 dark:text-green-400';
      case 'Beginner': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Analytics"
        description="Track your learning progress and achievements"
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Learning Activity Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5" />
                <span>Weekly Learning Activity</span>
              </CardTitle>
              <CardDescription>
                Your daily learning hours and lessons completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Weekly activity chart would be here</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Integration with charting library (Chart.js, Recharts, etc.)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5" />
                <span>Course Progress</span>
              </CardTitle>
              <CardDescription>
                Your progress across all enrolled courses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {learningProgress.map((course, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{course.course}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">by {course.instructor}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary" className="mb-1">
                          {course.category}
                        </Badge>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className="text-sm">{course.rating}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>{course.lessonsCompleted} of {course.totalLessons} lessons</span>
                        <span>{course.progress}%</span>
                      </div>
                      <Progress value={course.progress} className="h-2" />
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          <span>{course.timeSpent}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          <span>Last: {new Date(course.lastAccessed).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4 mr-2" />
                        Continue
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skills Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Skills Development</span>
              </CardTitle>
              <CardDescription>
                Track your skill levels and progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {skillsProgress.map((skill, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{skill.skill}</h4>
                      <Badge className={getSkillLevelColor(skill.level)}>
                        {skill.level}
                      </Badge>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{skill.progress}%</span>
                      </div>
                      <Progress value={skill.progress} className="h-2" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{skill.courses} courses</span>
                      <span>{skill.certificates} certificates</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Learning Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Learning Goals</span>
              </CardTitle>
              <CardDescription>
                Track your progress towards goals
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.map((goal) => (
                <div key={goal.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{goal.title}</h4>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(goal.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{goal.current} / {goal.target}</span>
                      <span>{Math.round((goal.current / goal.target) * 100)}%</span>
                    </div>
                    <Progress value={(goal.current / goal.target) * 100} className="h-1.5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChart className="w-5 h-5" />
                <span>Learning by Category</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryBreakdown.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${
                        index === 0 ? 'from-blue-400 to-blue-600' :
                        index === 1 ? 'from-purple-400 to-purple-600' :
                        index === 2 ? 'from-green-400 to-green-600' :
                        index === 3 ? 'from-orange-400 to-orange-600' :
                        'from-pink-400 to-pink-600'
                      }`} />
                      <span className="text-sm font-medium">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{category.hours}h</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{category.percentage}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Achievements</span>
              </CardTitle>
              <CardDescription>
                Your learning milestones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {achievements.map((achievement) => (
                <div key={achievement.id} className={`p-3 rounded-lg border ${
                  achievement.earned 
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-yellow-200 dark:border-yellow-800' 
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${achievement.color} flex items-center justify-center ${
                      !achievement.earned ? 'opacity-50' : ''
                    }`}>
                      <achievement.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{achievement.title}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{achievement.description}</p>
                      {achievement.earned ? (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          Earned {new Date(achievement.date!).toLocaleDateString()}
                        </p>
                      ) : (
                        <div className="mt-2">
                          <Progress value={achievement.progress} className="h-1" />
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {achievement.progress}% complete
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Avg. Daily Learning:</span>
                <span className="font-medium">2.3 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Most Active Day:</span>
                <span className="font-medium">Saturday</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Favorite Category:</span>
                <span className="font-medium">Web Development</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Completion Rate:</span>
                <span className="font-medium">78%</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

