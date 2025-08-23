'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { 
  CreditCard,
  Calendar,
  Download,
  Plus,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Receipt,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  Zap,
  Crown,
  Star
} from 'lucide-react';

export default function BillingSettingsPage() {
  const [selectedPlan, setSelectedPlan] = useState('pro');

  // Mock billing data
  const currentPlan = {
    name: 'Pro',
    price: 29,
    period: 'month',
    features: [
      'Access to 1000+ premium courses',
      'Unlimited AI tutor access',
      'Live classes and workshops',
      'Industry-recognized certificates',
      'Offline downloads',
      'Priority support'
    ],
    nextBilling: '2024-02-15',
    status: 'active'
  };

  const paymentMethods = [
    {
      id: '1',
      type: 'card',
      brand: 'visa',
      last4: '1234',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    },
    {
      id: '2',
      type: 'card',
      brand: 'mastercard',
      last4: '5678',
      expiryMonth: 8,
      expiryYear: 2026,
      isDefault: false
    }
  ];

  const billingHistory = [
    {
      id: '1',
      date: '2024-01-15',
      description: 'Pro Monthly Subscription',
      amount: 29.00,
      status: 'paid',
      invoiceUrl: '/invoices/inv-001.pdf'
    },
    {
      id: '2',
      date: '2023-12-15',
      description: 'Pro Monthly Subscription',
      amount: 29.00,
      status: 'paid',
      invoiceUrl: '/invoices/inv-002.pdf'
    },
    {
      id: '3',
      date: '2023-11-15',
      description: 'Pro Monthly Subscription',
      amount: 29.00,
      status: 'paid',
      invoiceUrl: '/invoices/inv-003.pdf'
    },
    {
      id: '4',
      date: '2023-10-15',
      description: 'Course Purchase - React Bootcamp',
      amount: 89.00,
      status: 'paid',
      invoiceUrl: '/invoices/inv-004.pdf'
    }
  ];

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      period: 'forever',
      description: 'Perfect for getting started',
      features: [
        'Access to 50+ free courses',
        'Basic AI tutor (5 questions/day)',
        'Community forums',
        'Mobile app access'
      ],
      limitations: [
        'No certificates',
        'Limited AI tutor usage',
        'No live classes'
      ],
      popular: false,
      icon: Zap,
      color: 'from-gray-500 to-gray-600'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      period: 'month',
      description: 'Best for serious learners',
      features: [
        'Access to 1000+ premium courses',
        'Unlimited AI tutor access',
        'Live classes and workshops',
        'Industry-recognized certificates',
        'Offline downloads',
        'Priority support'
      ],
      limitations: [],
      popular: true,
      icon: Star,
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: 'teams',
      name: 'Teams',
      price: 99,
      period: 'month',
      description: 'Perfect for teams',
      features: [
        'Everything in Pro',
        'Team management dashboard',
        'Bulk user management',
        'Advanced reporting',
        'Custom branding',
        'Dedicated account manager'
      ],
      limitations: [],
      popular: false,
      icon: Crown,
      color: 'from-purple-500 to-pink-600'
    }
  ];

  const usageStats = {
    coursesAccessed: 15,
    coursesLimit: 1000,
    aiQuestionsAsked: 245,
    aiQuestionsLimit: -1, // unlimited
    liveClassesAttended: 8,
    liveClassesLimit: -1,
    storageUsed: 2.4, // GB
    storageLimit: 10 // GB
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Cancelled</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Past Due</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your subscription, payment methods, and billing history"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Star className="w-5 h-5" />
                    <span>Current Plan</span>
                  </CardTitle>
                  <CardDescription>
                    Your active subscription and usage
                  </CardDescription>
                </div>
                {getStatusBadge(currentPlan.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{currentPlan.name}</h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        ${currentPlan.price}/{currentPlan.period}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Next billing:</span>
                      <span className="font-medium">{formatDate(currentPlan.nextBilling)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                      <span className="font-medium">${currentPlan.price}.00</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Plan Features</h4>
                  <div className="space-y-2">
                    {currentPlan.features.slice(0, 4).map((feature, index) => (
                      <div key={index} className="flex items-center text-sm">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                    {currentPlan.features.length > 4 && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        +{currentPlan.features.length - 4} more features
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <Button>
                  <Edit className="w-4 h-4 mr-2" />
                  Change Plan
                </Button>
                <Button variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Cancel Subscription
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Usage This Month</span>
              </CardTitle>
              <CardDescription>
                Track your usage against plan limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Courses Accessed</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {usageStats.coursesAccessed} / {usageStats.coursesLimit === -1 ? '∞' : usageStats.coursesLimit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(usageStats.coursesAccessed / usageStats.coursesLimit) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">AI Questions</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {usageStats.aiQuestionsAsked} / {usageStats.aiQuestionsLimit === -1 ? '∞' : usageStats.aiQuestionsLimit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Live Classes</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {usageStats.liveClassesAttended} / {usageStats.liveClassesLimit === -1 ? '∞' : usageStats.liveClassesLimit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Storage Used</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {usageStats.storageUsed}GB / {usageStats.storageLimit}GB
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full"
                        style={{ width: `${(usageStats.storageUsed / usageStats.storageLimit) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5" />
                    <span>Payment Methods</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your payment methods and billing information
                  </CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Method
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium capitalize">
                            {method.brand} •••• {method.last4}
                          </h4>
                          {method.isDefault && (
                            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Expires {method.expiryMonth.toString().padStart(2, '0')}/{method.expiryYear}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <Receipt className="w-5 h-5" />
                    <span>Billing History</span>
                  </CardTitle>
                  <CardDescription>
                    View and download your past invoices
                  </CardDescription>
                </div>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingHistory.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium">{invoice.description}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(invoice.date)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-semibold">${invoice.amount.toFixed(2)}</p>
                        {getPaymentStatusBadge(invoice.status)}
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Invoice
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Plan Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                Compare and upgrade your plan
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const isCurrentPlan = plan.id === 'pro';
                
                return (
                  <div key={plan.id} className={`p-4 border rounded-lg ${isCurrentPlan ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold">{plan.name}</h3>
                      </div>
                      {isCurrentPlan && (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <span className="text-2xl font-bold">${plan.price}</span>
                      <span className="text-gray-600 dark:text-gray-400">/{plan.period}</span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      {plan.description}
                    </p>
                    
                    {!isCurrentPlan && (
                      <Button size="sm" className="w-full">
                        {plan.price > 29 ? 'Upgrade' : 'Downgrade'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Billing Information */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Current Plan:</span>
                <span className="font-medium">{currentPlan.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Monthly Cost:</span>
                <span className="font-medium">${currentPlan.price}.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Next Billing:</span>
                <span className="font-medium">{formatDate(currentPlan.nextBilling)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
                <span className="font-medium">Visa •••• 1234</span>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Billing Support</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                  Need help with billing or have questions about your subscription?
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Contact Billing Support
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Report Billing Issue
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Our billing team typically responds within 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

