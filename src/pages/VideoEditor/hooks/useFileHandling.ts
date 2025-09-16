import { useState, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioPeaks, readFileChunk, getFileSize, generateThumbnails } from "../../../lib/ffmpeg";
import { useProjectFile } from "./useProjectFileManager";
import type { Clip } from "../../../lib/projectFile";

// Type for the preview data returned by generateThumbnailPreview
export interface ClipPreviewData {
  previewUrl: string;
  peaks: number[];
  thumbnailUrl?: string;
  filmstripThumbnails: string[];
}


export function useFileHandling() {
  const projectManager = useProjectFile();

  // Cache for preview data to prevent duplicate calls
  const previewCacheRef = useRef<Map<string, Promise<ClipPreviewData>>>(new Map());
  const completedPreviewsRef = useRef<Set<string>>(new Set());

  const videoFileTypes = ["mp4", "mov", "mkv", "avi", "webm"];
  const audioFileTypes = ["mp3", "wav", "aac", "m4a", "flac"];
  const imageFileTypes = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];

  const filters = [
    { name: "Video Files", extensions: videoFileTypes },
    { name: "Audio Files", extensions: audioFileTypes },
    { name: "Image Files", extensions: imageFileTypes },
  ];

  const identifyFileType = (filePath: string): "Video" | "Audio" | "Image" => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!ext) throw new Error("File has no extension");
    if (videoFileTypes.includes(ext)) return "Video";
    if (audioFileTypes.includes(ext)) return "Audio";
    if (imageFileTypes.includes(ext)) return "Image";
    throw new Error(`Unknown file type for extension: ${ext}`);
  };

  const [debug, setDebug] = useState<string>("");

  const log = (m: string) => setDebug(d => (d ? d + "\n" : "") + m);

  // Function to create blob URL from file chunks
  const createBlobFromFile = async (filePath: string) : Promise<string> => {
    try {
      log(`Creating blob from file chunks...`);
      const fileSize = await getFileSize(filePath);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      log(`File size: ${fileSizeMB} MB`);
      
      // Read file in chunks to avoid memory issues
      const chunkSize = 2 * 1024 * 1024; // 2MB chunks for better performance
      const chunks: Uint8Array[] = [];
      
      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const currentChunkSize = Math.min(chunkSize, fileSize - offset);
        const chunk = await readFileChunk(filePath, offset, currentChunkSize);
        // Convert the chunk to Uint8Array properly
        const uint8Chunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : new Uint8Array(chunk as number[]);
        chunks.push(uint8Chunk);
        
        // Show progress every 20MB
        if (offset % (chunkSize * 10) === 0) {
          const progress = ((offset / fileSize) * 100).toFixed(1);
          log(`Progress: ${progress}% (${(offset / (1024 * 1024)).toFixed(1)} MB / ${fileSizeMB} MB)`);
        }
      }
      
      log(`All chunks read, creating blob...`);
      // Combine all chunks into a single blob
      const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      log(`✅ Blob URL created successfully: ${blobUrl}`);
      return blobUrl;
    } catch (e: any) {
      log(`❌ Blob creation failed: ${e?.toString?.() || e}`);
      throw e;
    }
  };

  // Function to add multiple media files
  const pickMultipleFiles = async () => {
    console.log("pickMultipleFiles called - opening dialog...");
    log("Opening file dialog...");
    
    // First, let's test if the open function is available
    if (typeof open !== 'function') {
      throw new Error("open function is not available - dialog plugin may not be loaded");
    }
    
    // Try different dialog configurations
    console.log("Attempting to open file dialog...");
    
    // Try multiple file selection directly
    let selected;
    console.log("Trying multiple file selection...");
    try {
      selected = await open({ 
        multiple: true,
        title: "Select Media Files (Hold Cmd/Ctrl to select multiple)",
        filters
      });
      console.log("Multiple file result:", selected);
    } catch (e) {
      console.log("Multiple file selection failed, trying single file:", e);
      // Fallback to single file selection
      selected = await open({ 
        multiple: false,
        title: "Select a Media File",
        filters
      });
      console.log("Single file fallback result:", selected);
    }
    
    console.log("Dialog result:", selected);
    console.log("Dialog result type:", typeof selected);
    log(`Dialog result: ${JSON.stringify(selected)}`);
    
    if (!selected) {
      log("No files selected or dialog cancelled");
      console.log("No files selected or dialog cancelled");
      return;
    }

    // Handle both single file (string) and multiple files (array)
    let filePaths: string[];
    if (typeof selected === 'string') {
      filePaths = [selected];
      log(`Selected 1 file: ${selected}`);
      console.log("Dialog returned single file (string):", selected);

    } else if (Array.isArray(selected)) {
      filePaths = selected;
      log(`Selected ${selected.length} files`);
      console.log("Dialog returned multiple files (array):", selected);

    } else {
      log("Invalid dialog result format");
      console.log("Invalid dialog result format:", selected);
      return;
    }

    for (const filePath of filePaths) {
      try {
        // Add to clips
        if (projectManager.getClips().some(c => c.path === filePath)) {
          log(`File already added, skipping: ${filePath}`);
          console.log("File already added, skipping:", filePath);
          continue;
        }
        
        log(`Creating clip from path: ${filePath}`);
        await projectManager.createClipFromPath(filePath, identifyFileType(filePath));
        log(`Successfully created clip for: ${filePath}`);
      } catch (error) {
        console.error(`Failed to create clip for ${filePath}:`, error);
        log(`Failed to create clip for ${filePath}: ${error}`);
      }
    }

    return selected;
  };  

  // Function to generate useful data for previewing a clip (with caching)
  const generateThumbnailPreview = useCallback(async (clip: Clip): Promise<ClipPreviewData> => {
    console.log("generateThumbnailPreview called for clip:", clip.path);
    
    // Check if we already have this clip cached or in progress
    if (previewCacheRef.current.has(clip.id)) {
      console.log("Returning cached/in-progress preview for:", clip.path);
      return previewCacheRef.current.get(clip.id)!;
    }

    // Check if we already completed this clip
    if (completedPreviewsRef.current.has(clip.id)) {
      console.log("Clip already processed, skipping:", clip.path);
      // Return a simple cached result
      return {
        previewUrl: convertFileSrc(clip.path),
        peaks: [],
        thumbnailUrl: undefined,
        filmstripThumbnails: [],
      };
    }

    console.log("Starting NEW preview generation for:", clip.path);
    
    // Create the promise for this preview generation
    const previewPromise = (async (): Promise<ClipPreviewData> => {
      try {
        // Validate clip
        if (!clip || !clip.path) {
          log(`Invalid clip provided to generateThumbnailPreview`);
          return {
            previewUrl: "",
            peaks: [],
            thumbnailUrl: undefined,
            filmstripThumbnails: [],
          };
        }

        log(`Starting preview generation for clip: ${clip.path}`);

        // Create preview URL - use Tauri's convertFileSrc for better performance
        let previewUrl: string;
        try {
          // For now, use Tauri's file protocol which is more efficient than blob URLs
          previewUrl = convertFileSrc(clip.path);
          log(`Using Tauri file protocol for ${clip.path}`);
        } catch (e: any) {
          log(`File protocol failed for ${clip.path}: ${e?.toString?.() || e}`);
          previewUrl = clip.path; // Fallback to direct path
        }

        // Get audio peaks
        let peaks: number[] = [];
        if (clip.type === "Audio" || clip.type === "Video") {
          log(`Getting audio peaks for: ${clip.path}`);
          try {
            const audioPeaksData = await audioPeaks(clip.path);
            peaks = audioPeaksData.map(v => Math.max(0, Math.min(32767, v)));
            log(`Audio peaks for ${clip.path}: ${peaks.length} samples`);
          } catch (e: any) {
            log(`Audio peaks failed for ${clip.path}: ${e?.toString?.() || e}`);
          }
        }

        // Helper function to convert base64 to blob URL
        const base64ToBlob = (base64Data: string): string => {
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/png' });
          return URL.createObjectURL(blob);
        };

        // Generate thumbnails for video and image clips
        let thumbnailUrl: string | undefined;
        let filmstripThumbnails: string[] = [];
        
        if (clip.type === "Video") {
          try {
            // Generate single thumbnail for preview
            log(`Generating preview thumbnail for ${clip.path}`);
            const singleThumbnails = await generateThumbnails(clip.path, 1, 160);
            if (singleThumbnails.length > 0) {
              thumbnailUrl = base64ToBlob(singleThumbnails[0]);
              log(`Generated preview thumbnail for ${clip.path}`);
            }

            // Generate filmstrip thumbnails based on duration
            const duration = clip.latest_probe?.duration || 10; // Default to 10s if no probe data
            const thumbnailCount = Math.max(5, Math.min(50, Math.floor(duration / 2)));
            log(`Generating ${thumbnailCount} filmstrip thumbnails based on ${duration}s duration`);

            const rawFilmstripThumbnails = await generateThumbnails(clip.path, thumbnailCount, 80);
            log(`Raw filmstrip thumbnails received: ${rawFilmstripThumbnails.length}`);

            filmstripThumbnails = rawFilmstripThumbnails
              .map((base64Data, index) => {
                try {
                  const blobUrl = base64ToBlob(base64Data);
                  log(`Created filmstrip thumbnail ${index + 1}/${rawFilmstripThumbnails.length}`);
                  return blobUrl;
                } catch (e) {
                  log(`Error creating filmstrip thumbnail ${index}: ${e}`);
                  return '';
                }
              })
              .filter(url => url !== ''); // Remove failed thumbnails

            log(`Generated ${filmstripThumbnails.length} filmstrip thumbnails for ${clip.path}`);
          } catch (thumbError) {
            log(`Thumbnail generation failed for ${clip.path}: ${thumbError}`);
          }
        } else if (clip.type === "Image") {
          try {
            // For image files, use the image itself as the thumbnail
            log(`Using image file as thumbnail for ${clip.path}`);
            thumbnailUrl = previewUrl; // Use the same URL as preview
            log(`Set thumbnail URL for image: ${clip.path}`);
          } catch (imageError) {
            log(`Failed to set thumbnail for image ${clip.path}: ${imageError}`);
          }
        }

        // Return the preview data
        const previewData = {
          previewUrl,
          peaks,
          thumbnailUrl,
          filmstripThumbnails,
        };

        log(`Generated preview data for ${clip.path}: ${JSON.stringify({
          previewUrl: previewData.previewUrl ? "✓" : "✗",
          peaks: previewData.peaks.length,
          thumbnailUrl: previewData.thumbnailUrl ? "✓" : "✗",
          filmstripCount: previewData.filmstripThumbnails.length,
        })}`);

        // Mark as completed
        completedPreviewsRef.current.add(clip.id);
        console.log("Completed preview generation for:", clip.path);

        return previewData;

      } catch (error) {
        log(`Failed to generate preview data for ${clip.path}: ${error}`);
        console.error("Preview generation error:", error);
        
        // Mark as completed even on error to prevent retries
        completedPreviewsRef.current.add(clip.id);
        
        // Return minimal fallback data
        return {
          previewUrl: clip.path,
          peaks: [],
          thumbnailUrl: undefined,
          filmstripThumbnails: [],
        };
      } finally {
        // Remove from cache when done (successful or failed)
        previewCacheRef.current.delete(clip.id);
      }
    })();

    // Store the promise in cache
    previewCacheRef.current.set(clip.id, previewPromise);
    
    return previewPromise;
  }, [log]);

  // Function to remove a media file
  const removeMediaFile = (_mediaId: string) => {
    // TODO: Implement media file removal
  };

  return {
    debug,
    log,
    createBlobFromFile,
    pickMultipleFiles,
    generateThumbnailPreview,
    removeMediaFile,
  };
}
