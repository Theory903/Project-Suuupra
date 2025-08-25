import { BillingDashboard } from '@/components/subscription/billing-dashboard';
import { PageHeader } from '@/components/layout/page-header';

export default function BillingSettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title="Billing & Subscription"
        description="Manage your subscription, payment methods, and billing history"
      />
      
      <BillingDashboard />
    </div>
  );
}