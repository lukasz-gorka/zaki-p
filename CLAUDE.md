# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**zakip-voice** — a Tauri 2.0 desktop app for voice transcription with AI enhancement. Records audio via system microphone, transcribes it through OpenAI-compatible APIs, optionally enhances the text with an LLM, and copies the result to clipboard with optional auto-paste.

## Development Commands

```bash
pnpm install              # Install frontend dependencies
pnpm tauri dev            # Full app dev with hot-reload (frontend + Rust backend)
pnpm dev                  # Frontend-only Vite dev server (port 1421)
pnpm build                # Build frontend (tsc + vite build)
pnpm tauri build          # Production build (app bundles: dmg, msi, appimage, deb, rpm)

# Code quality
pnpm lint                 # ESLint on src/
pnpm lint:fix             # ESLint with auto-fix
pnpm format               # Prettier write
pnpm format:check         # Prettier check
pnpm typecheck            # TypeScript check (tsc --noEmit)
pnpm quality              # All three: format:check + lint + typecheck
pnpm test                 # Run Vitest tests

# Rust backend
cd src-tauri && cargo build    # Build Rust backend
cd src-tauri && cargo test     # Run Rust tests
```

## Architecture

### Two-layer architecture: React frontend + Rust backend

**Frontend** (`src/`) — React 19 + TypeScript + Vite + Tailwind CSS 4 + Radix UI (shadcn/ui pattern). Tests via Vitest.

**Backend** (`src-tauri/`) — Rust with Tauri 2.0. Handles audio recording via `cpal`, secure credential storage (AES-GCM encrypted files), keyboard simulation (`enigo`), and system tray.

### Frontend Key Modules

- **`G` singleton** (`src/appInitializer/module/G.ts`) — Central service locator. Holds `G.ai`, `G.voice`, `G.rustProxy`, `G.view`, `G.events`, `G.globalShortcuts`. Initialized during app boot in `AppInitializer.ts`.
- **Global state** — Zustand store (`src/appInitializer/store/index.ts`). Sections: `provider`, `view`, `globalShortcuts`, `voice`. Access via `GlobalStore.getStoreData(key)` or `GlobalStore.updateState(key, data)`.
- **`RustProxyModule`** (`src/rustProxy/RustProxyModule.ts`) — TypeScript wrapper around `invoke()` calls to Rust backend. Terminal, clipboard, and abort operations go through here.
- **`AIService` / `AIServiceBackend`** (`src/integrations/ai/`) — AI abstraction layer. `AIServiceBackend` resolves model→provider→credentials from global state, then calls `AgentService` (Vercel AI SDK). Supports text completion, image generation, audio transcription.
- **`AgentService`** (`src/integrations/ai/sdk/AgentService.ts`) — AI operations via Vercel AI SDK (`ai` package). Replaces the old Rust-based AI proxy. Handles completions, transcription, and image generation directly from the frontend.
- **`VoiceModule`** (`src/voice/VoiceModule.ts`) — Core voice workflow: start recording → stop → transcribe → enhance with AI → copy to clipboard → auto-paste. Manages recording popup window and escape shortcut.
- **`EventBus`** (`src/events/EventBus.ts`) — Frontend-only pub/sub singleton for decoupled communication.
- **`StateSyncManager`** (`src/stateSync/StateSyncManager.ts`) — Syncs Zustand state sections between main window and popup windows via Tauri events.
- **Views** — `src/views/pages/VoiceHomeView.tsx` (main page), `src/views/pages/settings/` (settings), `src/views/ui/` (shadcn/ui components).
- **Routing** — React Router v6. Routes defined in `src/views/Root.tsx`. Two routes: voice home (`/`) and model settings.

### Rust Backend Key Modules

- **`commands.rs`** — All Tauri commands (`#[tauri::command]`). Abort support via `AtomicBool` flags and `tokio::select!` for timeout/cancellation.
- **`audio/recorder.rs`** — Native audio recording using `cpal`. Records to WAV format.
- **`secure_storage.rs`** — AES-GCM encrypted file storage for credentials.
- **`main.rs`** — App setup: plugins, tray icon, window management (hide-on-close behavior), state initialization.

### Communication Pattern: Frontend → Backend

AI operations use Vercel AI SDK directly from the frontend (via `AgentService`). Other operations (audio recording, clipboard, keyboard simulation) use `invoke("command_name", {args})` → Tauri routes to `#[tauri::command]` Rust function.

### Model ID Convention

Composite model IDs: `{providerId}::{modelId}` (e.g., `openai::gpt-4o`). Parsed by `parseModelId()` / `createCompositeModelId()` in `src/integrations/ai/interface/AIModel.ts`.

## Code Style

- **Prettier**: 4-space indent, double quotes, no bracket spacing, 180 char line width, trailing commas, LF line endings
- **TypeScript**: Strict mode, no unused locals/params
- **Path alias**: `@/` maps to `src/` (configured in Vite and tsconfig)
- **UI components**: shadcn/ui pattern — primitives in `src/views/ui/`, composed in `src/views/`
- **ESLint**: `@typescript-eslint/no-explicit-any` is off (any is used in AI message types)

## Multi-Window Architecture

The app uses two Tauri windows:
1. **main** — Primary app window (hidden on close, shown from tray)
2. **voice-recording-popup** — Small overlay window at screen bottom during recording. Communicates with main window via Tauri events (`emitTo`/`listen`).

State between windows is synced via `StateSyncManager` using event channels `state-sync:{key}`.

## Provider System

Providers are configured in the UI and stored in Zustand state (`provider.collection`). Built-in templates: OpenAI, Perplexity, Groq, OpenRouter, Custom. All use the OpenAI-compatible API format. API keys are stored client-side and used by the Vercel AI SDK directly from the frontend.
