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
};

export type ChatAction = {
  type: "accept" | "reject" | "custom";
  label: string;
  onClick: () => void;
};