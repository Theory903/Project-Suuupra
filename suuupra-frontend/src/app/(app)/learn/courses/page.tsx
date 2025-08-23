'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingSpinner, LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  Star,
  Clock,
  Users,
  BookOpen,
  Play,
} from 'lucide-react';
import { useCourses } from '@/hooks/content/use-courses';
import Link from 'next/link';

export default function CoursesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState('popular');

  const { data: coursesData, isLoading, error } = useCourses({
    search: searchQuery,
    category: selectedCategory,
    page: 0,
    limit: 20,
  });

  const categories = [
    'Web Development',
    'Mobile Development',
    'Data Science',
    'Machine Learning',
    'DevOps',
    'Design',
    'Business',
    'Marketing',
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by the query hook automatically
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Courses" description="Explore our comprehensive course catalog" />
        <EmptyState
          title="Failed to load courses"
          description="There was an error loading the courses. Please try again."
          action={{
            label: 'Retry',
            onClick: () => window.location.reload(),
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Courses"
        description="Explore our comprehensive course catalog and start learning today."
      />

      {/* Search and Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category.toLowerCase()}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Course Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <LoadingSkeleton className="aspect-video" />
              <CardHeader>
                <LoadingSkeleton className="h-6 w-3/4" />
                <LoadingSkeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <LoadingSkeleton className="h-4 w-full mb-2" />
                <LoadingSkeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : coursesData?.content && coursesData.content.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              Showing {coursesData.content.length} of {coursesData.total} courses
            </p>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coursesData.content.map((course) => (
              <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-gray-200 relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <div className="flex gap-2">
                      {course.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="bg-white/20 text-white">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-blue-600">
                      {course.type}
                    </Badge>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400 mr-1" />
                        <span>4.8</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        <span>2.1k</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>12h</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-blue-600">$89</span>
                      <span className="text-sm text-gray-500 line-through">$129</span>
                    </div>
                    <div className="flex space-x-2">
                      <Link href={`/learn/courses/${course.id}`}>
                        <Button size="sm" variant="outline">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                      </Link>
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Enroll
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center mt-12">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" className="bg-blue-600 text-white">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                3
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title="No courses found"
          description={
            searchQuery || selectedCategory
              ? "Try adjusting your search criteria or browse all courses."
              : "We're working on adding more courses. Check back soon!"
          }
          action={{
            label: searchQuery || selectedCategory ? 'Clear Filters' : 'Browse All',
            onClick: () => {
              setSearchQuery('');
              setSelectedCategory('');
            },
          }}
          icon={<BookOpen className="h-6 w-6" />}
        />
      )}
    </div>
  );
}

