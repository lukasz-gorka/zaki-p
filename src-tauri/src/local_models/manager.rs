use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use crate::local_models::catalog::{find_catalog_entry, get_model_catalog, LocalModelCatalogEntry, LocalModelCategory};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelStatus {
    pub id: String,
    pub name: String,
    pub category: LocalModelCategory,
    pub description: String,
    pub size_mb: u64,
    pub downloaded: bool,
    pub downloading: bool,
    pub download_progress: f64,
    pub speed_rating: u8,
    pub accuracy_rating: u8,
    pub language_support: String,
}

pub struct LocalModelManager {
    models_dir: PathBuf,
    downloading: Arc<RwLock<std::collections::HashSet<String>>>,
    cancel_flags: Arc<RwLock<std::collections::HashMap<String, Arc<AtomicBool>>>>,
}

impl LocalModelManager {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let models_dir = app_data_dir.join("local-models");
        if !models_dir.exists() {
            let _ = std::fs::create_dir_all(&models_dir);
        }
        Self {
            models_dir,
            downloading: Arc::new(RwLock::new(std::collections::HashSet::new())),
            cancel_flags: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub fn model_path(&self, entry: &LocalModelCatalogEntry) -> PathBuf {
        self.models_dir.join(&entry.filename)
    }

    pub async fn list_models(&self) -> Vec<LocalModelStatus> {
        let downloading = self.downloading.read().await;
        get_model_catalog()
            .into_iter()
            .map(|entry| {
                let downloaded = self.model_path(&entry).exists();
                let is_downloading = downloading.contains(&entry.id);
                LocalModelStatus {
                    id: entry.id,
                    name: entry.name,
                    category: entry.category,
                    description: entry.description,
                    size_mb: entry.size_mb,
                    downloaded,
                    downloading: is_downloading,
                    download_progress: if is_downloading { 0.0 } else if downloaded { 100.0 } else { 0.0 },
                    speed_rating: entry.speed_rating,
                    accuracy_rating: entry.accuracy_rating,
                    language_support: entry.language_support,
                }
            })
            .collect()
    }

    pub async fn download_model(
        &self,
        model_id: String,
        progress_callback: impl Fn(f64) + Send + 'static,
    ) -> Result<(), String> {
        let entry = find_catalog_entry(&model_id)
            .ok_or_else(|| format!("Model not found in catalog: {}", model_id))?;

        // Mark as downloading and set up cancel flag
        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut downloading = self.downloading.write().await;
            if downloading.contains(&model_id) {
                return Err(format!("Model {} is already being downloaded", model_id));
            }
            downloading.insert(model_id.clone());
        }
        {
            let mut flags = self.cancel_flags.write().await;
            flags.insert(model_id.clone(), Arc::clone(&cancel_flag));
        }

        let dest_path = self.model_path(&entry);
        let downloading = Arc::clone(&self.downloading);
        let cancel_flags = Arc::clone(&self.cancel_flags);
        let model_id_clone = model_id.clone();

        // Download in a separate task
        let result = Self::download_file(&entry.download_url, &dest_path, progress_callback, cancel_flag).await;

        // Clean up temp file on cancellation
        if result.is_err() {
            let temp_path = dest_path.with_extension("downloading");
            let _ = tokio::fs::remove_file(&temp_path).await;
        }

        // Remove from downloading set and cancel flags
        {
            let mut dl = downloading.write().await;
            dl.remove(&model_id_clone);
        }
        {
            let mut flags = cancel_flags.write().await;
            flags.remove(&model_id_clone);
        }

        result
    }

    pub async fn cancel_download(&self, model_id: &str) -> Result<(), String> {
        let flags = self.cancel_flags.read().await;
        if let Some(flag) = flags.get(model_id) {
            flag.store(true, Ordering::Relaxed);
            Ok(())
        } else {
            Err(format!("No active download for model: {}", model_id))
        }
    }

    async fn download_file(
        url: &str,
        dest: &PathBuf,
        progress_callback: impl Fn(f64) + Send + 'static,
        cancel_flag: Arc<AtomicBool>,
    ) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3600))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Failed to start download: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Download failed with status: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        // Write to a temp file first, then rename
        let temp_path = dest.with_extension("downloading");

        let mut file = tokio::fs::File::create(&temp_path)
            .await
            .map_err(|e| format!("Failed to create file: {}", e))?;

        let mut stream = response.bytes_stream();
        use futures::StreamExt;
        use tokio::io::AsyncWriteExt;

        while let Some(chunk) = stream.next().await {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err("Download cancelled".to_string());
            }

            let chunk = chunk.map_err(|e| format!("Download error: {}", e))?;
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("Failed to write: {}", e))?;

            downloaded += chunk.len() as u64;
            if total_size > 0 {
                let progress = (downloaded as f64 / total_size as f64) * 100.0;
                progress_callback(progress);
            }
        }

        file.flush().await.map_err(|e| format!("Failed to flush: {}", e))?;
        drop(file);

        // Rename temp file to final destination
        tokio::fs::rename(&temp_path, dest)
            .await
            .map_err(|e| format!("Failed to finalize download: {}", e))?;

        progress_callback(100.0);
        Ok(())
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        let entry = find_catalog_entry(model_id)
            .ok_or_else(|| format!("Model not found in catalog: {}", model_id))?;

        let path = self.model_path(&entry);
        if path.exists() {
            tokio::fs::remove_file(&path)
                .await
                .map_err(|e| format!("Failed to delete model: {}", e))?;
        }

        Ok(())
    }

    pub fn get_model_file_path(&self, model_id: &str) -> Option<PathBuf> {
        let entry = find_catalog_entry(model_id)?;
        let path = self.model_path(&entry);
        if path.exists() {
            Some(path)
        } else {
            None
        }
    }
}
