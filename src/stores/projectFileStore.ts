import { create } from "zustand";
import { saveProjectPath, type ProjectFile } from "../lib/projectFile";
// Used to access ProjectFile across components / pages

// How to update ProjectFileStore ->

// import useProjectFileStore from "../stores/projectFileStore";
// const setProjectFile = useProjectFileStore(state => state.setProjectFile);
// setProjectFile(newProjectFile);


// How to fetch ProjectFileStore ->

// import useProjectFileStore from "../stores/projectFileStore";
// const projectFile = useProjectFileStore(state => state.projectFile);
// console.log(projectFile); 

interface ProjectFileStore {
    projectFile: ProjectFile | null;
    path: string | null; // Path to project file on disk, if any
    setProjectFile: (projectFile: ProjectFile, path: string) => void;
}

const useProjectFileStore = create<ProjectFileStore>((set) => ({
    projectFile: null,
    path: null,
    setProjectFile: (projectFile, path) => set({ projectFile, path }),
    saveToPath: async () => {
        const { projectFile, path } = useProjectFileStore.getState();
        if (!projectFile || !path) return;

        // Save project file to disk
        await saveProjectPath(projectFile, path);
    }
}));

export default useProjectFileStore;
