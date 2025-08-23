'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { 
  ArrowLeft,
  Download,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Calendar,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Receipt,
  Mail,
  Phone,
  MapPin,
  Truck,
  Star,
  MessageCircle
} from 'lucide-react';

interface OrderDetailPageProps {
  params: {
    id: string;
  };
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Mock order data - in real app, this would come from API
  const order = {
    id: params.id,
    orderNumber: `ORD-2024-${params.id.padStart(3, '0')}`,
    date: '2024-01-15T10:30:00Z',
    status: 'completed',
    paymentStatus: 'paid',
    total: 138.00,
    subtotal: 138.00,
    tax: 0,
    discount: 0,
    currency: 'USD',
    paymentMethod: {
      type: 'card',
      brand: 'visa',
      last4: '1234',
      expiryMonth: 12,
      expiryYear: 2025
    },
    billingAddress: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'United States'
    },
    items: [
      {
        id: '1',
        type: 'course',
        title: 'Complete React Development Bootcamp',
        instructor: 'Sarah Johnson',
        price: 89.00,
        originalPrice: 129.00,
        thumbnail: '/courses/react-bootcamp.jpg',
        accessUrl: '/learn/courses/react-bootcamp',
        downloadable: true,
        rating: 4.9,
        enrolled: true
      },
      {
        id: '2',
        type: 'course',
        title: 'JavaScript Fundamentals',
        instructor: 'Mike Chen',
        price: 49.00,
        originalPrice: 79.00,
        thumbnail: '/courses/js-fundamentals.jpg',
        accessUrl: '/learn/courses/js-fundamentals',
        downloadable: true,
        rating: 4.7,
        enrolled: true
      }
    ],
    timeline: [
      {
        id: '1',
        status: 'placed',
        title: 'Order Placed',
        description: 'Your order has been placed successfully',
        timestamp: '2024-01-15T10:30:00Z',
        completed: true
      },
      {
        id: '2',
        status: 'processing',
        title: 'Payment Processing',
        description: 'Processing your payment',
        timestamp: '2024-01-15T10:31:00Z',
        completed: true
      },
      {
        id: '3',
        status: 'confirmed',
        title: 'Payment Confirmed',
        description: 'Payment has been confirmed',
        timestamp: '2024-01-15T10:32:00Z',
        completed: true
      },
      {
        id: '4',
        status: 'completed',
        title: 'Order Completed',
        description: 'Course access has been granted',
        timestamp: '2024-01-15T10:33:00Z',
        completed: true
      }
    ],
    refundable: true,
    refundDeadline: '2024-02-14T10:30:00Z',
    invoiceUrl: `/invoices/${params.id}.pdf`,
    supportTickets: []
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"><RefreshCw className="w-3 h-3 mr-1" />Refunded</Badge>;
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
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isRefundable = order.refundable && new Date() < new Date(order.refundDeadline);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={`Placed on ${formatDate(order.date)}`}
        action={
          <div className="flex items-center space-x-2">
            <Link href="/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Invoice
            </Button>
            <Button variant="outline" size="sm">
              <Receipt className="w-4 h-4 mr-2" />
              Receipt
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Package className="w-5 h-5" />
                  <span>Order Status</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(order.status)}
                  {getPaymentStatusBadge(order.paymentStatus)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.timeline.map((event, index) => (
                  <div key={event.id} className="flex items-start space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      event.completed 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {event.completed ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{event.title}</h4>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>
                {order.items.length} item{order.items.length > 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center">
                      <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">by {item.instructor}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                          <span className="text-sm">{item.rating}</span>
                        </div>
                        {item.enrolled && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                            Enrolled
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="font-semibold">${item.price}</span>
                        {item.originalPrice > item.price && (
                          <span className="text-sm text-gray-500 line-through">
                            ${item.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Link href={item.accessUrl}>
                          <Button size="sm">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Access
                          </Button>
                        </Link>
                        {item.downloadable && (
                          <Button variant="outline" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5" />
                <span>Payment Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Payment Method</h4>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">
                        {order.paymentMethod.brand} •••• {order.paymentMethod.last4}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Expires {order.paymentMethod.expiryMonth}/{order.paymentMethod.expiryYear}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Order Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>${order.subtotal.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-green-600 dark:text-green-400">
                        <span>Discount</span>
                        <span>-${order.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.tax > 0 && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>${order.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${order.total.toFixed(2)} {order.currency}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="w-5 h-5" />
                <span>Billing Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Billing Address</h4>
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{order.billingAddress.name}</p>
                    <p>{order.billingAddress.address}</p>
                    <p>
                      {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.zipCode}
                    </p>
                    <p>{order.billingAddress.country}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.billingAddress.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{order.billingAddress.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <Download className="w-4 h-4 mr-2" />
                Download Invoice
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Receipt className="w-4 h-4 mr-2" />
                Print Receipt
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
              {isRefundable && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => setShowRefundModal(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Request Refund
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Order Number:</span>
                <span className="font-medium">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Order Date:</span>
                <span className="font-medium">{new Date(order.date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Payment Method:</span>
                <span className="font-medium capitalize">
                  {order.paymentMethod.brand} •••• {order.paymentMethod.last4}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Amount:</span>
                <span className="font-medium">${order.total.toFixed(2)} {order.currency}</span>
              </div>
              {isRefundable && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Refund Deadline:</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {new Date(order.refundDeadline).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Help & Support */}
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <p className="text-gray-600 dark:text-gray-300">
                  Having issues with your order or need assistance?
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Live Chat
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Mail className="w-4 h-4 mr-2" />
                    Email Support
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  Our support team typically responds within 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Refund Policy */}
          {isRefundable && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <span>Refund Policy</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <p className="text-gray-600 dark:text-gray-300">
                    You can request a full refund within 30 days of purchase.
                  </p>
                  <p className="text-orange-600 dark:text-orange-400 font-medium">
                    Refund deadline: {new Date(order.refundDeadline).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Refunds are processed within 5-7 business days.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

