use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

const STORAGE_FILE: &str = "secure_credentials.enc";
const FORMAT_VERSION_V1: u8 = 0x01;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;

#[derive(Debug, thiserror::Error)]
pub enum SecureStorageError {
    #[error("Encryption error: {0}")]
    Encryption(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Credential not found for key: {0}")]
    NotFound(String),
}

impl Serialize for SecureStorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub struct SecureStorage {
    storage_path: PathBuf,
    cache: Mutex<HashMap<String, String>>,
    encryption_key: Mutex<Option<[u8; 32]>>,
    salt: Mutex<Option<[u8; SALT_LEN]>>,
    machine_id: String,
}

impl SecureStorage {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let machine_id = whoami::devicename();

        Self {
            storage_path: app_data_dir.join(STORAGE_FILE),
            cache: Mutex::new(HashMap::new()),
            encryption_key: Mutex::new(None),
            salt: Mutex::new(None),
            machine_id,
        }
    }

    fn derive_key_argon2(machine_id: &str, salt: &[u8; SALT_LEN]) -> Result<[u8; 32], SecureStorageError> {
        let mut output_key = [0u8; 32];
        let params = argon2::Params::new(19 * 1024, 2, 1, Some(32))
            .map_err(|e| SecureStorageError::Encryption(format!("Argon2 params error: {}", e)))?;
        let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
        argon2
            .hash_password_into(machine_id.as_bytes(), salt, &mut output_key)
            .map_err(|e| SecureStorageError::Encryption(format!("Argon2 derivation error: {}", e)))?;
        Ok(output_key)
    }

    fn get_or_derive_key(&self, salt: &[u8; SALT_LEN]) -> Result<[u8; 32], SecureStorageError> {
        {
            let cached = self.encryption_key.lock()
                .map_err(|e| SecureStorageError::Encryption(format!("Lock error: {}", e)))?;
            if let Some(key) = *cached {
                return Ok(key);
            }
        }

        let key = Self::derive_key_argon2(&self.machine_id, salt)?;

        {
            let mut cached = self.encryption_key.lock()
                .map_err(|e| SecureStorageError::Encryption(format!("Lock error: {}", e)))?;
            *cached = Some(key);
        }
        {
            let mut cached_salt = self.salt.lock()
                .map_err(|e| SecureStorageError::Encryption(format!("Lock error: {}", e)))?;
            *cached_salt = Some(*salt);
        }

        Ok(key)
    }

    fn get_or_generate_salt(&self) -> [u8; SALT_LEN] {
        if let Ok(cached) = self.salt.lock() {
            if let Some(salt) = *cached {
                return salt;
            }
        }
        let mut salt = [0u8; SALT_LEN];
        use aes_gcm::aead::rand_core::RngCore;
        OsRng.fill_bytes(&mut salt);
        if let Ok(mut cached) = self.salt.lock() {
            *cached = Some(salt);
        }
        salt
    }

    fn encrypt_data(&self, plaintext: &[u8]) -> Result<Vec<u8>, SecureStorageError> {
        let salt = self.get_or_generate_salt();
        let key = self.get_or_derive_key(&salt)?;

        let cipher = Aes256Gcm::new((&key).into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|e| SecureStorageError::Encryption(format!("Encryption failed: {}", e)))?;

        let mut encrypted = Vec::with_capacity(1 + SALT_LEN + NONCE_LEN + ciphertext.len());
        encrypted.push(FORMAT_VERSION_V1);
        encrypted.extend_from_slice(&salt);
        encrypted.extend_from_slice(&nonce);
        encrypted.extend_from_slice(&ciphertext);

        Ok(encrypted)
    }

    fn decrypt_data(&self, encrypted: &[u8]) -> Result<Vec<u8>, SecureStorageError> {
        if encrypted.is_empty() {
            return Ok(Vec::new());
        }

        // Legacy format (no version byte): [12-byte nonce][ciphertext]
        if encrypted[0] != FORMAT_VERSION_V1 {
            return self.decrypt_data_legacy(encrypted);
        }

        let min_len = 1 + SALT_LEN + NONCE_LEN + 1;
        if encrypted.len() < min_len {
            return Err(SecureStorageError::Encryption(
                "Encrypted data too short".to_string(),
            ));
        }

        let salt: [u8; SALT_LEN] = encrypted[1..1 + SALT_LEN]
            .try_into()
            .map_err(|_| SecureStorageError::Encryption("Invalid salt".to_string()))?;
        let nonce_bytes = &encrypted[1 + SALT_LEN..1 + SALT_LEN + NONCE_LEN];
        let ciphertext = &encrypted[1 + SALT_LEN + NONCE_LEN..];

        let key = self.get_or_derive_key(&salt)?;
        let cipher = Aes256Gcm::new((&key).into());
        let nonce = Nonce::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| SecureStorageError::Encryption(format!("Decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    fn decrypt_data_legacy(&self, encrypted: &[u8]) -> Result<Vec<u8>, SecureStorageError> {
        use sha2::{Digest, Sha256};

        if encrypted.len() < 12 {
            return Ok(Vec::new());
        }

        let mut hasher = Sha256::new();
        hasher.update(self.machine_id.as_bytes());
        hasher.update(b"com.assistant.app.secret");
        let hash = hasher.finalize();
        let mut legacy_key = [0u8; 32];
        legacy_key.copy_from_slice(&hash[..]);

        let (nonce_bytes, ciphertext) = encrypted.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);
        let cipher = Aes256Gcm::new((&legacy_key).into());

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| SecureStorageError::Encryption(format!("Legacy decryption failed: {}", e)))?;

        Ok(plaintext)
    }

    fn load_credentials(&self) -> Result<HashMap<String, String>, SecureStorageError> {
        if !self.storage_path.exists() {
            return Ok(HashMap::new());
        }

        let encrypted_data = fs::read(&self.storage_path)?;
        if encrypted_data.is_empty() {
            return Ok(HashMap::new());
        }

        let decrypted = self.decrypt_data(&encrypted_data)?;
        let credentials: HashMap<String, String> = serde_json::from_slice(&decrypted)?;

        // If legacy format was used, re-encrypt with v1 format
        if !encrypted_data.is_empty() && encrypted_data[0] != FORMAT_VERSION_V1 {
            if let Ok(()) = self.save_credentials(&credentials) {
                eprintln!("[SecureStorage] Migrated credentials to Argon2id format");
            }
        }

        Ok(credentials)
    }

    fn save_credentials(&self, credentials: &HashMap<String, String>) -> Result<(), SecureStorageError> {
        let json_data = serde_json::to_vec(credentials)?;
        let encrypted_data = self.encrypt_data(&json_data)?;

        if let Some(parent) = self.storage_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&self.storage_path, encrypted_data)?;
        Ok(())
    }

    pub fn set_credential(&self, key: &str, value: &str) -> Result<(), SecureStorageError> {
        let mut credentials = self.load_credentials()?;
        credentials.insert(key.to_string(), value.to_string());
        self.save_credentials(&credentials)?;

        if let Ok(mut cache) = self.cache.lock() {
            cache.insert(key.to_string(), value.to_string());
        }

        Ok(())
    }

    pub fn get_credential(&self, key: &str) -> Result<String, SecureStorageError> {
        if let Ok(cache) = self.cache.lock() {
            if let Some(value) = cache.get(key) {
                return Ok(value.clone());
            }
        }

        let credentials = self.load_credentials()?;
        match credentials.get(key) {
            Some(value) => {
                if let Ok(mut cache) = self.cache.lock() {
                    cache.insert(key.to_string(), value.clone());
                }
                Ok(value.clone())
            }
            None => Err(SecureStorageError::NotFound(key.to_string())),
        }
    }

    pub fn delete_credential(&self, key: &str) -> Result<(), SecureStorageError> {
        let mut credentials = self.load_credentials()?;
        credentials.remove(key);
        self.save_credentials(&credentials)?;

        if let Ok(mut cache) = self.cache.lock() {
            cache.remove(key);
        }

        Ok(())
    }

    pub fn has_credential(&self, key: &str) -> bool {
        if let Ok(cache) = self.cache.lock() {
            if cache.contains_key(key) {
                return true;
            }
        }

        if let Ok(credentials) = self.load_credentials() {
            credentials.contains_key(key)
        } else {
            false
        }
    }
}

// Tauri Commands

#[tauri::command]
pub fn secure_storage_set(
    storage: State<'_, SecureStorage>,
    key: String,
    value: String,
) -> Result<(), SecureStorageError> {
    storage.set_credential(&key, &value)
}

#[tauri::command]
pub fn secure_storage_get(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<String, SecureStorageError> {
    storage.get_credential(&key)
}

#[tauri::command]
pub fn secure_storage_delete(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<(), SecureStorageError> {
    storage.delete_credential(&key)
}

#[tauri::command]
pub fn secure_storage_has(
    storage: State<'_, SecureStorage>,
    key: String,
) -> Result<bool, SecureStorageError> {
    Ok(storage.has_credential(&key))
}

#[tauri::command]
pub fn secure_storage_set_provider_keys(
    storage: State<'_, SecureStorage>,
    provider_keys: HashMap<String, String>,
) -> Result<(), SecureStorageError> {
    for (provider_uuid, api_key) in &provider_keys {
        let key = format!("provider_{}", provider_uuid);
        storage.set_credential(&key, api_key)?;
    }
    Ok(())
}

#[tauri::command]
pub fn secure_storage_get_provider_keys(
    storage: State<'_, SecureStorage>,
    provider_uuids: Vec<String>,
) -> Result<HashMap<String, String>, SecureStorageError> {
    let mut result = HashMap::new();

    for uuid in &provider_uuids {
        let key = format!("provider_{}", uuid);
        if let Ok(api_key) = storage.get_credential(&key) {
            result.insert(uuid.clone(), api_key);
        }
    }

    Ok(result)
}
