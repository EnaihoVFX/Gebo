use anyhow::{anyhow, Context, Result};
use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
extern crate dirs;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct LTSFile {
    pub recent_projects: Vec<String>
}

impl LTSFile {
    pub fn get_path() -> Result<PathBuf> {
        let lts_dir = get_lts_directory()?;
        let lts_file_path = lts_dir.join("lts.json");
        Ok(lts_file_path)
    }

    pub fn get() -> Result<Self> {
        let lts_file_path = Self::get_path()?;

        // If the file doesn't exist, return an empty LTSFile
        if !lts_file_path.exists() {
            return Ok(LTSFile { recent_projects: Vec::new() });
        }

        let data = fs::read_to_string(&lts_file_path)
            .with_context(|| format!("Failed to read LTS file at {:?}", lts_file_path))?;
        
        let lts_file: LTSFile = serde_json::from_str(&data)
            .with_context(|| "Failed to parse LTS JSON data")?;
        
        Ok(lts_file)
    }

    pub fn save(&self) -> Result<()> {
        let lts_file_path = Self::get_path()?;
        let data = serde_json::to_string_pretty(self)
            .with_context(|| "Failed to serialize LTS data to JSON")?;
        
        fs::write(&lts_file_path, data)
            .with_context(|| format!("Failed to write LTS file at {:?}", lts_file_path))?;
        
        Ok(())
    }
}

pub fn get_lts_directory() -> Result<PathBuf> {
    // Get config dir (%appdata% on windows)
  let lts_dir = dirs::config_dir()
    .ok_or_else(|| anyhow!("Could not find config directory"))?
    .join("gebo")
    .join("storage");

    // Create directory if it doesn't exist
    fs::create_dir_all(&lts_dir)
      .with_context(|| format!("Failed to create LTS directory at {:?}", lts_dir))?;

    // Return the LTS directory path
    Ok(lts_dir)
}

// Recent projects component of LTSFile

pub fn add_recent_project(path: String) -> Result<()> {
    if !Path::new(&path).exists() {
        return Err(anyhow!("Project path does not exist: {}", path));
    }
    
    let mut lts_file = LTSFile::get()?;

    // Remove the project if it already exists to avoid duplicates
    lts_file.recent_projects.retain(|p| p != &path);

    // Add the new project to the front
    lts_file.recent_projects.insert(0, path);

    // Limit to 10 recent projects
    if lts_file.recent_projects.len() > 10 {
        lts_file.recent_projects.truncate(10);
    }

    // Save the updated LTS file
    lts_file.save()?;

    Ok(())
}

/// Fetches the list of recent projects from the LTS file. Verifies and removes invalid projects.
pub fn get_recent_projects() -> Result<Vec<String>> {
    let mut lts_file = LTSFile::get()?;
    let mut valid_projects = Vec::new();

    for project in &lts_file.recent_projects {
        if Path::new(project).exists() {
            valid_projects.push(project.clone());
        }
    }

    // If any invalid projects were found, update the LTS file
    if valid_projects.len() != lts_file.recent_projects.len() {
        lts_file.recent_projects = valid_projects.clone();
        lts_file.save()?;
    }

    Ok(valid_projects)
}