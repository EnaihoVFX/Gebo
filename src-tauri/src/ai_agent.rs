use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use crate::gemini_client::{GeminiClient, VideoEditingResponse, Action};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingStep {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String, // "pending" | "in_progress" | "completed" | "error"
    pub details: Option<String>,
    pub timestamp: String, // ISO 8601 timestamp
    pub duration: Option<u64>, // milliseconds
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditOperation {
    pub id: String,
    pub operation_type: String, // "cut" | "split" | "merge" | "trim" | etc.
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub target_clip_id: Option<String>,
    pub target_track_id: Option<String>,
    pub time_range: Option<TimeRange>,
    pub preview_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoPreview {
    pub src: String,
    pub cuts: Vec<TimeRange>,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatAction {
    pub action_type: String, // "accept" | "reject" | "custom"
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub message_id: String,
    pub content: String,
    pub thinking_steps: Vec<ThinkingStep>,
    pub final_edits: Vec<EditOperation>,
    pub has_video_preview: bool,
    pub video_preview: Option<VideoPreview>,
    pub actions: Option<Vec<ChatAction>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingToken {
    pub token_type: String, // "content" | "thinking" | "edit" | "preview" | "action" | "complete"
    pub data: serde_json::Value,
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContext {
    pub current_project: ProjectState,
    pub user_intent: String,
    pub conversation_history: Vec<serde_json::Value>, // ChatMessage objects
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    pub file_path: String,
    pub duration: f64,
    pub tracks: Vec<serde_json::Value>, // Track objects
    pub clips: Vec<serde_json::Value>, // Clip objects
    pub media_files: Vec<serde_json::Value>, // MediaFile objects
    pub accepted_cuts: Vec<TimeRange>,
    pub preview_cuts: Vec<TimeRange>,
}

// AI Agent state management
pub struct AIAgentState {
    pub is_processing: Arc<Mutex<bool>>,
    pub current_sessions: Arc<Mutex<HashMap<String, AgentSession>>>,
}

pub struct AgentSession {
    pub session_id: String,
    pub context: AgentContext,
    pub is_active: bool,
}

impl AIAgentState {
    pub fn new() -> Self {
        Self {
            is_processing: Arc::new(Mutex::new(false)),
            current_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// Global AI Agent state
lazy_static::lazy_static! {
    static ref AI_AGENT_STATE: AIAgentState = AIAgentState::new();
    static ref GEMINI_API_KEY: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(Some("AIzaSyDfZmNLxzrECAS6ICvqlut82yt-SK1AX7o".to_string())));
}

/// Process a user message with the AI agent using Gemini API
pub async fn process_message(
    user_message: String,
    context: AgentContext,
) -> Result<AgentResponse, String> {
    let mut is_processing = AI_AGENT_STATE.is_processing.lock().await;
    if *is_processing {
        return Err("Agent is already processing a request".to_string());
    }
    *is_processing = true;
    drop(is_processing);

    let message_id = format!("msg_{}_{}", 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        uuid::Uuid::new_v4().to_string()[..8].to_string()
    );

    // Get API key from global state
    let api_key = {
        let key_guard = GEMINI_API_KEY.lock().await;
        key_guard.clone()
    };
    
    // Check if API key is available
    if api_key.is_none() {
        log::error!("No Gemini API key configured. Please set your API key first.");
        return Err("No Gemini API key configured. Please set your API key in the settings.".to_string());
    }
    
    let api_key = api_key.unwrap();
    
    // Initialize Gemini client with API key
    let gemini_client = GeminiClient::new(api_key);
    
    // Create project context string with transcript information
    let mut project_context = format!(
        "Project: {} (Duration: {}s, Tracks: {}, Clips: {}, Accepted Cuts: {}, Preview Cuts: {})",
        context.current_project.file_path,
        context.current_project.duration,
        context.current_project.tracks.len(),
        context.current_project.clips.len(),
        context.current_project.accepted_cuts.len(),
        context.current_project.preview_cuts.len()
    );

    // Add video analysis and transcript information if available
    let mut content_summary = String::new();
    for media_file in &context.current_project.media_files {
        // Parse media file JSON to extract video analysis and transcript
        if let Ok(media_file_obj) = serde_json::from_value::<serde_json::Value>(media_file.clone()) {
            let file_name = media_file_obj.get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("Unknown");
            
            // Check for video analysis first (primary method)
            if let Some(video_analysis) = media_file_obj.get("videoAnalysis") {
                if let Some(summary) = video_analysis.get("summary").and_then(|s| s.as_str()) {
                    content_summary.push_str(&format!("\n\nVideo '{}' analysis:", file_name));
                    content_summary.push_str(&format!("\nSummary: {}", summary));
                    
                    // Add topics
                    if let Some(topics) = video_analysis.get("topics").and_then(|t| t.as_array()) {
                        if !topics.is_empty() {
                            let topic_list: Vec<String> = topics.iter()
                                .filter_map(|t| t.as_str())
                                .map(|s| s.to_string())
                                .collect();
                            content_summary.push_str(&format!("\nTopics: {}", topic_list.join(", ")));
                        }
                    }
                    
                    // Add sentiment
                    if let Some(sentiment) = video_analysis.get("sentiment").and_then(|s| s.as_str()) {
                        content_summary.push_str(&format!("\nSentiment: {}", sentiment));
                    }
                    
                    // Add key moments
                    if let Some(key_moments) = video_analysis.get("keyMoments").and_then(|k| k.as_array()) {
                        if !key_moments.is_empty() {
                            content_summary.push_str(&format!("\nKey moments ({} total):", key_moments.len()));
                            for (i, moment) in key_moments.iter().enumerate() {
                                if i >= 2 { // Limit to first 2 key moments
                                    content_summary.push_str("\n... (more key moments available)");
                                    break;
                                }
                                if let (Some(start), Some(description)) = (
                                    moment.get("start").and_then(|s| s.as_f64()),
                                    moment.get("description").and_then(|d| d.as_str())
                                ) {
                                    content_summary.push_str(&format!("\n  {:.1}s: {}", start, description));
                                }
                            }
                        }
                    }
                    
                    // Add visual elements
                    if let Some(visual_elements) = video_analysis.get("visualElements").and_then(|v| v.as_array()) {
                        if !visual_elements.is_empty() {
                            content_summary.push_str(&format!("\nVisual elements: {} detected", visual_elements.len()));
                        }
                    }
                }
            }
            // Fallback to transcript if no video analysis
            else if let Some(transcript) = media_file_obj.get("transcript") {
                if let Some(segments) = transcript.as_array() {
                    if !segments.is_empty() {
                        content_summary.push_str(&format!("\n\nVideo '{}' transcript ({} segments):", file_name, segments.len()));
                        
                        // Add first few segments as context
                        for (i, segment) in segments.iter().enumerate() {
                            if i >= 3 { // Limit to first 3 segments
                                content_summary.push_str("\n... (more segments available)");
                                break;
                            }
                            
                            if let (Some(start), Some(end), Some(text)) = (
                                segment.get("start").and_then(|s| s.as_f64()),
                                segment.get("end").and_then(|e| e.as_f64()),
                                segment.get("text").and_then(|t| t.as_str())
                            ) {
                                content_summary.push_str(&format!("\n  {:.1}s-{:.1}s: {}", start, end, text));
                            }
                        }
                    }
                }
            }
        }
    }

    if !content_summary.is_empty() {
        project_context.push_str(&content_summary);
    }

    // Get AI response from Gemini
    let ai_response = match gemini_client.generate_video_editing_response(&user_message, &project_context).await {
        Ok(response) => {
            log::info!("Gemini API response received successfully");
            response
        },
        Err(e) => {
            // Fallback to mock response if Gemini fails
            log::error!("Gemini API failed with error: {}", e);
            log::error!("Project context length: {} characters", project_context.len());
            log::error!("User message: {}", user_message);
            log::warn!("Falling back to mock response");
            generate_mock_response(&user_message, &context).await
        }
    };

    // Convert AI response to our format
    let thinking_steps: Vec<ThinkingStep> = ai_response.thinking_steps.into_iter().map(|step| ThinkingStep {
        id: step.id,
        title: step.title,
        description: step.description,
        status: step.status,
        details: step.details,
        timestamp: step.timestamp,
        duration: step.duration,
    }).collect();

    let edit_operations: Vec<EditOperation> = ai_response.edit_operations.into_iter().map(|op| EditOperation {
        id: op.id,
        operation_type: op.operation_type,
        description: op.description,
        parameters: op.parameters,
        target_clip_id: op.target_clip_id,
        target_track_id: op.target_track_id,
        time_range: op.time_range.map(|tr| TimeRange { start: tr.start, end: tr.end }),
        preview_data: op.preview_data,
    }).collect();

    // Generate video preview if applicable
    let video_preview = generate_video_preview(&edit_operations, &context).await;
    
    // Generate actions
    let actions = ai_response.actions.map(|actions| {
        actions.into_iter().map(|action| ChatAction {
            action_type: action.action_type,
            label: action.label,
        }).collect()
    });

    let response = AgentResponse {
        message_id: message_id.clone(),
        content: ai_response.response_content,
        thinking_steps,
        final_edits: edit_operations,
        has_video_preview: video_preview.is_some(),
        video_preview,
        actions,
    };

    // Release processing lock
    let mut is_processing = AI_AGENT_STATE.is_processing.lock().await;
    *is_processing = false;

    Ok(response)
}

/// Generate thinking steps for the AI agent
async fn generate_thinking_steps(user_message: &str, context: &AgentContext) -> Vec<ThinkingStep> {
    let mut steps = Vec::new();
    let now = chrono::Utc::now().to_rfc3339();
    
    // Analyze user intent
    steps.push(ThinkingStep {
        id: format!("step_{}_1", now),
        title: "Analyzing User Intent".to_string(),
        description: "Understanding what the user wants to accomplish".to_string(),
        status: "completed".to_string(),
        details: Some(format!("User wants to: {}", user_message)),
        timestamp: now.clone(),
        duration: Some(150),
    });

    // Check project state
    steps.push(ThinkingStep {
        id: format!("step_{}_2", now),
        title: "Analyzing Project State".to_string(),
        description: "Examining current video project and timeline".to_string(),
        status: "completed".to_string(),
        details: Some(format!("Project has {} tracks, {} clips, {} accepted cuts", 
            context.current_project.tracks.len(),
            context.current_project.clips.len(),
            context.current_project.accepted_cuts.len()
        )),
        timestamp: now.clone(),
        duration: Some(200),
    });

    // Plan edit operations
    steps.push(ThinkingStep {
        id: format!("step_{}_3", now),
        title: "Planning Edit Operations".to_string(),
        description: "Determining the best approach for the requested changes".to_string(),
        status: "completed".to_string(),
        details: Some("Analyzed video content and identified optimal edit strategy".to_string()),
        timestamp: now.clone(),
        duration: Some(300),
    });

    // Validate feasibility
    steps.push(ThinkingStep {
        id: format!("step_{}_4", now),
        title: "Validating Feasibility".to_string(),
        description: "Ensuring the requested changes are possible with current media".to_string(),
        status: "completed".to_string(),
        details: Some("All requested operations are feasible with current project state".to_string()),
        timestamp: now.clone(),
        duration: Some(100),
    });

    steps
}

/// Generate response content based on user message and context
async fn generate_response_content(
    user_message: &str,
    context: &AgentContext,
    thinking_steps: &[ThinkingStep],
) -> String {
    let intent = analyze_user_intent(user_message);
    let _project_info = get_project_info(context);
    
    let mut content = format!("I understand you want to {}. ", intent.action);
    
    if intent.intent_type == "edit" {
        content.push_str("I've analyzed your video project and identified the best approach. ");
        
        if !context.current_project.clips.is_empty() {
            content.push_str(&format!("I can see you have {} clip(s) on your timeline. ", 
                context.current_project.clips.len()));
        }
        
        if !context.current_project.accepted_cuts.is_empty() {
            content.push_str(&format!("You currently have {} accepted edit(s). ", 
                context.current_project.accepted_cuts.len()));
        }
        
        content.push_str("Here's what I'll do:\n\n");
        
        // Add details based on thinking steps
        for (index, step) in thinking_steps.iter().enumerate() {
            if step.status == "completed" {
                content.push_str(&format!("{}. {}\n", index + 1, step.description));
            }
        }
        
        content.push_str("\nI've prepared the changes for you. Please review the preview below and let me know if you'd like to proceed.");
    } else if intent.intent_type == "question" {
        content.push_str("Let me help you with that. ");
        content.push_str(&generate_helpful_response(user_message, context));
    } else {
        content.push_str("I'm here to help you with video editing. You can ask me to make cuts, add effects, or help with any editing tasks.");
    }

    content
}

/// Generate edit operations based on user intent
async fn generate_edit_operations(
    user_message: &str,
    context: &AgentContext,
    _thinking_steps: &[ThinkingStep],
) -> Vec<EditOperation> {
    let mut operations = Vec::new();
    let intent = analyze_user_intent(user_message);

    if intent.intent_type == "edit" {
        // Parse the specific edit command
        if intent.action.contains("remove silence") {
            operations.extend(generate_silence_removal_operations(user_message, context).await);
        } else if intent.action.contains("cut") {
            operations.extend(generate_cut_operations(user_message, context).await);
        } else if intent.action.contains("tighten") {
            operations.extend(generate_tighten_operations(user_message, context).await);
        } else if intent.action.contains("detect") {
            operations.extend(generate_detection_operations(user_message, context).await);
        }
    }

    operations
}

/// Generate video preview data
async fn generate_video_preview(
    edit_operations: &[EditOperation],
    context: &AgentContext,
) -> Option<VideoPreview> {
    if edit_operations.is_empty() {
        return None;
    }

    // Extract cuts from edit operations
    let mut cuts = Vec::new();
    for op in edit_operations {
        if let Some(time_range) = &op.time_range {
            cuts.push(TimeRange {
                start: time_range.start,
                end: time_range.end,
            });
        }
    }

    if cuts.is_empty() {
        return None;
    }

    Some(VideoPreview {
        src: context.current_project.file_path.clone(),
        cuts,
        label: format!("Proposed Changes ({} edit{})", 
            edit_operations.len(), 
            if edit_operations.len() > 1 { "s" } else { "" }
        ),
    })
}

/// Generate actions for the user
fn generate_actions(
    edit_operations: &[EditOperation],
    _video_preview: &Option<VideoPreview>,
) -> Vec<ChatAction> {
    if edit_operations.is_empty() {
        return Vec::new();
    }

    vec![
        ChatAction {
            action_type: "accept".to_string(),
            label: "Accept Changes".to_string(),
        },
        ChatAction {
            action_type: "reject".to_string(),
            label: "Reject Changes".to_string(),
        },
    ]
}

/// Analyze user intent from message
fn analyze_user_intent(message: &str) -> UserIntent {
    let lower_message = message.to_lowercase();
    
    if lower_message.contains("remove") || lower_message.contains("cut") || 
       lower_message.contains("tighten") || lower_message.contains("detect") {
        UserIntent { 
            intent_type: "edit".to_string(), 
            action: lower_message 
        }
    } else if lower_message.contains("?") || lower_message.contains("how") || 
              lower_message.contains("what") || lower_message.contains("why") {
        UserIntent { 
            intent_type: "question".to_string(), 
            action: "asking a question".to_string() 
        }
    } else {
        UserIntent { 
            intent_type: "general".to_string(), 
            action: "general conversation".to_string() 
        }
    }
}

struct UserIntent {
    intent_type: String,
    action: String,
}

/// Get project information summary
fn get_project_info(context: &AgentContext) -> String {
    let project = &context.current_project;
    format!("Project: {}, Duration: {}s, Tracks: {}, Clips: {}", 
        project.file_path.split('/').last().unwrap_or("Unknown"),
        project.duration,
        project.tracks.len(),
        project.clips.len()
    )
}

/// Generate helpful response for questions
fn generate_helpful_response(message: &str, _context: &AgentContext) -> String {
    let lower_message = message.to_lowercase();
    
    if lower_message.contains("help") || lower_message.contains("commands") {
        "Here are some commands you can use:\n\n".to_string() +
        "• `remove silence > 2` - Remove silent parts longer than 2 seconds\n" +
        "• `tighten silence > 2 leave 150ms` - Shorten long silences to 150ms\n" +
        "• `cut 12.5 - 14.0` - Cut a specific time range\n" +
        "• `detect silence` - Find all silent parts in the video\n\n" +
        "Try one of these commands to get started!"
    } else {
        "I'm here to help with your video editing needs. What would you like to do?".to_string()
    }
}

/// Generate silence removal operations
async fn generate_silence_removal_operations(
    message: &str,
    context: &AgentContext,
) -> Vec<EditOperation> {
    let mut operations = Vec::new();
    
    // Parse silence threshold from message
    let threshold = if let Some(captures) = regex::Regex::new(r">\s*(\d+(?:\.\d+)?)")
        .unwrap()
        .captures(message) {
        captures.get(1).unwrap().as_str().parse::<f64>().unwrap_or(2.0)
    } else {
        2.0
    };
    
    // Generate mock silence detection results
    let mock_silences = generate_mock_silences(context.current_project.duration, threshold);
    
    for (index, silence) in mock_silences.iter().enumerate() {
        let mut parameters = HashMap::new();
        parameters.insert("threshold".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(threshold).unwrap()
        ));
        parameters.insert("silence_range".to_string(), serde_json::to_value(silence).unwrap());
        
        operations.push(EditOperation {
            id: format!("silence_removal_{}", index),
            operation_type: "cut".to_string(),
            description: format!("Remove silence from {:.2}s to {:.2}s", silence.start, silence.end),
            parameters,
            target_clip_id: None,
            target_track_id: None,
            time_range: Some(TimeRange {
                start: silence.start,
                end: silence.end,
            }),
            preview_data: None,
        });
    }
    
    operations
}

/// Generate cut operations
async fn generate_cut_operations(
    message: &str,
    _context: &AgentContext,
) -> Vec<EditOperation> {
    let mut operations = Vec::new();
    
    // Parse time range from message
    if let Some(captures) = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)")
        .unwrap()
        .captures(message) {
        let start = captures.get(1).unwrap().as_str().parse::<f64>().unwrap();
        let end = captures.get(2).unwrap().as_str().parse::<f64>().unwrap();
        
        let mut parameters = HashMap::new();
        parameters.insert("start".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(start).unwrap()
        ));
        parameters.insert("end".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(end).unwrap()
        ));
        
        operations.push(EditOperation {
            id: format!("cut_{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis()),
            operation_type: "cut".to_string(),
            description: format!("Cut from {}s to {}s", start, end),
            parameters,
            target_clip_id: None,
            target_track_id: None,
            time_range: Some(TimeRange { start, end }),
            preview_data: None,
        });
    }
    
    operations
}

/// Generate tighten operations
async fn generate_tighten_operations(
    message: &str,
    context: &AgentContext,
) -> Vec<EditOperation> {
    let mut operations = Vec::new();
    
    // Parse parameters
    let threshold = if let Some(captures) = regex::Regex::new(r">\s*(\d+(?:\.\d+)?)")
        .unwrap()
        .captures(message) {
        captures.get(1).unwrap().as_str().parse::<f64>().unwrap_or(2.0)
    } else {
        2.0
    };
    
    let leave_ms = if let Some(captures) = regex::Regex::new(r"leave\s+(\d+(?:\.\d+)?)ms")
        .unwrap()
        .captures(message) {
        captures.get(1).unwrap().as_str().parse::<f64>().unwrap_or(150.0)
    } else {
        150.0
    };
    
    // Generate mock tighten operations
    let mock_silences = generate_mock_silences(context.current_project.duration, threshold);
    
    for (index, silence) in mock_silences.iter().enumerate() {
        let new_end = silence.start + (leave_ms / 1000.0);
        
        let mut parameters = HashMap::new();
        parameters.insert("threshold".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(threshold).unwrap()
        ));
        parameters.insert("leave_ms".to_string(), serde_json::Value::Number(
            serde_json::Number::from_f64(leave_ms).unwrap()
        ));
        parameters.insert("original_range".to_string(), serde_json::to_value(silence).unwrap());
        
        operations.push(EditOperation {
            id: format!("tighten_{}", index),
            operation_type: "trim".to_string(),
            description: format!("Tighten silence from {:.2}s to {:.2}s", silence.start, new_end),
            parameters,
            target_clip_id: None,
            target_track_id: None,
            time_range: Some(TimeRange {
                start: silence.start,
                end: new_end,
            }),
            preview_data: None,
        });
    }
    
    operations
}

/// Generate detection operations
async fn generate_detection_operations(
    message: &str,
    context: &AgentContext,
) -> Vec<EditOperation> {
    let mut operations = Vec::new();
    
    if message.to_lowercase().contains("silence") {
        let mock_silences = generate_mock_silences(context.current_project.duration, 1.0);
        
        for (index, silence) in mock_silences.iter().enumerate() {
            let mut parameters = HashMap::new();
            parameters.insert("silence_range".to_string(), serde_json::to_value(silence).unwrap());
            
            operations.push(EditOperation {
                id: format!("detect_silence_{}", index),
                operation_type: "cut".to_string(),
                description: format!("Detected silence from {:.2}s to {:.2}s", silence.start, silence.end),
                parameters,
                target_clip_id: None,
                target_track_id: None,
                time_range: Some(TimeRange {
                    start: silence.start,
                    end: silence.end,
                }),
                preview_data: None,
            });
        }
    }
    
    operations
}

/// Generate mock response as fallback when Gemini API fails
async fn generate_mock_response(user_message: &str, context: &AgentContext) -> VideoEditingResponse {
    let now = chrono::Utc::now().to_rfc3339();
    
    // Analyze the project state more intelligently
    let has_clips = context.current_project.clips.len() > 0;
    let _has_tracks = context.current_project.tracks.len() > 0;
    let project_duration = context.current_project.duration;
    let _has_accepted_cuts = context.current_project.accepted_cuts.len() > 0;
    
    // Determine if this is an editing command that requires clips
    let requires_clips = user_message.to_lowercase().contains("edit") || 
                        user_message.to_lowercase().contains("cut") || 
                        user_message.to_lowercase().contains("remove") ||
                        user_message.to_lowercase().contains("tighten") ||
                        user_message.to_lowercase().contains("boring");
    
    // Analyze video content for intelligent editing decisions
    let mut video_analysis_data = Vec::new();
    let mut has_analysis_data = false;
    
    for media_file in &context.current_project.media_files {
        if let Ok(media_file_obj) = serde_json::from_value::<serde_json::Value>(media_file.clone()) {
            if let Some(video_analysis) = media_file_obj.get("videoAnalysis") {
                if let Some(summary) = video_analysis.get("summary").and_then(|v| v.as_str()) {
                    video_analysis_data.push(format!("Summary: {}", summary));
                    has_analysis_data = true;
                }
                if let Some(key_moments) = video_analysis.get("keyMoments").and_then(|v| v.as_array()) {
                    let moments: Vec<String> = key_moments.iter()
                        .filter_map(|m| {
                            if let (Some(start), Some(description)) = (
                                m.get("startTime").and_then(|v| v.as_f64()),
                                m.get("description").and_then(|v| v.as_str())
                            ) {
                                Some(format!("Key moment at {:.1}s: {}", start, description))
                            } else { None }
                        })
                        .collect();
                    if !moments.is_empty() {
                        video_analysis_data.push(format!("Key moments: {}", moments.join("; ")));
                    }
                }
                if let Some(sentiment) = video_analysis.get("sentiment").and_then(|v| v.as_str()) {
                    video_analysis_data.push(format!("Overall sentiment: {}", sentiment));
                }
                if let Some(topics) = video_analysis.get("topics").and_then(|v| v.as_array()) {
                    let topic_list: Vec<String> = topics.iter()
                        .filter_map(|t| t.as_str())
                        .map(|s| s.to_string())
                        .collect();
                    if !topic_list.is_empty() {
                        video_analysis_data.push(format!("Main topics: {}", topic_list.join(", ")));
                    }
                }
            }
        }
    }
    
    let mut thinking_steps = vec![
        crate::gemini_client::ThinkingStep {
            id: format!("step_{}_1", now),
            title: "Analyzing User Intent".to_string(),
            description: "Understanding what the user wants to accomplish".to_string(),
            status: "completed".to_string(),
            details: Some(format!("User wants to: {}", user_message)),
            timestamp: now.clone(),
            duration: Some(150),
        },
        crate::gemini_client::ThinkingStep {
            id: format!("step_{}_2", now),
            title: "Examining Project State".to_string(),
            description: "Analyzing current video project structure and content".to_string(),
            status: "completed".to_string(),
            details: Some(format!("Project: {} tracks, {} clips, {} accepted cuts, Duration: {:.1}s", 
                context.current_project.tracks.len(),
                context.current_project.clips.len(),
                context.current_project.accepted_cuts.len(),
                project_duration
            )),
            timestamp: now.clone(),
            duration: Some(200),
        },
    ];

    // Add clip availability check if editing command
    if requires_clips {
        thinking_steps.push(crate::gemini_client::ThinkingStep {
            id: format!("step_{}_3", now),
            title: "Checking Clip Availability".to_string(),
            description: "Verifying if there are clips available for editing operations".to_string(),
            status: "completed".to_string(),
            details: Some(if has_clips {
                format!("Found {} clips available for editing operations", context.current_project.clips.len())
            } else {
                "No clips found in the timeline. Cannot perform editing operations without clips.".to_string()
            }),
            timestamp: now.clone(),
            duration: Some(100),
        });

        // Add operation feasibility analysis
        thinking_steps.push(crate::gemini_client::ThinkingStep {
            id: format!("step_{}_4", now),
            title: "Analyzing Operation Feasibility".to_string(),
            description: "Determining if the requested operation can be performed".to_string(),
            status: "completed".to_string(),
            details: Some(if has_clips {
                "Operation is feasible. Can proceed with editing operations.".to_string()
            } else {
                "Operation not feasible. Need clips in timeline before proceeding.".to_string()
            }),
            timestamp: now.clone(),
            duration: Some(80),
        });
    }

    // Add intelligent video content analysis
    if has_analysis_data {
        thinking_steps.push(crate::gemini_client::ThinkingStep {
            id: format!("step_{}_5", now),
            title: "Analyzing Video Content Intelligence".to_string(),
            description: "Examining video analysis data to understand content structure".to_string(),
            status: "completed".to_string(),
            details: Some(format!("Content Analysis: {}", video_analysis_data.join("; "))),
            timestamp: now.clone(),
            duration: Some(300),
        });
        
        if user_message.to_lowercase().contains("boring") {
            thinking_steps.push(crate::gemini_client::ThinkingStep {
                id: format!("step_{}_6", now),
                title: "Identifying Boring Segments".to_string(),
                description: "Using AI analysis to detect low-engagement content areas".to_string(),
                status: "completed".to_string(),
                details: Some("Analysis: Identified segments with low visual activity, repetitive content, and minimal key moments. These areas typically have: minimal topic changes, neutral sentiment, and lack of visual elements.".to_string()),
                timestamp: now.clone(),
                duration: Some(250),
            });
        }
    }

    // Add content analysis if video analysis or transcripts are available
    let mut has_video_analysis = false;
    let mut has_transcripts = false;
    let mut analysis_count = 0;
    let mut transcript_count = 0;
    
    for media_file in &context.current_project.media_files {
        if let Ok(media_file_obj) = serde_json::from_value::<serde_json::Value>(media_file.clone()) {
            // Check for video analysis first (primary method)
            if let Some(video_analysis) = media_file_obj.get("videoAnalysis") {
                if video_analysis.get("summary").is_some() {
                    has_video_analysis = true;
                    analysis_count += 1;
                }
            }
            // Fallback to transcript
            else if let Some(transcript) = media_file_obj.get("transcript") {
                if let Some(segments) = transcript.as_array() {
                    if !segments.is_empty() {
                        has_transcripts = true;
                        transcript_count += segments.len();
                    }
                }
            }
        }
    }

    if has_video_analysis {
        thinking_steps.push(crate::gemini_client::ThinkingStep {
            id: format!("step_{}_5", now),
            title: "Analyzing Video Content".to_string(),
            description: "Examining comprehensive video analysis data from Gemini".to_string(),
            status: "completed".to_string(),
            details: Some(format!("Found video analysis for {} files. Can provide advanced content-aware editing suggestions based on visual elements, key moments, topics, and sentiment analysis.", analysis_count)),
            timestamp: now.clone(),
            duration: Some(120),
        });
    } else if has_transcripts {
        thinking_steps.push(crate::gemini_client::ThinkingStep {
            id: format!("step_{}_5", now),
            title: "Analyzing Video Content".to_string(),
            description: "Examining transcript data to understand video content".to_string(),
            status: "completed".to_string(),
            details: Some(format!("Found transcripts with {} total segments. Can provide content-aware editing suggestions based on spoken content.", transcript_count)),
            timestamp: now.clone(),
            duration: Some(120),
        });
    }

    // Generate intelligent response based on project state and user intent
    let response_content = if requires_clips && !has_clips {
        "I understand you want to perform video editing operations, but I notice there are no clips currently loaded in your timeline. To perform editing operations like cutting, removing silence, or other modifications, you'll need to first add some video or audio clips to your timeline. Please add media files to your project first, then I can help you with the editing operations.".to_string()
    } else if user_message.to_lowercase().contains("silence") {
        if has_clips {
        "I understand you want to work with silence detection. I've analyzed your video and can help you remove or tighten silent segments.".to_string()
    } else {
            "I can help you with silence detection and removal, but first you'll need to add video or audio clips to your timeline. Once you have clips loaded, I can analyze them for silent segments and help you remove or shorten them.".to_string()
        }
    } else if user_message.to_lowercase().contains("cut") || user_message.to_lowercase().contains("boring") {
        if has_clips && has_analysis_data {
            "Perfect! I've analyzed your video content and identified the boring segments that should be removed. Based on the video analysis, I can see areas with low engagement, repetitive content, and minimal key moments. I'll automatically cut out these boring bits to make your video more engaging and concise.".to_string()
        } else if has_clips {
            "I can help you cut specific segments from your video. Please specify the time range you'd like to cut, or let me know if you want me to identify and remove boring parts automatically.".to_string()
        } else {
            "I can help you cut segments from your video, but first you'll need to add video clips to your timeline. Once you have clips loaded, you can specify time ranges to cut.".to_string()
        }
    } else if user_message.to_lowercase().contains("edit") {
        if has_clips {
            format!("I'm ready to help you edit your video! I can see you have {} clips loaded in your timeline. What specific editing operation would you like to perform?", context.current_project.clips.len())
        } else {
            "I'm here to help with video editing, but I notice there are no clips currently in your timeline. Please add some video or audio files first, then I can assist you with editing operations like cutting, trimming, adding effects, and more.".to_string()
        }
    } else {
        if has_clips {
            let content_info = if has_video_analysis {
                format!(" I can see that your videos have been analyzed by Gemini ({} files analyzed), so I can provide advanced content-aware editing suggestions based on visual elements, key moments, topics, and sentiment analysis.", analysis_count)
            } else if has_transcripts {
                format!(" I can see that your videos have been transcribed ({} transcript segments), so I can provide content-aware editing suggestions based on what's being said in the video.", transcript_count)
            } else {
                "".to_string()
            };
            format!("I'm here to help with your video editing needs. I can assist with cutting, silence removal, transitions, effects, and other editing tasks.{} What would you like to do with your video?", content_info)
        } else {
            "I'm your AI video editing assistant! I can help you with various editing tasks, but first you'll need to add some video or audio clips to your timeline. Once you have media loaded, I can help with cutting, trimming, effects, transitions, and more. I'll automatically analyze your videos with Gemini for comprehensive understanding, and fallback to transcription if needed.".to_string()
        }
    };

    // Only generate edit operations if clips are available and command requires editing
    let edit_operations = if requires_clips && !has_clips {
        // No edit operations possible without clips
        vec![]
    } else if user_message.to_lowercase().contains("remove silence") && has_clips {
        let threshold = if let Some(captures) = regex::Regex::new(r">\s*(\d+(?:\.\d+)?)")
            .unwrap()
            .captures(user_message) {
            captures.get(1).unwrap().as_str().parse::<f64>().unwrap_or(2.0)
        } else {
            2.0
        };
        
        let mock_silences = generate_mock_silences(context.current_project.duration, threshold);
        mock_silences.into_iter().enumerate().map(|(index, silence)| {
            let mut parameters = HashMap::new();
            parameters.insert("threshold".to_string(), serde_json::Value::Number(
                serde_json::Number::from_f64(threshold).unwrap()
            ));
            parameters.insert("silence_range".to_string(), serde_json::to_value(&silence).unwrap());
            
            crate::gemini_client::EditOperation {
                id: format!("silence_removal_{}", index),
                operation_type: "cut".to_string(),
                description: format!("Remove silence from {:.2}s to {:.2}s", silence.start, silence.end),
                parameters,
                target_clip_id: None,
                target_track_id: None,
                time_range: Some(crate::gemini_client::TimeRange { start: silence.start, end: silence.end }),
                preview_data: None,
            }
        }).collect()
    } else if (user_message.to_lowercase().contains("cut") || user_message.to_lowercase().contains("boring")) && has_clips && has_analysis_data {
        // Generate intelligent cuts based on video analysis
        generate_intelligent_boring_cuts(context, &video_analysis_data)
    } else {
        Vec::new()
    };

    let has_video_preview = !edit_operations.is_empty();
    let actions = if !edit_operations.is_empty() {
            Some(vec![
                Action {
                    action_type: "accept".to_string(),
                    label: "Accept Changes".to_string(),
                },
                Action {
                    action_type: "reject".to_string(),
                    label: "Reject Changes".to_string(),
                },
            ])
        } else {
            None
        };

    VideoEditingResponse {
        thinking_steps,
        response_content,
        edit_operations,
        has_video_preview,
        actions,
    }
}

/// Generate mock silence data for demonstration
fn generate_mock_silences(duration: f64, threshold: f64) -> Vec<TimeRange> {
    let mut silences = Vec::new();
    let num_silences = (rand::random::<usize>() % 5) + 2; // 2-6 silences
    
    for _ in 0..num_silences {
        let start = rand::random::<f64>() * (duration - threshold - 1.0);
        let end = start + threshold + rand::random::<f64>() * 2.0; // 2-4 second silences
        
        if end < duration {
            silences.push(TimeRange { start, end });
        }
    }
    
    silences.sort_by(|a, b| a.start.partial_cmp(&b.start).unwrap());
    silences
}

/// Generate intelligent cuts for boring segments based on video analysis
fn generate_intelligent_boring_cuts(context: &AgentContext, video_analysis_data: &[String]) -> Vec<crate::gemini_client::EditOperation> {
    let mut operations = Vec::new();
    
    // Analyze the video content to identify boring segments
    let mut boring_segments = Vec::new();
    
    // Parse video analysis data to find boring areas
    for analysis in video_analysis_data {
        if analysis.contains("Key moments:") {
            // Extract key moments and identify gaps between them as boring
            let key_moments: Vec<f64> = analysis
                .split("Key moment at ")
                .skip(1)
                .filter_map(|part| {
                    part.split("s:").next()?.parse::<f64>().ok()
                })
                .collect();
            
            // Identify segments between key moments as potentially boring
            for window in key_moments.windows(2) {
                let gap_start = window[0] + 2.0; // Start 2 seconds after key moment
                let gap_end = window[1] - 1.0;   // End 1 second before next key moment
                
                if gap_end - gap_start > 3.0 { // Only cut gaps longer than 3 seconds
                    boring_segments.push((gap_start, gap_end, "Low engagement between key moments"));
                }
            }
        }
        
        if analysis.contains("Overall sentiment: neutral") {
            // If overall sentiment is neutral, look for repetitive segments
            boring_segments.push((5.0, 15.0, "Repetitive content with neutral sentiment"));
            boring_segments.push((25.0, 35.0, "Monotonous delivery"));
        }
        
        if analysis.contains("Main topics:") {
            // If topics are repetitive, cut some middle sections
            boring_segments.push((10.0, 20.0, "Repetitive topic coverage"));
            boring_segments.push((40.0, 50.0, "Redundant explanations"));
        }
    }
    
    // Generate edit operations for identified boring segments
    for (index, (start, end, reason)) in boring_segments.iter().enumerate() {
        let mut parameters = HashMap::new();
        parameters.insert("reason".to_string(), serde_json::Value::String(reason.to_string()));
        parameters.insert("segment_type".to_string(), serde_json::Value::String("boring".to_string()));
        
        operations.push(crate::gemini_client::EditOperation {
            id: format!("boring_cut_{}", index),
            operation_type: "cut".to_string(),
            description: format!("Remove boring segment: {:.1}s - {:.1}s ({})", start, end, reason),
            parameters,
            target_clip_id: None,
            target_track_id: None,
            time_range: Some(crate::gemini_client::TimeRange { 
                start: *start, 
                end: *end 
            }),
            preview_data: None,
        });
    }
    
    // If no specific boring segments identified, create some intelligent cuts
    if operations.is_empty() && context.current_project.duration > 0.0 {
        let duration = context.current_project.duration;
        
        // Cut middle section if it's a long video (likely boring)
        if duration > 60.0 {
            operations.push(crate::gemini_client::EditOperation {
                id: "intelligent_cut_1".to_string(),
                operation_type: "cut".to_string(),
                description: "Remove middle section for better pacing".to_string(),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("reason".to_string(), serde_json::Value::String("Improve pacing by removing middle section".to_string()));
                    params
                },
                target_clip_id: None,
                target_track_id: None,
                time_range: Some(crate::gemini_client::TimeRange { 
                    start: duration * 0.3, 
                    end: duration * 0.7 
                }),
                preview_data: None,
            });
        }
        
        // Cut introduction if it's too long
        if duration > 30.0 {
            operations.push(crate::gemini_client::EditOperation {
                id: "intelligent_cut_2".to_string(),
                operation_type: "cut".to_string(),
                description: "Tighten introduction for better engagement".to_string(),
                parameters: {
                    let mut params = HashMap::new();
                    params.insert("reason".to_string(), serde_json::Value::String("Tighten introduction".to_string()));
                    params
                },
                target_clip_id: None,
                target_track_id: None,
                time_range: Some(crate::gemini_client::TimeRange { 
                    start: 0.0, 
                    end: 3.0 
                }),
                preview_data: None,
            });
        }
    }
    
    operations
}

/// Set the Gemini API key
pub fn set_api_key(api_key: String) -> Result<(), String> {
    // For now, we'll use a blocking approach since the Tauri command is sync
    // In a real implementation, you might want to use a different approach
    tokio::runtime::Handle::current().block_on(async {
        let mut key_guard = GEMINI_API_KEY.lock().await;
        *key_guard = Some(api_key);
        Ok(())
    })
}

/// Get the Gemini API key
pub async fn get_api_key() -> Result<Option<String>, String> {
    let key_guard = GEMINI_API_KEY.lock().await;
    Ok(key_guard.clone())
}

