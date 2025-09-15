import { invoke } from "@tauri-apps/api/core";

export interface Clip {
    path: string; // File path as string
}

export interface ProjectFile {
    title: string;
    clips: Clip[];
    path: string;
}

export async function loadProject(path: string): Promise<ProjectFile> {
    return await invoke("load_project", { path }) as ProjectFile;
}

export async function updateProject(project: ProjectFile): Promise<void> {
    await invoke("update_project", { updatedProject: project });
}

export async function saveProject(path?: string): Promise<void> {
    await invoke("save_project", { newPath: path });
}

export async function getProject(): Promise<ProjectFile | null> {
    return await invoke("get_project") as ProjectFile | null;
}

export async function newProject(project: ProjectFile): Promise<ProjectFile> {
    return await invoke("new_project", { projectFile: project }) as ProjectFile;
}