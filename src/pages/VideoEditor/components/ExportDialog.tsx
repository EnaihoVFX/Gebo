import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import type { Range } from "../../../types";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  acceptedCuts: Range[];
  onExport: (path: string, options: ExportOptions) => Promise<void>;
}

interface ExportOptions {
  format: 'mp4' | 'mov' | 'avi';
  quality: 'high' | 'medium' | 'low';
  resolution: 'original' | '1080p' | '720p' | '480p';
  codec: 'h264' | 'h265' | 'vp9';
  audio: 'original' | 'aac' | 'mp3' | 'none';
}

export function ExportDialog({
  isOpen,
  onClose,
  filePath,
  acceptedCuts,
  onExport
}: ExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'mp4',
    quality: 'high',
    resolution: 'original',
    codec: 'h264',
    audio: 'original'
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportProgress(0);

      // Get default filename based on original file
      const originalName = filePath.split('/').pop()?.split('.')[0] || 'edited';
      const extension = exportOptions.format;
      const defaultPath = `${originalName}_edited.${extension}`;

      const savePath = await save({
        defaultPath,
        filters: [
          { name: exportOptions.format.toUpperCase(), extensions: [exportOptions.format] }
        ]
      });

      if (!savePath) {
        setIsExporting(false);
        return;
      }

      // Simulate progress (in real implementation, this would come from FFmpeg)
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await onExport(savePath as string, exportOptions);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        onClose();
      }, 500);

    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const getFileSizeEstimate = () => {
    // Rough estimate based on settings
    const baseSize = 100; // MB
    const qualityMultiplier = exportOptions.quality === 'high' ? 1.5 : exportOptions.quality === 'medium' ? 1 : 0.7;
    const resolutionMultiplier = exportOptions.resolution === '1080p' ? 1 : exportOptions.resolution === '720p' ? 0.6 : 0.4;
    return Math.round(baseSize * qualityMultiplier * resolutionMultiplier);
  };

  return (
    <div className="fixed inset-0 bg-editor-bg-glass-overlay backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] relative">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none"></div>
        <h3 className="text-lg font-semibold text-editor-text-primary mb-4 relative z-10">Export Video</h3>
        
        {/* Export Options */}
        <div className="space-y-4 mb-6">
          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-editor-text-secondary mb-2">Format</label>
            <select
              value={exportOptions.format}
              onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
              className="w-full px-3 py-2 bg-editor-bg-canvas border border-editor-border-tertiary rounded-lg text-editor-text-primary focus:outline-none focus:border-editor-border-accent focus:ring-1 focus:ring-editor-border-accent"
            >
              <option value="mp4">MP4</option>
              <option value="mov">MOV</option>
              <option value="avi">AVI</option>
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-medium text-editor-text-secondary mb-2">Quality</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => setExportOptions(prev => ({ ...prev, quality }))}
                  className={`px-3 py-2 rounded-lg text-sm capitalize transition-all duration-200 ${
                    exportOptions.quality === quality
                      ? 'bg-editor-bg-glass-tertiary backdrop-blur-xl text-editor-text-primary border border-editor-border-accent shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-secondary hover:bg-editor-interactive-hover border border-editor-border-tertiary hover:border-editor-border-secondary'
                  }`}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-medium text-editor-text-secondary mb-2">Resolution</label>
            <select
              value={exportOptions.resolution}
              onChange={(e) => setExportOptions(prev => ({ ...prev, resolution: e.target.value as any }))}
              className="w-full px-3 py-2 bg-editor-bg-canvas border border-editor-border-tertiary rounded-lg text-editor-text-primary focus:outline-none focus:border-editor-border-accent focus:ring-1 focus:ring-editor-border-accent"
            >
              <option value="original">Original</option>
              <option value="1080p">1080p (Full HD)</option>
              <option value="720p">720p (HD)</option>
              <option value="480p">480p (SD)</option>
            </select>
          </div>

          {/* Codec */}
          <div>
            <label className="block text-sm font-medium text-editor-text-secondary mb-2">Video Codec</label>
            <div className="flex gap-2">
              {(['h264', 'h265', 'vp9'] as const).map((codec) => (
                <button
                  key={codec}
                  onClick={() => setExportOptions(prev => ({ ...prev, codec }))}
                  className={`px-3 py-2 rounded-lg text-sm uppercase transition-all duration-200 ${
                    exportOptions.codec === codec
                      ? 'bg-editor-bg-glass-tertiary backdrop-blur-xl text-editor-text-primary border border-editor-border-accent shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-secondary hover:bg-editor-interactive-hover border border-editor-border-tertiary hover:border-editor-border-secondary'
                  }`}
                >
                  {codec}
                </button>
              ))}
            </div>
          </div>

          {/* Audio */}
          <div>
            <label className="block text-sm font-medium text-editor-text-secondary mb-2">Audio</label>
            <select
              value={exportOptions.audio}
              onChange={(e) => setExportOptions(prev => ({ ...prev, audio: e.target.value as any }))}
              className="w-full px-3 py-2 bg-editor-bg-canvas border border-editor-border-tertiary rounded-lg text-editor-text-primary focus:outline-none focus:border-editor-border-accent focus:ring-1 focus:ring-editor-border-accent"
            >
              <option value="original">Original</option>
              <option value="aac">AAC</option>
              <option value="mp3">MP3</option>
              <option value="none">No Audio</option>
            </select>
          </div>
        </div>

        {/* Export Info */}
        <div className="bg-editor-bg-glass-secondary backdrop-blur-xl rounded-xl p-3 mb-6 border border-editor-border-tertiary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] relative z-10">
          <div className="text-sm text-editor-text-tertiary space-y-1">
            <div>Cut segments: {acceptedCuts.length}</div>
            <div>Estimated file size: ~{getFileSizeEstimate()} MB</div>
            <div>Format: {exportOptions.format.toUpperCase()}</div>
            <div>Quality: {exportOptions.quality}</div>
          </div>
        </div>

        {/* Progress Bar */}
        {isExporting && (
          <div className="mb-6 relative z-10">
            <div className="flex justify-between text-sm text-editor-text-tertiary mb-2">
              <span>Exporting...</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full bg-editor-bg-glass-tertiary backdrop-blur-xl rounded-full h-2 border border-editor-border-tertiary">
              <div
                className="bg-gradient-to-r from-editor-status-info to-editor-status-success h-2 rounded-full transition-all duration-300 shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 relative z-10">
          <button
            onClick={handleExport}
            disabled={isExporting || acceptedCuts.length === 0}
            className="group flex-1 px-4 py-2 bg-editor-bg-glass-tertiary backdrop-blur-xl text-editor-text-primary rounded-xl hover:bg-editor-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 border border-editor-border-tertiary hover:border-editor-border-secondary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden font-medium"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <span className="relative z-10">{isExporting ? 'Exporting...' : 'Export Video'}</span>
          </button>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="group px-4 py-2 bg-editor-bg-glass-secondary backdrop-blur-xl text-editor-text-secondary rounded-xl hover:bg-editor-interactive-hover disabled:opacity-50 transition-all duration-300 hover:scale-105 border border-editor-border-tertiary hover:border-editor-border-secondary shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <span className="relative z-10">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
