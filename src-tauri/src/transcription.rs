use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::fs;
use anyhow::Result;
use reqwest::multipart;
use mime_guess;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub confidence: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptSegment>,
    pub status: String, // "completed" | "failed"
    pub error: Option<String>,
}

/// Transcription service that can use multiple providers
pub struct TranscriptionService {
    client: reqwest::Client,
}

impl TranscriptionService {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    /// Transcribe a video/audio file using Whisper.cc API
    pub async fn transcribe_with_whisper_cc(&self, file_path: &str) -> Result<TranscriptionResult> {
        log::info!("Starting transcription with Whisper.cc for: {}", file_path);

        // Check if file exists
        if !Path::new(file_path).exists() {
            return Err(anyhow::anyhow!("File does not exist: {}", file_path));
        }

        // Read file
        let file_data = fs::read(file_path).await?;
        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("audio.wav");

        // Detect MIME type
        let mime_type = mime_guess::from_path(file_path)
            .first_or_octet_stream()
            .to_string();

        log::info!("File MIME type: {}", mime_type);

        // Create multipart form
        let form = multipart::Form::new()
            .part("file", multipart::Part::bytes(file_data)
                .file_name(file_name.to_string())
                .mime_str(&mime_type)?);

        // Make request to Whisper.cc
        // Note: This is a placeholder URL - you'll need to replace with actual Whisper.cc API endpoint
        let response = self.client
            .post("https://api.whisper.cc/v1/transcribe") // Replace with actual endpoint
            .header("Authorization", "Bearer YOUR_API_KEY") // Replace with actual API key
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Whisper.cc API error: {}", error_text));
        }

        // Parse response
        let whisper_response: WhisperCCResponse = response.json().await?;
        
        // Convert to our format
        let segments = whisper_response.segments.into_iter().enumerate().map(|(index, segment)| {
            TranscriptSegment {
                id: format!("seg_{}", index),
                start: segment.start,
                end: segment.end,
                text: segment.text,
                confidence: segment.confidence,
            }
        }).collect();

        Ok(TranscriptionResult {
            segments,
            status: "completed".to_string(),
            error: None,
        })
    }

    /// Transcribe using OpenAI Whisper API (alternative option)
    pub async fn transcribe_with_openai_whisper(&self, file_path: &str, api_key: &str) -> Result<TranscriptionResult> {
        log::info!("Starting transcription with OpenAI Whisper for: {}", file_path);

        // Check if file exists
        if !Path::new(file_path).exists() {
            return Err(anyhow::anyhow!("File does not exist: {}", file_path));
        }

        // Read file
        let file_data = fs::read(file_path).await?;
        let file_name = Path::new(file_path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("audio.wav");

        // Detect MIME type
        let mime_type = mime_guess::from_path(file_path)
            .first_or_octet_stream()
            .to_string();

        // Create multipart form
        let form = multipart::Form::new()
            .part("file", multipart::Part::bytes(file_data)
                .file_name(file_name.to_string())
                .mime_str(&mime_type)?)
            .text("model", "whisper-1")
            .text("response_format", "verbose_json")
            .text("timestamp_granularities[]", "segment");

        // Make request to OpenAI API
        let response = self.client
            .post("https://api.openai.com/v1/audio/transcriptions")
            .header("Authorization", format!("Bearer {}", api_key))
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        // Parse response
        let openai_response: OpenAIWhisperResponse = response.json().await?;
        
        // Convert to our format
        let segments = openai_response.segments.into_iter().enumerate().map(|(index, segment)| {
            TranscriptSegment {
                id: format!("seg_{}", index),
                start: segment.start,
                end: segment.end,
                text: segment.text,
                confidence: None, // OpenAI doesn't provide confidence scores in this format
            }
        }).collect();

        Ok(TranscriptionResult {
            segments,
            status: "completed".to_string(),
            error: None,
        })
    }

    /// Generate mock transcription for testing/development
    pub async fn generate_mock_transcription(&self, file_path: &str, duration: f64) -> Result<TranscriptionResult> {
        log::info!("Generating mock transcription for: {} (duration: {}s)", file_path, duration);

        // Generate some mock segments
        let mut segments = Vec::new();
        let segment_duration = 10.0; // 10 seconds per segment
        let mut current_time = 0.0;

        let mock_texts = vec![
            "This is a sample transcription segment.",
            "The video contains important information.",
            "Here we discuss the main topic.",
            "Let me explain the key concepts.",
            "This concludes our presentation.",
        ];

        let mut segment_index = 0;
        while current_time < duration {
            let end_time = (current_time + segment_duration).min(duration);
            let text_index = segment_index % mock_texts.len();
            
            segments.push(TranscriptSegment {
                id: format!("mock_seg_{}", segment_index),
                start: current_time,
                end: end_time,
                text: mock_texts[text_index].to_string(),
                confidence: Some(0.95),
            });

            current_time = end_time;
            segment_index += 1;
        }

        Ok(TranscriptionResult {
            segments,
            status: "completed".to_string(),
            error: None,
        })
    }
}

// Response structures for different APIs
#[derive(Debug, Deserialize)]
struct WhisperCCResponse {
    segments: Vec<WhisperCCSegment>,
}

#[derive(Debug, Deserialize)]
struct WhisperCCSegment {
    start: f64,
    end: f64,
    text: String,
    confidence: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct OpenAIWhisperResponse {
    segments: Vec<OpenAISegment>,
}

#[derive(Debug, Deserialize)]
struct OpenAISegment {
    start: f64,
    end: f64,
    text: String,
}

// Tauri commands
#[tauri::command]
pub async fn transcribe_media_file(
    file_path: String,
    api_key: Option<String>,
    _use_mock: Option<bool>
) -> Result<TranscriptionResult, String> {
    let service = TranscriptionService::new();
    
    // Try OpenAI Whisper if API key is provided
    if let Some(key) = api_key {
        service.transcribe_with_openai_whisper(&file_path, &key).await
            .map_err(|e| {
                log::error!("OpenAI Whisper failed: {}", e);
                e.to_string()
            })
    } else {
        Err("No API key provided for transcription".to_string())
    }
}
