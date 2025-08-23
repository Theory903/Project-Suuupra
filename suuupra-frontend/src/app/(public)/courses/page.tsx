'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSkeleton } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  Search, 
  Star, 
  Clock, 
  Users, 
  Play,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { usePublicCourses, useFeaturedCourses, useCourseCategories } from '@/hooks/content/use-public-courses';

export default function PublicCoursesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const { data: coursesData, isLoading, error, refetch } = usePublicCourses({
    search: searchQuery,
    category: selectedCategory || undefined,
    page: currentPage,
    limit: 12,
  });

  const { data: featuredData, isLoading: featuredLoading } = useFeaturedCourses(6);
  const { data: categoriesData, isLoading: categoriesLoading } = useCourseCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0); // Reset to first page when searching
    refetch();
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === selectedCategory ? '' : category);
    setCurrentPage(0); // Reset to first page when filtering
  };

  const totalPages = Math.ceil((coursesData?.total || 0) / 12);

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4 py-20">
          <EmptyState
            title="Failed to load courses"
            description="There was an error loading the courses. Please try again."
            action={{
              label: 'Retry',
              onClick: () => refetch(),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-purple-900/20">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob dark:bg-blue-800" />
        <div className="absolute top-40 right-10 w-20 h-20 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 dark:bg-purple-800" />
        <div className="absolute -bottom-8 left-20 w-20 h-20 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 dark:bg-pink-800" />

        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Unlock Your
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Potential
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Master new skills with our comprehensive online courses. Learn from industry experts and advance your career.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search courses, instructors, or topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-4 text-lg bg-white/80 backdrop-blur-sm border-0 shadow-lg"
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Button 
                  type="submit" 
                  size="sm" 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  Search
                </Button>
              </div>
            </form>
            
            <div className="flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">{coursesData?.total || 0}+ Courses</span>
                  </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                <Users className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">50,000+ Students</span>
                  </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">4.8 Average Rating</span>
                </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Browse by Category
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Find the perfect course for your learning goals
            </p>
          </div>
          
          {categoriesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="text-center">
                  <LoadingSkeleton className="w-20 h-20 rounded-2xl mx-auto mb-4" />
                  <LoadingSkeleton className="h-6 w-32 mx-auto mb-2" />
                  <LoadingSkeleton className="h-4 w-20 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {(categoriesData || []).map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.name}
                    onClick={() => handleCategoryChange(category.name)}
                    className={`text-center group hover:scale-105 transition-transform ${
                      selectedCategory === category.name ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${category.color} p-4 group-hover:shadow-lg transition-shadow`}>
                      <IconComponent className="w-full h-full text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {category.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {category.count} courses
                    </p>
                  </button>
                );
              })}
          </div>
          )}
        </div>
      </section>

      {/* Featured Courses */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-16">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Featured Courses
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Handpicked courses from our top instructors
              </p>
            </div>
            <Link href="/courses">
            <Button variant="outline" className="hidden md:flex">
                View All <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            </Link>
          </div>
          
          {featuredLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <LoadingSkeleton className="w-full h-48" />
                  <CardContent className="p-6">
                    <LoadingSkeleton className="h-6 w-full mb-2" />
                    <LoadingSkeleton className="h-4 w-2/3 mb-4" />
                    <div className="flex items-center justify-between mb-4">
                      <LoadingSkeleton className="h-4 w-16" />
                      <LoadingSkeleton className="h-4 w-20" />
                    </div>
                    <LoadingSkeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(featuredData?.courses || []).map((course) => (
                <Card key={course.id} className="overflow-hidden group hover:shadow-xl transition-shadow">
                  <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                    {course.thumbnail ? (
                      <img 
                        src={course.thumbnail} 
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-gray-400" />
                  </div>
                )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-16 w-16 text-white" />
                    </div>
                    <Badge className="absolute top-4 right-4 bg-white/90 text-gray-900">
                      {course.level}
                    </Badge>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      by {course.instructor}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span>{course.rating.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{course.students.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{course.duration}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {course.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${course.price}
                        </span>
                        {course.originalPrice && course.originalPrice > course.price && (
                          <span className="text-lg text-gray-500 line-through">
                            ${course.originalPrice}
                          </span>
                        )}
                  </div>
                      <Link href={`/courses/${course.id}`}>
                        <Button>
                          Enroll Now
                    </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All Courses with Filters */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                All Courses
              </h2>
              {selectedCategory && (
                <p className="text-gray-600 dark:text-gray-400">
                  Showing courses in: <Badge variant="outline">{selectedCategory}</Badge>
                  <button 
                    onClick={() => setSelectedCategory('')}
                    className="ml-2 text-blue-600 hover:text-blue-700"
                  >
                    Clear filter
                  </button>
                </p>
              )}
                  </div>
                </div>
                
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <LoadingSkeleton className="w-full h-40" />
                  <CardContent className="p-4">
                    <LoadingSkeleton className="h-5 w-full mb-2" />
                    <LoadingSkeleton className="h-4 w-2/3 mb-3" />
                    <div className="flex items-center justify-between">
                      <LoadingSkeleton className="h-4 w-12" />
                      <LoadingSkeleton className="h-6 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : coursesData?.courses && coursesData.courses.length > 0 ? (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {coursesData.courses.map((course) => (
                  <Card key={course.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                    <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                      {course.thumbnail ? (
                        <img 
                          src={course.thumbnail} 
                          alt={course.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="h-12 w-12 text-white" />
                      </div>
                      <Badge className="absolute top-2 right-2 bg-white/90 text-gray-900 text-xs">
                        {course.level}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        by {course.instructor}
                      </p>
                      
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          <span>{course.rating.toFixed(1)}</span>
                      </div>
                        <span className="text-gray-500">{course.duration}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 dark:text-white">
                        ${course.price}
                      </span>
                    <Link href={`/courses/${course.id}`}>
                          <Button size="sm">
                            Enroll
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                      const pageNumber = currentPage < 3 ? i : currentPage - 2 + i;
                      if (pageNumber >= totalPages) return null;
                      
                      return (
                        <Button
                          key={pageNumber}
                          variant={pageNumber === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNumber)}
                        >
                          {pageNumber + 1}
              </Button>
                      );
                    })}
        </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage === totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
          </div>
              )}
            </>
          ) : (
            <EmptyState
              title={selectedCategory ? "No courses found in this category" : "No courses found"}
              description={
                searchQuery 
                  ? `No courses match your search "${searchQuery}". Try different keywords.`
                  : "No courses are currently available. Please check back later."
              }
              action={
                (searchQuery || selectedCategory) ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearchQuery('');
                    setSelectedCategory('');
                    setCurrentPage(0);
                  },
                } : undefined
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}