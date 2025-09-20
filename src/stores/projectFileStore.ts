import { create } from 'zustand';
import type { ProjectFile } from '../lib/projectFile';

type ProjectFileState = {
  projectFile: ProjectFile | null;
  setProjectFile: (projectFile: ProjectFile | null) => void;
};

export const useProjectFileStore = create<ProjectFileState>((set) => ({
  projectFile: null,
  setProjectFile: (projectFile) => set({ projectFile }),
}));



