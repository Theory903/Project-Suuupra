'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { 
  User,
  Bell,
  CreditCard,
  Shield,
  Key,
  Webhook,
  Globe,
  Mail,
  Smartphone,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Plus,
  ExternalLink,
  Download,
  Upload,
  Settings as SettingsIcon
} from 'lucide-react';

export default function SettingsPage() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    bio: 'Full-stack developer passionate about learning new technologies.',
    location: 'San Francisco, CA',
    website: 'https://johndoe.dev',
    linkedin: 'https://linkedin.com/in/johndoe',
    twitter: 'https://twitter.com/johndoe'
  });

  const [notifications, setNotifications] = useState({
    emailCourseUpdates: true,
    emailPromotions: false,
    pushNotifications: true,
    smsReminders: false,
    weeklyDigest: true,
    courseCompletions: true,
    liveClassReminders: true,
    aiTutorSummary: false
  });

  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showProgress: true,
    showCertificates: true,
    allowMessages: true,
    showOnlineStatus: false
  });

  const settingsCategories = [
    {
      title: 'Profile',
      description: 'Manage your personal information and public profile',
      icon: User,
      href: '/settings/profile',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Notifications',
      description: 'Control how and when you receive notifications',
      icon: Bell,
      href: '/settings/notifications',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Billing',
      description: 'Manage your subscription and payment methods',
      icon: CreditCard,
      href: '/settings/billing',
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Security',
      description: 'Password, two-factor authentication, and security settings',
      icon: Shield,
      href: '/settings/security',
      color: 'from-red-500 to-orange-500'
    },
    {
      title: 'API Keys',
      description: 'Manage API keys for third-party integrations',
      icon: Key,
      href: '/settings/api-keys',
      color: 'from-indigo-500 to-purple-500'
    },
    {
      title: 'Webhooks',
      description: 'Configure webhooks for external applications',
      icon: Webhook,
      href: '/settings/webhooks',
      color: 'from-pink-500 to-rose-500'
    }
  ];

  const handleProfileUpdate = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationToggle = (setting: string) => {
    setNotifications(prev => ({ ...prev, [setting]: !prev[setting as keyof typeof prev] }));
  };

  const handlePrivacyToggle = (setting: string) => {
    setPrivacy(prev => ({ ...prev, [setting]: !prev[setting as keyof typeof prev] }));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and configurations"
      />

      {/* Quick Settings Overview */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category, index) => (
          <Link key={index} href={category.href}>
            <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer">
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${category.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <category.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {category.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{category.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Profile Information</span>
          </CardTitle>
          <CardDescription>
            Update your personal information and public profile details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={profileData.firstName}
                onChange={(e) => handleProfileUpdate('firstName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={profileData.lastName}
                onChange={(e) => handleProfileUpdate('lastName', e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={profileData.email}
              onChange={(e) => handleProfileUpdate('email', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              rows={3}
              value={profileData.bio}
              onChange={(e) => handleProfileUpdate('bio', e.target.value)}
              placeholder="Tell us about yourself..."
            />
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profileData.location}
                onChange={(e) => handleProfileUpdate('location', e.target.value)}
                placeholder="City, Country"
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={profileData.website}
                onChange={(e) => handleProfileUpdate('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notification Preferences</span>
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about course updates and activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Course Updates</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about new lessons and course updates</p>
                </div>
              </div>
              <Switch
                checked={notifications.emailCourseUpdates}
                onCheckedChange={() => handleNotificationToggle('emailCourseUpdates')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Smartphone className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive push notifications on your devices</p>
                </div>
              </div>
              <Switch
                checked={notifications.pushNotifications}
                onCheckedChange={() => handleNotificationToggle('pushNotifications')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Bell className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Live Class Reminders</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Get reminded about upcoming live classes</p>
                </div>
              </div>
              <Switch
                checked={notifications.liveClassReminders}
                onCheckedChange={() => handleNotificationToggle('liveClassReminders')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-gray-500" />
                <div>
                  <p className="font-medium">Weekly Digest</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Weekly summary of your learning progress</p>
                </div>
              </div>
              <Switch
                checked={notifications.weeklyDigest}
                onCheckedChange={() => handleNotificationToggle('weeklyDigest')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Privacy Settings</span>
          </CardTitle>
          <CardDescription>
            Control who can see your profile and learning activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show Learning Progress</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Allow others to see your course progress and achievements</p>
              </div>
              <Switch
                checked={privacy.showProgress}
                onCheckedChange={() => handlePrivacyToggle('showProgress')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Show Certificates</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Display your earned certificates on your public profile</p>
              </div>
              <Switch
                checked={privacy.showCertificates}
                onCheckedChange={() => handlePrivacyToggle('showCertificates')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Allow Direct Messages</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Let other learners send you direct messages</p>
              </div>
              <Switch
                checked={privacy.allowMessages}
                onCheckedChange={() => handlePrivacyToggle('allowMessages')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Security</span>
          </CardTitle>
          <CardDescription>
            Manage your password and security preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            
            <Button>Update Password</Button>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security to your account</p>
              </div>
              <Button variant="outline">
                <Shield className="w-4 h-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Active Sessions</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage devices that are signed in to your account</p>
              </div>
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Sessions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="w-5 h-5" />
            <span>Data & Privacy</span>
          </CardTitle>
          <CardDescription>
            Manage your data and privacy preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Download Your Data</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Get a copy of all your data including courses, progress, and certificates</p>
              </div>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Permanently delete your account and all associated data</p>
              </div>
              <Button variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
