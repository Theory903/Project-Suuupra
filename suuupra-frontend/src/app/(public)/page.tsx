'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { 
  BookOpen, 
  Video, 
  Users, 
  MessageCircle, 
  Star,
  ArrowRight,
  Play,
  Clock,
  Award,
  Zap,
  Shield,
  Globe,
  TrendingUp,
  CheckCircle,
  Sparkles,
  Brain,
  Target,
  Rocket
} from 'lucide-react';
import { useFeaturedCourses } from '@/hooks/content/use-public-courses';

export default function HomePage() {
  const { data: featuredCourses, isLoading: coursesLoading } = useFeaturedCourses(3);
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob dark:bg-blue-800" />
        <div className="absolute top-40 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 dark:bg-purple-800" />
        <div className="absolute -bottom-8 left-20 w-20 h-20 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 dark:bg-pink-800" />

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-6xl mx-auto text-center">
            {/* Announcement Badge */}
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium mb-8 bg-white/50 backdrop-blur-sm dark:bg-gray-800/50 dark:border-gray-700">
              <Sparkles className="w-4 h-4 text-yellow-500 mr-2" />
              <span className="text-gray-600 dark:text-gray-300">Introducing AI-Powered Learning • </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold ml-1">Now Live!</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
              <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent dark:from-white dark:via-blue-200 dark:to-purple-200">
                Learn Without
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Limits
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Experience the future of education with our comprehensive platform. 
              <span className="font-semibold text-gray-800 dark:text-gray-200"> AI-powered tutoring</span>, 
              <span className="font-semibold text-gray-800 dark:text-gray-200"> live classes</span>, and 
              <span className="font-semibold text-gray-800 dark:text-gray-200"> personalized learning paths</span> 
              — all in one place.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/auth/sign-up">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-8 py-6 text-lg">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Learning Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/courses">
                <Button size="lg" variant="outline" className="border-2 hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700 dark:text-gray-100 px-8 py-6 text-lg">
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center">
                <div className="flex -space-x-2 mr-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 border-2 border-white dark:border-gray-800" />
                  ))}
                </div>
                <span>Join 2M+ learners worldwide</span>
              </div>
              <div className="flex items-center">
                <div className="flex text-yellow-400 mr-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <span>4.9/5 from 50k+ reviews</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <Badge variant="secondary" className="mb-4">
              <Zap className="w-4 h-4 mr-2" />
              Powerful Features
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Excel
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our comprehensive platform combines cutting-edge technology with proven educational methods
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Tutor',
                description: 'Get personalized help 24/7 with our advanced AI that adapts to your learning style',
                color: 'from-purple-500 to-pink-500',
                bgColor: 'bg-purple-50 dark:bg-purple-900/20'
              },
              {
                icon: Video,
                title: 'Live Classes',
                description: 'Join interactive sessions with expert instructors and fellow learners worldwide',
                color: 'from-blue-500 to-cyan-500',
                bgColor: 'bg-blue-50 dark:bg-blue-900/20'
              },
              {
                icon: BookOpen,
                title: 'Expert Courses',
                description: 'Learn from industry professionals with hands-on projects and real-world applications',
                color: 'from-green-500 to-emerald-500',
                bgColor: 'bg-green-50 dark:bg-green-900/20'
              },
              {
                icon: Target,
                title: 'Personalized Paths',
                description: 'AI-curated learning journeys tailored to your goals, pace, and preferences',
                color: 'from-orange-500 to-red-500',
                bgColor: 'bg-orange-50 dark:bg-orange-900/20'
              }
            ].map((feature, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg dark:bg-gray-900/60 dark:hover:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800">
                <CardHeader className="pb-4">
                  <div className={`w-14 h-14 rounded-2xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className={`w-7 h-7 bg-gradient-to-r ${feature.color} bg-clip-text text-transparent`} />
                  </div>
                  <CardTitle className="text-xl text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
              { number: '2M+', label: 'Active Learners', icon: Users },
              { number: '10K+', label: 'Expert Courses', icon: BookOpen },
              { number: '500+', label: 'Live Classes Daily', icon: Video },
              { number: '98%', label: 'Success Rate', icon: TrendingUp },
            ].map((stat, index) => (
              <div key={index} className="group">
                <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <stat.icon className="w-8 h-8 text-white" />
                </div>
                <div className="text-4xl font-bold mb-2">{stat.number}</div>
                <div className="text-blue-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Courses */}
      <section className="py-24 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4">
              <Star className="w-4 h-4 mr-2" />
              Most Popular
            </Badge>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trending Courses
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Join thousands of students in our most popular courses
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coursesLoading ? (
              // Loading skeletons
              [...Array(3)].map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <LoadingSkeleton className="aspect-video" />
                  <CardHeader>
                    <LoadingSkeleton className="h-6 w-full mb-2" />
                    <LoadingSkeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                      <LoadingSkeleton className="h-4 w-12" />
                      <LoadingSkeleton className="h-4 w-16" />
                      <LoadingSkeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center justify-between">
                      <LoadingSkeleton className="h-8 w-16" />
                      <LoadingSkeleton className="h-10 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              (featuredCourses?.courses || []).map((course) => (
                <Card key={course.id} className="group overflow-hidden hover:shadow-2xl transition-all duration-300 border-0 shadow-lg dark:bg-gray-900/60 dark:hover:bg-gray-900 dark:shadow-none dark:ring-1 dark:ring-gray-800">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 relative">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-white/90 text-gray-800 dark:bg-gray-900/80 dark:text-gray-100 dark:border dark:border-gray-700">
                      {course.level}
                    </Badge>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <div className="flex gap-2">
                      {course.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="bg-white/20 text-white border-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="lg" className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30">
                      <Play className="w-5 h-5 mr-2" />
                      Preview
                    </Button>
                  </div>
                </div>
                
                <CardHeader>
                  <CardTitle className="line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {course.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">by {course.instructor}</CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                        <span className="font-medium">{course.rating.toFixed(1)}</span>
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
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        ${course.price}
                      </span>
                      {course.originalPrice && course.originalPrice > course.price && (
                        <>
                          <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                            ${course.originalPrice}
                          </span>
                          <Badge variant="destructive" className="text-xs">
                            {Math.round((1 - course.price / course.originalPrice) * 100)}% OFF
                          </Badge>
                        </>
                      )}
                    </div>
                    <Link href={`/courses/${course.id}`}>
                      <Button className="group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        Enroll Now
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>

          <div className="text-center mt-12">
            <Link href="/courses">
              <Button size="lg" variant="outline" className="border-2 dark:border-gray-700 dark:text-gray-100">
                View All Courses
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-24 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Why 2M+ Learners Choose{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Suuupra
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              We&apos;re not just another learning platform. We&apos;re your partner in success.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Industry-Recognized Certificates',
                description: 'Earn certificates that employers actually value and recognize in the job market.'
              },
              {
                icon: Users,
                title: 'Expert Instructors',
                description: 'Learn from industry professionals who are currently working at top companies.'
              },
              {
                icon: Zap,
                title: 'Learn at Your Pace',
                description: 'Flexible scheduling with lifetime access to all course materials and updates.'
              },
              {
                icon: Globe,
                title: 'Global Community',
                description: 'Connect with learners worldwide and build your professional network.'
              },
              {
                icon: Award,
                title: '30-Day Money Back',
                description: 'Not satisfied? Get a full refund within 30 days, no questions asked.'
              },
              {
                icon: MessageCircle,
                title: '24/7 AI Support',
                description: 'Get instant help from our AI tutor whenever you need assistance.'
              }
            ].map((benefit, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <benefit.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Future?
            </h2>
            <p className="text-xl mb-12 text-blue-100">
              Join millions of learners who are already building successful careers with Suuupra.
              Start your journey today with our free courses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 shadow-lg px-8 py-6 text-lg font-semibold">
                  <Rocket className="w-5 h-5 mr-2" />
                  Start Learning Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                  View Pricing Plans
                </Button>
              </Link>
            </div>
            
            <div className="mt-12 flex items-center justify-center gap-8 text-sm text-blue-100">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Free to start
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                No credit card required
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 mr-2" />
                Cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}