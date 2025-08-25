'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Wallet, Landmark, Shield } from 'lucide-react';
import { useCreateCheckout } from '@/hooks/subscription/use-subscription';
import { toast } from 'sonner';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: { id: 'pro' | 'team' | 'enterprise'; name: string; monthlyPrice: number; yearlyPrice: number };
  isYearly: boolean;
}

export function CheckoutModal({ isOpen, onClose, tier, isYearly }: CheckoutModalProps) {
  const [method, setMethod] = useState<'card' | 'upi' | 'netbanking'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExp, setCardExp] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState('HDFC');

  const { mutateAsync: createCheckout, isPending } = useCreateCheckout();

  const amount = isYearly ? tier.yearlyPrice : tier.monthlyPrice;

  const handlePay = async () => {
    try {
      const details: Record<string, unknown> = {};
      
      if (method === 'card') {
        if (!cardNumber || !cardExp || !cardCvc) {
          toast.error('Please enter complete card details');
          return;
        }
        // Basic validation
        if (cardNumber.length < 13 || cardExp.length < 4 || cardCvc.length < 3) {
          toast.error('Please enter valid card details');
          return;
        }
        details.cardNumber = cardNumber;
        details.expiry = cardExp;
        details.cvc = cardCvc;
      } else if (method === 'upi') {
        if (!upiId) {
          toast.error('Enter a valid UPI ID');
          return;
        }
        // Basic UPI validation
        if (!upiId.includes('@') || upiId.length < 5) {
          toast.error('Please enter a valid UPI ID');
          return;
        }
        details.upiId = upiId;
      } else if (method === 'netbanking') {
        details.bank = bank;
      }

      const result = await createCheckout({
        tierId: tier.id,
        isYearly,
        paymentMethod: { type: method, details },
      });

      if (result.status === 'completed') {
        toast.success(`🎉 Welcome to ${tier.name}! Your subscription is now active.`);
        onClose();
        // Redirect to dashboard after successful payment
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        toast.error('Payment processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please check your details and try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>
            Complete your purchase to activate the {tier.name} plan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{tier.name} Plan</div>
                <div className="text-sm text-muted-foreground">{isYearly ? 'Yearly' : 'Monthly'} billing</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">₹{amount}</div>
                {isYearly && <div className="text-xs text-muted-foreground">≈ ₹{Math.round(amount/12)}/mo</div>}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">
                  <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Card</div>
                </SelectItem>
                <SelectItem value="upi">
                  <div className="flex items-center gap-2"><Wallet className="h-4 w-4" /> UPI</div>
                </SelectItem>
                <SelectItem value="netbanking">
                  <div className="flex items-center gap-2"><Landmark className="h-4 w-4" /> Net Banking</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === 'card' && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Card number</Label>
                <Input placeholder="4242 4242 4242 4242" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expiry (MM/YY)</Label>
                  <Input placeholder="12/26" value={cardExp} onChange={(e) => setCardExp(e.target.value)} />
                </div>
                <div>
                  <Label>CVC</Label>
                  <Input placeholder="123" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {method === 'upi' && (
            <div>
              <Label>UPI ID</Label>
              <Input placeholder="name@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
            </div>
          )}

          {method === 'netbanking' && (
            <div>
              <Label>Select Bank</Label>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['HDFC','ICICI','SBI','AXIS','KOTAK'].map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Payments are secured and encrypted. You can cancel anytime.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handlePay} disabled={isPending}>
            {isPending ? 'Processing...' : `Pay ₹${amount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


