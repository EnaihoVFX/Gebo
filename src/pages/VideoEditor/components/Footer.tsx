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
    <div className="bg-editor-bg-glass-primary backdrop-blur-2xl border-t border-editor-border-tertiary px-3 py-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 shadow-[0_-8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/2 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-editor-bg-glass-secondary/10 to-transparent"></div>
      {/* Left Section - Project Info */}
      <div className="flex items-center gap-2 sm:gap-2 lg:gap-3 text-xs sm:text-sm text-editor-text-secondary relative z-10">
        {/* Project Name */}
        <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <FileText className="w-3 h-3 flex-shrink-0 text-editor-status-info" />
          <span className="font-medium text-editor-text-primary whitespace-nowrap max-w-20 sm:max-w-24 truncate text-xs" title={projectName}>
            {projectName}
          </span>
        </div>

        {/* Container Format */}
        {container && (
          <div className="hidden sm:flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-tertiary font-mono text-xs">
              {container.toUpperCase()}
            </span>
          </div>
        )}

        {/* Duration */}
        {duration > 0 && (
          <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Clock className="w-3 h-3 flex-shrink-0 text-green-400" />
            <span className="font-mono whitespace-nowrap text-editor-text-primary text-xs">
              {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Clips Count */}
        {clips > 0 && (
          <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-primary font-medium text-xs">{clips} clips</span>
          </div>
        )}
      </div>

      {/* Center Section - Technical Specs */}
      <div className="flex items-center gap-2 sm:gap-2 lg:gap-3 text-xs sm:text-sm text-editor-text-secondary">
        {/* Resolution */}
        {resolution !== "No video loaded" && (
          <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Monitor className="w-3 h-3 flex-shrink-0 text-purple-400" />
            <span className="whitespace-nowrap text-editor-text-primary font-mono text-xs">{resolution}</span>
          </div>
        )}
        
        {/* Frame Rate */}
        {frameRate > 0 && (
          <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <Activity className="w-3 h-3 flex-shrink-0 text-orange-400" />
            <span className="whitespace-nowrap text-editor-text-primary font-mono text-xs">{frameRate} fps</span>
          </div>
        )}

        {/* Audio Info */}
        {audioChannels > 0 && (
          <div className="hidden sm:flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-primary font-mono text-xs">{audioChannels}ch</span>
            {audioRate > 0 && (
              <span className="whitespace-nowrap text-editor-text-tertiary font-mono text-xs">
                {Math.round(audioRate / 1000)}kHz
              </span>
            )}
          </div>
        )}

        {/* Codec Info */}
        {videoCodec && (
          <div className="hidden lg:flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-tertiary font-mono text-xs">
              {videoCodec.toUpperCase()}
            </span>
          </div>
        )}

        {/* Project Stats */}
        <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Scissors className="w-3 h-3 flex-shrink-0 text-red-400" />
          <span className="whitespace-nowrap text-editor-text-primary font-medium text-xs">{acceptedCuts} cuts</span>
          {previewCuts > 0 && (
            <span className="text-editor-status-warning whitespace-nowrap font-medium text-xs">+{previewCuts}</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 border border-current rounded-sm bg-cyan-400/20"></div>
          </div>
          <span className="whitespace-nowrap text-editor-text-primary font-medium text-xs">{tracks} tracks</span>
        </div>
      </div>

      {/* Right Section - Zoom & Status */}
      <div className="flex items-center gap-2 sm:gap-2">
        {/* Current Tool */}
        {currentTool && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-editor-text-secondary bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-primary">Tool: <span className="text-yellow-400 font-medium">{currentTool}</span></span>
          </div>
        )}

        {/* Selection Info */}
        {selectionInfo && (
          <div className="hidden lg:flex items-center gap-1 text-xs text-editor-text-secondary bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
            <span className="whitespace-nowrap text-editor-text-primary">{selectionInfo}</span>
          </div>
        )}

        {/* Zoom Level Display */}
        <div className="flex items-center gap-1 bg-editor-bg-glass-tertiary backdrop-blur-xl px-2 py-1 rounded-lg border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]">
          <span className="text-xs text-editor-text-primary font-mono font-semibold">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="p-1 text-editor-text-secondary hover:text-editor-text-primary hover:bg-editor-bg-glass-tertiary backdrop-blur-xl rounded-lg transition-all duration-200 hover:scale-105 border border-transparent hover:border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]"
          title="Settings"
        >
          <Settings className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
