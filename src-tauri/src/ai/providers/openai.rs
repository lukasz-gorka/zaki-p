use async_trait::async_trait;
use eventsource_stream::Eventsource;
use futures::{Stream, StreamExt};
use reqwest::Client;
use std::sync::{Arc, Mutex};
use crate::ai::error::{AIError, AIResult};
use crate::ai::provider::AIProvider;
use crate::ai::types::{ChatCompletionRequest, ChatCompletionResponse, ChatCompletionChunk, ProviderCredentials, StreamChunk, extract_model_id};

pub struct OpenAIProvider {
    api_key: String,
    base_url: String,
    client: Client,
}

impl OpenAIProvider {
    /// Create provider from per-request credentials (new preferred method)
    pub fn from_credentials(credentials: ProviderCredentials) -> AIResult<Self> {
        crate::ai::url_validation::validate_provider_url(&credentials.base_url)?;

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| AIError::ProviderError(format!("Failed to create HTTP client: {}", e)))?;

        Ok(Self {
            api_key: credentials.api_key,
            base_url: credentials.base_url,
            client,
        })
    }

    fn get_base_url(&self) -> String {
        self.base_url.clone()
    }
}

#[async_trait]
impl AIProvider for OpenAIProvider {
    fn name(&self) -> &str {
        "openai"
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn supports_tools(&self) -> bool {
        true
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> AIResult<ChatCompletionResponse> {
        let base_url_string = self.get_base_url();
        let base_url = base_url_string.trim_end_matches('/');
        let url = format!("{}/chat/completions", base_url);

        // Filter messages - remove tool-related messages and fields for providers that don't support them
        let filtered_messages: Vec<serde_json::Value> = request.messages.iter()
            .filter_map(|msg| {
                let mut msg_json = serde_json::to_value(msg).unwrap_or(serde_json::json!({}));

                // Skip tool messages entirely
                if let Some(role) = msg_json.get("role").and_then(|r| r.as_str()) {
                    if role == "tool" {
                        return None;
                    }
                }

                // Remove tool-specific fields from other messages
                if let Some(obj) = msg_json.as_object_mut() {
                    obj.remove("tool_calls");
                    obj.remove("tool_call_id");
                }

                Some(msg_json)
            })
            .collect();

        // Build request body - only include non-None fields
        // Extract actual model ID from composite (e.g., "openai::gpt-4" -> "gpt-4")
        let actual_model = extract_model_id(&request.model);
        let mut body = serde_json::json!({
            "model": actual_model,
            "messages": filtered_messages,
            "stream": false,
        });

        // Add optional fields only if present
        if let Some(temp) = request.temperature {
            body["temperature"] = serde_json::json!(temp);
        }
        if let Some(max_tokens) = request.max_tokens {
            body["max_tokens"] = serde_json::json!(max_tokens);
        }
        if let Some(tools) = request.tools {
            if !tools.is_empty() {
                body["tools"] = serde_json::json!(tools);
            }
        }
        if let Some(tool_ids) = request.tool_ids {
            if !tool_ids.is_empty() {
                body["tool_ids"] = serde_json::json!(tool_ids);
            }
        }
        if let Some(response_format) = request.response_format {
            body["response_format"] = serde_json::json!(response_format);
        }
        if let Some(reasoning_effort) = request.reasoning_effort {
            // Only send reasoning_effort for o1 models and o3 models
            if actual_model.starts_with("o1") || actual_model.starts_with("o3") {
                body["reasoning_effort"] = serde_json::json!(reasoning_effort);
            }
        }
        if let Some(extra) = request.extra_params {
            for (k, v) in extra {
                body[k] = v;
            }
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::ProviderError(format!(
                "OpenAI API error ({}): {}",
                status, error_text
            )));
        }

        let response_text = response.text().await?;
        let completion: ChatCompletionResponse = serde_json::from_str(&response_text)?;

        Ok(completion)
    }

    async fn chat_completion_stream(
        &self,
        request: ChatCompletionRequest,
    ) -> AIResult<Box<dyn Stream<Item = AIResult<StreamChunk>> + Send + Unpin>> {
        let base_url_string = self.get_base_url();
        let base_url = base_url_string.trim_end_matches('/');
        let url = format!("{}/chat/completions", base_url);

        // Filter messages - remove tool-related messages and fields for providers that don't support them
        let filtered_messages: Vec<serde_json::Value> = request.messages.iter()
            .filter_map(|msg| {
                let mut msg_json = serde_json::to_value(msg).unwrap_or(serde_json::json!({}));

                // Skip tool messages entirely
                if let Some(role) = msg_json.get("role").and_then(|r| r.as_str()) {
                    if role == "tool" {
                        return None;
                    }
                }

                // Remove tool-specific fields from other messages
                if let Some(obj) = msg_json.as_object_mut() {
                    obj.remove("tool_calls");
                    obj.remove("tool_call_id");
                }

                Some(msg_json)
            })
            .collect();

        // Build request body - only include non-None fields
        let actual_model = extract_model_id(&request.model);
        let mut body = serde_json::json!({
            "model": actual_model,
            "messages": filtered_messages,
            "stream": true,
        });

        // Add optional fields only if present
        if let Some(temp) = request.temperature {
            body["temperature"] = serde_json::json!(temp);
        }
        if let Some(max_tokens) = request.max_tokens {
            body["max_tokens"] = serde_json::json!(max_tokens);
        }
        if let Some(tools) = request.tools {
            if !tools.is_empty() {
                body["tools"] = serde_json::json!(tools);
            }
        }
        if let Some(tool_ids) = request.tool_ids {
            if !tool_ids.is_empty() {
                body["tool_ids"] = serde_json::json!(tool_ids);
            }
        }
        if let Some(reasoning_effort) = request.reasoning_effort {
            // Only send reasoning_effort for o1 models and o3 models
            if actual_model.starts_with("o1") || actual_model.starts_with("o3") {
                body["reasoning_effort"] = serde_json::json!(reasoning_effort);
            }
        }
        if let Some(extra) = request.extra_params {
            for (k, v) in extra {
                body[k] = v;
            }
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::ProviderError(format!(
                "OpenAI API error ({}): {}",
                status, error_text
            )));
        }

        // Create SSE stream with accumulated response logging
        let accumulated = Arc::new(Mutex::new(String::new()));
        let stream = response
            .bytes_stream()
            .eventsource()
            .map(move |event| {
                match event {
                    Ok(event) => {
                        if event.data == "[DONE]" {
                            return Ok(StreamChunk {
                                content: String::new(),
                                citations: None,
                                search_results: None,
                                usage: None,
                            });
                        }

                        // Parse chunk
                        match serde_json::from_str::<ChatCompletionChunk>(&event.data) {
                            Ok(chunk) => {
                                // Extract content from first choice delta
                                let content = chunk.choices.first()
                                    .and_then(|choice| choice.delta.content.clone())
                                    .unwrap_or_default();

                                if !content.is_empty() {
                                    if let Ok(mut acc) = accumulated.lock() {
                                        acc.push_str(&content);
                                    }
                                }

                                // Create StreamChunk with content and metadata
                                // Citations, search_results, and usage are typically only in final chunk
                                Ok(StreamChunk {
                                    content,
                                    citations: chunk.citations.clone(),
                                    search_results: chunk.search_results.clone(),
                                    usage: chunk.usage.clone(),
                                })
                            }
                            Err(e) => {
                                Err(AIError::ProviderError(format!("Failed to parse chunk: {}", e)))
                            }
                        }
                    }
                    Err(e) => {
                        Err(AIError::ProviderError(format!("Stream error: {}", e)))
                    }
                }
            });

        Ok(Box::new(Box::pin(stream)))
    }
}

// Additional OpenAI-specific methods (not part of the AIProvider trait)
impl OpenAIProvider {
    /// Transcribe audio using Whisper
    pub async fn transcribe_audio(
        &self,
        audio_data: Vec<u8>,
        request: crate::ai::types::AudioTranscriptionRequest,
        audio_format: Option<String>,
    ) -> AIResult<crate::ai::types::AudioTranscriptionResponse> {
        let base_url_string = self.get_base_url();
        let base_url = base_url_string.trim_end_matches('/');
        let url = format!("{}/audio/transcriptions", base_url);

        let fmt = audio_format.as_deref().unwrap_or("wav");
        let (file_name, mime_type) = match fmt {
            "flac" => ("audio.flac", "audio/flac"),
            _ => ("audio.wav", "audio/wav"),
        };

        let part = reqwest::multipart::Part::bytes(audio_data)
            .file_name(file_name.to_string())
            .mime_str(mime_type)
            .map_err(|e| AIError::ProviderError(format!("Failed to set MIME type: {}", e)))?;

        let actual_model = extract_model_id(&request.model);
        let mut form = reqwest::multipart::Form::new()
            .part("file", part)
            .text("model", actual_model.to_string());

        // Add optional fields
        if let Some(language) = request.language {
            form = form.text("language", language);
        }
        if let Some(prompt) = request.prompt {
            form = form.text("prompt", prompt);
        }
        if let Some(response_format) = request.response_format {
            form = form.text("response_format", response_format);
        } else {
            // Default to JSON format for structured response
            form = form.text("response_format", "json");
        }
        if let Some(temperature) = request.temperature {
            form = form.text("temperature", temperature.to_string());
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::ProviderError(format!(
                "OpenAI transcription error ({}): {}",
                status, error_text
            )));
        }

        let transcription: crate::ai::types::AudioTranscriptionResponse = response.json().await?;

        Ok(transcription)
    }

    /// Generate speech from text using TTS
    pub async fn text_to_speech(
        &self,
        request: crate::ai::types::TextToSpeechRequest,
    ) -> AIResult<Vec<u8>> {
        let base_url_string = self.get_base_url();
        let base_url = base_url_string.trim_end_matches('/');
        let url = format!("{}/audio/speech", base_url);

        // Build request body
        let actual_model = extract_model_id(&request.model);
        let mut body = serde_json::json!({
            "model": actual_model,
            "input": request.input,
            "voice": request.voice,
        });

        if let Some(speed) = request.speed {
            body["speed"] = serde_json::json!(speed);
        }
        if let Some(response_format) = request.response_format {
            body["response_format"] = serde_json::json!(response_format);
        }

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::ProviderError(format!(
                "OpenAI TTS error ({}): {}",
                status, error_text
            )));
        }

        let bytes = response.bytes().await?;

        Ok(bytes.to_vec())
    }
}
