import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { exportCutlist } from "../lib/ffmpeg";
import type { Range } from "../types";

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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-zinc-100 mb-4">Export Video</h3>
        
        {/* Export Options */}
        <div className="space-y-4 mb-6">
          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Format</label>
            <select
              value={exportOptions.format}
              onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              <option value="mp4">MP4</option>
              <option value="mov">MOV</option>
              <option value="avi">AVI</option>
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Quality</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => setExportOptions(prev => ({ ...prev, quality }))}
                  className={`px-3 py-2 rounded text-sm capitalize ${
                    exportOptions.quality === quality
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  {quality}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Resolution</label>
            <select
              value={exportOptions.resolution}
              onChange={(e) => setExportOptions(prev => ({ ...prev, resolution: e.target.value as any }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              <option value="original">Original</option>
              <option value="1080p">1080p (Full HD)</option>
              <option value="720p">720p (HD)</option>
              <option value="480p">480p (SD)</option>
            </select>
          </div>

          {/* Codec */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Video Codec</label>
            <div className="flex gap-2">
              {(['h264', 'h265', 'vp9'] as const).map((codec) => (
                <button
                  key={codec}
                  onClick={() => setExportOptions(prev => ({ ...prev, codec }))}
                  className={`px-3 py-2 rounded text-sm uppercase ${
                    exportOptions.codec === codec
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                  }`}
                >
                  {codec}
                </button>
              ))}
            </div>
          </div>

          {/* Audio */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Audio</label>
            <select
              value={exportOptions.audio}
              onChange={(e) => setExportOptions(prev => ({ ...prev, audio: e.target.value as any }))}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded text-zinc-100 focus:outline-none focus:border-blue-500"
            >
              <option value="original">Original</option>
              <option value="aac">AAC</option>
              <option value="mp3">MP3</option>
              <option value="none">No Audio</option>
            </select>
          </div>
        </div>

        {/* Export Info */}
        <div className="bg-zinc-800 rounded p-3 mb-6">
          <div className="text-sm text-zinc-400 space-y-1">
            <div>Cut segments: {acceptedCuts.length}</div>
            <div>Estimated file size: ~{getFileSizeEstimate()} MB</div>
            <div>Format: {exportOptions.format.toUpperCase()}</div>
            <div>Quality: {exportOptions.quality}</div>
          </div>
        </div>

        {/* Progress Bar */}
        {isExporting && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-zinc-400 mb-2">
              <span>Exporting...</span>
              <span>{exportProgress}%</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={isExporting || acceptedCuts.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? 'Exporting...' : 'Export Video'}
          </button>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
