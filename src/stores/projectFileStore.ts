import { create } from 'zustand';

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  lastModified: Date;
  // Add other project file properties as needed
}

interface ProjectFileStore {
  projectFile: ProjectFile | null;
  setProjectFile: (projectFile: ProjectFile | null) => void;
}

export const useProjectFileStore = create<ProjectFileStore>((set) => ({
  projectFile: null,
  setProjectFile: (projectFile) => set({ projectFile }),
}));

export default useProjectFileStore;
