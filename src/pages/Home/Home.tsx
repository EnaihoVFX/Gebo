import { useNavigate } from 'react-router-dom';
import { openProjectPicker, saveProjectPicker } from './utils/fileUtils';
import { openProjectPath, saveProjectPath, type ProjectFile } from '../../lib/projectFile';
import useProjectFileStore from '../../stores/projectFileStore';
import FormModal from '../../components/FormModal';
import { useState } from 'react';

export default function Home() {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  const openProject = async () => {
    // Get project path
    const path = await openProjectPicker();
    if (!path) {
      console.log("User cancelled opening project");
      return;
    }; // User cancelled

    // Open project file
    let projectFile: ProjectFile;
    try {
      projectFile = await openProjectPath(path);
    } catch (error) {
      console.error("Failed to open project file at path:", path, error);
      return;
    }; // Failed to open project file

    // Store project file to state
    useProjectFileStore.setState({ projectFile, path });

    // Navigate to editor
    navigate('/editor');
  };

  const createProject = async (values: { [key: string]: string | number | boolean }) => {
    const projectFile : ProjectFile = { title: values.title as string, clips: [] };

    // Open save dialog
    const path = await saveProjectPicker();
    if (!path) {
      console.log("User cancelled saving created project"); 
      return;
    }

    // Save empty project file to path
    try {
      await saveProjectPath(projectFile, path);
    } catch (error) {
      console.error("Failed to save project file:", error);
      return;
    }

    // Store to state
    useProjectFileStore.setState({ projectFile, path });

    // Navigate to editor
    navigate('/editor');
  };

  return (
    <>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Video Editor Logo" className="h-16 mb-4 mx-auto" />
          <button onClick={openProject} className="px-4 py-2 bg-cyan-600 text-white rounded mr-2">Open Project</button>
          <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-zinc-600 text-white rounded">Create New Project</button>
        </div>
      </div>
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