import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ImageLightboxProps {
  imageUrl: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, onClose }: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 modal-overlay flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      data-testid="image-lightbox"
    >
      <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt="Powiększony obraz EKG"
          className="lightbox-image rounded-lg shadow-2xl"
          style={{ transform: `scale(${zoom})` }}
          data-testid="lightbox-image"
        />
        
        {/* Close button */}
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-4 right-4 w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/70"
          onClick={onClose}
          data-testid="close-lightbox"
        >
          <X className="h-4 w-4" />
        </Button>
        
        {/* Zoom controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/50 rounded-lg p-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-10 h-10 text-white hover:bg-white/20"
            onClick={handleZoomOut}
            data-testid="zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-10 h-10 text-white hover:bg-white/20"
            onClick={handleResetZoom}
            data-testid="reset-zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-10 h-10 text-white hover:bg-white/20"
            onClick={handleZoomIn}
            data-testid="zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
