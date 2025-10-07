import { invoke } from '@tauri-apps/api/core';
import type { 
  AgentContext, 
  AgentResponse, 
  StreamingToken, 
  ThinkingStep, 
  EditOperation, 
  ChatMessage, 
  Range,
  Track,
  Clip,
  MediaFile
} from '../types';

export class AIAgent {
  private isProcessing = false;
  private currentStream: ReadableStreamDefaultReader<Uint8Array> | null = null;

  constructor() {
    // Initialize the AI agent
  }

  /**
   * Test the Gemini API connection
   */
  async testApiConnection(): Promise<string> {
    try {
      const response = await invoke('test_gemini_api') as string;
      return response;
    } catch (error) {
      console.error('API test failed:', error);
      throw error;
    }
  }

  /**
   * Generate a short, descriptive name for a chat based on the first user message
   */
  async generateChatName(firstUserMessage: string): Promise<string> {
    try {
      const response = await invoke('generate_chat_name', {
        userMessage: firstUserMessage
      }) as string;
      
      return response || this.generateFallbackName(firstUserMessage);
    } catch (error) {
      console.warn('Failed to generate AI chat name, using fallback:', error);
      return this.generateFallbackName(firstUserMessage);
    }
  }

  /**
   * Generate a fallback name if AI generation fails
   */
  private generateFallbackName(message: string): string {
    // Extract key words and create a short name
    const words = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'and', 'for', 'with', 'this', 'that', 'remove', 'cut', 'edit'].includes(word))
      .slice(0, 3);
    
    if (words.length === 0) {
      return 'New Chat';
    }
    
    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  /**
   * Process a user message and generate a streaming response
   */
  async processMessage(
    userMessage: string,
    context: AgentContext,
    onToken: (token: StreamingToken) => void,
    onComplete: (response: AgentResponse) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (this.isProcessing) {
      onError(new Error('Agent is already processing a request'));
      return;
    }

    this.isProcessing = true;
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Convert context to Tauri format
      const tauriContext = this.convertContextToTauriFormat(context);
      
      // Call Tauri backend
      const response = await invoke('process_ai_message', {
        userMessage,
        context: tauriContext
      }) as any;

      // Convert response back to frontend format
      const agentResponse = this.convertResponseFromTauriFormat(response);

      // Stream the thinking steps
      for (const step of agentResponse.thinkingSteps) {
        onToken({
          type: "thinking",
          data: step,
          messageId
        });
        
        // Simulate thinking time
        await this.delay(300 + Math.random() * 500);
      }

      // Stream the response content
      await this.streamContent(agentResponse.content, messageId, onToken);

      // Stream edit operations
      for (const edit of agentResponse.finalEdits) {
        onToken({
          type: "edit",
          data: edit,
          messageId
        });
      }

      // Stream video preview if applicable
      if (agentResponse.hasVideoPreview && agentResponse.videoPreview) {
        onToken({
          type: "preview",
          data: agentResponse.videoPreview,
          messageId
        });
      }

      // Stream actions
      if (agentResponse.actions && agentResponse.actions.length > 0) {
        onToken({
          type: "action",
          data: agentResponse.actions,
          messageId
        });
      }

      // Complete the response
      onToken({
        type: "complete",
        data: agentResponse,
        messageId
      });

      onComplete(agentResponse);

    } catch (error) {
      onError(error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Generate thinking steps for the AI agent
   */
  private async generateThinkingSteps(userMessage: string, context: AgentContext): Promise<ThinkingStep[]> {
    const steps: ThinkingStep[] = [];
    
    // Analyze user intent
    steps.push({
      id: `step_${Date.now()}_1`,
      title: "Analyzing User Intent",
      description: "Understanding what the user wants to accomplish",
      status: "in_progress",
      timestamp: new Date()
    });

    // Check project state
    steps.push({
      id: `step_${Date.now()}_2`,
      title: "Analyzing Project State",
      description: "Examining current video project and timeline",
      status: "pending",
      timestamp: new Date()
    });

    // Plan edit operations
    steps.push({
      id: `step_${Date.now()}_3`,
      title: "Planning Edit Operations",
      description: "Determining the best approach for the requested changes",
      status: "pending",
      timestamp: new Date()
    });

    // Validate feasibility
    steps.push({
      id: `step_${Date.now()}_4`,
      title: "Validating Feasibility",
      description: "Ensuring the requested changes are possible with current media",
      status: "pending",
      timestamp: new Date()
    });

    return steps;
  }

  /**
   * Generate response content based on user message and context
   */
  private async generateResponseContent(
    userMessage: string, 
    context: AgentContext, 
    thinkingSteps: ThinkingStep[]
  ): Promise<string> {
    // Simulate AI processing time
    await this.delay(300);

    const intent = this.analyzeUserIntent(userMessage);
    const projectInfo = this.getProjectInfo(context);
    
    let content = `I understand you want to ${intent.action}. `;
    
    if (intent.type === "edit") {
      content += `I've analyzed your video project and identified the best approach. `;
      
      if (context.currentProject.clips.length > 0) {
        content += `I can see you have ${context.currentProject.clips.length} clip(s) on your timeline. `;
      }
      
      if (context.currentProject.acceptedCuts.length > 0) {
        content += `You currently have ${context.currentProject.acceptedCuts.length} accepted edit(s). `;
      }
      
      content += `Here's what I'll do:\n\n`;
      
      // Add details based on thinking steps
      thinkingSteps.forEach((step, index) => {
        if (step.status === "completed") {
          content += `${index + 1}. ${step.description}\n`;
        }
      });
      
      content += `\nI've prepared the changes for you. Please review the preview below and let me know if you'd like to proceed.`;
    } else if (intent.type === "question") {
      content += `Let me help you with that. `;
      content += this.generateHelpfulResponse(userMessage, context);
    } else {
      content += `I'm here to help you with video editing. You can ask me to make cuts, add effects, or help with any editing tasks.`;
    }

    return content;
  }

  /**
   * Generate edit operations based on user intent
   */
  private async generateEditOperations(
    userMessage: string,
    context: AgentContext,
    thinkingSteps: ThinkingStep[]
  ): Promise<EditOperation[]> {
    const operations: EditOperation[] = [];
    const intent = this.analyzeUserIntent(userMessage);

    if (intent.type === "edit") {
      // Parse the specific edit command
      if (intent.action.includes("remove silence")) {
        operations.push(...this.generateSilenceRemovalOperations(userMessage, context));
      } else if (intent.action.includes("cut")) {
        operations.push(...this.generateCutOperations(userMessage, context));
      } else if (intent.action.includes("tighten")) {
        operations.push(...this.generateTightenOperations(userMessage, context));
      } else if (intent.action.includes("detect")) {
        operations.push(...this.generateDetectionOperations(userMessage, context));
      }
    }

    return operations;
  }

  /**
   * Generate video preview data
   */
  private async generateVideoPreview(
    editOperations: EditOperation[],
    context: AgentContext
  ): Promise<{ src: string; cuts: Range[]; label: string } | null> {
    if (editOperations.length === 0) return null;

    // Extract cuts from edit operations
    const cuts: Range[] = [];
    editOperations.forEach(op => {
      if (op.timeRange) {
        cuts.push(op.timeRange);
      }
    });

    if (cuts.length === 0) return null;

    return {
      src: context.currentProject.filePath,
      cuts,
      label: `Proposed Changes (${cuts.length} edit${cuts.length > 1 ? 's' : ''})`
    };
  }

  /**
   * Generate actions for the user
   */
  private generateActions(
    editOperations: EditOperation[],
    videoPreview: { src: string; cuts: Range[]; label: string } | null
  ) {
    if (editOperations.length === 0) return [];

    return [
      {
        type: "accept" as const,
        label: "Accept Changes",
        onClick: () => {
          console.log("User accepted changes");
        }
      },
      {
        type: "reject" as const,
        label: "Reject Changes", 
        onClick: () => {
          console.log("User rejected changes");
        }
      }
    ];
  }

  /**
   * Stream content token by token
   */
  private async streamContent(
    content: string,
    messageId: string,
    onToken: (token: StreamingToken) => void
  ): Promise<void> {
    const words = content.split(' ');
    let currentContent = '';

    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];
      
      onToken({
        type: "content",
        data: { content: currentContent },
        messageId
      });

      // Simulate typing delay
      await this.delay(50 + Math.random() * 100);
    }
  }

  /**
   * Analyze user intent from message
   */
  private analyzeUserIntent(message: string): { type: "edit" | "question" | "general"; action: string } {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("remove") || lowerMessage.includes("cut") || 
        lowerMessage.includes("tighten") || lowerMessage.includes("detect")) {
      return { type: "edit", action: lowerMessage };
    }
    
    if (lowerMessage.includes("?") || lowerMessage.includes("how") || 
        lowerMessage.includes("what") || lowerMessage.includes("why")) {
      return { type: "question", action: "asking a question" };
    }
    
    return { type: "general", action: "general conversation" };
  }

  /**
   * Get project information summary
   */
  private getProjectInfo(context: AgentContext): string {
    const project = context.currentProject;
    return `Project: ${project.filePath.split('/').pop()}, Duration: ${project.duration}s, Tracks: ${project.tracks.length}, Clips: ${project.clips.length}`;
  }

  /**
   * Generate helpful response for questions
   */
  private generateHelpfulResponse(message: string, context: AgentContext): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes("help") || lowerMessage.includes("commands")) {
      return `Here are some commands you can use:\n\n` +
             `• \`remove silence > 2\` - Remove silent parts longer than 2 seconds\n` +
             `• \`tighten silence > 2 leave 150ms\` - Shorten long silences to 150ms\n` +
             `• \`cut 12.5 - 14.0\` - Cut a specific time range\n` +
             `• \`detect silence\` - Find all silent parts in the video\n\n` +
             `Try one of these commands to get started!`;
    }
    
    return `I'm here to help with your video editing needs. What would you like to do?`;
  }

  /**
   * Generate silence removal operations
   */
  private generateSilenceRemovalOperations(message: string, context: AgentContext): EditOperation[] {
    const operations: EditOperation[] = [];
    
    // Parse silence threshold from message
    const thresholdMatch = message.match(/>\s*(\d+(?:\.\d+)?)/);
    const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 2.0;
    
    // Generate mock silence detection results
    const mockSilences = this.generateMockSilences(context.currentProject.duration, threshold);
    
    mockSilences.forEach((silence, index) => {
      operations.push({
        id: `silence_removal_${index}`,
        type: "cut",
        description: `Remove silence from ${silence.start.toFixed(2)}s to ${silence.end.toFixed(2)}s`,
        parameters: { threshold, silenceRange: silence },
        timeRange: silence
      });
    });
    
    return operations;
  }

  /**
   * Generate cut operations
   */
  private generateCutOperations(message: string, context: AgentContext): EditOperation[] {
    const operations: EditOperation[] = [];
    
    // Parse time range from message
    const rangeMatch = message.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (rangeMatch) {
      const start = parseFloat(rangeMatch[1]);
      const end = parseFloat(rangeMatch[2]);
      
      operations.push({
        id: `cut_${Date.now()}`,
        type: "cut",
        description: `Cut from ${start}s to ${end}s`,
        parameters: { start, end },
        timeRange: { start, end }
      });
    }
    
    return operations;
  }

  /**
   * Generate tighten operations
   */
  private generateTightenOperations(message: string, context: AgentContext): EditOperation[] {
    const operations: EditOperation[] = [];
    
    // Parse parameters
    const thresholdMatch = message.match(/>\s*(\d+(?:\.\d+)?)/);
    const leaveMatch = message.match(/leave\s+(\d+(?:\.\d+)?)ms/);
    
    const threshold = thresholdMatch ? parseFloat(thresholdMatch[1]) : 2.0;
    const leaveMs = leaveMatch ? parseFloat(leaveMatch[1]) : 150;
    
    // Generate mock tighten operations
    const mockSilences = this.generateMockSilences(context.currentProject.duration, threshold);
    
    mockSilences.forEach((silence, index) => {
      const newEnd = silence.start + (leaveMs / 1000);
      operations.push({
        id: `tighten_${index}`,
        type: "trim",
        description: `Tighten silence from ${silence.start.toFixed(2)}s to ${newEnd.toFixed(2)}s`,
        parameters: { threshold, leaveMs, originalRange: silence },
        timeRange: { start: silence.start, end: newEnd }
      });
    });
    
    return operations;
  }

  /**
   * Generate detection operations
   */
  private generateDetectionOperations(message: string, context: AgentContext): EditOperation[] {
    const operations: EditOperation[] = [];
    
    if (message.toLowerCase().includes("silence")) {
      const mockSilences = this.generateMockSilences(context.currentProject.duration, 1.0);
      
      mockSilences.forEach((silence, index) => {
        operations.push({
          id: `detect_silence_${index}`,
          type: "cut",
          description: `Detected silence from ${silence.start.toFixed(2)}s to ${silence.end.toFixed(2)}s`,
          parameters: { silenceRange: silence },
          timeRange: silence
        });
      });
    }
    
    return operations;
  }

  /**
   * Generate mock silence data for demonstration
   */
  private generateMockSilences(duration: number, threshold: number): Range[] {
    const silences: Range[] = [];
    const numSilences = Math.floor(Math.random() * 5) + 2; // 2-6 silences
    
    for (let i = 0; i < numSilences; i++) {
      const start = Math.random() * (duration - threshold - 1);
      const end = start + threshold + Math.random() * 2; // 2-4 second silences
      
      if (end < duration) {
        silences.push({ start, end });
      }
    }
    
    return silences.sort((a, b) => a.start - b.start);
  }

  /**
   * Convert frontend context to Tauri backend format
   */
  private convertContextToTauriFormat(context: AgentContext): any {
    return {
      current_project: {
        file_path: context.currentProject.filePath,
        duration: context.currentProject.duration,
        tracks: context.currentProject.tracks,
        clips: context.currentProject.clips,
        media_files: context.currentProject.mediaFiles,
        accepted_cuts: context.currentProject.acceptedCuts,
        preview_cuts: context.currentProject.previewCuts,
      },
      user_intent: context.userIntent,
      conversation_history: context.conversationHistory,
    };
  }

  /**
   * Convert Tauri backend response to frontend format
   */
  private convertResponseFromTauriFormat(response: any): AgentResponse {
    return {
      messageId: response.message_id,
      content: response.content,
      thinkingSteps: response.thinking_steps.map((step: any) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        status: step.status as "pending" | "in_progress" | "completed" | "error",
        details: step.details,
        timestamp: new Date(step.timestamp),
        duration: step.duration,
      })),
      finalEdits: response.final_edits.map((edit: any) => ({
        id: edit.id,
        type: edit.operation_type as EditOperation['type'],
        description: edit.description,
        parameters: edit.parameters,
        targetClipId: edit.target_clip_id,
        targetTrackId: edit.target_track_id,
        timeRange: edit.time_range ? {
          start: edit.time_range.start,
          end: edit.time_range.end,
        } : undefined,
        previewData: edit.preview_data,
      })),
      hasVideoPreview: response.has_video_preview,
      videoPreview: response.video_preview ? {
        src: response.video_preview.src,
        cuts: response.video_preview.cuts.map((cut: any) => ({
          start: cut.start,
          end: cut.end,
        })),
        label: response.video_preview.label,
      } : undefined,
      actions: response.actions?.map((action: any) => ({
        type: action.action_type as "accept" | "reject" | "custom" | "upload_video" | "upload_media" | "confirm_proceed",
        label: action.label,
        onClick: () => {
          console.log(`Action clicked: ${action.action_type}`);
        },
      })),
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel current processing
   */
  cancel(): void {
    this.isProcessing = false;
    if (this.currentStream) {
      this.currentStream.cancel();
      this.currentStream = null;
    }
  }

  /**
   * Check if agent is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Reset the AI agent processing lock (for recovery from stuck states)
   */
  async resetProcessingLock(): Promise<void> {
    try {
      await invoke('reset_ai_agent');
      this.isProcessing = false;
      console.log('AI agent processing lock has been reset');
    } catch (error) {
      console.error('Failed to reset AI agent:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiAgent = new AIAgent();


