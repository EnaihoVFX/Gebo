use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

pub struct GeminiClient {
    api_key: String,
    base_url: String,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            base_url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent".to_string(),
        }
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

    pub async fn generate_video_editing_response(
        &self,
        user_message: &str,
        project_context: &str,
    ) -> Result<VideoEditingResponse, String> {
        let prompt = format!(
            r#"You are an AI video editing assistant. Analyze the user's request and provide a structured response.

User Message: "{}"

Project Context: {}

Please respond with a JSON object containing:
1. thinking_steps: Array of objects with id, title, description, status, details, timestamp, duration
2. response_content: Natural language response to the user
3. edit_operations: Array of objects with id, operation_type, description, parameters, time_range
4. has_video_preview: Boolean indicating if a video preview should be shown
5. actions: Array of action objects with action_type and label

Focus on video editing operations like:
- Removing silence (remove silence > X seconds)
- Cutting segments (cut X - Y seconds)
- Tightening silence (tighten silence > X leave Yms)
- Detecting silence (detect silence)

For thinking steps, use status values: "pending", "in_progress", "completed", "error"
For edit operations, use operation_type values: "cut", "split", "merge", "trim", "add_transition", "add_effect", "add_text", "adjust_audio"

Respond with valid JSON only."#,
            user_message,
            project_context
        );

        let response_text = self.generate_content(prompt).await?;
        
        // Try to parse the JSON response
        let video_response: VideoEditingResponse = serde_json::from_str(&response_text)
            .map_err(|e| format!("Failed to parse AI response as JSON: {}. Response was: {}", e, response_text))?;

        Ok(video_response)
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

