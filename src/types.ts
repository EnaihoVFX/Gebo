import type { Probe } from "./lib/ffmpeg";

export type Range = { start: number; end: number };

export type PlayerHandle = {
  play: () => void;
  pause: () => void;
  seek: (t: number) => void;
  isPlaying: () => boolean;
  currentTime: () => number;
};

export type PlayerProps = {
  src: string;
  label: string;
  cuts: Range[];
  large?: boolean;
};

export type WaveformCanvasProps = {
  peaks: number[];
  duration: number;
  accepted: Range[];
  preview: Range[];
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
};

export type VideoTimelineProps = {
  peaks: number[];
  duration: number;
  accepted: Range[];
  preview: Range[];
  filePath: string;
  width?: number;
  height?: number;
  onSeek?: (t: number) => void;
};

export type ChatMessage = {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  hasVideoPreview?: boolean;
  videoPreview?: {
    src: string;
    cuts: Range[];
    label: string;
  };
  actions?: ChatAction[];
  // AI Agent specific fields
  isStreaming?: boolean;
  thinkingSteps?: ThinkingStep[];
  finalEdits?: EditOperation[];
  status?: "thinking" | "streaming" | "completed" | "error";
};

export type ChatAction = {
  type: "accept" | "reject" | "custom";
  label: string;
  onClick: () => void;
};

export type MediaFile = {
  id: string;
  name: string;
  path: string;
  previewUrl: string;
  thumbnailUrl?: string;
  thumbnails?: string[]; // Multiple thumbnails for filmstrip
  probe: Probe;
  peaks: number[];
  duration: number;
  width: number;
  height: number;
  type: "video" | "audio";
  // Video analysis data (primary method)
  videoAnalysis?: VideoAnalysisResult;
  videoAnalysisStatus?: "pending" | "processing" | "completed" | "failed";
  videoAnalysisError?: string;
  // Transcription data (fallback method)
  transcript?: TranscriptSegment[];
  transcriptionStatus?: "pending" | "processing" | "completed" | "failed";
  transcriptionError?: string;
};

export type TranscriptSegment = {
  id: string;
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;  // Transcribed text
  confidence?: number; // Confidence score if available
};

export type TranscriptionResult = {
  segments: TranscriptSegment[];
  status: "completed" | "failed";
  error?: string;
};

export type VideoAnalysisResult = {
  summary: string;
  keyMoments: VideoKeyMoment[];
  topics: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  transcript?: TranscriptSegment[]; // Gemini can also provide transcript
  visualElements: VisualElement[];
  audioAnalysis?: AudioAnalysis;
  status: "completed" | "failed";
  error?: string;
};

export type VideoKeyMoment = {
  id: string;
  start: number;
  end: number;
  description: string;
  importance: number; // 0-1 scale
  type: "speech" | "action" | "transition" | "highlight";
};

export type VisualElement = {
  id: string;
  start: number;
  end: number;
  description: string;
  type: "object" | "person" | "scene" | "text" | "graphic";
  confidence: number;
};

export type AudioAnalysis = {
  hasSpeech: boolean;
  hasMusic: boolean;
  hasSoundEffects: boolean;
  speechClarity: number; // 0-1 scale
  backgroundNoise: number; // 0-1 scale
};

// Timeline UI types used by AdvancedTimeline/VideoEditor (distinct from lib/projectFile)
export type Track = {
  id: string;
  name: string;
  type: "video" | "audio" | "text" | "effect";
  enabled: boolean;
  muted: boolean;
  volume: number;
  order: number;
};

export type Clip = {
  id: string;
  mediaFileId: string;
  name: string;
  startTime: number;
  endTime: number;
  trackId: string;
  offset: number;
};

export type ChatSession = {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
};

// AI Agent System Types
export type ThinkingStep = {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "error";
  details?: string;
  timestamp: Date;
  duration?: number; // milliseconds
};

export type EditOperation = {
  id: string;
  type: "cut" | "split" | "merge" | "trim" | "add_transition" | "add_effect" | "add_text" | "adjust_audio";
  description: string;
  parameters: Record<string, any>;
  targetClipId?: string;
  targetTrackId?: string;
  timeRange?: Range;
  previewData?: any;
};

export type AgentResponse = {
  messageId: string;
  content: string;
  thinkingSteps: ThinkingStep[];
  finalEdits: EditOperation[];
  hasVideoPreview: boolean;
  videoPreview?: {
    src: string;
    cuts: Range[];
    label: string;
  };
  actions?: ChatAction[];
};

export type StreamingToken = {
  type: "content" | "thinking" | "edit" | "preview" | "action" | "complete";
  data: any;
  messageId: string;
};

export type AgentContext = {
  currentProject: {
    filePath: string;
    duration: number;
    tracks: Track[];
    clips: Clip[];
    mediaFiles: MediaFile[];
    acceptedCuts: Range[];
    previewCuts: Range[];
  };
  userIntent: string;
  conversationHistory: ChatMessage[];
};