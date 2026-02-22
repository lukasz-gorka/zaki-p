use futures::Stream;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::ai::error::{AIError, AIResult};
use crate::ai::provider::AIProvider;
use crate::ai::types::{
    ChatCompletionRequest, ChatCompletionResponse, ProviderCredentials, Tool, StreamChunk,
    AudioTranscriptionRequest, AudioTranscriptionResponse,
    TextToSpeechRequest,
};
use crate::ai::providers::OpenAIProvider;

/// Main AI proxy orchestrator
/// Stateless - credentials are passed per-request
pub struct AIProxy {
    mcp_tools: Arc<RwLock<Vec<Tool>>>,
}

impl AIProxy {
    pub fn new() -> Self {
        Self {
            mcp_tools: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Get all MCP tools
    pub async fn get_mcp_tools(&self) -> Vec<Tool> {
        let mcp_tools = self.mcp_tools.read().await;
        mcp_tools.clone()
    }

    /// Main chat completion method - credentials passed per-request
    pub async fn chat_completion(
        &self,
        mut request: ChatCompletionRequest,
        credentials: ProviderCredentials,
    ) -> AIResult<ChatCompletionResponse> {
        // Create provider from credentials
        let provider = OpenAIProvider::from_credentials(credentials)?;

        // Add MCP tools to request if available
        let mcp_tools = self.get_mcp_tools().await;
        if !mcp_tools.is_empty() && provider.supports_tools() {
            request.tools = Some(mcp_tools);
        }

        // Execute completion
        provider.chat_completion(request).await
    }

    /// Chat completion with streaming - credentials passed per-request
    pub async fn chat_completion_stream(
        &self,
        mut request: ChatCompletionRequest,
        credentials: ProviderCredentials,
    ) -> AIResult<Box<dyn Stream<Item = AIResult<StreamChunk>> + Send + Unpin>> {
        // Create provider from credentials
        let provider = OpenAIProvider::from_credentials(credentials)?;

        // Check if provider supports streaming
        if !provider.supports_streaming() {
            return Err(AIError::ProviderError("Provider does not support streaming".to_string()));
        }

        // Add MCP tools to request if available
        let mcp_tools = self.get_mcp_tools().await;
        if !mcp_tools.is_empty() && provider.supports_tools() {
            request.tools = Some(mcp_tools);
        }

        // Execute streaming completion
        provider.chat_completion_stream(request).await
    }

    /// Transcribe audio - credentials passed per-request
    pub async fn transcribe_audio(
        &self,
        audio_data: Vec<u8>,
        request: AudioTranscriptionRequest,
        credentials: ProviderCredentials,
        audio_format: Option<String>,
    ) -> AIResult<AudioTranscriptionResponse> {
        let provider = OpenAIProvider::from_credentials(credentials)?;
        provider.transcribe_audio(audio_data, request, audio_format).await
    }

    /// Generate speech from text - credentials passed per-request
    pub async fn text_to_speech(
        &self,
        request: TextToSpeechRequest,
        credentials: ProviderCredentials,
    ) -> AIResult<Vec<u8>> {
        let provider = OpenAIProvider::from_credentials(credentials)?;
        provider.text_to_speech(request).await
    }
}

impl Default for AIProxy {
    fn default() -> Self {
        Self::new()
    }
}
