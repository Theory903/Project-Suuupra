'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Tabs not used on pricing page currently
import { Switch } from '@/components/ui/switch';
import {
  Check,
  Star,
  Crown,
  Users,
  BookOpen,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/use-auth';
import { useSubscription } from '@/hooks/subscription/use-subscription';
import { CheckoutModal } from '@/components/subscription/checkout-modal';
import { toast } from 'sonner';

interface PricingTier {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  originalMonthlyPrice?: number;
  originalYearlyPrice?: number;
  popular?: boolean;
  icon: React.ReactNode;
  features: string[];
  limitations?: string[];
  maxUsers?: number;
  maxStorage?: string;
  buttonText: string;
  buttonVariant: 'default' | 'outline' | 'secondary';
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out Suuupra',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <BookOpen className="h-6 w-6" />,
    features: [
      'Access to 3 courses per month',
      'Basic video streaming',
      'Community forums access',
      'Mobile app access',
      'Basic progress tracking',
    ],
    limitations: [
      'Limited to 720p video quality',
      'No offline downloads',
      'Basic customer support',
    ],
    maxUsers: 1,
    maxStorage: '1 GB',
    buttonText: 'Get Started Free',
    buttonVariant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Best for individual learners',
    monthlyPrice: 29,
    yearlyPrice: 290,
    originalMonthlyPrice: 39,
    originalYearlyPrice: 468,
    popular: true,
    icon: <Star className="h-6 w-6" />,
    features: [
      'Unlimited course access',
      'HD video streaming (1080p)',
      'Offline downloads',
      'Priority customer support',
      'Advanced progress analytics',
      'Certificate of completion',
      'Live Q&A sessions',
      'Community forums access',
      'Mobile app access',
      'Personal learning dashboard',
    ],
    maxUsers: 1,
    maxStorage: '50 GB',
    buttonText: 'Start Pro Trial',
    buttonVariant: 'default',
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Perfect for small teams',
    monthlyPrice: 79,
    yearlyPrice: 790,
    originalMonthlyPrice: 99,
    originalYearlyPrice: 1188,
    icon: <Users className="h-6 w-6" />,
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Team learning analytics',
      'Custom learning paths',
      'Team collaboration tools',
      'Admin dashboard',
      'Bulk user management',
      'Team progress tracking',
      'Priority support',
      'SSO integration',
    ],
    maxUsers: 10,
    maxStorage: '500 GB',
    buttonText: 'Start Team Trial',
    buttonVariant: 'default',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    monthlyPrice: 199,
    yearlyPrice: 1990,
    originalMonthlyPrice: 299,
    originalYearlyPrice: 3588,
    icon: <Crown className="h-6 w-6" />,
    features: [
      'Everything in Team',
      'Unlimited team members',
      'Advanced analytics & reporting',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
      'Advanced security features',
      'Custom branding',
      'API access',
      'White-label options',
      'Advanced SSO & SCIM',
      'Compliance reports',
    ],
    maxUsers: 999999,
    maxStorage: 'Unlimited',
    buttonText: 'Contact Sales',
    buttonVariant: 'secondary',
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const { isAuthenticated } = useAuth();
  const { data: subscription } = useSubscription();

  const handleSelectPlan = (tier: PricingTier) => {
    if (tier.id === 'free') {
      if (!isAuthenticated) {
        window.location.href = '/auth/sign-up?plan=free';
        return;
      }
      toast.success('You\'re already on the free plan!');
      return;
    }

    if (tier.id === 'enterprise') {
      // For enterprise, still show checkout modal for demonstration
      // In production, you might want to redirect to sales
      if (!isAuthenticated) {
        localStorage.setItem('selectedPlan', JSON.stringify({ 
          tierId: tier.id, 
          isYearly 
        }));
        window.location.href = '/auth/sign-up?plan=enterprise';
        return;
      }
      setSelectedTier(tier.id);
      setShowCheckout(true);
      return;
    }

    if (!isAuthenticated) {
      localStorage.setItem('selectedPlan', JSON.stringify({ 
        tierId: tier.id, 
        isYearly 
      }));
      window.location.href = `/auth/sign-up?plan=${tier.id}`;
      return;
    }

    setSelectedTier(tier.id);
    setShowCheckout(true);
  };

  const handleStartFreeTrial = () => {
    if (!isAuthenticated) {
      window.location.href = '/auth/sign-up?plan=pro&trial=true';
      return;
    }
    
    // If already authenticated, show pro checkout with trial info
    const proTier = pricingTiers.find(t => t.id === 'pro');
    if (proTier) {
      setSelectedTier('pro');
      setShowCheckout(true);
    }
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@suuupra.com?subject=Enterprise%20Plan%20Inquiry&body=Hi,%0A%0AI\'m interested in learning more about your Enterprise plan.%0A%0APlease contact me to discuss our needs.%0A%0AThank you!';
  };

  const getPrice = (tier: PricingTier) => {
    return isYearly ? tier.yearlyPrice : tier.monthlyPrice;
  };

  const getOriginalPrice = (tier: PricingTier) => {
    return isYearly ? tier.originalYearlyPrice : tier.originalMonthlyPrice;
  };

  const getSavings = (tier: PricingTier) => {
    if (!tier.originalMonthlyPrice) return 0;
    const originalPrice = isYearly ? tier.originalYearlyPrice || 0 : tier.originalMonthlyPrice;
    const currentPrice = getPrice(tier);
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  };

  const faqs = [
    {
      question: 'Can I change my plan anytime?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately and billing is prorated.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, UPI, net banking, and digital wallets. All payments are processed securely.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes! All paid plans come with a 14-day free trial. No credit card required to start.',
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Absolutely. You can cancel your subscription at any time. You\'ll continue to have access until the end of your billing period.',
    },
    {
      question: 'Do you offer refunds?',
      answer: 'We offer a 30-day money-back guarantee for all paid plans. Contact our support team for assistance.',
    },
    {
      question: 'What happens to my data if I cancel?',
      answer: 'Your learning progress and data are safely stored for 90 days after cancellation, giving you time to reactivate or export your data.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
            <Sparkles className="h-3 w-3 mr-1" />
            Special Launch Pricing
          </Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Choose Your Learning Journey
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            From individual learners to enterprise teams, we have the perfect plan to accelerate your growth
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mt-8 space-x-4">
            <span className={`text-sm ${!isYearly ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-blue-600"
            />
            <span className={`text-sm ${isYearly ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500'}`}>
              Yearly
            </span>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              Save up to 38%
            </Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {pricingTiers.map((tier) => {
            const price = getPrice(tier);
            const originalPrice = getOriginalPrice(tier);
            const savings = getSavings(tier);
            const isCurrentPlan = subscription?.tierId === tier.id;

            return (
              <Card key={tier.id} className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                tier.popular ? 'border-2 border-blue-500 scale-105 shadow-xl' : 'hover:scale-105'
              }`}>
                {tier.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center py-2 text-sm font-semibold">
                    <Star className="h-4 w-4 inline mr-1" />
                    Most Popular
                  </div>
                )}
                
                <CardHeader className={`text-center ${tier.popular ? 'pt-12' : 'pt-6'}`}>
                  <div className="flex justify-center mb-4">
                    <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                      {tier.icon}
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-300">
                    {tier.description}
                  </CardDescription>
                  
                  <div className="mt-6">
                    {originalPrice && originalPrice > price ? (
                      <div className="space-y-1">
                        <div className="text-sm text-gray-500 line-through">
                          ₹{originalPrice}{isYearly ? '/year' : '/month'}
                        </div>
                        <div className="flex items-baseline justify-center">
                          <span className="text-4xl font-bold">₹{price}</span>
                          <span className="text-gray-500 ml-1">{isYearly ? '/year' : '/month'}</span>
                        </div>
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                          Save {savings}%
                        </Badge>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-center">
                        {price === 0 ? (
                          <span className="text-4xl font-bold">Free</span>
                        ) : (
                          <>
                            <span className="text-4xl font-bold">₹{price}</span>
                            <span className="text-gray-500 ml-1">{isYearly ? '/year' : '/month'}</span>
                          </>
                        )}
                      </div>
                    )}
                    
                    {isYearly && price > 0 && (
                      <div className="text-sm text-gray-500 mt-1">
                        ₹{Math.round(price/12)} per month, billed annually
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Button
                    className={`w-full mb-6 ${tier.popular ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' : ''}`}
                    variant={tier.buttonVariant}
                    onClick={() => handleSelectPlan(tier)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? 'Current Plan' : tier.buttonText}
                    {!isCurrentPlan && tier.id !== 'free' && tier.id !== 'enterprise' && (
                      <ArrowRight className="ml-2 h-4 w-4" />
                    )}
                  </Button>

                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {tier.limitations && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 mb-2">Limitations:</p>
                      <ul className="space-y-1">
                        {tier.limitations.map((limitation, index) => (
                          <li key={index} className="flex items-start text-xs text-gray-500">
                            <Info className="h-3 w-3 mr-2 mt-0.5 flex-shrink-0" />
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t text-center">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Users: {tier.maxUsers === 999999 ? 'Unlimited' : tier.maxUsers}</span>
                      <span>Storage: {tier.maxStorage}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">Feature Comparison</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">Features</th>
                    {pricingTiers.map((tier) => (
                      <th key={tier.id} className="text-center p-4 font-semibold min-w-32">
                        <div className="flex flex-col items-center">
                          {tier.icon}
                          <span className="mt-2">{tier.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Course Access', free: '3/month', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
                    { feature: 'Video Quality', free: '720p', pro: '1080p', team: '1080p', enterprise: '4K' },
                    { feature: 'Offline Downloads', free: '✗', pro: '✓', team: '✓', enterprise: '✓' },
                    { feature: 'Live Classes', free: '✗', pro: '✓', team: '✓', enterprise: '✓' },
                    { feature: 'AI Tutor', free: '✗', pro: '✓', team: '✓', enterprise: '✓' },
                    { feature: 'Team Analytics', free: '✗', pro: '✗', team: '✓', enterprise: '✓' },
                    { feature: 'SSO Integration', free: '✗', pro: '✗', team: '✓', enterprise: '✓' },
                    { feature: 'API Access', free: '✗', pro: '✗', team: '✗', enterprise: '✓' },
                    { feature: 'White-label', free: '✗', pro: '✗', team: '✗', enterprise: '✓' },
                  ].map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : ''}>
                      <td className="p-4 font-medium">{row.feature}</td>
                      <td className="p-4 text-center">{row.free}</td>
                      <td className="p-4 text-center">{row.pro}</td>
                      <td className="p-4 text-center">{row.team}</td>
                      <td className="p-4 text-center">{row.enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="overflow-hidden">
                <button
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                >
                  <span className="font-semibold">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-6 text-gray-600 dark:text-gray-300">
                    {faq.answer}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <CardContent className="p-12">
              <h2 className="text-3xl font-bold mb-4">Ready to transform your learning?</h2>
              <p className="text-xl mb-8 opacity-90">
                Join thousands of learners who have accelerated their careers with Suuupra
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={handleStartFreeTrial}
                >
                  Start Free Trial
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-white border-white hover:bg-white hover:text-blue-600"
                  onClick={handleContactSales}
                >
                  Contact Sales
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (selectedTier === 'pro' || selectedTier === 'team' || selectedTier === 'enterprise') && (
        <CheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          tier={(function() {
            const t = pricingTiers.find(t => t.id === selectedTier)!;
            return {
              id: t.id as 'pro' | 'team' | 'enterprise',
              name: t.name,
              monthlyPrice: t.monthlyPrice,
              yearlyPrice: t.yearlyPrice,
            };
          })()}
          isYearly={isYearly}
        />
      )}
    </div>
  );
}