'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { 
  Search, 
  Filter,
  Clock,
  Star,
  Users,
  BookOpen,
  Video,
  FileText,
  User,
  Play,
  TrendingUp,
  Calendar,
  Tag,
  ArrowRight,
  X
} from 'lucide-react';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('relevance');

  // Mock search results
  const searchResults = {
    total: 1247,
    searchTime: 0.23,
    results: [
      {
        id: '1',
        type: 'course',
        title: 'Complete React Development Bootcamp',
        description: 'Master React from basics to advanced concepts with hands-on projects and real-world applications.',
        instructor: 'Sarah Johnson',
        rating: 4.9,
        students: 12543,
        duration: '40 hours',
        price: 89,
        originalPrice: 129,
        level: 'Intermediate',
        category: 'Web Development',
        tags: ['React', 'JavaScript', 'Frontend'],
        lastUpdated: '2024-01-15',
        thumbnail: '/courses/react-bootcamp.jpg'
      },
      {
        id: '2',
        type: 'course',
        title: 'Advanced React Patterns',
        description: 'Learn advanced React patterns, performance optimization, and architectural best practices.',
        instructor: 'Mike Chen',
        rating: 4.8,
        students: 8932,
        duration: '25 hours',
        price: 79,
        originalPrice: 119,
        level: 'Advanced',
        category: 'Web Development',
        tags: ['React', 'Advanced', 'Patterns'],
        lastUpdated: '2024-01-12',
        thumbnail: '/courses/react-advanced.jpg'
      },
      {
        id: '3',
        type: 'instructor',
        title: 'Sarah Johnson',
        description: 'Senior Frontend Developer at Google with 8+ years of experience in React and modern web technologies.',
        rating: 4.9,
        students: 45231,
        courses: 12,
        specialties: ['React', 'JavaScript', 'TypeScript', 'Frontend Architecture'],
        avatar: '/instructors/sarah.jpg'
      },
      {
        id: '4',
        type: 'article',
        title: 'React Hooks: A Complete Guide',
        description: 'Everything you need to know about React Hooks, from basics to advanced patterns and custom hooks.',
        author: 'David Kim',
        readTime: '15 min read',
        publishDate: '2024-01-10',
        tags: ['React', 'Hooks', 'Tutorial'],
        thumbnail: '/articles/react-hooks.jpg'
      },
      {
        id: '5',
        type: 'video',
        title: 'Building a React E-commerce App',
        description: 'Step-by-step tutorial on building a complete e-commerce application with React and modern tools.',
        instructor: 'Emma Wilson',
        duration: '2h 30m',
        views: 15672,
        publishDate: '2024-01-08',
        tags: ['React', 'E-commerce', 'Project'],
        thumbnail: '/videos/react-ecommerce.jpg'
      }
    ]
  };

  const filters = {
    type: ['Course', 'Instructor', 'Article', 'Video'],
    level: ['Beginner', 'Intermediate', 'Advanced'],
    category: ['Web Development', 'Data Science', 'Design', 'Business', 'Mobile Development'],
    duration: ['0-2 hours', '2-5 hours', '5-10 hours', '10+ hours'],
    price: ['Free', '$0-$50', '$50-$100', '$100+']
  };

  const popularSearches = [
    'React', 'JavaScript', 'Python', 'Machine Learning', 'UI/UX Design',
    'Node.js', 'Data Science', 'Mobile Development', 'DevOps', 'Blockchain'
  ];

  const recentSearches = [
    'React hooks tutorial',
    'Python for beginners',
    'UI design principles',
    'JavaScript async await'
  ];

  useEffect(() => {
    if (initialQuery) {
      // Perform search with initial query
      console.log('Searching for:', initialQuery);
    }
  }, [initialQuery]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // In real app, this would trigger API call
    console.log('Searching for:', query);
  };

  const toggleFilter = (filter: string) => {
    setSelectedFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const removeFilter = (filter: string) => {
    setSelectedFilters(prev => prev.filter(f => f !== filter));
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'course': return BookOpen;
      case 'instructor': return User;
      case 'article': return FileText;
      case 'video': return Video;
      default: return BookOpen;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'course': return 'text-blue-600 dark:text-blue-400';
      case 'instructor': return 'text-purple-600 dark:text-purple-400';
      case 'article': return 'text-green-600 dark:text-green-400';
      case 'video': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const filteredResults = searchResults.results.filter(result => {
    if (activeTab !== 'all' && result.type !== activeTab) return false;
    if (selectedFilters.length === 0) return true;
    
    // Check if result matches any selected filters
    return selectedFilters.some(filter => {
      if (result.type === 'course') {
        return (
          result.level === filter ||
          result.category === filter ||
          result.tags?.includes(filter) ||
          (filter === 'Free' && result.price === 0) ||
          (filter === '$0-$50' && result.price > 0 && result.price <= 50) ||
          (filter === '$50-$100' && result.price > 50 && result.price <= 100) ||
          (filter === '$100+' && result.price > 100)
        );
      }
      return true;
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description={searchQuery ? `Results for "${searchQuery}"` : 'Find courses, instructors, and content'}
      />

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder="Search for courses, instructors, topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                className="pl-10 text-lg py-6"
              />
            </div>
            <Button onClick={() => handleSearch(searchQuery)} className="px-8 py-6">
              Search
            </Button>
          </div>

          {/* Quick Searches */}
          {!searchQuery && (
            <div className="mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Popular Searches</h3>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((search, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSearch(search)}
                        className="text-xs"
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {search}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-3">Recent Searches</h3>
                  <div className="space-y-2">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearch(search)}
                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <Clock className="w-4 h-4" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {searchQuery && (
        <>
          {/* Search Results Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                {searchResults.total.toLocaleString()} results found in {searchResults.searchTime}s
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="relevance">Most Relevant</option>
                <option value="newest">Newest First</option>
                <option value="rating">Highest Rated</option>
                <option value="popular">Most Popular</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="border-b">
            <nav className="flex space-x-8">
              {[
                { id: 'all', label: 'All', count: searchResults.results.length },
                { id: 'course', label: 'Courses', count: searchResults.results.filter(r => r.type === 'course').length },
                { id: 'instructor', label: 'Instructors', count: searchResults.results.filter(r => r.type === 'instructor').length },
                { id: 'article', label: 'Articles', count: searchResults.results.filter(r => r.type === 'article').length },
                { id: 'video', label: 'Videos', count: searchResults.results.filter(r => r.type === 'video').length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {tab.count}
                  </Badge>
                </button>
              ))}
            </nav>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Filters Sidebar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Filter className="w-5 h-5" />
                      <span>Filters</span>
                    </CardTitle>
                    {selectedFilters.length > 0 && (
                      <Button variant="outline" size="sm" onClick={clearAllFilters}>
                        Clear All
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Active Filters */}
                  {selectedFilters.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Active Filters</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedFilters.map((filter) => (
                          <Badge
                            key={filter}
                            variant="secondary"
                            className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                            onClick={() => removeFilter(filter)}
                          >
                            {filter}
                            <X className="w-3 h-3 ml-1" />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filter Categories */}
                  {Object.entries(filters).map(([category, options]) => (
                    <div key={category}>
                      <h4 className="font-semibold mb-2 capitalize">{category}</h4>
                      <div className="space-y-2">
                        {options.map((option) => (
                          <label key={option} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedFilters.includes(option)}
                              onChange={() => toggleFilter(option)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">{option}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Search Results */}
            <div className="lg:col-span-3">
              <div className="space-y-6">
                {filteredResults.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        No results found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Try adjusting your search query or filters
                      </p>
                      <Button onClick={clearAllFilters}>
                        Clear Filters
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  filteredResults.map((result) => {
                    const TypeIcon = getTypeIcon(result.type);
                    
                    return (
                      <Card key={result.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                              <TypeIcon className={`w-8 h-8 ${getTypeColor(result.type)}`} />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center space-x-2 mb-1">
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {result.type}
                                    </Badge>
                                    {result.type === 'course' && result.level && (
                                      <Badge variant="outline" className="text-xs">
                                        {result.level}
                                      </Badge>
                                    )}
                                  </div>
                                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                    <Link href={`/${result.type === 'course' ? 'learn/courses' : result.type}/${result.id}`}>
                                      {result.title}
                                    </Link>
                                  </h3>
                                </div>
                                
                                {result.type === 'course' && (
                                  <div className="text-right">
                                    <div className="flex items-center space-x-1 mb-1">
                                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        ${result.price}
                                      </span>
                                      {result.originalPrice && result.originalPrice > result.price && (
                                        <span className="text-sm text-gray-500 line-through">
                                          ${result.originalPrice}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <p className="text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                                {result.description}
                              </p>
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                                  {result.type === 'course' && (
                                    <>
                                      <span>by {result.instructor}</span>
                                      <div className="flex items-center">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                                        <span>{result.rating}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Users className="w-4 h-4 mr-1" />
                                        <span>{result.students?.toLocaleString()}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span>{result.duration}</span>
                                      </div>
                                    </>
                                  )}
                                  
                                  {result.type === 'instructor' && (
                                    <>
                                      <div className="flex items-center">
                                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-1" />
                                        <span>{result.rating}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Users className="w-4 h-4 mr-1" />
                                        <span>{result.students?.toLocaleString()} students</span>
                                      </div>
                                      <div className="flex items-center">
                                        <BookOpen className="w-4 h-4 mr-1" />
                                        <span>{result.courses} courses</span>
                                      </div>
                                    </>
                                  )}
                                  
                                  {result.type === 'article' && (
                                    <>
                                      <span>by {result.author}</span>
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span>{result.readTime}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Calendar className="w-4 h-4 mr-1" />
                                        <span>{new Date(result.publishDate!).toLocaleDateString()}</span>
                                      </div>
                                    </>
                                  )}
                                  
                                  {result.type === 'video' && (
                                    <>
                                      <span>by {result.instructor}</span>
                                      <div className="flex items-center">
                                        <Clock className="w-4 h-4 mr-1" />
                                        <span>{result.duration}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <Play className="w-4 h-4 mr-1" />
                                        <span>{result.views?.toLocaleString()} views</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                
                                <Link href={`/${result.type === 'course' ? 'learn/courses' : result.type}/${result.id}`}>
                                  <Button variant="outline" size="sm">
                                    View
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                  </Button>
                                </Link>
                              </div>
                              
                              {/* Tags */}
                              {result.tags && (
                                <div className="flex flex-wrap gap-1 mt-3">
                                  {result.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      <Tag className="w-3 h-3 mr-1" />
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

