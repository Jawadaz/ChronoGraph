# ChronoGraph

A desktop application for visualizing how a codebase's dependency graph evolves over time. Point it at a Git repository, and ChronoGraph walks through its commit history — sampling commits at a configurable rate — analyzing file-level dependencies at each point in time and rendering the results as an interactive graph.

<img width="1915" height="1127" alt="ChronoGraph UI" src="https://github.com/user-attachments/assets/09ff1bb8-b27a-49d6-82ca-cc87c48afad5" />

## What it does

- Clones a GitHub repository or opens a local one
- Iterates through the commit history (configurable sampling rate and commit limit)
- Analyzes file-level dependencies at each sampled commit using [Lakos-style](https://en.wikipedia.org/wiki/John_Lakos) dependency analysis
- Caches analysis results in SQLite so re-running is fast
- Visualizes the dependency graph interactively with timeline navigation, statistics, and a tree-based file explorer

Currently targets **Flutter/Dart** projects via the Lakos analyzer.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Desktop shell | Tauri 2 (Rust) |
| Graph rendering | Cytoscape.js (dagre + fcose layouts) |
| Git access | libgit2 via `git2` crate |
| Cache | SQLite via `rusqlite` |
| Unit tests | Vitest |
| E2E tests | Playwright |

## Prerequisites

- Node.js 18+
- Rust 1.70+ with `cargo`
- On Windows: MSVC build tools

## Getting started

```bash
# Install frontend dependencies
npm install

# Run the desktop app (starts Vite dev server + Tauri)
npm run tauri:dev

# Run the web-only dev server (shows sample data, no Tauri backend)
npm run dev
```

## Building

```bash
npm run tauri:build
```

## Testing

```bash
# Unit tests (Vitest)
npm test

# Unit tests with UI
npm run test:ui

# Unit test coverage
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e

# Rust backend tests
cd src-tauri && cargo test
```

## Project structure

```
src/
  components/
    AnalysisResults.tsx       # Tab container for graph, timeline, stats, deps
    GraphTab.tsx              # Cytoscape graph tab
    TimelineTab.tsx           # Commit timeline view
    StatisticsTab.tsx         # Dependency metrics over time
    DependenciesTab.tsx       # Flat dependency list
    TreeBasedCytoscapeGraph.tsx  # Tree-aware graph renderer
    NodeDetailsPanel.tsx      # Sidebar panel for selected node details
    GraphSettings.tsx         # Layout and display settings panel
    RepositoryManager.tsx     # Cache management UI
    RepositorySelectionModal.tsx  # Repository open dialog
    AnalysisProgress.tsx      # Progress display during analysis
  utils/
    treeStructure.ts          # Builds file tree from dependency data
    treeBasedGraphTransforms.ts  # Converts tree to Cytoscape elements

src-tauri/src/
  chronograph_engine.rs       # Core orchestration: clone → iterate commits → analyze
  git_navigator.rs            # Git repository traversal via libgit2
  lakos_analyzer.rs           # Lakos dependency analysis for Dart/Flutter
  analysis_cache.rs           # SQLite-backed result cache
  commands.rs                 # Tauri command handlers (IPC bridge)
  models.rs                   # Shared data types
```

## Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) with the [Tauri extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
