import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  Star, 
  Zap, 
  Crown, 
  Rocket,
  Users,
  BookOpen,
  Video,
  MessageCircle,
  Award,
  Shield,
  Headphones
} from 'lucide-react';

export default function PricingPage() {
  const plans = [
    {
      name: 'Free',
      price: 0,
      period: 'forever',
      description: 'Perfect for getting started with learning',
      features: [
        'Access to 50+ free courses',
        'Basic AI tutor (5 questions/day)',
        'Community forums',
        'Mobile app access',
        'Basic progress tracking',
        'Standard video quality'
      ],
      limitations: [
        'No certificates',
        'Limited AI tutor usage',
        'No live classes',
        'No offline downloads'
      ],
      cta: 'Get Started Free',
      popular: false,
      icon: BookOpen,
      color: 'from-gray-500 to-gray-600'
    },
    {
      name: 'Pro',
      price: 29,
      period: 'month',
      description: 'Best for serious learners and professionals',
      features: [
        'Access to 1000+ premium courses',
        'Unlimited AI tutor access',
        'Live classes and workshops',
        'Industry-recognized certificates',
        'Offline downloads',
        'HD video quality',
        'Priority support',
        'Advanced analytics',
        'Custom learning paths',
        'Project-based learning'
      ],
      limitations: [],
      cta: 'Start Pro Trial',
      popular: true,
      icon: Star,
      color: 'from-blue-500 to-purple-600'
    },
    {
      name: 'Teams',
      price: 99,
      period: 'month',
      description: 'Perfect for teams and organizations',
      features: [
        'Everything in Pro',
        'Team management dashboard',
        'Bulk user management',
        'Advanced reporting',
        'Custom branding',
        'SSO integration',
        'Dedicated account manager',
        'API access',
        'Custom integrations',
        'Priority phone support',
        'Team collaboration tools',
        'Advanced security features'
      ],
      limitations: [],
      cta: 'Contact Sales',
      popular: false,
      icon: Users,
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const features = [
    {
      icon: Video,
      title: 'Live Classes',
      description: 'Interactive sessions with expert instructors'
    },
    {
      icon: MessageCircle,
      title: 'AI Tutor',
      description: '24/7 personalized learning assistance'
    },
    {
      icon: Award,
      title: 'Certificates',
      description: 'Industry-recognized completion certificates'
    },
    {
      icon: Shield,
      title: 'Secure Learning',
      description: 'Enterprise-grade security and privacy'
    }
  ];

  const faqs = [
    {
      question: 'Can I switch plans anytime?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and we&apos;ll prorate any charges.'
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes! Pro plan comes with a 14-day free trial. No credit card required to start.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, PayPal, bank transfers, and UPI payments.'
    },
    {
      question: 'Can I get a refund?',
      answer: 'Absolutely! We offer a 30-day money-back guarantee on all paid plans.'
    },
    {
      question: 'Do you offer student discounts?',
      answer: 'Yes, we offer 50% discount for students with valid student ID verification.'
    },
    {
      question: 'Is there a limit on course access?',
      answer: 'Free plan has access to 50+ courses. Pro and Teams plans have unlimited access to our entire catalog.'
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              <Zap className="w-4 h-4 mr-2" />
              Simple, Transparent Pricing
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 bg-clip-text text-transparent dark:from-white dark:via-blue-200 dark:to-purple-200">
                Choose Your
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Learning Journey
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Start free and upgrade as you grow. All plans include our core features 
              with no hidden fees or long-term commitments.
            </p>
            
            {/* Pricing Toggle */}
            <div className="flex items-center justify-center mb-12">
              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-1 rounded-lg border dark:border-gray-700 shadow-sm">
                <div className="flex">
                  <button className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md shadow-sm">
                    Monthly
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Annual
                    <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                      Save 20%
                    </Badge>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card key={index} className={`relative overflow-hidden ${plan.popular ? 'border-2 border-blue-500 shadow-2xl scale-105' : 'border shadow-lg'}`}>
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center py-2 text-sm font-semibold">
                    Most Popular
                  </div>
                )}
                
                <CardHeader className={plan.popular ? 'pt-12' : 'pt-6'}>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
                      <plan.icon className="w-6 h-6 text-white" />
                    </div>
                    {plan.name === 'Pro' && (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        14-day free trial
                      </Badge>
                    )}
                  </div>
                  
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {plan.description}
                  </CardDescription>
                  
                  <div className="flex items-baseline mt-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      /{plan.period}
                    </span>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Link href={plan.name === 'Teams' ? '/contact' : '/auth/sign-up'}>
                    <Button 
                      className={`w-full mb-6 ${plan.popular ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' : ''}`}
                      variant={plan.popular ? 'default' : 'outline'}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 dark:text-white">What&apos;s included:</h4>
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                    
                    {plan.limitations.length > 0 && (
                      <div className="pt-4 border-t">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Limitations:</h4>
                        {plan.limitations.map((limitation, limitIndex) => (
                          <div key={limitIndex} className="flex items-start">
                            <span className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0">×</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{limitation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our platform includes all the tools and features you need for effective learning
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center">
                  <feature.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Crown className="w-16 h-16 mx-auto mb-6 text-yellow-500" />
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Need Something Custom?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              For large organizations with specific requirements, we offer custom enterprise solutions 
              with dedicated support, custom integrations, and flexible pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Headphones className="w-5 h-5 mr-2" />
                  Contact Sales
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline">
                  <Rocket className="w-5 h-5 mr-2" />
                  Schedule Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Got questions? We&apos;ve got answers.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {faqs.map((faq, index) => (
                <Card key={index} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </p>
                </Card>
              ))}
            </div>
            
            <div className="text-center mt-12">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Still have questions?
              </p>
              <Link href="/contact">
                <Button variant="outline">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to Start Learning?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join millions of learners who are already transforming their careers with Suuupra.
          </p>
          <Link href="/auth/sign-up">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              <Rocket className="w-5 h-5 mr-2" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
