import { invoke } from "@tauri-apps/api/core";

export interface Clip {
    id: string,
    path: string, // PathBuf
}

export interface Segment {
    id: string,

    clip_id: string, // Reference to the Clip by ID
    start: number,     // Start time in seconds within the clip
    end: number,       // End time in seconds within the clip
}

export type TrackType = "video" | "audio";
export interface Track {
    id: string,
    name: string,
    type: TrackType,
    enabled: boolean,
    muted: boolean,
    volume: number, // 0-100 for audio tracks, else does not matter
    order: number, // Order of the track in the timeline

    segments: Segment[], // Segments in this track. Order matters
}


export interface ProjectFile {
    title: string;
    clips_map: Map<string, Clip>;
    tracks_map: Map<string, Track>;
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