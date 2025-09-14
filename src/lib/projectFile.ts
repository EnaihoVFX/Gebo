import { invoke } from "@tauri-apps/api/core";

export interface Clip {
    path: string; // File path as string
}

export interface ProjectFile {
    title: string;
    clips: Clip[];
}

export async function openProjectPath(path: string): Promise<ProjectFile> {
    return await invoke("open_project_path", { path }) as ProjectFile;
}

export async function saveProjectPath(project: ProjectFile, path: string): Promise<void> {
    await invoke("save_project_path", { project, path });
}
