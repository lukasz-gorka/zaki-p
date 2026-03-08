use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum LocalModelCategory {
    SpeechToText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelCatalogEntry {
    pub id: String,
    pub name: String,
    pub category: LocalModelCategory,
    pub description: String,
    pub size_mb: u64,
    pub download_url: String,
    pub filename: String,
    pub speed_rating: u8,
    pub accuracy_rating: u8,
    pub language_support: String,
}

struct CatalogDef {
    id: &'static str,
    name: &'static str,
    category: LocalModelCategory,
    description: &'static str,
    size_mb: u64,
    download_url: &'static str,
    filename: &'static str,
    speed_rating: u8,
    accuracy_rating: u8,
    language_support: &'static str,
}

const CATALOG_DEFS: &[CatalogDef] = &[
    CatalogDef {
        id: "whisper-tiny",
        name: "Whisper Tiny",
        category: LocalModelCategory::SpeechToText,
        description: "Fastest, lowest accuracy (~75 MB). Good for quick tests.",
        size_mb: 75,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        filename: "ggml-tiny.bin",
        speed_rating: 5,
        accuracy_rating: 2,
        language_support: "multilingual",
    },
    CatalogDef {
        id: "whisper-base",
        name: "Whisper Base",
        category: LocalModelCategory::SpeechToText,
        description: "Fast with decent accuracy (~142 MB).",
        size_mb: 142,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
        filename: "ggml-base.bin",
        speed_rating: 4,
        accuracy_rating: 3,
        language_support: "multilingual",
    },
    CatalogDef {
        id: "whisper-small",
        name: "Whisper Small",
        category: LocalModelCategory::SpeechToText,
        description: "Good balance of speed and accuracy (~466 MB).",
        size_mb: 466,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
        filename: "ggml-small.bin",
        speed_rating: 3,
        accuracy_rating: 4,
        language_support: "multilingual",
    },
    CatalogDef {
        id: "whisper-medium",
        name: "Whisper Medium",
        category: LocalModelCategory::SpeechToText,
        description: "High accuracy, slower (~1.5 GB). Recommended for most users.",
        size_mb: 1500,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
        filename: "ggml-medium.bin",
        speed_rating: 2,
        accuracy_rating: 4,
        language_support: "multilingual",
    },
    CatalogDef {
        id: "whisper-large-v3-turbo",
        name: "Whisper Large V3 Turbo",
        category: LocalModelCategory::SpeechToText,
        description: "Best accuracy with Turbo speed (~1.6 GB). Best quality option.",
        size_mb: 1600,
        download_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        filename: "ggml-large-v3-turbo.bin",
        speed_rating: 2,
        accuracy_rating: 5,
        language_support: "multilingual",
    },
];

pub fn get_model_catalog() -> Vec<LocalModelCatalogEntry> {
    CATALOG_DEFS
        .iter()
        .map(|def| LocalModelCatalogEntry {
            id: def.id.to_string(),
            name: def.name.to_string(),
            category: def.category.clone(),
            description: def.description.to_string(),
            size_mb: def.size_mb,
            download_url: def.download_url.to_string(),
            filename: def.filename.to_string(),
            speed_rating: def.speed_rating,
            accuracy_rating: def.accuracy_rating,
            language_support: def.language_support.to_string(),
        })
        .collect()
}

pub fn find_catalog_entry(model_id: &str) -> Option<LocalModelCatalogEntry> {
    get_model_catalog().into_iter().find(|e| e.id == model_id)
}
