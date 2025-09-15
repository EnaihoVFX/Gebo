import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { audioPeaks, makePreviewProxy, probeVideo, readFileAsBase64, copyToAppData, readFileChunk, getFileSize, generateThumbnails, type Probe } from "../../../lib/ffmpeg";
import type { MediaFile } from "../../../types";

export function useFileHandling() {
  const [filePath, setFilePath] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [debug, setDebug] = useState<string>("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);

  const log = (m: string) => setDebug(d => (d ? d + "\n" : "") + m);

  // Function to create blob URL from file chunks
  const createBlobFromFile = async (filePath: string) => {
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
        chunks.push(new Uint8Array(chunk));
        
        // Show progress every 20MB
        if (offset % (chunkSize * 10) === 0) {
          const progress = ((offset / fileSize) * 100).toFixed(1);
          log(`Progress: ${progress}% (${(offset / (1024 * 1024)).toFixed(1)} MB / ${fileSizeMB} MB)`);
        }
      }
      
      log(`All chunks read, creating blob...`);
      // Combine all chunks into a single blob
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      log(`✅ Blob URL created successfully: ${blobUrl}`);
      return blobUrl;
    } catch (e: any) {
      log(`❌ Blob creation failed: ${e?.toString?.() || e}`);
      throw e;
    }
  };

  const pickFile = async () => {
    try {
      const sel = await open({ multiple: false, filters: [{ name: "Video", extensions: ["mp4", "MP4", "mov", "MOV", "mkv", "MKV"] }] });
      if (typeof sel !== "string") return;

      setDebug("");
      setFilePath(sel);

      log(`Selected file: ${sel}`);

      // Use chunked blob method for reliable video loading
      try {
        log(`Creating blob URL for reliable playback...`);
        const blobUrl = await createBlobFromFile(sel);
        setPreviewUrl(blobUrl);
        log(`Using blob URL: ${blobUrl}`);
      } catch (e: any) {
        log(`Blob creation failed, falling back to asset protocol: ${e?.toString?.() || e}`);
        // Fallback to original method
        const originalUrl = convertFileSrc(sel);
        setPreviewUrl(originalUrl);
        log(`Fallback URL: ${originalUrl}`);
      }

      // Probe + peaks
      try {
        log(`Starting probe for: ${sel}`);
        const p = await probeVideo(sel);
        setProbe(p);
        log(`Probed: dur=${p.duration.toFixed(2)}s fps=${p.fps.toFixed(2)} rate=${p.audio_rate} codec=${p.v_codec}/${p.a_codec}`);
      } catch (e: any) {
        log(`Probe failed: ${e?.toString?.() || e}`);
        log(`Error details: ${JSON.stringify(e)}`);
        return;
      }

      try {
        log(`Starting audio peaks for: ${sel}`);
        const pk = await audioPeaks(sel);
        setPeaks(pk.map(v => Math.max(0, Math.min(32767, v))));
        log(`Peaks: ${pk.length}`);
      } catch (e: any) {
        log(`Audio peaks failed: ${e?.toString?.() || e}`);
        log(`Peaks error details: ${JSON.stringify(e)}`);
        setPeaks([]);
      }

      // Proactively proxy for MOV/MKV for reliable playback
      if (/\.(mkv|mov|MKV|MOV)$/i.test(sel)) {
        try {
          log(`Creating preview proxy for: ${sel}`);
          const prox = await makePreviewProxy(sel);
          log(`Proxy created, creating blob URL for proxy...`);
          const proxyBlobUrl = await createBlobFromFile(prox);
          setPreviewUrl(proxyBlobUrl);
          log(`Using preview proxy blob URL (H.264/AAC): ${proxyBlobUrl}`);
        } catch (e: any) {
          log("Proxy failed, continuing with original. " + (e?.toString?.() || e));
          log(`Proxy error details: ${JSON.stringify(e)}`);
        }
      }

      return sel;
    } catch (e: any) {
      log(`File picker failed: ${e?.toString?.() || e}`);
    }
  };

  const resetApp = () => {
    setPreviewUrl("");
    setFilePath("");
    setProbe(null);
    setPeaks([]);
    setDebug("");
    setMediaFiles([]);
    log("App reset - cleared all data");
  };

  // Function to add multiple media files
  const pickMultipleFiles = async () => {
    try {
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
          filters: [
            { 
              name: "Video Files", 
              extensions: ["mp4", "mov", "mkv", "avi", "webm"] 
            },
            { 
              name: "Audio Files", 
              extensions: ["mp3", "wav", "aac", "m4a", "flac"] 
            },
            { 
              name: "All Files", 
              extensions: ["*"] 
            }
          ]
        });
        console.log("Multiple file result:", selected);
      } catch (e) {
        console.log("Multiple file selection failed, trying single file:", e);
        // Fallback to single file selection
        selected = await open({ 
          multiple: false,
          title: "Select a Media File",
          filters: [
            { 
              name: "Video Files", 
              extensions: ["mp4", "mov", "mkv", "avi", "webm"] 
            },
            { 
              name: "Audio Files", 
              extensions: ["mp3", "wav", "aac", "m4a", "flac"] 
            },
            { 
              name: "All Files", 
              extensions: ["*"] 
            }
          ]
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
        await addMediaFile(filePath);
      }

      return selected;
    } catch (e: any) {
      console.error("pickMultipleFiles error:", e);
      log(`Multiple file picker failed: ${e?.toString?.() || e}`);
      log(`Error details: ${JSON.stringify(e)}`);
      
      // Log error instead of alert
      console.log(`Error opening file dialog: ${e?.toString?.() || e}`);
      
      // Fallback: Try using HTML file input
      console.log("Attempting fallback with HTML file input...");
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/*,audio/*';
      
      input.onchange = async (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          console.log(`HTML file input selected ${files.length} files`);
          log(`HTML file input selected ${files.length} files`);
          
          // For now, just show the file names
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            console.log(`File ${i + 1}: ${file.name} (${file.size} bytes)`);
            log(`File ${i + 1}: ${file.name} (${file.size} bytes)`);
          }
        }
      };
      
      input.click();
    }
  };

  // Function to add a single media file to the collection
  const addMediaFile = async (filePath: string) => {
    try {
      console.log(`Adding media file: ${filePath}`);
      console.log(`File path type: ${typeof filePath}`);
      console.log(`File path length: ${filePath.length}`);
      log(`Adding media file: ${filePath}`);

      // Validate file path
      if (!filePath || filePath.trim() === '' || filePath === '/') {
        log(`Invalid file path: ${filePath}`);
        console.log(`Invalid file path: ${filePath}`);
        return;
      }

      // Check if file already exists
      const existingFile = mediaFiles.find(f => f.path === filePath);
      if (existingFile) {
        log(`File already exists: ${filePath}`);
        return existingFile;
      }

      // Create preview URL - use Tauri's convertFileSrc for better performance
      let previewUrl: string;
      try {
        // For now, use Tauri's file protocol which is more efficient than blob URLs
        previewUrl = convertFileSrc(filePath);
        log(`Using Tauri file protocol for ${filePath}`);
      } catch (e: any) {
        log(`File protocol failed for ${filePath}: ${e?.toString?.() || e}`);
        previewUrl = filePath; // Fallback to direct path
      }

      // Probe the file
      const probe = await probeVideo(filePath);
      log(`Probed ${filePath}: dur=${probe.duration.toFixed(2)}s fps=${probe.fps.toFixed(2)} rate=${probe.audio_rate}`);

      // Get audio peaks
      let peaks: number[] = [];
      try {
        const audioPeaksData = await audioPeaks(filePath);
        peaks = audioPeaksData.map(v => Math.max(0, Math.min(32767, v)));
        log(`Audio peaks for ${filePath}: ${peaks.length}`);
      } catch (e: any) {
        log(`Audio peaks failed for ${filePath}: ${e?.toString?.() || e}`);
      }

      // Generate thumbnails (single for preview, multiple for filmstrip)
      let thumbnailUrl: string | undefined;
      let thumbnails: string[] = [];
      try {
        if (probe.width > 0 && probe.height > 0) {
          // Generate single thumbnail for preview
          const singleThumbnails = await generateThumbnails(filePath, 1, 160);
          if (singleThumbnails.length > 0) {
            // Convert base64 to blob URL for preview
            const base64Data = singleThumbnails[0];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            thumbnailUrl = URL.createObjectURL(blob);
          }

          // Generate multiple thumbnails for filmstrip based on duration
          log(`Generating filmstrip thumbnails for ${filePath}...`);
          log(`File path: ${filePath}, Duration: ${probe.duration}s, Width: ${probe.width}, Height: ${probe.height}`);
          
          let filmstripThumbnails: string[] = [];
          try {
            // Generate thumbnails based on duration: 1 thumbnail per 2 seconds, minimum 5, maximum 50
            const thumbnailCount = Math.max(5, Math.min(50, Math.floor(probe.duration / 2)));
            log(`Generating ${thumbnailCount} thumbnails based on ${probe.duration}s duration`);
            
            filmstripThumbnails = await generateThumbnails(filePath, thumbnailCount, 80);
            log(`Raw filmstrip thumbnails received: ${filmstripThumbnails.length}`);
            log(`First thumbnail length: ${filmstripThumbnails[0]?.length || 0} characters`);
          } catch (thumbError) {
            log(`generateThumbnails function failed: ${thumbError}`);
            throw thumbError;
          }
          
          thumbnails = filmstripThumbnails.map((base64Data, index) => {
            try {
              const byteCharacters = atob(base64Data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'image/png' });
              const blobUrl = URL.createObjectURL(blob);
              log(`Created blob URL for thumbnail ${index}: ${blobUrl}`);
              return blobUrl;
            } catch (e) {
              log(`Error creating blob URL for thumbnail ${index}: ${e}`);
              return '';
            }
          });
          log(`Generated ${thumbnails.length} filmstrip thumbnails for ${filePath}`);
        }
      } catch (e: any) {
        log(`Thumbnail generation failed for ${filePath}: ${e?.toString?.() || e}`);
        log(`Thumbnail error details: ${JSON.stringify(e)}`);
        // Set empty thumbnails array so we fall back to single thumbnail
        thumbnails = [];
      }

      // Determine file type and handle audio files properly
      const isVideo = probe.width > 0 && probe.height > 0;
      const fileType: "video" | "audio" = isVideo ? "video" : "audio";
      
      // For audio files, set width/height to 0
      const finalWidth = isVideo ? probe.width : 0;
      const finalHeight = isVideo ? probe.height : 0;

      // Create media file object
      const mediaFile: MediaFile = {
        id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: filePath.split('/').pop() || filePath,
        path: filePath,
        previewUrl,
        thumbnailUrl,
        thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
        probe,
        peaks,
        duration: probe.duration,
        width: finalWidth,
        height: finalHeight,
        type: fileType
      };

      // Add to media files
      setMediaFiles(prev => [...prev, mediaFile]);
      log(`✅ Added media file: ${mediaFile.name}`);

      return mediaFile;
    } catch (e: any) {
      log(`❌ Failed to add media file ${filePath}: ${e?.toString?.() || e}`);
      throw e;
    }
  };

  // Function to remove a media file
  const removeMediaFile = (mediaId: string) => {
    setMediaFiles(prev => {
      const fileToRemove = prev.find(f => f.id === mediaId);
      if (fileToRemove) {
        // Revoke blob URL to free memory
        if (fileToRemove.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(fileToRemove.previewUrl);
        }
        if (fileToRemove.thumbnailUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(fileToRemove.thumbnailUrl);
        }
        log(`Removed media file: ${fileToRemove.name}`);
        return prev.filter(f => f.id !== mediaId);
      }
      return prev;
    });
  };

  return {
    filePath,
    previewUrl,
    probe,
    peaks,
    debug,
    log,
    setPreviewUrl,
    createBlobFromFile,
    pickFile,
    resetApp,
    mediaFiles,
    pickMultipleFiles,
    addMediaFile,
    removeMediaFile,
  };
}
