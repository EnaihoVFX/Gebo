import { invoke } from "@tauri-apps/api/core";


export async function addRecentProject(path: string): Promise<void> {
    await invoke("add_recent_project", { path });
}

export async function getRecentProjects(): Promise<string[]> {
    return await invoke("get_recent_projects") as string[];
}
