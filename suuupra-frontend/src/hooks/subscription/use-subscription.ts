'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentsApi, SubscriptionsApi } from '@/lib/api-client';

export interface Subscription {
  id: string;
  tierId: 'free' | 'pro' | 'team' | 'enterprise';
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete';
  currentPeriodEnd?: string;
  trialEnd?: string;
  canceledAt?: string;
}

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      try {
        const response = await SubscriptionsApi.getCurrentSubscription();
        return response as Subscription;
      } catch {
        // If user doesn't have a subscription, return a free tier default
        return {
          id: 'free-default',
          tierId: 'free' as const,
          status: 'active' as const,
        } satisfies Subscription;
      }
    },
    staleTime: 60_000,
    retry: false, // Don't retry on auth errors
  });
}

export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      tierId: 'pro' | 'team' | 'enterprise';
      isYearly: boolean;
      paymentMethod: {
        type: 'card' | 'upi' | 'netbanking';
        details?: Record<string, unknown>;
      };
    }) => {
      const amountMap: Record<string, { monthly: number; yearly: number }> = {
        pro: { monthly: 29_00, yearly: 290_00 },
        team: { monthly: 79_00, yearly: 790_00 },
        enterprise: { monthly: 199_00, yearly: 1990_00 },
      };

      const cents = payload.isYearly
        ? amountMap[payload.tierId].yearly
        : amountMap[payload.tierId].monthly;

      // 1. Create payment intent
      const intent = await PaymentsApi.createIntent({
        amount: cents,
        currency: 'INR',
        description: `${payload.tierId} ${payload.isYearly ? 'yearly' : 'monthly'} subscription`,
      });

      // 2. Process payment
      const payment = await PaymentsApi.processPayment({
        paymentIntentId: intent.id as unknown as string,
        paymentMethod: payload.paymentMethod,
      });

      // 3. Create subscription after successful payment
      if (payment.status === 'completed') {
        await SubscriptionsApi.createSubscription({
          tierId: payload.tierId,
          isYearly: payload.isYearly,
          paymentIntentId: intent.id as unknown as string,
        });
      }

      // 4. Invalidate queries to refresh subscription data
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      return payment;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      await SubscriptionsApi.cancelSubscription(subscriptionId);
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subscriptionId, ...updates }: { 
      subscriptionId: string; 
      tierId?: string; 
      isYearly?: boolean; 
    }) => {
      await SubscriptionsApi.updateSubscription(subscriptionId, updates);
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => SubscriptionsApi.getInvoices(),
    staleTime: 300_000, // 5 minutes
  });
}


