import { useCallback, useState, useEffect } from "react";
import { Music, Download, Play, Pause, Volume2, Clock, Search, Filter } from "lucide-react";
import type { MediaFile } from "../../../types";
import { songDownloader, type StockSong } from "../../../lib/songDownloader";

interface SongLibraryProps {
  onAddSong: (song: MediaFile) => void;
  onDragStart: (song: MediaFile, event: React.DragEvent) => void;
}

export function SongLibrary({ onAddSong, onDragStart }: SongLibraryProps) {
  const [songs, setSongs] = useState<StockSong[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("all");
  const [selectedMood, setSelectedMood] = useState<string>("all");
  const [downloadingSongs, setDownloadingSongs] = useState<Set<string>>(new Set());
  const [downloadedSongs, setDownloadedSongs] = useState<Set<string>>(new Set());
  const [playingSong, setPlayingSong] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());

  // Load songs on component mount
  useEffect(() => {
    const stockSongs = songDownloader.getStockSongs();
    setSongs(stockSongs);
    
    // Check which songs are already downloaded
    const downloaded = new Set<string>();
    stockSongs.forEach(song => {
      if (songDownloader.isDownloaded(song.id)) {
        downloaded.add(song.id);
      }
    });
    setDownloadedSongs(downloaded);
  }, []);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      audioElements.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
      });
    };
  }, [audioElements]);

  // Get unique genres and moods for filters
  const genres = ["all", ...Array.from(new Set(songs.map(song => song.genre)))];
  const moods = ["all", ...Array.from(new Set(songs.map(song => song.mood)))];

  // Filter songs based on search and filters
  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         song.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === "all" || song.genre === selectedGenre;
    const matchesMood = selectedMood === "all" || song.mood === selectedMood;
    
    return matchesSearch && matchesGenre && matchesMood;
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadSong = useCallback(async (song: StockSong) => {
    setDownloadingSongs(prev => new Set(prev).add(song.id));
    setDownloadProgress(prev => new Map(prev).set(song.id, 0));
    
    try {
      const mediaFile = await songDownloader.downloadSong(song, (progress) => {
        setDownloadProgress(prev => new Map(prev).set(song.id, progress));
      });

      setDownloadedSongs(prev => new Set(prev).add(song.id));
      onAddSong(mediaFile);
      
    } catch (error) {
      console.error("Failed to download song:", error);
    } finally {
      setDownloadingSongs(prev => {
        const newSet = new Set(prev);
        newSet.delete(song.id);
        return newSet;
      });
      setDownloadProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(song.id);
        return newMap;
      });
    }
  }, [onAddSong]);

  const togglePlay = useCallback((song: StockSong) => {
    if (playingSong === song.id) {
      // Stop current song
      const audio = audioElements.get(song.id);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      setPlayingSong(null);
    } else {
      // Stop any currently playing song
      if (playingSong) {
        const currentAudio = audioElements.get(playingSong);
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      // Create and play audio element for preview
      const audio = new Audio(song.previewUrl);
      audio.volume = 0.7; // Set volume to 70%
      audio.loop = false;
      
      // Set up event listeners
      audio.addEventListener('ended', () => {
        setPlayingSong(null);
        audioElements.delete(song.id);
      });
      
      audio.addEventListener('error', (e) => {
        console.error('Error playing audio preview:', e);
        setPlayingSong(null);
        audioElements.delete(song.id);
      });

      // Store audio element and start playing
      setAudioElements(prev => new Map(prev).set(song.id, audio));
      setPlayingSong(song.id);
      
      audio.play().catch(error => {
        console.error('Failed to play audio preview:', error);
        setPlayingSong(null);
        audioElements.delete(song.id);
      });
    }
  }, [playingSong, audioElements]);

  const handleDragStart = useCallback((song: StockSong, event: React.DragEvent) => {
    // Only allow dragging if song is downloaded
    if (!downloadedSongs.has(song.id)) {
      event.preventDefault();
      return;
    }

    // Get the downloaded MediaFile
    const mediaFile = songDownloader.getDownloadedSong(song.id);
    if (!mediaFile) {
      event.preventDefault();
      return;
    }

    onDragStart(mediaFile, event);
    
    // Set drag data
    const dragData = {
      type: "media-file",
      mediaFile
    };
    
    try {
      event.dataTransfer.setData("application/json", JSON.stringify(dragData));
      event.dataTransfer.effectAllowed = "copy";
      
      // Broadcast custom drag start for global indicator
      const customEvent = new CustomEvent('customDragStart', { detail: dragData });
      document.dispatchEvent(customEvent);
    } catch (error) {
      console.error("Error setting drag data:", error);
    }

    // Defer custom start; indicator will show on first dragover/move
  }, [downloadedSongs, onDragStart]);

  // While native drag is active, forward cursor moves for overlay positioning
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types || []);
      if (types.includes('application/json')) {
        let detail: any = null;
        try {
          detail = JSON.parse(e.dataTransfer!.getData('application/json'));
        } catch {}
        const evt = new CustomEvent('customDragMove', { detail: { ...detail, clientX: e.clientX, clientY: e.clientY } });
        document.dispatchEvent(evt);
      }
    };
    const onDragEnd = () => {
      const evt = new CustomEvent('customDragEnd');
      document.dispatchEvent(evt);
    };
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('dragend', onDragEnd, true);
    return () => {
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('dragend', onDragEnd, true);
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header with search and filters */}
      <div className="p-3 border-b border-slate-700 bg-slate-800 flex-shrink-0">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {genres.map(genre => (
                <option key={genre} value={genre}>
                  {genre === "all" ? "All Genres" : genre}
                </option>
              ))}
            </select>
            
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {moods.map(mood => (
                <option key={mood} value={mood}>
                  {mood === "all" ? "All Moods" : mood}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Songs Grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Music className="w-12 h-12 text-slate-400 mb-3" />
            <p className="text-sm text-slate-400">No songs found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredSongs.map((song) => {
              const isDownloading = downloadingSongs.has(song.id);
              const isDownloaded = downloadedSongs.has(song.id);
              const isPlaying = playingSong === song.id;

              return (
                <div
                  key={song.id}
                  className={`group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-colors ${
                    isDownloaded ? 'cursor-grab hover:border-slate-600' : 'cursor-default'
                  }`}
                  draggable={isDownloaded}
                  onDragStart={(e) => handleDragStart(song, e)}
                >
                  <div className="flex">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 flex-shrink-0">
                      <img
                        src={song.thumbnailUrl}
                        alt={song.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Song Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-white truncate">
                            {song.name}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            {song.artist}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {song.description}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-3">
                          {/* Play/Pause Preview */}
                          <button
                            onClick={() => togglePlay(song)}
                            className="w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors"
                            title={isPlaying ? "Stop Preview" : "Play Preview"}
                          >
                            {isPlaying ? (
                              <Pause className="w-4 h-4 text-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white" />
                            )}
                          </button>

                          {/* Download/Downloaded Button */}
                          {isDownloading ? (
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center relative">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-slate-400">
                                {downloadProgress.get(song.id) || 0}%
                              </div>
                            </div>
                          ) : isDownloaded ? (
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                              <Volume2 className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <button
                              onClick={() => downloadSong(song)}
                              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center transition-colors"
                              title="Download Song"
                            >
                              <Download className="w-4 h-4 text-white" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Song Metadata */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(song.duration)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {song.genre}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-slate-500 rounded-full" />
                          {song.mood}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-slate-500 rounded-full" />
                          {song.bpm} BPM
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded">
                            {song.license}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drag indicator for downloaded songs */}
                  {isDownloaded && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-slate-600 text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-700 bg-slate-800 flex-shrink-0">
        <div className="text-xs text-slate-400">
          {downloadedSongs.size} of {songs.length} songs downloaded
        </div>
      </div>
    </div>
  );
}
