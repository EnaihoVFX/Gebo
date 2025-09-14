import { openProjectPicker, saveProjectPicker } from './utils/fileUtils';
import { openProjectPath, saveProjectPath, type ProjectFile } from '../../lib/projectFile';
import useProjectFileStore from '../../stores/projectFileStore';
import FormModal from '../../components/FormModal';
import LoadingScreen from '../../components/LoadingScreen';
import { openEditorWindow } from '../../lib/windowManager';
import { useState } from 'react';

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProjectTitle, setLoadingProjectTitle] = useState<string | undefined>();

  const openProject = async () => {
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
      const projectFile = await openProjectPath(path);

      // Store project file to state
      useProjectFileStore.setState({ projectFile, path });

      // Set project title for loading screen
      setLoadingProjectTitle(projectFile.title);

      // The loading screen will handle the navigation after completion
    } catch (error) {
      console.error("Failed to open project file at path:", path, error);
      setIsLoading(false);
      setLoadingProjectTitle(undefined);
    }
  };

  const createProject = async (values: { [key: string]: string | number | boolean }) => {
    const projectFile : ProjectFile = { title: values.title as string, clips: [] };

    // Open save dialog
    const path = await saveProjectPicker();
    if (!path) {
      console.log("User cancelled saving created project"); 
      return;
    }

    // Start loading
    setIsLoading(true);
    setLoadingProjectTitle(projectFile.title);

    try {
      // Save empty project file to path
      await saveProjectPath(projectFile, path);

      // Store to state
      useProjectFileStore.setState({ projectFile, path });

      // The loading screen will handle the navigation after completion
    } catch (error) {
      console.error("Failed to save project file:", error);
      setIsLoading(false);
      setLoadingProjectTitle(undefined);
    }
  };

  const handleLoadingComplete = async () => {
    console.log('Loading complete, opening editor window...');
    try {
      // Open new fullscreen editor window
      await openEditorWindow();
      console.log('Editor window opened successfully');
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
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
          <div className="text-center">
            <img src="/logo.png" alt="Video Editor Logo" className="h-16 mb-4 mx-auto" />
            <button onClick={openProject} className="px-4 py-2 bg-cyan-600 text-white rounded mr-2">Open Project</button>
            <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-zinc-600 text-white rounded">Create New Project</button>
          </div>
        </div>
      )}
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => await createProject(values)}
        title={"Create New Project"}
        fields={{
          title: { type: 'string', placeholder: 'Project Title' },
        }}
      />
    </>
  );
}