import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Plus, Edit, Trash2, Search, Eye, FileText, Calendar, User, Tag, MoreHorizontal } from "lucide-react";
import BlogEditor from "./BlogEditor";
import type { BlogPost, InsertBlogPost } from "@shared/schema";

interface BlogWithAuthor extends BlogPost {
  author: {
    firstName: string;
    lastName: string;
  };
}

interface BlogPostsResponse {
  data: BlogWithAuthor[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export default function BlogManager() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogWithAuthor | null>(null);
  const { t } = useTranslation();
  const { toast } = useToast();

  // Build query params for API calls
  const buildQueryParams = (page: number = currentPage) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("pageSize", "10");
    
    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    if (tagFilter !== "all") {
      params.set("tag", tagFilter);
    }
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    
    return params.toString();
  };

  // Fetch blog posts with filters
  const { data: postsResponse, isLoading, error } = useQuery({
    queryKey: ["/api/admin/blog-posts", { page: currentPage, status: statusFilter, tag: tagFilter, q: searchQuery }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/blog-posts?${buildQueryParams()}`);
      return response.json() as Promise<BlogPostsResponse>;
    },
  });

  // Get all unique tags for the filter dropdown
  const { data: allTags } = useQuery({
    queryKey: ["/api/admin/blog-posts", "all-tags"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/blog-posts?pageSize=100");
      const data = await response.json() as BlogPostsResponse;
      const tags = new Set<string>();
      data.items.forEach(post => {
        (post.tags || []).forEach(tag => tags.add(tag));
      });
      return Array.from(tags).sort();
    },
  });

  // Create blog post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/admin/blog-posts", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Artykuł został utworzony",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      setShowEditor(false);
      setEditingPost(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się utworzyć artykułu",
        variant: "destructive",
      });
    },
  });

  // Update blog post mutation
  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/admin/blog-posts/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Artykuł został zaktualizowany",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
      setShowEditor(false);
      setEditingPost(null);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować artykułu",
        variant: "destructive",
      });
    },
  });

  // Delete blog post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/blog-posts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Artykuł został usunięty",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć artykułu",
        variant: "destructive",
      });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "draft" | "published" }) => {
      const response = await apiRequest("PATCH", `/api/admin/blog-posts/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sukces",
        description: "Status artykułu został zmieniony",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zmienić statusu artykułu",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "published") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Opublikowany
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        Szkic
      </Badge>
    );
  };

  const handleSavePost = (data: any) => {
    // Transform BlogEditor data to API format
    const transformedData = {
      slug: data.slug,
      title: data.title,
      excerpt: data.excerpt,
      contentMd: data.contentMd,
      featuredImage: data.featuredImage,
      tags: data.tags,
      seoMeta: data.seoMeta,
      status: data.status,
    };

    if (editingPost) {
      updatePostMutation.mutate({ id: editingPost.id, data: transformedData });
    } else {
      createPostMutation.mutate(transformedData);
    }
  };

  const handleNewPost = () => {
    setEditingPost(null);
    setShowEditor(true);
  };

  const handleEditPost = (post: BlogWithAuthor) => {
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleDeletePost = (id: string) => {
    deletePostMutation.mutate(id);
  };

  const handleToggleStatus = (post: BlogWithAuthor) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    toggleStatusMutation.mutate({ id: post.id, status: newStatus });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setTagFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  if (showEditor) {
    return (
      <BlogEditor
        blogPost={editingPost || undefined}
        onSave={handleSavePost}
        onCancel={() => {
          setShowEditor(false);
          setEditingPost(null);
        }}
        isLoading={createPostMutation.isPending || updatePostMutation.isPending}
      />
    );
  }

  const posts = postsResponse?.data || [];
  const totalPosts = postsResponse?.total || 0;
  const hasMore = postsResponse?.hasMore || false;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold text-foreground">Zarządzanie blogiem</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50">
              Opublikowane: {posts.filter(p => p.status === "published").length}
            </Badge>
            <Badge variant="outline" className="bg-gray-50">
              Szkice: {posts.filter(p => p.status === "draft").length}
            </Badge>
            <Badge variant="outline">
              Łącznie: {totalPosts}
            </Badge>
          </div>
        </div>
        
        <Button onClick={handleNewPost} data-testid="new-post-button">
          <Plus className="h-4 w-4 mr-2" />
          Nowy artykuł
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Wyszukaj
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Szukaj w tytule lub opisie..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Status
              </label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="published">Opublikowane</SelectItem>
                  <SelectItem value="draft">Szkice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Tag
              </label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger data-testid="tag-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie tagi</SelectItem>
                  {allTags?.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} data-testid="reset-filters-button">
                Wyczyść filtry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posts List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">Błąd podczas pobierania artykułów</p>
              <Button 
                variant="outline" 
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/blog-posts"] })}
                className="mt-4"
              >
                Spróbuj ponownie
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Brak artykułów</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || tagFilter !== "all" 
                  ? "Nie znaleziono artykułów spełniających kryteria wyszukiwania"
                  : "Zacznij od utworzenia pierwszego artykułu"
                }
              </p>
              {(searchQuery || statusFilter !== "all" || tagFilter !== "all") ? (
                <Button variant="outline" onClick={resetFilters}>
                  Wyczyść filtry
                </Button>
              ) : (
                <Button onClick={handleNewPost}>
                  <Plus className="h-4 w-4 mr-2" />
                  Utwórz pierwszy artykuł
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table data-testid="posts-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tytuł</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>Tagi</TableHead>
                    <TableHead>Utworzony</TableHead>
                    <TableHead>Zaktualizowany</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id} className="hover:bg-secondary/50" data-testid={`post-row-${post.id}`}>
                      <TableCell>
                        <div className="flex items-start space-x-3">
                          <div className="w-16 h-12 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                            {post.featuredImage ? (
                              <img 
                                src={post.featuredImage} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => handleEditPost(post)}
                              className="font-medium text-foreground hover:text-primary text-left"
                              data-testid={`edit-post-${post.id}`}
                            >
                              {post.title}
                            </button>
                            <p className="text-sm text-muted-foreground mt-1">
                              {post.excerpt.substring(0, 100)}
                              {post.excerpt.length > 100 && "..."}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(post.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {post.author.firstName} {post.author.lastName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(post.tags || []).slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {(post.tags || []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(post.tags || []).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(post.createdAt).toLocaleDateString('pl-PL')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {new Date(post.updatedAt).toLocaleDateString('pl-PL')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleEditPost(post)}
                            data-testid={`edit-button-${post.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleToggleStatus(post)}
                            disabled={toggleStatusMutation.isPending}
                            data-testid={`toggle-status-${post.id}`}
                          >
                            {post.status === "published" ? (
                              <span className="text-xs">Szkic</span>
                            ) : (
                              <span className="text-xs">Publikuj</span>
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                data-testid={`delete-button-${post.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Usuń artykuł</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Czy na pewno chcesz usunąć artykuł "{post.title}"? 
                                  Ta akcja jest nieodwracalna.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid={`cancel-delete-${post.id}`}>Anuluj</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeletePost(post.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`confirm-delete-${post.id}`}
                                >
                                  Usuń
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Wyświetlono {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, totalPosts)} z {totalPosts} artykułów
                </p>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    data-testid="prev-page-button"
                  >
                    Poprzednia
                  </Button>
                  <span className="px-3 py-1 text-sm">
                    Strona {currentPage}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={!hasMore}
                    onClick={() => handlePageChange(currentPage + 1)}
                    data-testid="next-page-button"
                  >
                    Następna
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}