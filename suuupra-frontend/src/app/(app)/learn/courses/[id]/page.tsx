'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Play, 
  Clock, 
  CheckCircle,
  Lock,
  BookOpen,
  Download,
  MessageCircle,
  Star,
  Users,
  Calendar,
  Award,
  FileText,
  Video,
  Headphones,
  Code,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Share2,
  Bookmark,
  Settings
} from 'lucide-react';

interface CourseDetailPageProps {
  params: {
    id: string;
  };
}

export default function CourseDetailPage({ params }: CourseDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState<string[]>(['section-1']);

  // Mock course data with enrollment info
  const course = {
    id: params.id,
    title: 'Complete React Development Bootcamp',
    instructor: 'Sarah Johnson',
    progress: 35,
    totalLessons: 156,
    completedLessons: 55,
    duration: '42 hours',
    enrolledDate: '2024-01-10',
    lastAccessed: '2024-01-20',
    certificate: false,
    rating: 4.9,
    myRating: 0,
    bookmarked: true,
    sections: [
      {
        id: 'section-1',
        title: 'Getting Started with React',
        lessons: 12,
        duration: '3h 45m',
        completed: 12,
        lessons_detail: [
          { id: '1', title: 'Introduction to React', duration: '15:30', type: 'video', completed: true, locked: false },
          { id: '2', title: 'Setting up Development Environment', duration: '20:45', type: 'video', completed: true, locked: false },
          { id: '3', title: 'Your First React Component', duration: '18:20', type: 'video', completed: true, locked: false },
          { id: '4', title: 'Understanding JSX', duration: '22:15', type: 'video', completed: true, locked: false },
          { id: '5', title: 'Props and Components', duration: '25:30', type: 'video', completed: true, locked: false },
          { id: '6', title: 'Exercise: Building a Profile Card', duration: '30:00', type: 'exercise', completed: true, locked: false }
        ]
      },
      {
        id: 'section-2',
        title: 'React Hooks Deep Dive',
        lessons: 18,
        duration: '5h 20m',
        completed: 8,
        lessons_detail: [
          { id: '7', title: 'Introduction to Hooks', duration: '18:45', type: 'video', completed: true, locked: false },
          { id: '8', title: 'useState Hook', duration: '25:30', type: 'video', completed: true, locked: false },
          { id: '9', title: 'useEffect Hook', duration: '32:15', type: 'video', completed: true, locked: false },
          { id: '10', title: 'useContext Hook', duration: '28:20', type: 'video', completed: false, locked: false },
          { id: '11', title: 'Custom Hooks', duration: '35:45', type: 'video', completed: false, locked: false },
          { id: '12', title: 'Hooks Best Practices', duration: '22:30', type: 'video', completed: false, locked: false }
        ]
      },
      {
        id: 'section-3',
        title: 'State Management',
        lessons: 15,
        duration: '4h 30m',
        completed: 0,
        lessons_detail: [
          { id: '13', title: 'Context API Deep Dive', duration: '30:15', type: 'video', completed: false, locked: true },
          { id: '14', title: 'Redux Toolkit Setup', duration: '25:45', type: 'video', completed: false, locked: true },
          { id: '15', title: 'Redux Store and Slices', duration: '35:20', type: 'video', completed: false, locked: true }
        ]
      }
    ],
    resources: [
      { id: '1', title: 'Course Source Code', type: 'zip', size: '2.5 MB' },
      { id: '2', title: 'React Cheat Sheet', type: 'pdf', size: '1.2 MB' },
      { id: '3', title: 'Project Assets', type: 'zip', size: '15.8 MB' }
    ],
    announcements: [
      {
        id: '1',
        title: 'New Section Added: Testing React Apps',
        date: '2024-01-18',
        content: 'I\'ve added a new section covering testing with Jest and React Testing Library.'
      },
      {
        id: '2',
        title: 'Course Updated for React 18',
        date: '2024-01-15',
        content: 'All lessons have been updated to use React 18 features and best practices.'
      }
    ]
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return Video;
      case 'exercise': return Code;
      case 'quiz': return FileText;
      case 'reading': return BookOpen;
      default: return Video;
    }
  };

  const nextLesson = course.sections
    .flatMap(section => section.lessons_detail)
    .find(lesson => !lesson.completed && !lesson.locked);

  return (
    <div className="space-y-6">
      <PageHeader
        title={course.title}
        description={`by ${course.instructor}`}
        action={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm">
              <Bookmark className={`w-4 h-4 mr-2 ${course.bookmarked ? 'fill-current' : ''}`} />
              {course.bookmarked ? 'Bookmarked' : 'Bookmark'}
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        }
      />

      {/* Progress Overview */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Course Progress</h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {course.completedLessons} of {course.totalLessons} lessons
                </span>
              </div>
              <Progress value={course.progress} className="mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {course.progress}% complete
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">{course.duration}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total duration</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold">{new Date(course.lastAccessed).toLocaleDateString()}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Last accessed</p>
              </div>
            </div>
          </div>

          {nextLesson && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Continue Learning</h4>
                  <p className="text-blue-700 dark:text-blue-300">Next: {nextLesson.title}</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Play className="w-4 h-4 mr-2" />
                  Continue
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="border-b">
        <nav className="flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'curriculum', label: 'Curriculum', icon: Video },
            { id: 'resources', label: 'Resources', icon: Download },
            { id: 'announcements', label: 'Announcements', icon: MessageCircle },
            { id: 'reviews', label: 'Reviews', icon: Star }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">About this course</h3>
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    This comprehensive React course will take you from beginner to advanced level. 
                    You'll learn modern React concepts including hooks, context, routing, and state management. 
                    Build real-world projects and deploy them to production.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">What you'll learn</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {[
                      'Master React fundamentals and advanced concepts',
                      'Build responsive web applications with modern React',
                      'Understand React hooks and custom hooks',
                      'Implement state management with Context API and Redux',
                      'Work with React Router for navigation',
                      'Test React applications with Jest and React Testing Library'
                    ].map((item, index) => (
                      <div key={index} className="flex items-start">
                        <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Your Progress</h3>
                  <div className="space-y-3">
                    {course.sections.map((section) => (
                      <div key={section.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <h4 className="font-medium">{section.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {section.completed} of {section.lessons} lessons completed
                          </p>
                        </div>
                        <div className="text-right">
                          <Progress value={(section.completed / section.lessons) * 100} className="w-24 mb-1" />
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {Math.round((section.completed / section.lessons) * 100)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'curriculum' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Curriculum</CardTitle>
                <CardDescription>
                  {course.sections.length} sections • {course.totalLessons} lessons • {course.duration}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.sections.map((section) => (
                    <div key={section.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{section.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {section.lessons} lessons • {section.duration} • {section.completed} completed
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Progress value={(section.completed / section.lessons) * 100} className="w-16" />
                            <ArrowRight className={`w-4 h-4 transition-transform ${expandedSections.includes(section.id) ? 'rotate-90' : ''}`} />
                          </div>
                        </div>
                      </button>
                      
                      {expandedSections.includes(section.id) && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                          {section.lessons_detail.map((lesson) => {
                            const TypeIcon = getTypeIcon(lesson.type);
                            return (
                              <div key={lesson.id} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    lesson.completed 
                                      ? 'bg-green-100 dark:bg-green-900/30' 
                                      : lesson.locked 
                                      ? 'bg-gray-100 dark:bg-gray-700' 
                                      : 'bg-blue-100 dark:bg-blue-900/30'
                                  }`}>
                                    {lesson.completed ? (
                                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : lesson.locked ? (
                                      <Lock className="w-4 h-4 text-gray-400" />
                                    ) : (
                                      <TypeIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    )}
                                  </div>
                                  <div>
                                    <h4 className={`font-medium ${lesson.locked ? 'text-gray-400' : ''}`}>
                                      {lesson.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {lesson.duration} • {lesson.type}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  {lesson.completed && (
                                    <Button variant="outline" size="sm">
                                      <RotateCcw className="w-4 h-4 mr-2" />
                                      Rewatch
                                    </Button>
                                  )}
                                  {!lesson.locked && !lesson.completed && (
                                    <Button size="sm">
                                      <Play className="w-4 h-4 mr-2" />
                                      Start
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'resources' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Resources</CardTitle>
                <CardDescription>
                  Downloadable materials and additional resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.resources.map((resource) => (
                    <div key={resource.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <h4 className="font-medium">{resource.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {resource.type.toUpperCase()} • {resource.size}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'announcements' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Announcements</CardTitle>
                <CardDescription>
                  Latest updates from your instructor
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {course.announcements.map((announcement) => (
                    <div key={announcement.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{announcement.title}</h4>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(announcement.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300">{announcement.content}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'reviews' && (
            <Card>
              <CardHeader>
                <CardTitle>Course Reviews</CardTitle>
                <CardDescription>
                  See what other students are saying
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Course reviews would be displayed here
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Course Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Your Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
                <span className="font-semibold">{course.progress}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Lessons Completed</span>
                <span className="font-semibold">{course.completedLessons}/{course.totalLessons}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Enrolled</span>
                <span className="font-semibold">{new Date(course.enrolledDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Certificate</span>
                <span className="font-semibold text-gray-400">Not earned</span>
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
                <Download className="w-4 h-4 mr-2" />
                Download Resources
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <MessageCircle className="w-4 h-4 mr-2" />
                Ask Question
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Star className="w-4 h-4 mr-2" />
                Rate Course
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Award className="w-4 h-4 mr-2" />
                View Certificate
              </Button>
            </CardContent>
          </Card>

          {/* Instructor */}
          <Card>
            <CardHeader>
              <CardTitle>Instructor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold">{course.instructor}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Senior Frontend Developer
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  View Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

