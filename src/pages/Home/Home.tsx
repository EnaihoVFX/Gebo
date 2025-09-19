import { openProjectPicker, saveProjectPicker } from './utils/fileUtils';
import { loadProject, newProject, type ProjectFile } from '../../lib/projectFile';
import { getRecentProjects, addRecentProject } from '../../lib/longtermStorage';
import FormModal from '../../components/FormModal';
import LoadingScreen from '../../components/LoadingScreen';
import { openEditorWindow } from '../../lib/windowManager';
import RecentProject from './components/recentProject.tsx';
import { useState, useEffect } from 'react';

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProjectTitle, setLoadingProjectTitle] = useState<string | undefined>();
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  // Load recent projects on mount
  useEffect(() => {
    loadRecentProjects();

    // Refresh recent projects when window gains focus
    const handleFocus = () => {
      loadRecentProjects();
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Function to load/refresh recent projects
  const loadRecentProjects = async () => {
    try {
      const projects = await getRecentProjects();
      console.log('Loaded recent projects:', projects);
      setRecentProjects(projects);
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  };

  const openFlow = async () => {
    // Get project path
    const path = await openProjectPicker();
    if (!path) {
      console.log("User cancelled opening project");
      return;
    }; // User cancelled

    // Start loading
    setIsLoading(true);
    setLoadingProjectTitle('Opening Project...');

    try {
      // Open project file
      const projectFile = await loadProject(path);

      // Add to recent projects
      await addRecentProject(path);

      // Refresh recent projects list
      await loadRecentProjects();

      // Set project title for loading screen
      setLoadingProjectTitle(projectFile.title);

      // The loading screen will handle the navigation after completion
    } catch (error) {
      console.error("Failed to open project file at path:", path, error);
      setLoadingProjectTitle(undefined);
      setIsLoading(false);
    }
  };

  // Handle recent project loading (called from RecentProject component)
  const handleRecentProjectLoading = (title: string) => {
    setIsLoading(true);
    setLoadingProjectTitle(title);
  };

  const createFlow = async (values: { [key: string]: string | number | boolean }) => {
    // Open save dialog
    const path = await saveProjectPicker();
    if (!path) {
      console.log("User cancelled saving created project"); 
      return;
    }

    const projectFile : ProjectFile = { title: values.title as string, clips_map: new Map(), tracks_map: new Map(), path };

    // Start loading
    setIsLoading(true);
    setLoadingProjectTitle(projectFile.title);

    try {
      await newProject(projectFile); // Set rust backend projectFile = this new one we have created

      // Add to recent projects
      await addRecentProject(path);

      // Refresh recent projects list
      await loadRecentProjects();

      // The loading screen will handle the navigation after completion
    } catch (error) {
      console.error("Failed to save project file:", error);
      setIsLoading(false);
      setLoadingProjectTitle(undefined);
    }
  };

  const handleLoadingComplete = async () => {
    try {
      // Open new fullscreen editor window
      await openEditorWindow();
    } catch (error) {
      console.error('Failed to open editor window:', error);
    }
    
    // Reset loading state
    setIsLoading(false);
    setLoadingProjectTitle(undefined);
  };

  return (
    <>
      {isLoading ? (
        <LoadingScreen 
          onComplete={handleLoadingComplete}
          projectTitle={loadingProjectTitle}
        />
      ) : (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
          <div className="max-w-6xl mx-auto p-8">
            {/* Main Header and Actions */}
            <div className="text-center mb-12">
              <img src="/logo.png" alt="Video Editor Logo" className="h-16 mb-6 mx-auto" />
              <div className="space-y-3 max-w-sm mx-auto">
                <button onClick={openFlow} className="block w-full px-6 py-3 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors">
                  Open Project
                </button>
                <button onClick={() => setModalOpen(true)} className="block w-full px-6 py-3 bg-zinc-600 text-white rounded hover:bg-zinc-700 transition-colors">
                  Create New Project
                </button>
              </div>
            </div>

            {/* Recent Projects Section */}
            {recentProjects.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-4 text-center text-zinc-300">Recent Projects</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-w-5xl mx-auto">
                  {recentProjects.map((projectPath, index) => (
                    <RecentProject
                      key={index}
                      projectPath={projectPath}
                      onLoadingStart={handleRecentProjectLoading}
                      onProjectOpened={loadRecentProjects}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => await createFlow(values)}
        title={"Create New Project"}
        fields={{
          title: { type: 'string', placeholder: 'Project Title' },
        }}
      />
    </>
  );
}