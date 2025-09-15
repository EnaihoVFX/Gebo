import { 
  Monitor,
  Clock,
  FileText,
  Scissors,
  Settings,
  Activity
} from 'lucide-react';

interface FooterProps {
  // Project info
  acceptedCuts?: number;
  previewCuts?: number;
  clips?: number;
  tracks?: number;
  
  // Project metadata
  projectName?: string;
  resolution?: string;
  frameRate?: number;
  duration?: number;
  filePath?: string;
  audioChannels?: number;
  audioRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
  
  // Zoom info
  zoomLevel?: number;
  
  // Status info
  currentTool?: string;
  selectionInfo?: string;
  
  // Settings
  onSettingsClick?: () => void;
}

export default function Footer({
  acceptedCuts = 0,
  previewCuts = 0,
  clips = 0,
  tracks = 0,
  projectName = "Untitled Project",
  resolution = "1920x1080",
  frameRate = 30,
  duration = 0,
  audioChannels = 0,
  audioRate = 0,
  videoCodec = "",
  container = "",
  zoomLevel = 100,
  currentTool = "Select",
  selectionInfo = "",
  onSettingsClick
}: FooterProps) {
  
  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };


  return (
    <div className="bg-gradient-to-r from-editor-bg-secondary to-editor-bg-primary border-t border-editor-border-secondary px-3 sm:px-4 py-2 sm:py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-0 shadow-lg">
      {/* Left Section - Project Info */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm text-editor-text-secondary">
        {/* Project Name */}
        <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/30 px-2 py-1 rounded-md border border-editor-border-secondary/50">
          <FileText className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 text-blue-400" />
          <span className="font-medium text-editor-text-primary whitespace-nowrap max-w-24 sm:max-w-32 truncate" title={projectName}>
            {projectName}
          </span>
        </div>

        {/* Container Format */}
        {container && (
          <div className="hidden sm:flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-tertiary font-mono text-xs">
              {container.toUpperCase()}
            </span>
          </div>
        )}

        {/* Duration */}
        {duration > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 text-green-400" />
            <span className="font-mono whitespace-nowrap text-editor-text-primary">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Clips Count */}
        {clips > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-primary font-medium">{clips} clips</span>
          </div>
        )}
      </div>

      {/* Center Section - Technical Specs */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm text-editor-text-secondary">
        {/* Resolution */}
        {resolution !== "No video loaded" && (
          <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <Monitor className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 text-purple-400" />
            <span className="whitespace-nowrap text-editor-text-primary font-mono">{resolution}</span>
          </div>
        )}
        
        {/* Frame Rate */}
        {frameRate > 0 && (
          <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <Activity className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 text-orange-400" />
            <span className="whitespace-nowrap text-editor-text-primary font-mono">{frameRate} fps</span>
          </div>
        )}

        {/* Audio Info */}
        {audioChannels > 0 && (
          <div className="hidden sm:flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-primary font-mono">{audioChannels}ch</span>
            {audioRate > 0 && (
              <span className="whitespace-nowrap text-editor-text-tertiary font-mono">
                {Math.round(audioRate / 1000)}kHz
              </span>
            )}
          </div>
        )}

        {/* Codec Info */}
        {videoCodec && (
          <div className="hidden lg:flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-tertiary font-mono text-xs">
              {videoCodec.toUpperCase()}
            </span>
          </div>
        )}

        {/* Project Stats */}
        <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
          <Scissors className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0 text-red-400" />
          <span className="whitespace-nowrap text-editor-text-primary font-medium">{acceptedCuts} cuts</span>
          {previewCuts > 0 && (
            <span className="text-blue-400 whitespace-nowrap font-medium">+{previewCuts}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
          <div className="w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 sm:w-3 sm:h-3 border border-current rounded-sm bg-cyan-400/20"></div>
          </div>
          <span className="whitespace-nowrap text-editor-text-primary font-medium">{tracks} tracks</span>
        </div>
      </div>

      {/* Right Section - Zoom & Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Current Tool */}
        {currentTool && (
          <div className="hidden sm:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-editor-text-secondary bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-primary">Tool: <span className="text-yellow-400 font-medium">{currentTool}</span></span>
          </div>
        )}

        {/* Selection Info */}
        {selectionInfo && (
          <div className="hidden lg:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-editor-text-secondary bg-editor-bg-tertiary/20 px-2 py-1 rounded border border-editor-border-secondary/30">
            <span className="whitespace-nowrap text-editor-text-primary">{selectionInfo}</span>
          </div>
        )}

        {/* Zoom Level Display */}
        <div className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-3 py-1.5 rounded-lg border border-blue-400/30 shadow-sm">
          <span className="text-xs sm:text-sm text-blue-300 font-mono font-semibold">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="p-1.5 sm:p-2 text-editor-text-secondary hover:text-editor-text-primary hover:bg-editor-bg-tertiary rounded-lg transition-all duration-200 hover:scale-105 border border-transparent hover:border-editor-border-secondary/50"
          title="Settings"
        >
          <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
