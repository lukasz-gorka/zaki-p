# Contributing to Zakip Voice

Thanks for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [pnpm](https://pnpm.io/installation)
- Platform-specific build dependencies (see [README](README.md#build-from-source))

## Setup

```bash
git clone https://github.com/lukasz-gorka/zakip-voice.git
cd zakip-voice
pnpm install
pnpm tauri dev
```

## Code Style

### Frontend (TypeScript)

- **Prettier** — 4-space indent, double quotes, no bracket spacing, 180 char line width, trailing commas, LF
- **ESLint** — `@typescript-eslint` with strict mode
- **Path alias** — `@/` maps to `src/`
- **UI** — shadcn/ui pattern (Radix primitives in `src/views/ui/`, composed in `src/views/`)

### Backend (Rust)

- Standard `rustfmt` formatting
- `cargo clippy -- -D warnings` must pass

## Quality Checks

Run before every commit:

```bash
pnpm quality                           # Prettier + ESLint + TypeScript
cd src-tauri && cargo clippy -- -D warnings  # Rust linting
cd src-tauri && cargo test             # Rust tests
```

## Project Structure

```
src/                    # React frontend (TypeScript + Vite)
src-tauri/              # Rust backend (Tauri 2.0)
pro/                    # Pro-only features (separate from OSS core)
public/                 # Static assets
```

## Architecture Notes

- **G singleton** (`src/appInitializer/module/G.ts`) — Central service locator
- **Zustand store** — Global state with sections: `provider`, `voice`, `view`, `globalShortcuts`
- **RustProxy** (`src/rustProxy/RustProxy.ts`) — All Rust backend calls go through here
- **Commands** (`src-tauri/src/commands.rs`) — All `#[tauri::command]` handlers
- **Model IDs** — Composite format: `{providerId}::{modelId}` (e.g., `openai::gpt-4o`)

## Pull Request Process

1. Fork and create a feature branch
2. Make your changes
3. Run `pnpm quality` and `cargo clippy`
4. Write a clear commit message
5. Open a PR against `main`

## Reporting Issues

Use [GitHub Issues](https://github.com/lukasz-gorka/zakip-voice/issues). Include:
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (if applicable)
