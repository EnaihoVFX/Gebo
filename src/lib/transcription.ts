import { invoke } from '@tauri-apps/api/core';
import type { TranscriptSegment, TranscriptionResult } from '../types';

export interface TranscriptionOptions {
  apiKey?: string;
  useMock?: boolean;
}

export class TranscriptionService {
  private static instance: TranscriptionService;

  static getInstance(): TranscriptionService {
    if (!TranscriptionService.instance) {
      TranscriptionService.instance = new TranscriptionService();
    }
    return TranscriptionService.instance;
  }

  /**
   * Transcribe a media file
   */
  async transcribeMediaFile(
    filePath: string, 
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      console.log('Starting transcription for:', filePath);
      
      // Get API key from storage if not provided
      let apiKey = options.apiKey;
      if (!apiKey) {
        try {
          apiKey = await invoke<string>('get_gemini_api_key');
        } catch (error) {
          console.warn('Could not get API key from storage:', error);
        }
      }
      
      const result = await invoke<TranscriptionResult>('transcribe_media_file', {
        filePath,
        apiKey,
        useMock: options.useMock ?? false // Default to real API calls
      });

      console.log('Transcription completed:', result);
      return result;
    } catch (error) {
      console.error('Transcription failed:', error);
      throw new Error(`Transcription failed: ${error}`);
    }
  }

  /**
   * Check if a file needs transcription
   */
  shouldTranscribe(filePath: string, type: 'video' | 'audio'): boolean {
    // Only transcribe video and audio files
    return type === 'video' || type === 'audio';
  }

  /**
   * Extract text content from transcript segments
   */
  extractTextFromTranscript(segments: TranscriptSegment[]): string {
    return segments.map(segment => segment.text).join(' ');
  }

  /**
   * Find transcript segments within a time range
   */
  findSegmentsInRange(
    segments: TranscriptSegment[], 
    startTime: number, 
    endTime: number
  ): TranscriptSegment[] {
    return segments.filter(segment => 
      segment.start >= startTime && segment.end <= endTime
    );
  }

  /**
   * Get transcript text for a specific time range
   */
  getTextInTimeRange(
    segments: TranscriptSegment[], 
    startTime: number, 
    endTime: number
  ): string {
    const relevantSegments = this.findSegmentsInRange(segments, startTime, endTime);
    return this.extractTextFromTranscript(relevantSegments);
  }

  /**
   * Search for text within transcript
   */
  searchTranscript(
    segments: TranscriptSegment[], 
    searchText: string
  ): { segment: TranscriptSegment; matchStart: number; matchEnd: number }[] {
    const results: { segment: TranscriptSegment; matchStart: number; matchEnd: number }[] = [];
    const lowerSearchText = searchText.toLowerCase();

    for (const segment of segments) {
      const lowerText = segment.text.toLowerCase();
      const index = lowerText.indexOf(lowerSearchText);
      
      if (index !== -1) {
        results.push({
          segment,
          matchStart: index,
          matchEnd: index + searchText.length
        });
      }
    }

    return results;
  }
}

// Export singleton instance
export const transcriptionService = TranscriptionService.getInstance();
