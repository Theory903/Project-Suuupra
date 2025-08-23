'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Target, 
  Award, 
  Globe,
  Heart,
  Lightbulb,
  Shield,
  Zap,
  BookOpen,
  TrendingUp,
  Star,
  ArrowRight,
  Mail,
  Linkedin,
  Twitter
} from 'lucide-react';

export default function AboutPage() {
  const stats = [
    { number: '2M+', label: 'Active Learners', icon: Users },
    { number: '50K+', label: 'Courses Completed', icon: BookOpen },
    { number: '95%', label: 'Success Rate', icon: TrendingUp },
    { number: '150+', label: 'Countries', icon: Globe },
  ];

  const values = [
    {
      icon: Heart,
      title: 'Learner-First',
      description: 'Every decision we make puts our learners at the center. Your success is our success.'
    },
    {
      icon: Lightbulb,
      title: 'Innovation',
      description: 'We constantly push the boundaries of educational technology to create better learning experiences.'
    },
    {
      icon: Shield,
      title: 'Quality',
      description: 'We maintain the highest standards in content creation, instructor selection, and platform reliability.'
    },
    {
      icon: Globe,
      title: 'Accessibility',
      description: 'Education should be accessible to everyone, everywhere. We break down barriers to learning.'
    }
  ];

  const team = [
    {
      name: 'Abhishek Jha',
      role: 'CEO & Co-Founder',
      bio: 'Former VP of Education at Google, passionate about democratizing learning.',
      image: '/team/abhishek.jpg',
      social: {
        linkedin: '#',
        twitter: '#'
      }
    },
    {
      name: 'Purvi Shrivastava',
      role: 'Head of Operations',
      bio: 'AI researcher from MIT, developing personalized learning algorithms.',
      image: '/team/purvi.jpg',
      social: {
        linkedin: '#',
        twitter: '#'
      }
    },
    {
      name: 'Shivansh Rajak',
      role: 'Head of Content',
      bio: 'Former Stanford professor, ensuring world-class educational content.',
      image: '/team/priya.jpg',
      social: {
        linkedin: '#',
        twitter: '#'
      }
    },
    {
      name: 'Jay Sahu',
      role: 'CTO',
      bio: 'Ex-Netflix engineer, building scalable learning infrastructure.',
      image: '/team/jay.jpg',
      social: {
        linkedin: '#',
        twitter: '#'
      }
    }
  ];

  const milestones = [
    {
      year: '2020',
      title: 'Founded',
      description: 'Started with a vision to make quality education accessible to everyone'
    },
    {
      year: '2021',
      title: 'First 10K Users',
      description: 'Reached our first major milestone with 10,000 active learners'
    },
    {
      year: '2022',
      title: 'AI Tutor Launch',
      description: 'Introduced our revolutionary AI-powered personalized tutoring system'
    },
    {
      year: '2023',
      title: 'Global Expansion',
      description: 'Expanded to 150+ countries with multi-language support'
    },
    {
      year: '2024',
      title: '2M+ Learners',
      description: 'Celebrating 2 million learners and 50,000 course completions'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              <Heart className="w-4 h-4 mr-2" />
              Our Story
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent dark:from-white dark:via-blue-200 dark:to-purple-200">
                Empowering
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Global Learning
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              We believe that everyone deserves access to world-class education. 
              Our mission is to break down barriers and make learning accessible, 
              engaging, and effective for millions of people worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Join Our Mission
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline">
                  Get in Touch
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 dark:text-gray-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">
                  <Target className="w-4 h-4 mr-2" />
                  Our Mission
                </Badge>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
                  Democratizing Quality Education
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  We started Suuupra with a simple belief: that everyone, regardless of their background, 
                  location, or circumstances, should have access to world-class education. Traditional 
                  education systems often create barriers—high costs, rigid schedules, geographic limitations.
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                  Our platform breaks down these barriers by combining cutting-edge technology with 
                  proven educational methods. From AI-powered personalized tutoring to live interactive 
                  classes, we&apos;re reimagining what learning can be in the digital age.
                </p>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <Award className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">Industry Recognition</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-5 h-5 text-yellow-500 mr-2" />
                    <span className="text-gray-700 dark:text-gray-300">4.9/5 Rating</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-3xl flex items-center justify-center">
                  <div className="text-center">
                    <Zap className="w-24 h-24 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Powered by AI
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      Personalized learning experiences for every student
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Core Values
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              These principles guide everything we do and every decision we make
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="text-center hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                <CardHeader>
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
                    <value.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {value.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Journey
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Key milestones in our mission to transform education
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
              
              {milestones.map((milestone, index) => (
                <div key={index} className={`relative flex items-center mb-12 ${index % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <Card className="shadow-lg border-0">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {milestone.year}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{milestone.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-gray-600 dark:text-gray-300">
                          {milestone.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Timeline dot */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-4 border-white dark:border-gray-800"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Meet Our Team
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              The passionate people behind Suuupra&apos;s mission
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <Card key={index} className="text-center hover:shadow-xl transition-all duration-300 border-0 shadow-lg">
                <CardHeader>
                  <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                    <Users className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle className="text-xl">{member.name}</CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400 font-medium">
                    {member.role}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                    {member.bio}
                  </p>
                  <div className="flex justify-center space-x-3">
                    <Button variant="outline" size="sm">
                      <Linkedin className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Twitter className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Mail className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Join Our Learning Revolution
          </h2>
          <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Be part of a global community that&apos;s transforming how the world learns. 
            Your journey to success starts here.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/sign-up">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                Start Learning Today
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/careers">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Join Our Team
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
