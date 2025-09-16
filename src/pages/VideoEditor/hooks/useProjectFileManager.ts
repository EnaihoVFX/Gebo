import { useState, useEffect } from 'react';
import { type ProjectFile, type Track, type Clip, getProject, updateProject, type Segment } from '../../../lib/projectFile';
import { probeVideo, type Probe } from '../../../lib/ffmpeg';

export class ProjectFileManager {
    private _project: ProjectFile | null = null;
    private _loading: boolean = true;
    private _error: string | null = null;
    private _stateUpdateCallbacks: Set<() => void> = new Set();

    constructor() {
        // No longer take callback in constructor
    }

    // Add callback for state updates
    addStateCallback(callback: () => void) {
        this._stateUpdateCallbacks.add(callback);
    }

    // Remove callback
    removeStateCallback(callback: () => void) {
        this._stateUpdateCallbacks.delete(callback);
    }

    // Trigger all callbacks
    private triggerStateUpdate() {
        console.log(`Triggering state update for ${this._stateUpdateCallbacks.size} components`);
        this._stateUpdateCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('Error in state update callback:', error);
            }
        });
    }

    // Normalize project data from backend (convert plain objects to Maps)
    private normalizeProject(project: ProjectFile): ProjectFile {
        return {
            ...project,
            clips_map: project.clips_map instanceof Map 
                ? project.clips_map 
                : new Map(Object.entries(project.clips_map as Record<string, Clip>)),
            tracks_map: project.tracks_map instanceof Map 
                ? project.tracks_map 
                : new Map(Object.entries(project.tracks_map as Record<string, Track>))
        };
    }

    // Getters for state
    get project(): ProjectFile | null {
        return this._project;
    }

    get loading(): boolean {
        return this._loading;
    }

    get error(): string | null {
        return this._error;
    }

    // Get serialized project for JSON display/debugging
    getSerializedProject(): any {
        if (!this._project) return null;
        
        return {
            ...this._project,
            clips_map: Object.fromEntries(this._project.clips_map),
            tracks_map: Object.fromEntries(this._project.tracks_map),
        };
    }

    // Core project operations
    async initialize(): Promise<void> {
        // Fetch project from rust backend on init
        await this.refetchProject();
    }

    async setProject(project: ProjectFile | null): Promise<void> {
        console.log('setProject called with project:', project);
        
        if (project) {
            const normalizedProject = this.normalizeProject(project);
            console.log('Normalized project:', normalizedProject);
            console.log('About to call updateProject backend function');
            
            try {
                await updateProject(normalizedProject); // Update project on backend
                console.log('updateProject backend call completed successfully');
            } catch (error) {
                console.error('Error calling updateProject backend:', error);
                throw error;
            }
            
            this._project = normalizedProject; // Update local project state to reflect changes
            console.log('Local project state updated');
        } else {
            this._project = project;
        }
        
        console.log('About to call state update callback');
        this.triggerStateUpdate(); // Update callback to re-render, keep manager stateful
        console.log('State update callback completed');
        
        // Force a small delay and trigger callback again to ensure React picks up the change
        setTimeout(() => {
            console.log('Triggering delayed state update callback');
            this.triggerStateUpdate();
        }, 10);
    }

    async refetchProject(): Promise<void> {
        try {
            this._loading = true;
            this._error = null;
            this.triggerStateUpdate();
            
            const currentProject = await getProject();
            
            // Convert plain objects to Maps if needed (Tauri serialization issue)
            if (currentProject) {
                this._project = this.normalizeProject(currentProject);
            } else {
                this._project = currentProject;
            }
        } catch (err) {
            this._error = err instanceof Error ? err.message : 'Failed to load project';
            this._project = null;
        } finally {
            this._loading = false;
            this.triggerStateUpdate();
        }
    }

    // Track operations
    async addTrack(track: Omit<Track, 'id'>): Promise<string | null> {
        console.log('ProjectFileManager.addTrack called with:', track);
        
        if (!this._project) {
            console.log('No project loaded, cannot add track');
            return null;
        }

        console.log('Current project before adding track:', this._project);

        const newTrack: Track = {
            ...track,
            id: crypto.randomUUID(),
        };

        console.log('Generated new track with ID:', newTrack);

        const newTracksMap = new Map(this._project.tracks_map);
        newTracksMap.set(newTrack.id, newTrack);

        console.log('Updated tracks map size:', newTracksMap.size);

        const updatedProject = {
            ...this._project,
            tracks_map: newTracksMap
        };

        console.log('About to call setProject with updated project');
        
        try {
            await this.setProject(updatedProject);
            console.log('setProject completed successfully');
            console.log('Final project state:', this._project);
        } catch (error) {
            console.error('Error in setProject:', error);
            throw error;
        }
        
        return newTrack.id;
    }

    async removeTrack(trackId: string): Promise<void> {
        if (!this._project) return;

        const newTracksMap = new Map(this._project.tracks_map);
        newTracksMap.delete(trackId);

        const updatedProject = {
            ...this._project,
            tracks_map: newTracksMap
        };

        await this.setProject(updatedProject);
    }

    async updateTrack(trackId: string, updates: Partial<Track>): Promise<void> {
        if (!this._project) return;

        const track = this._project.tracks_map.get(trackId);
        if (!track) throw new Error(`Track ${trackId} not found`);

        const updatedTrack = { ...track, ...updates };
        const newTracksMap = new Map(this._project.tracks_map);
        newTracksMap.set(trackId, updatedTrack);

        const updatedProject = {
            ...this._project,
            tracks_map: newTracksMap
        };

        await this.setProject(updatedProject);
    }

    // Clip operations
    async addClip(clip: Omit<Clip, 'id'>): Promise<string | null> {
        if (!this._project) return null;

        const newClip: Clip = {
            ...clip,
            id: crypto.randomUUID(),
        };

        const newClipsMap = new Map(this._project.clips_map);
        newClipsMap.set(newClip.id, newClip);

        const updatedProject = {
            ...this._project,
            clips_map: newClipsMap
        };

        await this.setProject(updatedProject);
        return newClip.id;
    }

    async createClipFromPath(path: string, type: Clip['type']): Promise<Clip | null> {
        if (!this._project) return null;

        // Probe if video or audio
        let latest_probe: Probe | undefined;
        if (type === 'Video' || type === 'Audio') {
            latest_probe = await probeVideo(path);
        }

        const newClip: Clip = {
            id: crypto.randomUUID(),
            path,
            type,
            latest_probe
            // Set other default properties as needed
        };

        const newClipsMap = new Map(this._project.clips_map);
        newClipsMap.set(newClip.id, newClip);

        const updatedProject = {
            ...this._project,
            clips_map: newClipsMap
        };

        await this.setProject(updatedProject);
        return newClip;
    }

    async removeClip(clipId: string): Promise<void> {
        if (!this._project) return;

        const newClipsMap = new Map(this._project.clips_map);
        newClipsMap.delete(clipId);

        const updatedProject = {
            ...this._project,
            clips_map: newClipsMap
        };

        await this.setProject(updatedProject);
    }

    // Utility methods
    getTracks(): Track[] {
        if (!this._project) return [];
        return Array.from(this._project.tracks_map.values())
            .sort((a, b) => a.order - b.order);
    }

    getClips(): Clip[] {
        if (!this._project) return [];
        return Array.from(this._project.clips_map.values());
    }

    getSegments(trackId: string): Segment[] {
        if (!this._project) return [];
        const track = this._project.tracks_map.get(trackId);
        return track ? track.segments : [];
    }

    getTrack(id: string): Track | undefined {
        return this._project?.tracks_map.get(id);
    }

    getClip(id: string): Clip | undefined {
        return this._project?.clips_map.get(id);
    }
}

// Singleton instance
let globalProjectManager: ProjectFileManager | null = null;

export function useProjectFile(): ProjectFileManager {
    const [, forceUpdate] = useState({});
    
    // Create singleton instance if it doesn't exist
    if (!globalProjectManager) {
        console.log('Creating new global ProjectFileManager instance');
        globalProjectManager = new ProjectFileManager();
        globalProjectManager.initialize();
    }
    
    // Add this component's forceUpdate callback
    const callback = () => {
        console.log('ProjectFileManager state update callback triggered - forcing component re-render');
        forceUpdate({});
    };
    
    // Use useEffect equivalent with cleanup
    useEffect(() => {
        globalProjectManager!.addStateCallback(callback);
        return () => {
            globalProjectManager!.removeStateCallback(callback);
        };
    }, []);

    return globalProjectManager;
}