import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Upload, Plus, Trash2, Save, X, Image as ImageIcon } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import type { BlogPost } from "@shared/schema";

interface BlogFormData {
  slug: string;
  title: string;
  excerpt: string;
  contentMd: string;
  featuredImage?: string;
  tags: string[];
  seoMeta: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  status: "draft" | "published";
}

interface BlogEditorProps {
  blogPost?: BlogPost;
  onSave: (data: BlogFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'color': [] }, { 'background': [] }],
    ['link', 'image'],
    ['blockquote', 'code-block'],
    ['clean']
  ],
  clipboard: {
    matchVisual: true,
  },
};

const quillFormats = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'list', 'bullet', 'indent', 'color', 'background', 'link', 'image',
  'blockquote', 'code-block', 'align', 'font', 'size', 'script', 'direction'
];

export default function BlogEditor({
  blogPost,
  onSave,
  onCancel,
  isLoading
}: BlogEditorProps) {
  const [formData, setFormData] = useState<BlogFormData>({
    slug: blogPost?.slug || "",
    title: blogPost?.title || "",
    excerpt: blogPost?.excerpt || "",
    contentMd: blogPost?.contentMd || "",
    featuredImage: blogPost?.featuredImage || "",
    tags: blogPost?.tags || [],
    seoMeta: blogPost?.seoMeta || {},
    status: blogPost?.status as "draft" | "published" || "draft",
  });

  const [tagInput, setTagInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const contentQuillRef = useRef<ReactQuill>(null);
  const { toast } = useToast();

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      setImageUploading(true);
      try {
        // Get upload URL
        const uploadResponse = await apiRequest("POST", "/api/admin/upload");
        const { uploadURL } = await uploadResponse.json();

        // Upload file to object storage
        const fileUploadResponse = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!fileUploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        // Set ACL policy for the uploaded image
        const aclResponse = await apiRequest("PUT", "/api/admin/images", {
          imageURL: uploadURL,
        });
        const { objectPath } = await aclResponse.json();

        return objectPath;
      } finally {
        setImageUploading(false);
      }
    },
    onSuccess: (objectPath) => {
      setFormData(prev => ({ ...prev, featuredImage: objectPath }));
      toast({
        title: "Sukces",
        description: "Obraz został przesłany",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się przesłać obrazu",
        variant: "destructive",
      });
    },
  });

  const generateSlugFromTitle = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[ąćęłńóśźż]/g, (match) => {
        const map: Record<string, string> = {
          'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
          'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z'
        };
        return map[match] || match;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = "Tytuł jest wymagany";
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = "Slug jest wymagany";
    }
    
    if (!formData.excerpt.trim()) {
      newErrors.excerpt = "Krótki opis jest wymagany";
    }
    
    if (!formData.contentMd.trim()) {
      newErrors.contentMd = "Treść jest wymagana";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      // Auto-generate slug only for new posts and if slug is empty or matches old title
      ...((!blogPost || prev.slug === generateSlugFromTitle(prev.title)) && {
        slug: generateSlugFromTitle(title)
      })
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const addKeyword = () => {
    const keyword = keywordInput.trim();
    if (keyword && !formData.seoMeta.keywords?.includes(keyword)) {
      setFormData(prev => ({
        ...prev,
        seoMeta: {
          ...prev.seoMeta,
          keywords: [...(prev.seoMeta.keywords || []), keyword]
        }
      }));
      setKeywordInput("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      seoMeta: {
        ...prev.seoMeta,
        keywords: prev.seoMeta.keywords?.filter(keyword => keyword !== keywordToRemove) || []
      }
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        uploadImageMutation.mutate(file);
      } else {
        toast({
          title: "Błąd",
          description: "Można przesłać tylko pliki obrazów",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {blogPost ? "Edytuj artykuł" : "Nowy artykuł"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {blogPost ? "Modyfikuj istniejący artykuł" : "Utwórz nowy artykuł na blogu"}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={onCancel} data-testid="cancel-button">
            <X className="h-4 w-4 mr-2" />
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={isLoading} data-testid="save-button">
            {isLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {blogPost ? "Zaktualizuj" : "Zapisz"}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Podstawowe informacje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Tytuł artykułu *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Wprowadź tytuł artykułu"
                  className={errors.title ? "border-red-500" : ""}
                  data-testid="input-title"
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>

              <div>
                <Label htmlFor="slug">Slug URL *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="slug-artykulu"
                  className={errors.slug ? "border-red-500" : ""}
                  data-testid="input-slug"
                />
                {errors.slug && <p className="text-sm text-red-500">{errors.slug}</p>}
              </div>

              <div>
                <Label htmlFor="excerpt">Krótki opis *</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Krótki opis artykułu dla list i meta description"
                  rows={3}
                  className={errors.excerpt ? "border-red-500" : ""}
                  data-testid="input-excerpt"
                />
                {errors.excerpt && <p className="text-sm text-red-500">{errors.excerpt}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <CardTitle>Treść artykułu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <Label>Treść *</Label>
              </div>
              <div className={`${errors.contentMd ? "border border-red-500 rounded-md" : ""}`} data-testid="content-editor">
                <ReactQuill
                  ref={contentQuillRef}
                  theme="snow"
                  value={formData.contentMd}
                  onChange={(value) => setFormData(prev => ({ ...prev, contentMd: value }))}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Napisz treść artykułu..."
                  style={{ minHeight: '300px' }}
                />
              </div>
              {errors.contentMd && <p className="text-sm text-red-500 mt-2">{errors.contentMd}</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Publishing */}
          <Card>
            <CardHeader>
              <CardTitle>Publikacja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: "draft" | "published") => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Szkic</SelectItem>
                    <SelectItem value="published">Opublikowany</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Featured Image */}
          <Card>
            <CardHeader>
              <CardTitle>Obraz wyróżniający</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.featuredImage ? (
                <div className="space-y-2">
                  <img 
                    src={formData.featuredImage} 
                    alt="Featured" 
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setFormData(prev => ({ ...prev, featuredImage: "" }))}
                    data-testid="remove-image-button"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Usuń obraz
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="featured-image-upload"
                  />
                  <label htmlFor="featured-image-upload">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      disabled={imageUploading}
                      asChild
                      data-testid="upload-image-button"
                    >
                      <span>
                        {imageUploading ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                          <ImageIcon className="h-4 w-4 mr-2" />
                        )}
                        {imageUploading ? "Przesyłanie..." : "Dodaj obraz"}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tagi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Dodaj tag..."
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  data-testid="input-tag"
                />
                <Button onClick={addTag} size="sm" data-testid="add-tag-button">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center space-x-1" data-testid={`tag-${index}`}>
                    <span>{tag}</span>
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 text-xs hover:text-red-500"
                      data-testid={`remove-tag-${index}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SEO Meta */}
          <Card>
            <CardHeader>
              <CardTitle>SEO Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seo-title">Meta Title</Label>
                <Input
                  id="seo-title"
                  value={formData.seoMeta.title || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seoMeta: { ...prev.seoMeta, title: e.target.value }
                  }))}
                  placeholder="Zostaw puste aby użyć tytułu artykułu"
                  data-testid="input-seo-title"
                />
              </div>

              <div>
                <Label htmlFor="seo-description">Meta Description</Label>
                <Textarea
                  id="seo-description"
                  value={formData.seoMeta.description || ""}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    seoMeta: { ...prev.seoMeta, description: e.target.value }
                  }))}
                  placeholder="Zostaw puste aby użyć krótkiego opisu"
                  rows={3}
                  data-testid="input-seo-description"
                />
              </div>

              <div>
                <Label>Słowa kluczowe</Label>
                <div className="flex space-x-2 mb-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Dodaj słowo kluczowe..."
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    data-testid="input-keyword"
                  />
                  <Button onClick={addKeyword} size="sm" data-testid="add-keyword-button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.seoMeta.keywords?.map((keyword, index) => (
                    <Badge key={index} variant="outline" className="flex items-center space-x-1" data-testid={`keyword-${index}`}>
                      <span>{keyword}</span>
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 text-xs hover:text-red-500"
                        data-testid={`remove-keyword-${index}`}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}