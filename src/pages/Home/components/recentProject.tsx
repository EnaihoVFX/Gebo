import { useState, useEffect } from 'react';
import { singleReadProject, loadProject, type ProjectFile } from '../../../lib/projectFile';
import { addRecentProject } from '../../../lib/longtermStorage';
import { openEditorWindow } from '../../../lib/windowManager';

interface RecentProjectProps {
  projectPath: string;
  onLoadingStart?: (title: string) => void;
  onProjectOpened?: () => void; // Callback to refresh parent's recent projects
}

export default function RecentProject({ projectPath, onLoadingStart, onProjectOpened }: RecentProjectProps) {
  const [projectDetails, setProjectDetails] = useState<ProjectFile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load project details on mount
  useEffect(() => {
    const loadProjectDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const project = await singleReadProject(projectPath);
        setProjectDetails(project);
      } catch (err) {
        console.error('Failed to load project details:', err);
        setError('Failed to load project');
      } finally {
        setIsLoading(false);
      }
    };

    loadProjectDetails();
  }, [projectPath]);

  // Handle opening the project (similar to Home.tsx openFlow)
  const handleOpenProject = async () => {
    if (!projectDetails) return;

    // Start loading immediately (notify parent if callback provided)
    onLoadingStart?.(projectDetails.title);

    // Give React a chance to render the loading screen before heavy operations
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      // Load the project into the backend
      await loadProject(projectPath);

      // Add to recent projects (this will move it to front if it already exists)
      await addRecentProject(projectPath);

      // Notify parent to refresh recent projects list (do this in background)
      setTimeout(() => {
        onProjectOpened?.();
      }, 0);

      // Open editor window
      await openEditorWindow();
    } catch (error) {
      console.error("Failed to open project:", error);
      // Could add error handling UI here
    }
  };

  // Get just the filename from the full path for display
  const getFileName = (path: string) => {
    return path.split(/[/\\]/).pop() || path;
  };

  // Get directory path for display
  const getDirectoryPath = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts.slice(0, -1).join('/') || '/';
  };

  if (isLoading) {
    return (
      <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700 animate-pulse">
        <div className="h-3 bg-zinc-700 rounded mb-2"></div>
        <div className="h-2 bg-zinc-700 rounded w-3/4"></div>
      </div>
    );
  }

  if (error || !projectDetails) {
    return (
      <div className="bg-zinc-800 rounded-md p-3 border border-red-700 border-opacity-50">
        <div className="text-red-400 text-xs font-medium mb-1">Error loading project</div>
        <div className="text-zinc-400 text-xs truncate">{getFileName(projectPath)}</div>
      </div>
    );
  }

  return (
    <button
      onClick={handleOpenProject}
      className="w-full bg-zinc-800 hover:bg-zinc-750 rounded-md p-3 border border-zinc-700 hover:border-zinc-600 transition-all duration-200 text-left group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-zinc-100 text-sm font-medium truncate pr-2 group-hover:text-cyan-400 transition-colors">
          {projectDetails.title}
        </h3>
      </div>
      
      <div className="text-zinc-400 text-xs mb-1 truncate">
        {getFileName(projectPath)}
      </div>
      
      <div className="text-zinc-500 text-xs truncate">
        {getDirectoryPath(projectPath)}
      </div>
      
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-700">
        <div className="text-zinc-500 text-xs">
          {Object.keys(projectDetails.clips_map || {}).length}c • {Object.keys(projectDetails.tracks_map || {}).length}t
        </div>
        <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
          →
        </div>
      </div>
    </button>
  );
}