import { useCallback, useState, useEffect } from "react";
import { Plus, Video, Music, X, Mic, MicOff, Loader, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import type { MediaFile } from "../../../types";

interface MediaGridProps {
  mediaFiles: MediaFile[];
  onAddMedia: () => void;
  onRemoveMedia: (mediaId: string) => void;
  onDragStart: (mediaFile: MediaFile, event: React.DragEvent) => void;
}

export function MediaGrid({ mediaFiles, onAddMedia, onRemoveMedia, onDragStart }: MediaGridProps) {
  
  // Debug: Log when component renders
  console.log("MediaGrid rendering with", mediaFiles.length, "media files");
  console.log("onAddMedia function:", typeof onAddMedia, onAddMedia);
  

  const handleDragStart = useCallback((mediaFile: MediaFile, event: React.DragEvent) => {
    console.log("MediaGrid: Starting drag of:", mediaFile.name);
    console.log("MediaGrid: MediaFile object:", mediaFile);
    onDragStart(mediaFile, event);
    
    // Set drag data
    const dragData = {
      type: "media-file",
      mediaFile
    };
    console.log("MediaGrid: Setting drag data:", dragData);
    
    try {
      event.dataTransfer.setData("application/json", JSON.stringify(dragData));
      event.dataTransfer.effectAllowed = "copy";
      console.log("MediaGrid: Drag data set successfully");
      console.log("MediaGrid: DataTransfer types after setting:", Array.from(event.dataTransfer.types));
    } catch (error) {
      console.error("MediaGrid: Error setting drag data:", error);
    }
  }, [onDragStart]);

  // Custom drag and drop using mouse events
  const [isDragging, setIsDragging] = useState(false);
  const [dragData, setDragData] = useState<any>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((mediaFile: MediaFile, event: React.MouseEvent) => {
    console.log("MediaGrid: Mouse down on:", mediaFile.name);
    setIsDragging(true);
    const dragData = { type: "media-file", mediaFile };
    setDragData(dragData);
    
    const rect = event.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    
    // Dispatch custom event for timeline to listen to
    const customEvent = new CustomEvent('customDragStart', { 
      detail: dragData 
    });
    document.dispatchEvent(customEvent);
    console.log("MediaGrid: Dispatched custom drag start event");
    
    // Prevent default to avoid text selection
    event.preventDefault();
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isDragging && dragData) {
      console.log("MediaGrid: Mouse move while dragging");
      // We'll handle this in the timeline component
    }
  }, [isDragging, dragData]);

  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (isDragging) {
      console.log("MediaGrid: Mouse up, ending drag");
      setIsDragging(false);
      setDragData(null);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleDragEnd = useCallback(() => {
    // Drag ended
  }, []);

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
              className="group px-4 py-2 bg-editor-bg-glass-tertiary backdrop-blur-xl border border-editor-border-secondary text-editor-text-primary rounded-xl hover:bg-editor-interactive-hover hover:border-editor-border-primary transition-all duration-300 hover:scale-105 text-sm flex items-center gap-2 relative z-50 cursor-pointer pointer-events-auto shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] overflow-hidden"
              style={{ zIndex: 9999 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              <Plus className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Add Media Files</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {mediaFiles.map((mediaFile) => (
              <div
                key={mediaFile.id}
                className={`group relative bg-editor-bg-glass-secondary backdrop-blur-xl rounded-lg border border-editor-border-tertiary overflow-hidden cursor-grab hover:border-editor-border-secondary transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.2)] ${
                  isDragging && dragData?.mediaFile?.id === mediaFile.id ? 'opacity-50 scale-95' : ''
                }`}
                draggable={true}
                onDragStart={(e) => {
                  console.log("MediaGrid: onDragStart triggered for", mediaFile.name);
                  handleDragStart(mediaFile, e);
                }}
                onDragEnd={() => {
                  console.log("MediaGrid: onDragEnd triggered");
                  handleDragEnd();
                }}
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

                  {/* Video analysis status indicator (primary for videos) */}
                  {mediaFile.type === 'video' && (
                    <div className="absolute top-1 left-7 w-5 h-5 bg-slate-600 text-slate-300 rounded-full flex items-center justify-center opacity-80 transition-opacity" title={
                      mediaFile.videoAnalysisStatus === 'completed' ? 'Video analyzed by Gemini' :
                      mediaFile.videoAnalysisStatus === 'processing' ? 'Analyzing video...' :
                      mediaFile.videoAnalysisStatus === 'pending' ? 'Pending video analysis' :
                      mediaFile.videoAnalysisStatus === 'failed' ? 'Video analysis failed' :
                      'No video analysis'
                    }>
                      {mediaFile.videoAnalysisStatus === 'completed' && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                      {mediaFile.videoAnalysisStatus === 'processing' && (
                        <Loader className="w-3 h-3 text-editor-text-muted animate-spin" />
                      )}
                      {mediaFile.videoAnalysisStatus === 'pending' && (
                        <Eye className="w-3 h-3 text-yellow-400" />
                      )}
                      {mediaFile.videoAnalysisStatus === 'failed' && (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      {!mediaFile.videoAnalysisStatus && (
                        <EyeOff className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  )}

                  {/* Transcription status indicator (fallback for videos, primary for audio) */}
                  {(mediaFile.type === 'video' || mediaFile.type === 'audio') && (
                    <div className={`absolute top-1 ${mediaFile.type === 'video' ? 'left-12' : 'left-7'} w-5 h-5 bg-slate-600 text-slate-300 rounded-full flex items-center justify-center opacity-80 transition-opacity`} title={
                      mediaFile.transcriptionStatus === 'completed' ? 'Transcribed' :
                      mediaFile.transcriptionStatus === 'processing' ? 'Transcribing...' :
                      mediaFile.transcriptionStatus === 'pending' ? 'Pending transcription' :
                      mediaFile.transcriptionStatus === 'failed' ? 'Transcription failed' :
                      'No transcription'
                    }>
                      {mediaFile.transcriptionStatus === 'completed' && (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      )}
                      {mediaFile.transcriptionStatus === 'processing' && (
                        <Loader className="w-3 h-3 text-editor-text-muted animate-spin" />
                      )}
                      {mediaFile.transcriptionStatus === 'pending' && (
                        <Mic className="w-3 h-3 text-yellow-400" />
                      )}
                      {mediaFile.transcriptionStatus === 'failed' && (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      {!mediaFile.transcriptionStatus && (
                        <MicOff className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {mediaFiles.length > 0 && (
        <div className="px-3 py-2 border-t border-editor-border-tertiary bg-editor-bg-glass-secondary backdrop-blur-xl flex-shrink-0">
          <div className="text-xs text-editor-text-tertiary">
            {mediaFiles.length} media file{mediaFiles.length !== 1 ? 's' : ''} loaded
          </div>
        </div>
      )}
    </div>
  );
}
