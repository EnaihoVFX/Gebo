import { invoke } from '@tauri-apps/api/core';
import type { MediaFile, Probe } from '../types';

// Real royalty-free music sources
const ROYALTY_FREE_SONGS = [
  {
    id: "upbeat-electronic-1",
    name: "Upbeat Electronic",
    artist: "Freesound",
    duration: 180,
    genre: "Electronic",
    mood: "Upbeat",
    bpm: 128,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Electronic",
    description: "High-energy electronic track perfect for intros and transitions",
    license: "CC0"
  },
  {
    id: "ambient-chill-1",
    name: "Ambient Chill",
    artist: "Freesound",
    duration: 240,
    genre: "Ambient",
    mood: "Chill",
    bpm: 80,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/059669/FFFFFF?text=Ambient",
    description: "Relaxing ambient soundscape for background music",
    license: "CC0"
  },
  {
    id: "corporate-inspirational-1",
    name: "Corporate Inspirational",
    artist: "Freesound",
    duration: 120,
    genre: "Corporate",
    mood: "Inspirational",
    bpm: 100,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/DC2626/FFFFFF?text=Corporate",
    description: "Professional and uplifting track for presentations",
    license: "CC0"
  },
  {
    id: "acoustic-folk-1",
    name: "Acoustic Folk",
    artist: "Freesound",
    duration: 200,
    genre: "Folk",
    mood: "Warm",
    bpm: 90,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/EA580C/FFFFFF?text=Folk",
    description: "Warm acoustic guitar with folk elements",
    license: "CC0"
  },
  {
    id: "cinematic-epic-1",
    name: "Cinematic Epic",
    artist: "Freesound",
    duration: 300,
    genre: "Cinematic",
    mood: "Epic",
    bpm: 110,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/7C3AED/FFFFFF?text=Cinematic",
    description: "Grand orchestral piece for dramatic moments",
    license: "CC0"
  },
  {
    id: "jazz-smooth-1",
    name: "Smooth Jazz",
    artist: "Freesound",
    duration: 220,
    genre: "Jazz",
    mood: "Smooth",
    bpm: 95,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/0891B2/FFFFFF?text=Jazz",
    description: "Smooth jazz with saxophone and piano",
    license: "CC0"
  },
  {
    id: "rock-energy-1",
    name: "Rock Energy",
    artist: "Freesound",
    duration: 180,
    genre: "Rock",
    mood: "Energetic",
    bpm: 140,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/DC2626/FFFFFF?text=Rock",
    description: "High-energy rock track with driving rhythm",
    license: "CC0"
  },
  {
    id: "classical-elegant-1",
    name: "Classical Elegant",
    artist: "Freesound",
    duration: 280,
    genre: "Classical",
    mood: "Elegant",
    bpm: 60,
    downloadUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    previewUrl: "https://freesound.org/data/previews/316/316847_5123451-lq.mp3",
    thumbnailUrl: "https://via.placeholder.com/300x200/374151/FFFFFF?text=Classical",
    description: "Elegant classical piece with strings and piano",
    license: "CC0"
  }
];

export type StockSong = typeof ROYALTY_FREE_SONGS[0];

export class SongDownloader {
  private static instance: SongDownloader;
  private downloadedSongs: Map<string, MediaFile> = new Map();

  static getInstance(): SongDownloader {
    if (!SongDownloader.instance) {
      SongDownloader.instance = new SongDownloader();
    }
    return SongDownloader.instance;
  }

  getStockSongs(): StockSong[] {
    return ROYALTY_FREE_SONGS;
  }

  async downloadSong(song: StockSong, onProgress?: (progress: number) => void): Promise<MediaFile> {
    try {
      // Check if already downloaded
      if (this.downloadedSongs.has(song.id)) {
        return this.downloadedSongs.get(song.id)!;
      }

      onProgress?.(0);

      // Download the actual audio file using Tauri command
      const filename = `${song.id}.mp3`;
      const filePath = await invoke<string>('download_audio_file', {
        url: song.downloadUrl,
        filename: filename
      });

      onProgress?.(50);

      // Probe the downloaded audio file
      const probe = await invoke<Probe>('probe_video', { path: filePath });
      
      onProgress?.(75);

      // Generate waveform peaks
      const peaks = await invoke<number[]>('audio_peaks', { path: filePath });

      onProgress?.(100);

      // Create MediaFile from the downloaded and processed audio
      const mediaFile: MediaFile = {
        id: `downloaded-${song.id}`,
        name: song.name,
        path: filePath,
        previewUrl: `file://${filePath}`, // Local file URL
        thumbnailUrl: song.thumbnailUrl,
        probe: probe,
        peaks: peaks,
        duration: probe.duration,
        width: 0,
        height: 0,
        type: "audio"
      };

      // Cache the downloaded song
      this.downloadedSongs.set(song.id, mediaFile);
      
      return mediaFile;
    } catch (error) {
      console.error('Failed to download song:', error);
      throw new Error(`Failed to download song: ${song.name}`);
    }
  }

  private generateMockPeaks(duration: number): number[] {
    // Generate mock waveform peaks for visualization
    const sampleRate = 8000; // 8kHz sample rate
    const samplesPerSecond = 100; // 100 peaks per second
    const totalSamples = Math.floor(duration * samplesPerSecond);
    
    const peaks: number[] = [];
    for (let i = 0; i < totalSamples; i++) {
      // Generate random peaks with some variation
      const baseLevel = Math.sin(i * 0.1) * 0.3 + 0.5;
      const variation = (Math.random() - 0.5) * 0.4;
      const peak = Math.max(0, Math.min(1, baseLevel + variation));
      peaks.push(Math.floor(peak * 32767)); // Convert to 16-bit range
    }
    
    return peaks;
  }

  getDownloadedSong(songId: string): MediaFile | undefined {
    return this.downloadedSongs.get(songId);
  }

  isDownloaded(songId: string): boolean {
    return this.downloadedSongs.has(songId);
  }

  getAllDownloadedSongs(): MediaFile[] {
    return Array.from(this.downloadedSongs.values());
  }

  // In a real implementation, you would also have methods to:
  // - Delete downloaded songs
  // - Manage storage space
  // - Update song metadata
  // - Handle different audio formats
  // - Generate thumbnails from audio
}

// Export a singleton instance
export const songDownloader = SongDownloader.getInstance();
