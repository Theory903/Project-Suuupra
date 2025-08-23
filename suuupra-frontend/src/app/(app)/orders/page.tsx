'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/ui/data-table';
import { 
  Search, 
  Filter,
  Download,
  Eye,
  Calendar,
  CreditCard,
  Package,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Receipt,
  ArrowUpDown,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';

interface Order {
  id: string;
  date: string;
  items: {
    name: string;
    type: 'course' | 'subscription' | 'certificate';
    price: number;
  }[];
  total: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  invoiceUrl?: string;
}

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const orders: Order[] = [
    {
      id: 'ORD-2024-001',
      date: '2024-01-15',
      items: [
        { name: 'Complete React Development Bootcamp', type: 'course', price: 89 },
        { name: 'JavaScript Fundamentals', type: 'course', price: 49 }
      ],
      total: 138,
      status: 'completed',
      paymentMethod: 'Visa ****1234',
      invoiceUrl: '/invoices/ORD-2024-001.pdf'
    },
    {
      id: 'ORD-2024-002',
      date: '2024-01-10',
      items: [
        { name: 'Pro Monthly Subscription', type: 'subscription', price: 29 }
      ],
      total: 29,
      status: 'completed',
      paymentMethod: 'PayPal',
      invoiceUrl: '/invoices/ORD-2024-002.pdf'
    },
    {
      id: 'ORD-2024-003',
      date: '2024-01-08',
      items: [
        { name: 'AI & Machine Learning Certificate', type: 'certificate', price: 99 }
      ],
      total: 99,
      status: 'pending',
      paymentMethod: 'Visa ****5678'
    },
    {
      id: 'ORD-2024-004',
      date: '2024-01-05',
      items: [
        { name: 'UI/UX Design Masterclass', type: 'course', price: 79 },
        { name: 'Figma for Beginners', type: 'course', price: 39 }
      ],
      total: 118,
      status: 'completed',
      paymentMethod: 'Mastercard ****9012',
      invoiceUrl: '/invoices/ORD-2024-004.pdf'
    },
    {
      id: 'ORD-2024-005',
      date: '2024-01-03',
      items: [
        { name: 'Data Science Bundle', type: 'course', price: 199 }
      ],
      total: 199,
      status: 'refunded',
      paymentMethod: 'Visa ****1234'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"><RefreshCw className="w-3 h-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'course':
        return '📚';
      case 'subscription':
        return '⭐';
      case 'certificate':
        return '🏆';
      default:
        return '📦';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalSpent = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + order.total, 0);

  const stats = [
    { label: 'Total Orders', value: orders.length.toString(), icon: Package },
    { label: 'Total Spent', value: `$${totalSpent}`, icon: CreditCard },
    { label: 'Completed', value: orders.filter(o => o.status === 'completed').length.toString(), icon: CheckCircle },
    { label: 'This Month', value: orders.filter(o => new Date(o.date).getMonth() === new Date().getMonth()).length.toString(), icon: Calendar }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Order History"
        description="View and manage your purchase history"
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search orders by ID or item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No orders found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'You haven\'t made any purchases yet'
                }
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link href="/learn/courses">
                  <Button>Browse Courses</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <span>{order.id}</span>
                      {getStatusBadge(order.status)}
                    </CardTitle>
                    <CardDescription className="flex items-center space-x-4 mt-1">
                      <span className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(order.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center">
                        <CreditCard className="w-4 h-4 mr-1" />
                        {order.paymentMethod}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${order.total}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Order Items */}
                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getItemTypeIcon(item.type)}</span>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{item.type}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ${item.price}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex space-x-2">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </Link>
                      {order.invoiceUrl && (
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-2" />
                          Invoice
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex space-x-2">
                      {order.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          <Receipt className="w-4 h-4 mr-2" />
                          Receipt
                        </Button>
                      )}
                      {order.status === 'failed' && (
                        <Button size="sm">
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Retry Payment
                        </Button>
                      )}
                      {order.status === 'completed' && (
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Access Content
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Having issues with your orders or need assistance?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <Button variant="outline" className="justify-start">
              <RefreshCw className="w-4 h-4 mr-2" />
              Request Refund
            </Button>
            <Button variant="outline" className="justify-start">
              <Receipt className="w-4 h-4 mr-2" />
              Download Invoice
            </Button>
            <Button variant="outline" className="justify-start">
              <ExternalLink className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
