'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CreditCard,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Crown,
  Star,
  Users,
  BookOpen,
  Shield,
} from 'lucide-react';
import { 
  useSubscription, 
  useCancelSubscription, 
  useInvoices 
} from '@/hooks/subscription/use-subscription';
import { CheckoutModal } from './checkout-modal';
import { toast } from 'sonner';

const tierConfig = {
  free: {
    name: 'Free',
    icon: BookOpen,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  pro: {
    name: 'Pro',
    icon: Star,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  team: {
    name: 'Team',
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  enterprise: {
    name: 'Enterprise',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
};

export function BillingDashboard() {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'pro' | 'team' | 'enterprise'>('pro');

  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices();
  const { mutate: cancelSubscription, isPending: cancelling } = useCancelSubscription();

  if (subscriptionLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-lg" />
        <div className="h-64 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  const currentTier = subscription?.tierId || 'free';
  const TierIcon = tierConfig[currentTier].icon;

  const handleCancelSubscription = () => {
    if (subscription && subscription.id !== 'free-default') {
      cancelSubscription(subscription.id, {
        onSuccess: () => {
          toast.success('Subscription cancelled successfully');
          setShowCancelDialog(false);
        },
        onError: () => {
          toast.error('Failed to cancel subscription');
        }
      });
    }
  };

  const handleUpgrade = (tierId: 'pro' | 'team' | 'enterprise') => {
    setSelectedTier(tierId);
    setShowUpgradeModal(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Active' },
      trialing: { color: 'bg-blue-100 text-blue-800', icon: Clock, label: 'Trial' },
      canceled: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: 'Cancelled' },
      past_due: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Past Due' },
      incomplete: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Incomplete' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const StatusIcon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center space-x-1`}>
        <StatusIcon className="w-3 h-3" />
        <span>{config.label}</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-8">
      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-full ${tierConfig[currentTier].bgColor}`}>
                <TierIcon className={`w-6 h-6 ${tierConfig[currentTier].color}`} />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {tierConfig[currentTier].name} Plan
                </CardTitle>
                <CardDescription>
                  Your current subscription plan
                </CardDescription>
              </div>
            </div>
            {subscription?.status && getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <div className="font-semibold capitalize">
                {subscription?.status || 'Active'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Next Billing</div>
              <div className="font-semibold">
                {formatDate(subscription?.currentPeriodEnd)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Plan Started</div>
              <div className="font-semibold">
                {subscription?.id === 'free-default' ? 'N/A' : formatDate(subscription?.currentPeriodEnd)}
              </div>
            </div>
          </div>

          {subscription?.status === 'trialing' && subscription?.trialEnd && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                <Clock className="w-4 h-4" />
                <span className="font-semibold">Trial Active</span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Your trial ends on {formatDate(subscription.trialEnd)}. Add payment method to continue.
              </p>
            </div>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-4">
            {currentTier === 'free' ? (
              <>
                <Button onClick={() => handleUpgrade('pro')} className="flex-1">
                  Upgrade to Pro
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleUpgrade('team')}
                  className="flex-1"
                >
                  Upgrade to Team
                </Button>
              </>
            ) : currentTier === 'pro' ? (
              <>
                <Button onClick={() => handleUpgrade('team')} className="flex-1">
                  Upgrade to Team
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleUpgrade('enterprise')}
                  className="flex-1"
                >
                  Upgrade to Enterprise
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowCancelDialog(true)}
                  className="flex-1"
                >
                  Cancel Subscription
                </Button>
              </>
            ) : (
              <Button 
                variant="destructive" 
                onClick={() => setShowCancelDialog(true)}
                disabled={subscription?.status === 'canceled'}
                className="flex-1"
              >
                {subscription?.status === 'canceled' ? 'Already Cancelled' : 'Cancel Subscription'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Billing History</span>
          </CardTitle>
          <CardDescription>
            View and download your invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
              ))}
            </div>
          ) : invoicesData?.invoices?.length ? (
            <div className="space-y-4">
              {invoicesData.invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      invoice.status === 'paid' ? 'bg-green-100' :
                      invoice.status === 'pending' ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {invoice.status === 'paid' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : invoice.status === 'pending' ? (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">
                        ₹{invoice.amount} {invoice.currency}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.description} • {formatDate(invoice.invoiceDate)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={
                      invoice.status === 'paid' ? 'default' :
                      invoice.status === 'pending' ? 'secondary' : 'destructive'
                    }>
                      {invoice.status}
                    </Badge>
                    {invoice.downloadUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(invoice.downloadUrl, '_blank')}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No billing history available</p>
              <p className="text-sm">Your invoices will appear here once you make a purchase</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Cancel Subscription</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You'll lose access to premium features 
              at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Subscription
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelSubscription}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <CheckoutModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          tier={{
            id: selectedTier,
            name: tierConfig[selectedTier].name,
            monthlyPrice: selectedTier === 'pro' ? 29 : selectedTier === 'team' ? 79 : 199,
            yearlyPrice: selectedTier === 'pro' ? 290 : selectedTier === 'team' ? 790 : 1990,
          }}
          isYearly={false}
        />
      )}
    </div>
  );
}
