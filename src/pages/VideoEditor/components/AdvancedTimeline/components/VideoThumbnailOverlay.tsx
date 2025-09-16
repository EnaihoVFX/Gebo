import { useEffect, useRef, useState, useCallback } from "react";
import { generateThumbnails } from "../../../../../lib/ffmpeg";
import type { VideoThumbnailOverlayProps } from "../types";

export const VideoThumbnailOverlay: React.FC<VideoThumbnailOverlayProps> = ({
  clip,
  width,
  height,
  startTime,
  endTime,
  zoom: _zoom, // Reserved for future detail scaling
  pan: _pan, // Reserved for future viewport panning
  duration,
  thumbnailCount = 10
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const thumbnailCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Calculate segment duration and thumbnail specs
  const segmentDuration = endTime - startTime;
  const actualThumbnailCount = Math.min(thumbnailCount, Math.max(3, Math.floor(segmentDuration / 0.5)));

  // Generate thumbnails for this specific time segment
  useEffect(() => {
    if (!clip.path || segmentDuration <= 0) return;
    
    thumbnailCache.current.clear();
    setIsGenerating(true);
    
    // Generate thumbnails specifically for this time range
    generateThumbnails(clip.path, actualThumbnailCount, 160)
      .then((thumbs) => {
        // Filter thumbnails to match our time segment
        const totalThumbs = thumbs.length;
        const startRatio = startTime / duration;
        const endRatio = endTime / duration;
        
        const startIndex = Math.floor(startRatio * totalThumbs);
        const endIndex = Math.ceil(endRatio * totalThumbs);
        
        const segmentThumbs = thumbs.slice(startIndex, Math.min(endIndex, totalThumbs));
        setThumbnails(segmentThumbs);
      })
      .catch(console.error)
      .finally(() => setIsGenerating(false));
  }, [clip.path, startTime, endTime, duration, actualThumbnailCount]);

  // Get cached thumbnail
  const getCachedThumbnail = useCallback((base64Data: string, index: number): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const cacheKey = `${clip.path}_${startTime}_${endTime}_${index}_${base64Data.slice(0, 20)}`;
      
      if (thumbnailCache.current.has(cacheKey)) {
        const cachedImg = thumbnailCache.current.get(cacheKey)!;
        if (cachedImg.complete && cachedImg.naturalWidth > 0) {
          resolve(cachedImg);
          return;
        }
      }
      
      const img = new Image();
      img.onload = () => {
        thumbnailCache.current.set(cacheKey, img);
        resolve(img);
      };
      img.onerror = () => reject(new Error(`Failed to load thumbnail ${index}`));
      img.src = `data:image/png;base64,${base64Data}`;
    });
  }, [clip.path, startTime, endTime]);

  // Calculate thumbnail crop for segment
  const calculateThumbnailCrop = useCallback((
    img: HTMLImageElement,
    thumbnailWidth: number,
    thumbnailIndex: number,
    totalThumbnails: number
  ) => {
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    
    if (imgWidth <= 0 || imgHeight <= 0) {
      return { sourceX: 0, sourceY: 0, sourceWidth: imgWidth, sourceHeight: imgHeight };
    }

    const sourceHeight = imgHeight;
    let cropWidth = Math.min(imgWidth, thumbnailWidth * 2);
    
    // Distribute crop across the segment
    const segmentPosition = totalThumbnails > 1 ? thumbnailIndex / (totalThumbnails - 1) : 0;
    const maxOffset = Math.max(0, imgWidth - cropWidth);
    const sourceX = Math.floor(segmentPosition * maxOffset);
    
    return {
      sourceX,
      sourceY: 0,
      sourceWidth: cropWidth,
      sourceHeight: sourceHeight
    };
  }, []);

  // Draw thumbnails
  const drawThumbnails = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || thumbnails.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Calculate thumbnail dimensions
    const thumbnailWidth = width / thumbnails.length;
    const thumbnailHeight = height;

    // Draw each thumbnail
    thumbnails.forEach((thumbnail, index) => {
      const x = index * thumbnailWidth;
      
      getCachedThumbnail(thumbnail, index)
        .then(img => {
          if (canvas && ctx) {
            const crop = calculateThumbnailCrop(img, thumbnailWidth, index, thumbnails.length);
            
            ctx.drawImage(
              img,
              crop.sourceX, crop.sourceY, crop.sourceWidth, crop.sourceHeight,
              x, 0, thumbnailWidth, thumbnailHeight
            );
            
            // Add border
            ctx.strokeStyle = "#404040";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, thumbnailWidth, thumbnailHeight);
          }
        })
        .catch(error => {
          console.warn(`Error loading thumbnail ${index}:`, error);
          if (canvas && ctx) {
            // Draw placeholder
            ctx.fillStyle = "rgba(100, 100, 100, 0.5)";
            ctx.fillRect(x, 0, thumbnailWidth, thumbnailHeight);
          }
        });
    });
  }, [thumbnails, width, height, getCachedThumbnail, calculateThumbnailCrop]);

  useEffect(() => {
    drawThumbnails();
  }, [drawThumbnails]);

  // Cleanup
  useEffect(() => {
    return () => {
      thumbnailCache.current.clear();
    };
  }, []);

  if (isGenerating) {
    return (
      <div 
        style={{ width, height }} 
        className="bg-slate-700 flex items-center justify-center text-xs text-slate-300"
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ width, height }} className="relative overflow-hidden">
      <canvas 
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};