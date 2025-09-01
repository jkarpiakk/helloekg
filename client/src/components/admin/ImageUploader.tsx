import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImageUploaderProps {
  onUpload: (imageUrl: string) => void;
}

export function ImageUploader({ onUpload }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Błąd",
        description: "Proszę wybrać plik obrazu",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Błąd",
        description: "Plik jest za duży. Maksymalny rozmiar to 10MB",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Get upload URL from server
      const uploadResponse = await apiRequest("POST", "/api/objects/upload");
      const { uploadURL } = await uploadResponse.json();

      // Upload file directly to object storage
      const uploadResult = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResult.ok) {
        throw new Error('Upload failed');
      }

      // Normalize the URL for the database
      const imageUrl = uploadURL.split('?')[0]; // Remove query parameters
      
      // Set ACL policy for the uploaded image (public for lecture images)
      await apiRequest("PUT", "/api/lecture-images", {
        imageURL: imageUrl
      });

      onUpload(imageUrl);
      
      toast({
        title: "Sukces",
        description: "Obrazek został przesłany"
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się przesłać obrazka",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        disabled={uploading}
        onClick={() => document.getElementById('image-upload')?.click()}
        data-testid="button-upload-image"
      >
        {uploading ? (
          <Loader className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {uploading ? 'Przesyłanie...' : 'Dodaj obrazek'}
      </Button>
      
      <input
        id="image-upload"
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />
      
      <p className="text-xs text-muted-foreground text-center">
        Obsługiwane formaty: JPG, PNG, GIF (max 10MB)
      </p>
    </div>
  );
}