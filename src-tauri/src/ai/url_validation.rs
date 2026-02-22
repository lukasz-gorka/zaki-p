use crate::ai::error::{AIError, AIResult};
use url::Url;

pub fn validate_provider_url(base_url: &str) -> AIResult<()> {
    let parsed = Url::parse(base_url)
        .map_err(|e| AIError::ProviderError(format!("Invalid provider URL: {}", e)))?;

    match parsed.scheme() {
        "http" | "https" => {}
        scheme => {
            return Err(AIError::ProviderError(format!(
                "Invalid URL scheme '{}': only http and https are allowed",
                scheme
            )));
        }
    }

    if parsed.host().is_none() {
        return Err(AIError::ProviderError(
            "Provider URL must have a valid host".to_string(),
        ));
    }

    Ok(())
}
