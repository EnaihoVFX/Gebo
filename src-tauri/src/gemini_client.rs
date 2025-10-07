use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiRequest {
    pub contents: Vec<Content>,
    pub generation_config: GenerationConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Content {
    pub parts: Vec<Part>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Part {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GenerationConfig {
    pub temperature: f32,
    pub top_k: i32,
    pub top_p: f32,
    pub max_output_tokens: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiResponse {
    pub candidates: Vec<Candidate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Candidate {
    pub content: Content,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiStreamResponse {
    pub candidates: Vec<StreamCandidate>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StreamCandidate {
    pub content: Option<Content>,
    pub finish_reason: Option<String>,
    pub index: Option<u32>,
}

pub struct GeminiClient {
    api_key: String,
    base_url: String,
    stream_base_url: String,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent".to_string(),
            stream_base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent".to_string(),
        }
    }

    /// Test the API key and basic connectivity
    pub async fn test_api_key(&self) -> Result<String, String> {
        let test_prompt = "Respond with just the word 'success' to test the API connection.".to_string();
        self.generate_content(test_prompt).await
    }

    pub async fn generate_content(&self, prompt: String) -> Result<String, String> {
        let client = reqwest::Client::new();
        
        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part { text: prompt }],
            }],
            generation_config: GenerationConfig {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.95,
                max_output_tokens: 2048,
            },
        };

        let url = format!("{}?key={}", self.base_url, self.api_key);
        
        let response = client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API request failed with status {}: {}", status, error_text));
        }

        let gemini_response: GeminiResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        if let Some(candidate) = gemini_response.candidates.first() {
            if let Some(part) = candidate.content.parts.first() {
                Ok(part.text.clone())
            } else {
                Err("No content in response".to_string())
            }
        } else {
            Err("No candidates in response".to_string())
        }
    }

    /// Generate content with streaming support
    pub async fn generate_content_stream<F>(&self, prompt: String, mut on_token: F) -> Result<String, String> 
    where
        F: FnMut(&str) -> (),
    {
        let client = reqwest::Client::new();
        
        let request = GeminiRequest {
            contents: vec![Content {
                parts: vec![Part { text: prompt }],
            }],
            generation_config: GenerationConfig {
                temperature: 0.7,
                top_k: 40,
                top_p: 0.95,
                max_output_tokens: 2048,
            },
        };

        let url = format!("{}?key={}", self.stream_base_url, self.api_key);
        
        let response = client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API request failed with status {}: {}", status, error_text));
        }

        let mut stream = response.bytes_stream();
        let mut full_response = String::new();
        let mut buffer = String::new();

        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| format!("Failed to read chunk: {}", e))?;
            let text = String::from_utf8_lossy(&chunk);
            buffer.push_str(&text);

            // Process complete lines in the buffer
            while let Some(newline_pos) = buffer.find('\n') {
                let line = buffer[..newline_pos].trim().to_string();
                buffer = buffer[newline_pos + 1..].to_string();

                if line.starts_with("data: ") {
                    let json_data = &line[6..]; // Remove "data: " prefix
                    if json_data == "[DONE]" {
                        break;
                    }

                    if let Ok(stream_response) = serde_json::from_str::<GeminiStreamResponse>(json_data) {
                        if let Some(candidate) = stream_response.candidates.first() {
                            if let Some(content) = &candidate.content {
                                if let Some(part) = content.parts.first() {
                                    on_token(&part.text);
                                    full_response.push_str(&part.text);
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(full_response)
    }

    pub async fn generate_video_editing_response(
        &self,
        user_message: &str,
        project_context: &str,
    ) -> Result<VideoEditingResponse, String> {
        let prompt = format!(
            r#"You are an AI video editing assistant. Analyze the user's request and provide a structured response.

User Message: "{}"

Project Context: {}

Please respond with ONLY a valid JSON object (no additional text, explanations, or markdown) containing:
{{
  "thinking_steps": [
    {{
      "id": "step_1",
      "title": "Analyzing User Intent",
      "description": "Understanding what the user wants to accomplish",
      "status": "completed",
      "details": "User wants to: [user request]",
      "timestamp": "2024-01-01T00:00:00Z",
      "duration": 150
    }}
  ],
  "response_content": "Natural language response to the user",
  "edit_operations": [
    {{
      "id": "op_1",
      "operation_type": "cut",
      "description": "Description of the operation",
      "parameters": {{}},
      "target_clip_id": null,
      "target_track_id": null,
      "time_range": {{"start": 0.0, "end": 1.0}},
      "preview_data": null
    }}
  ],
  "has_video_preview": true,
  "actions": [
    {{
      "action_type": "accept",
      "label": "Accept Changes"
    }}
  ]
}}

Action types can be: "accept", "reject", "upload_video", "confirm_proceed", "custom"
- Use "upload_video" when user needs to add media but has none
- Use "accept"/"reject" ONLY after changes have been applied and preview is shown

IMPORTANT WORKFLOW:
When user requests an edit operation:
1. FIRST RESPONSE: Describe what you plan to do, ask for confirmation, return EMPTY edit_operations array and NO actions
2. WAIT for user to respond "yes", "no", "proceed", etc.
3. SECOND RESPONSE (after confirmation): Execute the changes, return edit_operations, and include "accept"/"reject" actions

Example first response:
{{
  "thinking_steps": [...],
  "response_content": "I can remove all silent parts longer than 2 seconds from your video. This will make it more concise and engaging. Would you like me to proceed with this?",
  "edit_operations": [],
  "has_video_preview": false,
  "actions": null
}}

Example second response (after user says yes):
{{
  "thinking_steps": [...],
  "response_content": "Great! I've identified and removed the silent segments. Please review the preview below.",
  "edit_operations": [...actual operations...],
  "has_video_preview": true,
  "actions": [{{"action_type": "accept", "label": "Accept Changes"}}, {{"action_type": "reject", "label": "Reject Changes"}}]
}}

Focus on video editing operations like:
- Removing silence (remove silence > X seconds)
- Cutting segments (cut X - Y seconds)
- Tightening silence (tighten silence > X leave Yms)
- Detecting silence (detect silence)

For thinking steps, use status values: "pending", "in_progress", "completed", "error"
For edit operations, use operation_type values: "cut", "split", "merge", "trim", "add_transition", "add_effect", "add_text", "adjust_audio"

Respond with ONLY the JSON object, no other text."#,
            user_message,
            project_context
        );

        let response_text = self.generate_content(prompt).await?;
        
        // Clean the response text to extract JSON
        let cleaned_response = self.extract_json_from_response(&response_text);
        
        // Try to parse the JSON response
        let video_response: VideoEditingResponse = serde_json::from_str(&cleaned_response)
            .map_err(|e| format!("Failed to parse AI response as JSON: {}. Cleaned response was: {}", e, cleaned_response))?;

        Ok(video_response)
    }

    pub async fn generate_video_editing_response_stream<F>(
        &self,
        user_message: &str,
        project_context: &str,
        mut on_token: F,
    ) -> Result<VideoEditingResponse, String> 
    where
        F: FnMut(&str) -> (),
    {
        let prompt = format!(
            r#"You are an AI video editing assistant. Analyze the user's request and provide a structured response.

User Message: "{}"

Project Context: {}

Please respond with ONLY a valid JSON object (no additional text, explanations, or markdown) containing:
{{
  "thinking_steps": [
    {{
      "id": "step_1",
      "title": "Analyzing User Intent",
      "description": "Understanding what the user wants to accomplish",
      "status": "completed",
      "details": "User wants to: [user request]",
      "timestamp": "2024-01-01T00:00:00Z",
      "duration": 150
    }}
  ],
  "response_content": "Natural language response to the user",
  "edit_operations": [
    {{
      "id": "op_1",
      "operation_type": "cut",
      "description": "Description of the operation",
      "parameters": {{}},
      "target_clip_id": null,
      "target_track_id": null,
      "time_range": {{"start": 0.0, "end": 1.0}},
      "preview_data": null
    }}
  ],
  "has_video_preview": true,
  "actions": [
    {{
      "action_type": "accept",
      "label": "Accept Changes"
    }}
  ]
}}

Action types can be: "accept", "reject", "upload_video", "confirm_proceed", "custom"
- Use "upload_video" when user needs to add media but has none
- Use "accept"/"reject" ONLY after changes have been applied and preview is shown

IMPORTANT WORKFLOW:
When user requests an edit operation:
1. FIRST RESPONSE: Describe what you plan to do, ask for confirmation, return EMPTY edit_operations array and NO actions
2. WAIT for user to respond "yes", "no", "proceed", etc.
3. SECOND RESPONSE (after confirmation): Execute the changes, return edit_operations, and include "accept"/"reject" actions

Example first response:
{{
  "thinking_steps": [...],
  "response_content": "I can remove all silent parts longer than 2 seconds from your video. This will make it more concise and engaging. Would you like me to proceed with this?",
  "edit_operations": [],
  "has_video_preview": false,
  "actions": null
}}

Example second response (after user says yes):
{{
  "thinking_steps": [...],
  "response_content": "Great! I've identified and removed the silent segments. Please review the preview below.",
  "edit_operations": [...actual operations...],
  "has_video_preview": true,
  "actions": [{{"action_type": "accept", "label": "Accept Changes"}}, {{"action_type": "reject", "label": "Reject Changes"}}]
}}

Focus on video editing operations like:
- Removing silence (remove silence > X seconds)
- Cutting segments (cut X - Y seconds)
- Tightening silence (tighten silence > X leave Yms)
- Detecting silence (detect silence)

For thinking steps, use status values: "pending", "in_progress", "completed", "error"
For edit operations, use operation_type values: "cut", "split", "merge", "trim", "add_transition", "add_effect", "add_text", "adjust_audio"

Respond with ONLY the JSON object, no other text."#,
            user_message,
            project_context
        );

        let response_text = self.generate_content_stream(prompt, |token| {
            on_token(token);
        }).await?;
        
        // Clean the response text to extract JSON
        let cleaned_response = self.extract_json_from_response(&response_text);
        
        // Try to parse the JSON response
        let video_response: VideoEditingResponse = serde_json::from_str(&cleaned_response)
            .map_err(|e| format!("Failed to parse AI response as JSON: {}. Cleaned response was: {}", e, cleaned_response))?;

        Ok(video_response)
    }

    /// Extract JSON from the response text, handling cases where Gemini adds extra text
    fn extract_json_from_response(&self, response: &str) -> String {
        let response = response.trim();
        
        // If the response starts with ```json, extract content between markers
        if response.starts_with("```json") {
            if let Some(end_marker_pos) = response[7..].find("```") {
                let end_marker = 7 + end_marker_pos;
                if let Some(json_start) = response[7..].find('{') {
                    let json_start_pos = 7 + json_start;
                    if json_start_pos < end_marker {
                        let json_content = &response[json_start_pos..end_marker];
                        return json_content.trim().to_string();
                    }
                }
            }
        }
        
        // If the response starts with ```, extract content between markers
        if response.starts_with("```") {
            if let Some(end_marker_pos) = response[3..].find("```") {
                let end_marker = 3 + end_marker_pos;
                if let Some(json_start) = response[3..].find('{') {
                    let json_start_pos = 3 + json_start;
                    if json_start_pos < end_marker {
                        let json_content = &response[json_start_pos..end_marker];
                        return json_content.trim().to_string();
                    }
                }
            }
        }
        
        // Find the first { and last } to extract JSON
        if let Some(start) = response.find('{') {
            if let Some(end) = response.rfind('}') {
                if end > start {
                    return response[start..=end].to_string();
                }
            }
        }
        
        // If no JSON markers found, return the original response
        response.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoEditingResponse {
    pub thinking_steps: Vec<ThinkingStep>,
    pub response_content: String,
    pub edit_operations: Vec<EditOperation>,
    pub has_video_preview: bool,
    pub actions: Option<Vec<Action>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThinkingStep {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub details: Option<String>,
    pub timestamp: String,
    pub duration: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EditOperation {
    pub id: String,
    pub operation_type: String,
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub target_clip_id: Option<String>,
    pub target_track_id: Option<String>,
    pub time_range: Option<TimeRange>,
    pub preview_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimeRange {
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Action {
    pub action_type: String,
    pub label: String,
}

