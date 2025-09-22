fn extract_json_from_response(response: &str) -> String {
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

fn main() {
    let test_response = r#"```json
{"thinking_steps": [{"id": "step_1", "title": "Analyzing User Intent", "description": "Understanding what the user wants to accomplish", "status": "completed", "details": "User wants to remove the section of the video containing loud audio.", "timestamp": "2024-01-01T00:00:00Z", "duration": 150}], "response_content": "Please specify the time range of the loud part you want to remove.  I need the start and end times to accurately cut it out.", "edit_operations": [], "has_video_preview": false, "actions": []}
```"#;
    
    let extracted = extract_json_from_response(test_response);
    println!("Extracted JSON: {}", extracted);
    println!("Length: {}", extracted.len());
}
