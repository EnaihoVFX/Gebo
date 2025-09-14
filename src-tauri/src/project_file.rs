use anyhow::{anyhow, Context, Result};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Represents a single 'clip' (audio/video/image file) used in the project
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Clip {
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

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectFile {
    pub title: String,
    pub clips: Vec<Clip>,
    // Add other fields here later, such as metadata, settings, 
    // and info about edits like segments and effects
    // and maybe cache probe info?
}

impl ProjectFile {
    pub fn verify(&self) -> bool {
        self.clips.is_empty() || self.clips.iter().all(|clip| clip.verify())
    }
}

pub fn open_project_path(path: &Path) -> Result<ProjectFile> {
    if !path.exists() || !path.is_file() {
        return Err(anyhow!("project file does not exist or is not a valid file"));
    }
    let content = fs::read_to_string(path).with_context(|| "failed to read project file")?;
    let project: ProjectFile = serde_json::from_str(&content).with_context(|| "invalid project file format")?;
    if !project.verify() {
        return Err(anyhow!("project file is invalid."));
    }
    Ok(project)
}

pub fn save_project_path(project: &ProjectFile, path: &Path) -> Result<()> {
    let content = serde_json::to_string_pretty(project).with_context(|| "failed to serialize project data")?;
    fs::write(path, content).with_context(|| "failed to write project file")?;
    Ok(())
}