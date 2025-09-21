import { invoke } from '@tauri-apps/api/core';
import type { VideoAnalysisResult, VideoKeyMoment, VisualElement, AudioAnalysis } from '../types';

export interface VideoAnalysisOptions {
  apiKey?: string;
  useMock?: boolean;
  duration?: number;
}

export class VideoAnalysisService {
  private static instance: VideoAnalysisService;

  static getInstance(): VideoAnalysisService {
    if (!VideoAnalysisService.instance) {
      VideoAnalysisService.instance = new VideoAnalysisService();
    }
    return VideoAnalysisService.instance;
  }

  /**
   * Analyze a video file using Gemini's multimodal capabilities
   */
  async analyzeVideoFile(
    filePath: string, 
    options: VideoAnalysisOptions = {}
  ): Promise<VideoAnalysisResult> {
    try {
      console.log('Starting video analysis for:', filePath);
      
      // Get API key from storage if not provided
      let apiKey = options.apiKey;
      if (!apiKey) {
        try {
          apiKey = await invoke<string>('get_gemini_api_key');
        } catch (error) {
          console.warn('Could not get API key from storage:', error);
        }
      }
      
      const result = await invoke<VideoAnalysisResult>('analyze_video_file', {
        filePath,
        apiKey,
        useMock: options.useMock ?? false, // Default to real API calls
        duration: options.duration
      });

      console.log('Video analysis completed:', result);
      return result;
    } catch (error) {
      console.error('Video analysis failed:', error);
      throw new Error(`Video analysis failed: ${error}`);
    }
  }

  /**
   * Check if a file should be analyzed
   */
  shouldAnalyze(filePath: string, type: 'video' | 'audio'): boolean {
    // Only analyze video files for now (audio can use transcription)
    return type === 'video';
  }

  /**
   * Extract key moments within a time range
   */
  findKeyMomentsInRange(
    keyMoments: VideoKeyMoment[], 
    startTime: number, 
    endTime: number
  ): VideoKeyMoment[] {
    return keyMoments.filter(moment => 
      moment.start >= startTime && moment.end <= endTime
    );
  }

  /**
   * Get the most important key moments
   */
  getMostImportantMoments(
    keyMoments: VideoKeyMoment[], 
    limit: number = 5
  ): VideoKeyMoment[] {
    return keyMoments
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  /**
   * Find visual elements by type
   */
  findVisualElementsByType(
    visualElements: VisualElement[], 
    type: 'object' | 'person' | 'scene' | 'text' | 'graphic'
  ): VisualElement[] {
    return visualElements.filter(element => element.type === type);
  }

  /**
   * Get high-confidence visual elements
   */
  getHighConfidenceElements(
    visualElements: VisualElement[], 
    threshold: number = 0.8
  ): VisualElement[] {
    return visualElements.filter(element => element.confidence >= threshold);
  }

  /**
   * Analyze sentiment from video analysis
   */
  getSentimentSummary(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return 'The video has a positive tone and content';
      case 'negative':
        return 'The video has a negative tone and content';
      case 'mixed':
        return 'The video has mixed positive and negative elements';
      default:
        return 'The video has a neutral tone and content';
    }
  }

  /**
   * Get audio analysis summary
   */
  getAudioSummary(audioAnalysis?: AudioAnalysis): string {
    if (!audioAnalysis) return 'No audio analysis available';

    const parts: string[] = [];
    
    if (audioAnalysis.hasSpeech) {
      parts.push(`speech (clarity: ${(audioAnalysis.speechClarity * 100).toFixed(0)}%)`);
    }
    if (audioAnalysis.hasMusic) {
      parts.push('background music');
    }
    if (audioAnalysis.hasSoundEffects) {
      parts.push('sound effects');
    }
    
    const noiseLevel = audioAnalysis.backgroundNoise > 0.5 ? 'high' : 
                      audioAnalysis.backgroundNoise > 0.2 ? 'moderate' : 'low';
    
    return `Audio contains: ${parts.join(', ')}. Background noise level: ${noiseLevel}`;
  }

  /**
   * Generate editing suggestions based on video analysis
   */
  generateEditingSuggestions(analysis: VideoAnalysisResult): string[] {
    const suggestions: string[] = [];

    // Based on key moments
    const importantMoments = this.getMostImportantMoments(analysis.keyMoments, 3);
    if (importantMoments.length > 0) {
      suggestions.push(`Consider highlighting the key moments at ${importantMoments.map(m => `${m.start.toFixed(1)}s`).join(', ')}`);
    }

    // Based on sentiment
    if (analysis.sentiment === 'mixed') {
      suggestions.push('The video has mixed sentiment - consider restructuring for better flow');
    }

    // Based on audio analysis
    if (analysis.audioAnalysis?.speechClarity && analysis.audioAnalysis.speechClarity < 0.7) {
      suggestions.push('Audio clarity could be improved - consider noise reduction');
    }

    // Based on visual elements
    const people = this.findVisualElementsByType(analysis.visualElements, 'person');
    if (people.length > 0) {
      suggestions.push('Consider adding speaker identification or name overlays');
    }

    return suggestions;
  }

  /**
   * Search for content within video analysis
   */
  searchVideoContent(
    analysis: VideoAnalysisResult, 
    searchText: string
  ): { type: 'moment' | 'visual' | 'topic'; content: any; relevance: number }[] {
    const results: { type: 'moment' | 'visual' | 'topic'; content: any; relevance: number }[] = [];
    const lowerSearchText = searchText.toLowerCase();

    // Search in key moments
    analysis.keyMoments.forEach(moment => {
      const relevance = moment.description.toLowerCase().includes(lowerSearchText) ? 1.0 : 0.0;
      if (relevance > 0) {
        results.push({ type: 'moment', content: moment, relevance });
      }
    });

    // Search in visual elements
    analysis.visualElements.forEach(element => {
      const relevance = element.description.toLowerCase().includes(lowerSearchText) ? 0.8 : 0.0;
      if (relevance > 0) {
        results.push({ type: 'visual', content: element, relevance });
      }
    });

    // Search in topics
    analysis.topics.forEach(topic => {
      const relevance = topic.toLowerCase().includes(lowerSearchText) ? 0.9 : 0.0;
      if (relevance > 0) {
        results.push({ type: 'topic', content: { topic }, relevance });
      }
    });

    return results.sort((a, b) => b.relevance - a.relevance);
  }
}

// Export singleton instance
export const videoAnalysisService = VideoAnalysisService.getInstance();
