import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  User, 
  ArrowLeft, 
  Share2, 
  BookOpen,
  ExternalLink 
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { sanitizeMarkdown } from "@/lib/sanitize";
import SEO from "@/components/SEO";
import type { BlogPost } from "@shared/schema";

interface BlogResponse {
  items: BlogPost[];
  total: number;
  page: number;
  pageSize: number;
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();

  // Fetch the blog post by slug
  const { data: post, isLoading, error } = useQuery<BlogPost>({
    queryKey: ['/api/blog', slug],
    queryFn: async () => {
      const response = await fetch(`/api/blog/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }
        throw new Error('Failed to fetch blog post');
      }
      return response.json();
    },
    enabled: !!slug,
  });

  // Fetch related articles (same tags, excluding current post)
  const { data: relatedPosts } = useQuery<BlogResponse>({
    queryKey: ['/api/blog', 'related', post?.tags?.[0]],
    queryFn: async () => {
      const tag = post?.tags?.[0];
      const response = await fetch(`/api/blog?pageSize=4&status=published${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch related posts');
      return response.json();
    },
    enabled: !!post && Array.isArray(post.tags) && post.tags.length > 0,
    select: (data) => ({
      ...data,
      items: data.items.filter(item => item.id !== post?.id).slice(0, 3)
    })
  });

  const handleShare = async () => {
    if (navigator.share && post) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share failed:', err);
      }
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const renderMarkdown = (markdown: string) => {
    return sanitizeMarkdown(markdown);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumbs skeleton */}
          <div className="flex items-center space-x-2 mb-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Hero image skeleton */}
          <Skeleton className="aspect-video w-full mb-8 rounded-lg" />

          {/* Header skeleton */}
          <div className="mb-8">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-18" />
            </div>
          </div>

          {/* Content skeleton */}
          <div className="space-y-4 mb-8">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error.message === 'NOT_FOUND';
    
    return (
      <div className="min-h-screen bg-background">
        <SEO
          title={isNotFound ? "Artykuł nie znaleziony | helloEKG Blog" : "Błąd | helloEKG Blog"}
          description={isNotFound ? "Szukany artykuł nie istnieje lub został usunięty." : "Wystąpił błąd podczas ładowania artykułu."}
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <BookOpen className="h-24 w-24 mx-auto text-muted-foreground mb-6" />
            <h1 className="text-4xl font-bold text-foreground mb-4">
              {isNotFound ? "404 - Artykuł nie znaleziony" : "Błąd"}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {isNotFound 
                ? "Szukany artykuł nie istnieje lub został usunięty." 
                : "Wystąpił błąd podczas ładowania artykułu. Spróbuj ponownie później."
              }
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild>
                <Link href="/blog" data-testid="back-to-blog">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Powrót do blog
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/" data-testid="back-to-home">
                  Strona główna
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  const seoTitle = post.seoMeta?.title || `${post.title} | helloEKG Blog`;
  const seoDescription = post.seoMeta?.description || post.excerpt;

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={seoTitle}
        description={seoDescription}
        image={post.featuredImage || undefined}
        article={true}
        publishedTime={post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date(post.createdAt).toISOString()}
        modifiedTime={new Date(post.updatedAt).toISOString()}
        tags={Array.isArray(post.tags) ? post.tags : []}
        author="helloEKG"
        canonical={`/blog/${post.slug}`}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6" data-testid="breadcrumbs">
          <Link href="/" className="hover:text-primary transition-colors" data-testid="breadcrumb-home">
            Strona główna
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-primary transition-colors" data-testid="breadcrumb-blog">
            Blog
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium line-clamp-1">{post.title}</span>
        </nav>

        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="back-button">
          <Link href="/blog">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót do blog
          </Link>
        </Button>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="aspect-video mb-8 rounded-lg overflow-hidden shadow-lg" data-testid="featured-image">
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight" data-testid="article-title">
            {post.title}
          </h1>

          {/* Author and Date Info */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1" data-testid="article-author">
                <User className="h-4 w-4" />
                <span>helloEKG</span>
              </div>
              <div className="flex items-center gap-1" data-testid="article-date">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(post.publishedAt || post.createdAt), "d MMMM yyyy", { locale: pl })}
                </span>
              </div>
            </div>

            {/* Share Button */}
            <Button variant="outline" size="sm" onClick={handleShare} data-testid="share-button">
              <Share2 className="h-4 w-4 mr-2" />
              Udostępnij
            </Button>
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6" data-testid="article-tags">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="hover:bg-primary hover:text-primary-foreground cursor-pointer">
                  <Link href={`/blog?tag=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Link>
                </Badge>
              ))}
            </div>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-muted-foreground leading-relaxed mb-8" data-testid="article-excerpt">
              {post.excerpt}
            </p>
          )}
        </header>

        {/* Article Content */}
        <article 
          className="prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary hover:prose-a:text-primary/80 prose-strong:text-foreground prose-code:text-primary prose-pre:bg-muted prose-blockquote:border-primary prose-blockquote:text-muted-foreground"
          dangerouslySetInnerHTML={renderMarkdown(post.contentMd)}
          data-testid="article-content"
        />

        {/* Article Footer */}
        <footer className="mt-12 pt-8 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Ostatnia aktualizacja: {format(new Date(post.updatedAt), "d MMMM yyyy", { locale: pl })}
            </div>
            <Button variant="outline" size="sm" onClick={handleShare} data-testid="share-button-footer">
              <Share2 className="h-4 w-4 mr-2" />
              Udostępnij artykuł
            </Button>
          </div>
        </footer>

        {/* Related Articles */}
        {relatedPosts && relatedPosts.items.length > 0 && (
          <section className="mt-16" data-testid="related-articles">
            <h2 className="text-2xl font-bold text-foreground mb-8">Powiązane artykuły</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.items.map((relatedPost) => (
                <Card key={relatedPost.id} className="overflow-hidden hover:shadow-lg transition-shadow group" data-testid={`related-article-${relatedPost.slug}`}>
                  {relatedPost.featuredImage && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={relatedPost.featuredImage}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                      <Link href={`/blog/${relatedPost.slug}`}>
                        {relatedPost.title}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {relatedPost.excerpt}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {format(new Date(relatedPost.publishedAt || relatedPost.createdAt), "d MMM yyyy", { locale: pl })}
                      </span>
                      <Link href={`/blog/${relatedPost.slug}`} className="flex items-center gap-1 hover:text-primary">
                        Czytaj więcej
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-8">
              <Button variant="outline" asChild data-testid="view-all-articles">
                <Link href="/blog">
                  Zobacz wszystkie artykuły
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="mt-16 bg-gradient-to-r from-primary/5 to-secondary/10 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Zacznij naukę EKG już dziś
          </h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Dołącz do tysięcy studentów medycyny i lekarzy, którzy już opanowali interpretację EKG dzięki naszemu kursowi.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" data-testid="cta-start-course">
              <Link href="/pricing">
                Rozpocznij kurs
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild data-testid="cta-free-trial">
              <Link href="/?auth=register">
                Darmowy dostęp
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}