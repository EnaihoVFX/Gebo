import { useCallback, useState, useMemo, useEffect } from "react";
import { Plus, Video, Music, X, Image } from "lucide-react";
import type { Clip } from "../../../lib/projectFile";
import { useFileHandling } from "../hooks/useFileHandling";

interface ClipGridProps {
  clips: Clip[];
  onAddClips: () => void;
  onRemoveClip: (clipId: string) => void;
  onDragStart: (clip: Clip, event: React.DragEvent) => void;
}

export function ClipGrid({ clips, onAddClips, onRemoveClip, onDragStart }: ClipGridProps) {
  const { generateThumbnailPreview } = useFileHandling();
  
  // Simple drag state without complex effects
  const [draggedClipId, setDraggedClipId] = useState<string | null>(null);
  
  // Store thumbnails for clips (simple cache)
  const [clipThumbnails, setClipThumbnails] = useState<Map<string, string>>(new Map());
  const [thumbnailsBeingGenerated, setThumbnailsBeingGenerated] = useState<Set<string>>(new Set());

  // Generate thumbnails for clips that don't have them yet
  useEffect(() => {
    const clipsNeedingThumbnails = clips.filter(clip => 
      (clip.type === 'Video' || clip.type === 'Image') && 
      !clipThumbnails.has(clip.id) && 
      !thumbnailsBeingGenerated.has(clip.id)
    );

    if (clipsNeedingThumbnails.length === 0) return;

    // Process clips one at a time to avoid overload
    const processNextClip = async () => {
      for (const clip of clipsNeedingThumbnails) {
        // Mark as being generated
        setThumbnailsBeingGenerated(prev => new Set(prev).add(clip.id));
        
        try {
          console.log("Generating thumbnail for:", clip.path, "Type:", clip.type);
          const previewData = await generateThumbnailPreview(clip);
          
          if (previewData.thumbnailUrl) {
            setClipThumbnails(prev => new Map(prev).set(clip.id, previewData.thumbnailUrl!));
            console.log("Thumbnail generated successfully for:", clip.path);
          } else {
            console.log("No thumbnail URL returned for:", clip.path);
          }
        } catch (error) {
          console.error("Failed to generate thumbnail for:", clip.path, error);
        } finally {
          // Remove from being generated set
          setThumbnailsBeingGenerated(prev => {
            const newSet = new Set(prev);
            newSet.delete(clip.id);
            return newSet;
          });
        }
        
        // Small delay between generations to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };

    processNextClip();
  }, [clips.map(c => c.id).join(',')]); // Only re-run when clip IDs change

  // Memoize handlers to prevent unnecessary re-renders
  const handleDragStart = useCallback((clip: Clip, event: React.DragEvent) => {
    setDraggedClipId(clip.id);
    onDragStart(clip, event);
    
    // Set drag data
    const dragData = {
      type: "clip",
      clip
    };
    
    try {
      event.dataTransfer.setData("application/json", JSON.stringify(dragData));
      event.dataTransfer.effectAllowed = "copy";
    } catch (error) {
      console.error("Error setting drag data:", error);
    }
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    setDraggedClipId(null);
  }, []);

  const handleMouseDown = useCallback((clip: Clip, event: React.MouseEvent) => {
    // Dispatch custom event for timeline to listen to
    const customEvent = new CustomEvent('customDragStart', { 
      detail: { type: "clip", clip }
    });
    document.dispatchEvent(customEvent);
    
    // Prevent default to avoid text selection
    event.preventDefault();
  }, []);

  // Memoize utility functions
  const formatDuration = useCallback((seconds: number | undefined) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getClipIcon = useCallback((clip: Clip) => {
    switch (clip.type) {
      case 'Video':
        return <Video className="w-6 h-6 text-slate-500" />;
      case 'Audio':
        return <Music className="w-6 h-6 text-slate-500" />;
      case 'Image':
        return <Image className="w-6 h-6 text-slate-500" />;
      default:
        return <Video className="w-6 h-6 text-slate-500" />;
    }
  }, []);

  const getClipDisplayName = useCallback((clip: Clip) => {
    return clip.path.split(/[/\\]/).pop() || clip.path;
  }, []);

  // Memoize the entire clips grid to prevent unnecessary re-renders
  const clipsGrid = useMemo(() => {
    if (clips.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-slate-700 flex items-center justify-center">
            <Video className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-400 mb-4">No clips loaded</p>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddClips();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Media Files
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-3">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={`group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden cursor-grab hover:border-slate-600 transition-colors ${
              draggedClipId === clip.id ? 'opacity-50 scale-95' : ''
            }`}
            draggable={true}
            onDragStart={(e) => handleDragStart(clip, e)}
            onDragEnd={handleDragEnd}
            onMouseDown={(e) => handleMouseDown(clip, e)}
            style={{ aspectRatio: '16/9' }}
          >
            {/* Thumbnail display with fallback */}
            <div className="relative w-full h-full">
              {clipThumbnails.has(clip.id) ? (
                <img
                  src={clipThumbnails.get(clip.id)}
                  alt={getClipDisplayName(clip)}
                  className="w-full h-full object-cover"
                />
              ) : thumbnailsBeingGenerated.has(clip.id) ? (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  {getClipIcon(clip)}
                </div>
              )}
              
              {/* Overlay with info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <div className="text-white text-xs font-medium truncate">
                    {getClipDisplayName(clip)}
                  </div>
                  <div className="text-slate-300 text-xs">
                    {formatDuration(clip.latest_probe?.duration)} • {clip.type}
                    {clip.latest_probe?.width && clip.latest_probe?.height && 
                      ` • ${clip.latest_probe.width}×${clip.latest_probe.height}`
                    }
                  </div>
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveClip(clip.id);
                }}
                className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
              >
                <X className="w-3 h-3" />
              </button>

              {/* Drag indicator */}
              <div className="absolute top-1 left-1 w-5 h-5 bg-slate-600 text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [clips, draggedClipId, onAddClips, onRemoveClip, handleDragStart, handleDragEnd, handleMouseDown, getClipIcon, getClipDisplayName, formatDuration]);

  return (
    <div className="h-full flex flex-col">
      {/* Clip Grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {clipsGrid}
      </div>

      {/* Footer info */}
      {clips.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-700 bg-slate-800 flex-shrink-0">
          <div className="text-xs text-slate-400">
            {clips.length} clip{clips.length !== 1 ? 's' : ''} loaded
          </div>
        </div>
      )}
    </div>
  );
}