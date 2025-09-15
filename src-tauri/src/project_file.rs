use anyhow::{anyhow, Context, Result};
use serde::{Serialize, Deserialize};
use std::fs::{self, File, OpenOptions};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::collections::HashMap;

/// Represents a single 'clip' (audio/video/image file) used in the project
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Clip {
    pub id: String,
    pub path: PathBuf,
}
impl Clip {
    /// Verify that the clip's path exists and is a file
    /// 
    /// Returns true if valid, false otherwise
    pub fn verify(&self) -> bool {
        self.path.exists() && self.path.is_file()
    }
}

// Segment
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Segment {
    pub id: String,

    pub clip_id: String, // Reference to the Clip by ID
    pub start: f64,     // Start time in seconds within the clip
    pub end: f64,       // End time in seconds within the clip
}

impl Segment {
    /// Verify that the segment is valid. Does not check that clip id is valid
    pub fn verify(&self) -> bool {
        self.start < self.end
    }

    /// Get the duration of the segment in seconds
    pub fn duration(&self) -> f64 {
        self.end - self.start
    }
}

// TrackType
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TrackType {
    Video,
    Audio,
}

impl TrackType {
    /// Convert to string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            TrackType::Video => "video",
            TrackType::Audio => "audio",
        }
    }
    
    /// Create from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "video" => Some(TrackType::Video),
            "audio" => Some(TrackType::Audio),
            _ => None,
        }
    }
}

// Track
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Track {
    pub id: String,
    pub name: String,
    pub r#type: TrackType,
    pub enabled: bool,
    pub muted: bool,
    pub volume: u8, // 0-100 for audio tracks, else does not matter
    pub order: u32, // Order of the track in the timeline

    pub segments: Vec<Segment>, // Segments in this track. Order matters
}

impl Track {
    /// Verify that the track is valid
    pub fn verify(&self) -> bool {
        let segments_valid = self.segments.is_empty() || self.segments.iter().all(|seg| seg.verify());
        let volume_valid = self.r#type != TrackType::Audio || (self.volume <= 100);
        
        segments_valid && volume_valid
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectFile {
    pub title: String,
    pub clips_map: HashMap<String, Clip>, // Id to CLIP
    pub tracks_map: HashMap<String, Track>, // Id to Track
    pub path: Option<PathBuf>, // Where the ProjectFile is saved on disk.
    // This is a weird way of doing it but is convenient and its used frequently

    // Add other fields here later, such as metadata, settings, 
    // and info about edits like segments and effects
    // and maybe cache probe info?
}

impl ProjectFile { 
    fn verify_segments_in_tracks(&self) -> bool {
        for track in self.tracks_map.values() {
            for segment in &track.segments {
                if !self.clips_map.contains_key(&segment.clip_id) {
                    return false; // Segment references a non-existent clip
                }
            }
        }
        true
    }
    /// Verify that the project file is valid
    pub fn verify(&self) -> bool {
        let clips_valid = self.clips_map.is_empty() || self.clips_map.iter().all(|clip| clip.1.verify());
        let tracks_valid = self.tracks_map.is_empty() || self.tracks_map.iter().all(|track| track.1.verify());
        clips_valid && tracks_valid && self.verify_segments_in_tracks()
    }

    /// Load a ProjectFile from a given path
    pub fn from_path(path: &Path) -> Result<Self> {
        // Ensure path exists
        if !path.exists() || !path.is_file() {
            return Err(anyhow!("project file does not exist or is not a valid file"));
        }

        // Read file content, set self = deserialized content
        let content: String = fs::read_to_string(path).with_context(|| "failed to read project file")?;
        let mut project: Self = serde_json::from_str(&content).with_context(|| "invalid project file format")?;
        
        // Mutate self.path to be the provided path so path is always updated
        project.path = Some(path.to_path_buf());

        // Ensure project is valid now
        if !project.verify() {
            return Err(anyhow!("project file is invalid."));
        }

        Ok(project)
    }

    /// Save the ProjectFile to its stored path
    pub fn save(&self) -> Result<()> {
        // JSONify self
        let content = serde_json::to_string_pretty(self).with_context(|| "failed to serialize project file")?;
        // Write to self.path
        fs::write(self.path.as_ref().context("project file path is not set")?, content).with_context(|| "failed to write project file")?;
        Ok(())
    }
}



// Global Project State Management

/// Global project state that handles all project operations and file locking
struct ProjectState {
    project: ProjectFile,
    file_handle: Option<File>,  // Handle to prevent deletion
}

impl ProjectState {
    /// Create a new project state with optional file locking
    fn new(project: ProjectFile) -> Result<Self> {
        let file_handle = if let Some(path) = &project.path {
            Self::acquire_file_handle(path).ok()
        } else {
            None
        };
        
        Ok(Self {
            project,
            file_handle,
        })
    }

    /// Acquire a file handle with exclusive access to prevent deletion
    fn acquire_file_handle(path: &Path) -> Result<File> {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::fs::OpenOptionsExt;
            
            OpenOptions::new()
                .read(true)
                .write(true)
                .share_mode(0)  // No sharing - exclusive access
                .open(path)
                .with_context(|| format!("failed to acquire exclusive file handle for {:?}", path))
        }
        
        #[cfg(not(target_os = "windows"))]
        {
            // On non-Windows systems, just open with read/write access
            OpenOptions::new()
                .read(true)
                .write(true)
                .open(path)
                .with_context(|| format!("failed to acquire file handle for {:?}", path))
        }
    }

    /// Load a project from path and create state with file locking
    fn load_from_path(path: String) -> Result<Self> {
        let path_buf = PathBuf::from(&path);
        let project = ProjectFile::from_path(&path_buf)?;
        
        // Acquire exclusive file handle to prevent deletion
        let file_handle = Self::acquire_file_handle(&path_buf)?;
        
        Ok(Self {
            project,
            file_handle: Some(file_handle),
        })
    }

    /// Save the project, temporarily releasing and reacquiring file handle
    fn save(&mut self, new_path: Option<String>) -> Result<()> {
        // Temporarily release file handle for saving
        let _temp_handle = self.file_handle.take();
        
        // Update path if provided
        if let Some(new_path_str) = new_path {
            self.project.path = Some(PathBuf::from(new_path_str));
        }
        
        // Save the project
        let save_result = self.project.save();
        
        // Reacquire file handle after saving
        if let Some(path) = &self.project.path {
            self.file_handle = Self::acquire_file_handle(path).ok();
        }
        
        save_result
    }

    /// Update the project data and refresh file handle if path changed
    fn update(&mut self, updated_project: ProjectFile) -> Result<()> {
        let path_changed = self.project.path != updated_project.path;
        
        self.project = updated_project;
        
        // If path changed, reacquire file handle
        if path_changed {
            self.file_handle = if let Some(path) = &self.project.path {
                Self::acquire_file_handle(path).ok()
            } else {
                None
            };
        }
        
        Ok(())
    }

    /// Get a clone of the project data
    fn get_project(&self) -> ProjectFile {
        self.project.clone()
    }
}

// Global singleton state
static PROJECT_STATE: OnceLock<Mutex<Option<ProjectState>>> = OnceLock::new();

/// Get the global project state singleton
fn get_global_state() -> &'static Mutex<Option<ProjectState>> {
    PROJECT_STATE.get_or_init(|| Mutex::new(None))
}

// Public API functions

/// Create a new project and set it as current (for unsaved projects)
pub fn new_project(project: ProjectFile) -> Result<ProjectFile> {
    let state = get_global_state();
    let mut guard = state.lock().map_err(|e| anyhow!("failed to lock project state: {}", e))?;
    
    let mut project_state = ProjectState::new(project)?;
    
    // Save the project to disk if it has a path
    if project_state.project.path.is_some() {
        project_state.save(None)?;
    }
    
    let result = project_state.get_project();
    
    *guard = Some(project_state);
    Ok(result)
}

/// Load a project from a file path and set it as current
pub fn load_project(path: String) -> Result<ProjectFile> {
    let state = get_global_state();
    let mut guard = state.lock().map_err(|e| anyhow!("failed to lock project state: {}", e))?;
    
    let project_state = ProjectState::load_from_path(path)?;
    let result = project_state.get_project();
    
    *guard = Some(project_state);
    Ok(result)
}

/// Get the current project, if any
pub fn get_project() -> Result<Option<ProjectFile>, String> {
    let state = get_global_state();
    let guard = state.lock().map_err(|e| format!("failed to lock project state: {}", e))?;
    
    Ok(guard.as_ref().map(|s| s.get_project()))
}

/// Save the current project to disk, optionally updating its path
pub fn save_project(new_path: Option<String>) -> Result<()> {
    let state = get_global_state();
    let mut guard = state.lock().map_err(|e| anyhow!("failed to lock project state: {}", e))?;
    
    if let Some(project_state) = guard.as_mut() {
        project_state.save(new_path)
    } else {
        Err(anyhow!("no project is currently loaded"))
    }
}

/// Update the current project with new data
pub fn update_project(updated_project: ProjectFile) -> Result<()> {
    let state = get_global_state();
    let mut guard = state.lock().map_err(|e| anyhow!("failed to lock project state: {}", e))?;
    
    if let Some(project_state) = guard.as_mut() {
        project_state.update(updated_project)
    } else {
        // If no project exists, create new one
        let project_state = ProjectState::new(updated_project)?;
        *guard = Some(project_state);
        Ok(())
    }
}

/// Close the current project and release file handle
pub fn close_project() -> Result<()> {
    let state = get_global_state();
    let mut guard = state.lock().map_err(|e| anyhow!("failed to lock project state: {}", e))?;
    
    *guard = None;  // Drops project state and file handle
    Ok(())
}

/// Check if a project is currently loaded
pub fn has_project() -> bool {
    let state = get_global_state();
    let guard = state.lock().unwrap_or_else(|e| e.into_inner());
    guard.is_some()
}


// NOTES
// Simplified ProjectState pattern for handling project files with file locking
// ProjectState contains all functionality directly without unnecessary wrapper classes
// File handles use read+write access for stronger Windows file locking
// Use new_project() for creating unsaved projects, load_project() for loading from disk
// File handles are automatically managed - acquired on load, released during saves, reacquired after
