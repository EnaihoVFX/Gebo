import { useCallback, useState, useEffect } from "react";
import { Plus, Video, Music, X } from "lucide-react";
import type { MediaFile } from "../../../types";

interface MediaGridProps {
  mediaFiles: MediaFile[];
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
}

export function MediaGrid({ mediaFiles, onAddMedia, onRemoveMedia }: MediaGridProps) {
  
  // Debug: Log when component renders
  console.log("MediaGrid rendering with", mediaFiles.length, "media files");
  console.log("onAddMedia function:", typeof onAddMedia, onAddMedia);
  

  // Removed HTML5 drag handling - using custom mouse events instead

  // Custom drag and drop using mouse events
  const [isDragging, setIsDragging] = useState(false);
  const [dragData, setDragData] = useState<any>(null);

  const handleMouseDown = useCallback((mediaFile: MediaFile, event: React.MouseEvent) => {
    console.log("🎬 === MEDIA GRID DRAG START ===");
    console.log("🎬 MediaGrid: Mouse down on:", mediaFile.name);
    console.log("🎬 Media file details:", { id: mediaFile.id, name: mediaFile.name, type: mediaFile.type, duration: mediaFile.duration });
    console.log("🎬 Mouse position:", { clientX: event.clientX, clientY: event.clientY });
    
    setIsDragging(true);
    const dragData = { type: "media-file", mediaFile };
    setDragData(dragData);
    
    // Get initial mouse position for drag indicator
    const initialPos = {
      clientX: event.clientX,
      clientY: event.clientY
    };
    
    // Dispatch custom event for timeline to listen to
    const customEvent = new CustomEvent('customDragStart', { 
      detail: { ...dragData, ...initialPos }
    });
    document.dispatchEvent(customEvent);
    console.log("🎬 MediaGrid: Dispatched custom drag start event with position", initialPos);
    console.log("🎬 Custom event detail:", customEvent.detail);
    
    // Prevent default to avoid text selection
    event.preventDefault();
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging && dragData) {
      console.log("MediaGrid: Mouse move while dragging");
      // Dispatch drag move event with current mouse position
      const customEvent = new CustomEvent('customDragMove', {
        detail: {
          clientX: event.clientX,
          clientY: event.clientY
        }
      });
      document.dispatchEvent(customEvent);
    }
  }, [isDragging, dragData]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (isDragging) {
      console.log("🎬 === MEDIA GRID DRAG END ===");
      console.log("🎬 MediaGrid: Mouse up, ending drag");
      console.log("🎬 Final mouse position:", { clientX: event.clientX, clientY: event.clientY });
      console.log("🎬 Drag data was:", dragData);
      
      setIsDragging(false);
      setDragData(null);
      
      // Dispatch custom drag end event with current mouse position
      const customEvent = new CustomEvent('customDragEnd', {
        detail: {
          clientX: event.clientX,
          clientY: event.clientY
        }
      });
      document.dispatchEvent(customEvent);
      console.log("🎬 MediaGrid: Dispatched custom drag end event with position", { x: event.clientX, y: event.clientY });
    }
  }, [isDragging, dragData]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Also listen for drag events to broadcast cursor position
      const handleGlobalDragOver = (e: DragEvent) => {
        const customEvent = new CustomEvent('customDragMove', {
          detail: {
            clientX: e.clientX,
            clientY: e.clientY
          }
        });
        document.dispatchEvent(customEvent);
      };
      
      document.addEventListener('dragover', handleGlobalDragOver);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('dragover', handleGlobalDragOver);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Removed HTML5 drag end handling - using custom mouse events instead

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAspectRatio = (width: number, height: number) => {
    return width / height;
  };

  const getThumbnailStyle = (mediaFile: MediaFile) => {
    const aspectRatio = getAspectRatio(mediaFile.width, mediaFile.height);
    const targetAspectRatio = 16 / 9;
    
    if (aspectRatio > targetAspectRatio) {
      // Video is wider than 16:9, fit by height
      return {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        objectPosition: 'center' as const
      };
    } else {
      // Video is taller than 16:9, fit by width
      return {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        objectPosition: 'center' as const
      };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0 relative">
        {mediaFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center relative">
            <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-slate-700 flex items-center justify-center">
              <Video className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400 mb-4">No media files loaded</p>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("Add Media button clicked");
                console.log("Add Media button was clicked!");
                onAddMedia();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 relative z-50 cursor-pointer pointer-events-auto"
              style={{ zIndex: 9999 }}
            >
              <Plus className="w-4 h-4" />
              Add Media Files
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mediaFiles.map((mediaFile) => (
              <div
                key={mediaFile.id}
                className={`group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden cursor-grab hover:border-slate-600 transition-colors ${
                  isDragging && dragData?.mediaFile?.id === mediaFile.id ? 'opacity-50 scale-95' : ''
                }`}
                onMouseDown={(e) => {
                  console.log("MediaGrid: onMouseDown triggered for", mediaFile.name);
                  handleMouseDown(mediaFile, e);
                }}
                style={{
                  aspectRatio: '16/9'
                }}
              >
                {/* Thumbnail */}
                <div className="relative w-full h-full">
                  {mediaFile.thumbnailUrl ? (
                    <img
                      src={mediaFile.thumbnailUrl}
                      alt={mediaFile.name}
                      className="w-full h-full object-cover"
                      style={getThumbnailStyle(mediaFile)}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                      {mediaFile.type === 'video' ? (
                        <Video className="w-8 h-8 text-slate-500" />
                      ) : (
                        <Music className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                  )}
                  
                  {/* Overlay with info */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="text-white text-xs font-medium truncate">
                        {mediaFile.name}
                      </div>
                      <div className="text-slate-300 text-xs">
                        {formatDuration(mediaFile.duration)} • {mediaFile.type === 'video' ? `${mediaFile.width}×${mediaFile.height}` : 'Audio'}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveMedia(mediaFile.id);
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
        )}
      </div>

      {/* Footer info */}
      {mediaFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-700 bg-slate-800 flex-shrink-0">
          <div className="text-xs text-slate-400">
            {mediaFiles.length} media file{mediaFiles.length !== 1 ? 's' : ''} loaded
          </div>
        </div>
      )}
    </div>
  );
}
