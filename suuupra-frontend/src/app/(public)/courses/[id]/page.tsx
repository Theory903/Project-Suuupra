'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Clock, 
  Users, 
  Star,
  BookOpen,
  Award,
  Download,
  Share2,
  Heart,
  CheckCircle,
  Globe,
  Smartphone,
  Monitor,
  ArrowRight,
  User,
  Calendar,
  Target,
  TrendingUp
} from 'lucide-react';

interface CoursePageProps {
  params: {
    id: string;
  };
}

export default function CoursePreviewPage({ params }: CoursePageProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Mock course data - in real app, this would come from API
  const course = {
    id: params.id,
    title: 'Complete React Development Bootcamp',
    subtitle: 'Master React from basics to advanced concepts with hands-on projects',
    instructor: {
      name: 'Sarah Johnson',
      title: 'Senior Frontend Developer at Google',
      avatar: '/instructors/sarah.jpg',
      rating: 4.9,
      students: 125000,
      courses: 12
    },
    rating: 4.9,
    totalRatings: 15672,
    students: 45231,
    price: 89,
    originalPrice: 129,
    duration: '42 hours',
    lessons: 156,
    level: 'Intermediate',
    language: 'English',
    lastUpdated: '2024-01-15',
    category: 'Web Development',
    tags: ['React', 'JavaScript', 'Frontend', 'Web Development'],
    description: `This comprehensive React course will take you from beginner to advanced level. You'll learn modern React concepts including hooks, context, routing, and state management. Build real-world projects and deploy them to production.`,
    whatYouWillLearn: [
      'Master React fundamentals and advanced concepts',
      'Build responsive web applications with modern React',
      'Understand React hooks and custom hooks',
      'Implement state management with Context API and Redux',
      'Work with React Router for navigation',
      'Test React applications with Jest and React Testing Library',
      'Deploy React apps to production',
      'Build a complete e-commerce application'
    ],
    requirements: [
      'Basic knowledge of HTML, CSS, and JavaScript',
      'Familiarity with ES6+ JavaScript features',
      'A computer with internet connection',
      'Code editor (VS Code recommended)'
    ],
    curriculum: [
      {
        section: 'Getting Started with React',
        lessons: 12,
        duration: '3h 45m',
        topics: ['React Basics', 'JSX', 'Components', 'Props']
      },
      {
        section: 'React Hooks Deep Dive',
        lessons: 18,
        duration: '5h 20m',
        topics: ['useState', 'useEffect', 'useContext', 'Custom Hooks']
      },
      {
        section: 'State Management',
        lessons: 15,
        duration: '4h 30m',
        topics: ['Context API', 'Redux Toolkit', 'Zustand']
      },
      {
        section: 'Routing and Navigation',
        lessons: 10,
        duration: '3h 15m',
        topics: ['React Router', 'Protected Routes', 'Dynamic Routing']
      },
      {
        section: 'Testing React Applications',
        lessons: 8,
        duration: '2h 45m',
        topics: ['Jest', 'React Testing Library', 'E2E Testing']
      },
      {
        section: 'Final Project: E-commerce App',
        lessons: 25,
        duration: '8h 30m',
        topics: ['Project Setup', 'Authentication', 'Shopping Cart', 'Payment Integration']
      }
    ],
    reviews: [
      {
        id: '1',
        user: 'John Doe',
        rating: 5,
        date: '2024-01-10',
        comment: 'Excellent course! Sarah explains everything clearly and the projects are very practical.'
      },
      {
        id: '2',
        user: 'Jane Smith',
        rating: 5,
        date: '2024-01-08',
        comment: 'Best React course I\'ve taken. The final project really helped me understand everything.'
      },
      {
        id: '3',
        user: 'Mike Johnson',
        rating: 4,
        date: '2024-01-05',
        comment: 'Great content and well structured. Would recommend to anyone learning React.'
      }
    ]
  };

  const handleEnroll = () => {
    // In real app, this would add to cart or start enrollment process
    console.log('Enrolling in course:', course.id);
  };

  const handleWishlist = () => {
    setIsWishlisted(!isWishlisted);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="mb-6 text-sm">
              <Link href="/" className="text-gray-400 hover:text-white">Home</Link>
              <span className="mx-2 text-gray-400">/</span>
              <Link href="/courses" className="text-gray-400 hover:text-white">Courses</Link>
              <span className="mx-2 text-gray-400">/</span>
              <span className="text-white">{course.category}</span>
            </nav>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="mb-4">
                  <Badge className="bg-blue-600 text-white mb-3">
                    {course.category}
                  </Badge>
                  <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
                  <p className="text-xl text-gray-300 mb-6">{course.subtitle}</p>
                </div>

                <div className="flex flex-wrap items-center gap-6 mb-6">
                  <div className="flex items-center">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 mr-1" />
                    <span className="font-semibold mr-1">{course.rating}</span>
                    <span className="text-gray-300">({course.totalRatings.toLocaleString()} ratings)</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2 text-gray-400" />
                    <span>{course.students.toLocaleString()} students</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-gray-400" />
                    <span>{course.duration}</span>
                  </div>
                  <div className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-gray-400" />
                    <span>{course.lessons} lessons</span>
                  </div>
                </div>

                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-4">
                    <User className="w-6 h-6 text-gray-300" />
                  </div>
                  <div>
                    <p className="font-semibold">{course.instructor.name}</p>
                    <p className="text-gray-300 text-sm">{course.instructor.title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {course.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="bg-gray-700 text-gray-200">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Course Preview Card */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 relative rounded-t-lg">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button size="lg" className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
                        <Play className="w-6 h-6 mr-2" />
                        Preview Course
                      </Button>
                    </div>
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-green-600 text-white">
                        {course.level}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-6">
                    <div className="mb-6">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                          ${course.price}
                        </span>
                        <span className="text-lg text-gray-500 line-through">
                          ${course.originalPrice}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          {Math.round((1 - course.price / course.originalPrice) * 100)}% OFF
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        30-day money-back guarantee
                      </p>
                    </div>

                    <div className="space-y-3 mb-6">
                      <Button onClick={handleEnroll} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg py-6">
                        Enroll Now
                      </Button>
                      <Button 
                        onClick={handleWishlist} 
                        variant="outline" 
                        className="w-full"
                      >
                        <Heart className={`w-4 h-4 mr-2 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                        {isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                      </Button>
                      <Button variant="outline" className="w-full">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share Course
                      </Button>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                        <span className="font-medium">{course.duration}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Lessons:</span>
                        <span className="font-medium">{course.lessons}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Level:</span>
                        <span className="font-medium">{course.level}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Language:</span>
                        <span className="font-medium">{course.language}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
                        <span className="font-medium">{new Date(course.lastUpdated).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <h4 className="font-semibold mb-3">This course includes:</h4>
                      <div className="flex items-center text-sm">
                        <Monitor className="w-4 h-4 mr-2 text-gray-500" />
                        <span>Full lifetime access</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Smartphone className="w-4 h-4 mr-2 text-gray-500" />
                        <span>Access on mobile and TV</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Download className="w-4 h-4 mr-2 text-gray-500" />
                        <span>Downloadable resources</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Award className="w-4 h-4 mr-2 text-gray-500" />
                        <span>Certificate of completion</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* What You'll Learn */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Target className="w-5 h-5 mr-2" />
                      What you'll learn
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-3">
                      {course.whatYouWillLearn.map((item, index) => (
                        <div key={index} className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Course Description */}
                <Card>
                  <CardHeader>
                    <CardTitle>Course Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {course.description}
                    </p>
                  </CardContent>
                </Card>

                {/* Requirements */}
                <Card>
                  <CardHeader>
                    <CardTitle>Requirements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {course.requirements.map((requirement, index) => (
                        <li key={index} className="flex items-start">
                          <span className="w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3 flex-shrink-0" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Curriculum */}
                <Card>
                  <CardHeader>
                    <CardTitle>Course Curriculum</CardTitle>
                    <CardDescription>
                      {course.curriculum.length} sections • {course.lessons} lessons • {course.duration} total length
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {course.curriculum.map((section, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold">{section.section}</h3>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {section.lessons} lessons • {section.duration}
                              </div>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {section.topics.map((topic, topicIndex) => (
                                <Badge key={topicIndex} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Reviews */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Student Reviews</span>
                      <div className="flex items-center">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 mr-1" />
                        <span className="font-semibold">{course.rating}</span>
                        <span className="text-gray-600 dark:text-gray-400 ml-2">
                          ({course.totalRatings.toLocaleString()} reviews)
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {course.reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mr-3">
                                <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                              </div>
                              <span className="font-medium">{review.user}</span>
                            </div>
                            <div className="flex items-center">
                              <div className="flex mr-2">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-4 h-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(review.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300">{review.comment}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Instructor Info */}
              <div className="lg:col-span-1">
                <Card className="sticky top-6">
                  <CardHeader>
                    <CardTitle>Instructor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-4">
                      <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                        <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="font-semibold text-lg">{course.instructor.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">{course.instructor.title}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Rating:</span>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className="font-medium">{course.instructor.rating}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Students:</span>
                        <span className="font-medium">{course.instructor.students.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Courses:</span>
                        <span className="font-medium">{course.instructor.courses}</span>
                      </div>
                    </div>

                    <Button variant="outline" className="w-full mt-4">
                      View Profile
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related Courses */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                More courses by {course.instructor.name}
              </h2>
              <Button variant="outline">
                View All
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
            
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Related courses would be displayed here
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

