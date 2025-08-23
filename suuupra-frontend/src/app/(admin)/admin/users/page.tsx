'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Search, 
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  MoreHorizontal,
  Users,
  UserCheck,
  UserX,
  Shield,
  Mail,
  Calendar,
  Activity,
  Ban,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'creator' | 'admin';
  status: 'active' | 'suspended' | 'pending';
  joinDate: string;
  lastActive: string;
  coursesEnrolled: number;
  coursesCreated?: number;
  totalSpent: number;
  avatar?: string;
}

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const users: User[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'user',
      status: 'active',
      joinDate: '2024-01-15',
      lastActive: '2024-01-20',
      coursesEnrolled: 5,
      totalSpent: 299
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      role: 'creator',
      status: 'active',
      joinDate: '2023-12-10',
      lastActive: '2024-01-19',
      coursesEnrolled: 12,
      coursesCreated: 8,
      totalSpent: 0
    },
    {
      id: '3',
      name: 'Mike Chen',
      email: 'mike.chen@example.com',
      role: 'user',
      status: 'suspended',
      joinDate: '2024-01-05',
      lastActive: '2024-01-18',
      coursesEnrolled: 3,
      totalSpent: 149
    },
    {
      id: '4',
      name: 'Emma Wilson',
      email: 'emma.wilson@example.com',
      role: 'creator',
      status: 'active',
      joinDate: '2023-11-20',
      lastActive: '2024-01-20',
      coursesEnrolled: 8,
      coursesCreated: 15,
      totalSpent: 0
    },
    {
      id: '5',
      name: 'David Kim',
      email: 'david.kim@example.com',
      role: 'admin',
      status: 'active',
      joinDate: '2023-10-01',
      lastActive: '2024-01-20',
      coursesEnrolled: 25,
      totalSpent: 0
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><Ban className="w-3 h-3 mr-1" />Suspended</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">Admin</Badge>;
      case 'creator':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Creator</Badge>;
      case 'user':
        return <Badge variant="secondary">User</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'creator': return UserCheck;
      case 'user': return Users;
      default: return Users;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = [
    { 
      label: 'Total Users', 
      value: users.length.toString(), 
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400'
    },
    { 
      label: 'Active Users', 
      value: users.filter(u => u.status === 'active').length.toString(), 
      icon: UserCheck,
      color: 'text-green-600 dark:text-green-400'
    },
    { 
      label: 'Creators', 
      value: users.filter(u => u.role === 'creator').length.toString(), 
      icon: UserCheck,
      color: 'text-purple-600 dark:text-purple-400'
    },
    { 
      label: 'Suspended', 
      value: users.filter(u => u.status === 'suspended').length.toString(), 
      icon: UserX,
      color: 'text-red-600 dark:text-red-400'
    }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="Manage users, creators, and administrators"
        action={
          <div className="flex items-center space-x-2">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import Users
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
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
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="creator">Creators</option>
                <option value="admin">Admins</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No users found
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Try adjusting your search or filters
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => {
            const RoleIcon = getRoleIcon(user.role);
            return (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                        <RoleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {user.name}
                          </h3>
                          {getStatusBadge(user.status)}
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center">
                            <Mail className="w-4 h-4 mr-1" />
                            {user.email}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            Joined {new Date(user.joinDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Activity className="w-4 h-4 mr-1" />
                            Last active {new Date(user.lastActive).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400 mt-2">
                          <span>{user.coursesEnrolled} courses enrolled</span>
                          {user.coursesCreated && (
                            <span>{user.coursesCreated} courses created</span>
                          )}
                          <span>${user.totalSpent} total spent</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      {user.status === 'active' ? (
                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                          <Ban className="w-4 h-4 mr-2" />
                          Suspend
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Activate
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>
            Perform actions on multiple users at once
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="justify-start">
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button variant="outline" className="justify-start">
              <Ban className="w-4 h-4 mr-2" />
              Bulk Suspend
            </Button>
            <Button variant="outline" className="justify-start">
              <CheckCircle className="w-4 h-4 mr-2" />
              Bulk Activate
            </Button>
            <Button variant="outline" className="justify-start">
              <Download className="w-4 h-4 mr-2" />
              Export Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>User Registration Trends</CardTitle>
            <CardDescription>
              New user registrations over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">Registration trends chart</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Activity</CardTitle>
            <CardDescription>
              Recent user activity and engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Daily Active Users</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">1,247</p>
                </div>
                <div className="text-green-600 dark:text-green-400">
                  +12.5%
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Course Enrollments</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">892</p>
                </div>
                <div className="text-green-600 dark:text-green-400">
                  +8.3%
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Support Tickets</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">23</p>
                </div>
                <div className="text-red-600 dark:text-red-400">
                  +15.2%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

