import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Calendar, User, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import SEO from "@/components/SEO";
import type { BlogPost } from "@shared/schema";

interface BlogResponse {
  items: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
}

export default function Blog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  // Fetch blog posts with filters
  const { data: blogData, isLoading, error } = useQuery<BlogResponse>({
    queryKey: ['/api/blog', { 
      page: currentPage, 
      pageSize, 
      tag: selectedTag || undefined, 
      q: searchQuery || undefined,
      status: 'published'
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('pageSize', pageSize.toString());
      params.set('status', 'published');
      if (selectedTag) params.set('tag', selectedTag);
      if (searchQuery) params.set('q', searchQuery);
      
      const response = await fetch(`/api/blog?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch blog posts');
      return response.json();
    },
    enabled: true,
  });

  // Get unique tags for filtering  
  const { data: allTagsData } = useQuery<string[]>({
    queryKey: ['/api/blog', { pageSize: 100, status: 'published' }],
    queryFn: async () => {
      const response = await fetch('/api/blog?pageSize=100&status=published');
      if (!response.ok) {
        throw new Error('Failed to fetch blog posts');
      }
      const data: BlogResponse = await response.json();
      const allTags = new Set<string>();
      data.items.forEach(post => {
        if (Array.isArray(post.tags)) {
          post.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      return Array.from(allTags).sort();
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag === "all" ? "" : tag);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = blogData ? Math.ceil(blogData.total / pageSize) : 0;
  const posts = blogData?.items || [];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Blog - helloEKG | Nauka interpretacji EKG"
        description="Najnowsze artykuły o EKG, interpretacji zapisów, przypadkach klinicznych i medycynie. Ekspertka wiedza dla studentów medycyny i lekarzy."
        canonical="/blog"
      />

      {/* Header Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-secondary/10">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6" data-testid="breadcrumbs">
            <Link href="/" className="hover:text-primary transition-colors" data-testid="breadcrumb-home">
              Strona główna
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Blog</span>
          </nav>

          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-4">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-primary" />
              Blog helloEKG
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Odkryj najnowsze artykuły o interpretacji EKG, przypadkach klinicznych i praktycznych aspektach kardiologii
            </p>
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="py-8 bg-card border-b">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md" data-testid="search-form">
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Szukaj artykułów..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </form>

            {/* Tag Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Kategoria:</span>
              <Select value={selectedTag || "all"} onValueChange={handleTagChange}>
                <SelectTrigger className="w-48" data-testid="tag-filter">
                  <SelectValue placeholder="Wszystkie kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie kategorie</SelectItem>
                  {allTagsData?.map((tag: string) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchQuery || selectedTag) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Aktywne filtry:</span>
              {searchQuery && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery("")}>
                  Wyszukiwanie: "{searchQuery}" ×
                </Badge>
              )}
              {selectedTag && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedTag("")}>
                  Kategoria: {selectedTag} ×
                </Badge>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          {error && (
            <Alert className="mb-8" data-testid="error-alert">
              <AlertDescription>
                Wystąpił błąd podczas ładowania artykułów. Spróbuj ponownie później.
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full mt-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-4 w-32" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16" data-testid="empty-state">
              <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-2xl font-semibold text-foreground mb-2">Brak artykułów</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedTag
                  ? "Nie znaleziono artykułów spełniających kryteria wyszukiwania."
                  : "Nie ma jeszcze opublikowanych artykułów."}
              </p>
              {(searchQuery || selectedTag) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedTag("");
                    setCurrentPage(1);
                  }}
                  className="mt-4"
                  data-testid="clear-filters-button"
                >
                  Wyczyść filtry
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Results Info */}
              <div className="mb-8 text-sm text-muted-foreground" data-testid="results-info">
                Znaleziono {blogData?.total} artykułów
                {blogData && blogData.total > pageSize && (
                  <span> • Strona {currentPage} z {totalPages}</span>
                )}
              </div>

              {/* Blog Posts Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                {posts.map((post) => (
                  <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow group" data-testid={`blog-card-${post.slug}`}>
                    {/* Featured Image */}
                    {post.featuredImage && (
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          data-testid={`blog-image-${post.slug}`}
                        />
                      </div>
                    )}

                    <CardHeader>
                      <h2 className="text-xl font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                        <Link href={`/blog/${post.slug}`} data-testid={`blog-title-${post.slug}`}>
                          {post.title}
                        </Link>
                      </h2>
                      <p className="text-muted-foreground line-clamp-3 text-sm" data-testid={`blog-excerpt-${post.slug}`}>
                        {post.excerpt}
                      </p>
                    </CardHeader>

                    <CardContent>
                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4" data-testid={`blog-tags-${post.slug}`}>
                          {post.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => handleTagChange(tag)}
                              data-testid={`blog-tag-${tag}`}
                            >
                              {tag}
                            </Badge>
                          ))}
                          {post.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{post.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="pt-0">
                      <div className="flex items-center justify-between w-full text-sm text-muted-foreground">
                        {/* Author & Date */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            <span>helloEKG</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span data-testid={`blog-date-${post.slug}`}>
                              {format(new Date(post.publishedAt || post.createdAt), "d MMM yyyy", { locale: pl })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2" data-testid="pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    data-testid="pagination-prev"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Poprzednia
                  </Button>

                  <div className="flex items-center space-x-1">
                    {/* Show page numbers */}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const pageNumber = i + 1;
                      const showPage = 
                        pageNumber === 1 ||
                        pageNumber === totalPages ||
                        (pageNumber >= currentPage - 2 && pageNumber <= currentPage + 2);

                      if (!showPage) return null;

                      return (
                        <Button
                          key={pageNumber}
                          variant={currentPage === pageNumber ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handlePageChange(pageNumber)}
                          data-testid={`pagination-page-${pageNumber}`}
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="pagination-next"
                  >
                    Następna
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}