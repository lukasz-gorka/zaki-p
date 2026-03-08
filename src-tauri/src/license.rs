use chrono::{DateTime, Duration, Utc};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use crate::secure_storage::SecureStorage;

const HMAC_KEY: &[u8; 32] = include_bytes!("../license_hmac_key.bin");

#[derive(Serialize, Deserialize, Clone)]
pub struct LicenseValidationRequest {
    pub key: String,
    pub device_fingerprint: String,
    pub device_name: String,
    pub platform: String,
    pub app_version: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LicenseValidationResponse {
    pub valid: bool,
    pub plan: Option<String>,
    pub expires_at: Option<String>,
    pub features: Option<Vec<String>>,
    pub cache_until: Option<String>,
    pub signature: Option<String>,
    pub error: Option<String>,
    pub message: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct CachedLicense {
    pub plan: String,
    pub features: Vec<String>,
    pub expires_at: Option<String>,
    pub cache_until: String,
    pub validated_at: String,
    pub key_prefix: String,
}

fn generate_device_fingerprint() -> String {
    let raw = format!(
        "{}-{}-{}-{}",
        whoami::devicename(),
        whoami::username(),
        whoami::platform(),
        whoami::arch(),
    );
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn verify_hmac_signature(response_body: &str, signature: &str) -> bool {
    type HmacSha256 = Hmac<Sha256>;
    let Ok(mut mac) = HmacSha256::new_from_slice(HMAC_KEY) else {
        return false;
    };
    mac.update(response_body.as_bytes());
    let expected = format!("{:x}", mac.finalize().into_bytes());
    expected == signature
}

fn is_cache_valid(cached: &CachedLicense) -> bool {
    let Ok(cache_until) = DateTime::parse_from_rfc3339(&cached.cache_until) else {
        return false;
    };
    let deadline = cache_until.with_timezone(&Utc) + Duration::days(3);
    Utc::now() < deadline
}

#[tauri::command]
pub async fn license_validate(
    storage: State<'_, SecureStorage>,
    key: String,
    backend_url: String,
) -> Result<LicenseValidationResponse, String> {
    let fingerprint = generate_device_fingerprint();
    let request = LicenseValidationRequest {
        key: key.clone(),
        device_fingerprint: fingerprint,
        device_name: whoami::devicename(),
        platform: whoami::platform().to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };

    let validate_url = format!("{}/validate", backend_url);
    crate::commands::validate_url(&validate_url)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(&validate_url)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = resp.text().await.map_err(|e| e.to_string())?;
    let response: LicenseValidationResponse =
        serde_json::from_str(&body).map_err(|e| e.to_string())?;

    if response.valid {
        if let Some(ref sig) = response.signature {
            // Strip signature field from body before HMAC verification
            let mut body_value: serde_json::Value =
                serde_json::from_str(&body).map_err(|e| e.to_string())?;
            body_value.as_object_mut().map(|o| o.remove("signature"));
            let body_without_sig = serde_json::to_string(&body_value).map_err(|e| e.to_string())?;
            if !verify_hmac_signature(&body_without_sig, sig) {
                return Err("Invalid response signature".to_string());
            }
        }

        let cached = CachedLicense {
            plan: response.plan.clone().unwrap_or_default(),
            features: response.features.clone().unwrap_or_default(),
            expires_at: response.expires_at.clone(),
            cache_until: response
                .cache_until
                .clone()
                .unwrap_or_else(|| Utc::now().to_rfc3339()),
            validated_at: Utc::now().to_rfc3339(),
            key_prefix: key.chars().take(8).collect(),
        };

        let cached_json = serde_json::to_string(&cached).map_err(|e| e.to_string())?;
        storage
            .set_credential("license_cache", &cached_json)
            .map_err(|e| e.to_string())?;
        storage
            .set_credential("license_key", &key)
            .map_err(|e| e.to_string())?;
    }

    Ok(response)
}

#[tauri::command]
pub fn license_get_cached(
    storage: State<'_, SecureStorage>,
) -> Result<Option<CachedLicense>, String> {
    match storage.get_credential("license_cache") {
        Ok(json) => {
            let cached: CachedLicense =
                serde_json::from_str(&json).map_err(|e| e.to_string())?;
            if is_cache_valid(&cached) {
                Ok(Some(cached))
            } else {
                Ok(None)
            }
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn license_get_stored_key(
    storage: State<'_, SecureStorage>,
) -> Result<Option<String>, String> {
    match storage.get_credential("license_key") {
        Ok(key) => Ok(Some(key)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn license_deactivate(
    storage: State<'_, SecureStorage>,
    backend_url: String,
) -> Result<(), String> {
    let key = storage.get_credential("license_key").ok();
    let fingerprint = generate_device_fingerprint();

    let _ = storage.delete_credential("license_cache");
    let _ = storage.delete_credential("license_key");

    if let Some(key) = key {
        let deactivate_url = format!("{}/deactivate", backend_url);
        if crate::commands::validate_url(&deactivate_url).is_ok() {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .map_err(|e| e.to_string())?;
            let _ = client
                .post(&deactivate_url)
                .json(&serde_json::json!({
                    "key": key,
                    "device_fingerprint": fingerprint,
                }))
                .send()
                .await;
        }
    }

    Ok(())
}
