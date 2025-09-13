# ChronoGraph AI Agent Instructions

This document provides essential guidance for AI agents working on the ChronoGraph codebase.
Read through the document ..\..\CLAUDE_CONTEXT.md for general instructions on claude progress.

## Architecture Overview

ChronoGraph is a desktop application built with [Tauri](https://tauri.app/), combining a web-based frontend with a Rust backend.

-   **Frontend (`src/`)**: A Single-Page Application (SPA) built with React, TypeScript, and Vite. The main application component is `src/App.tsx`, which orchestrates the user interface. UI components are located in `src/components/`.

-   **Backend (`src-tauri/`)**: A Rust application that handles all the core logic, including file system operations, Git interactions, and code analysis. The backend exposes its functionality to the frontend via Tauri commands.

-   **Frontend-Backend Communication**: The frontend invokes Rust functions using Tauri's `invoke` API. These backend functions are defined in `src-tauri/src/commands.rs` and are decorated with the `#[tauri::command]` attribute. Data is exchanged between the two layers using JSON serialization, with models defined in `src-tauri/src/models.rs`.

## Developer Workflows

### Running the Application

The primary command to run the application in development mode is:

```bash
npm run tauri:dev
```

This command uses `concurrently` to start the Vite development server for the frontend and the Tauri development process for the backend simultaneously.

### Building the Application

To create a production build, use:

```bash
npm run tauri:build
```

### Debugging

The project is configured for debugging in VS Code. The `.vscode/launch.json` file contains two primary configurations:

1.  **Debug Tauri App**: Launches and attaches a debugger to the frontend (JavaScript/React).
2.  **Debug Rust Backend**: Launches and attaches a debugger (CodeLLDB) to the Rust backend process. To use this, you must first start the application using `npm run tauri:dev` and then attach the debugger.

## Project Conventions

-   **State Management**: Frontend state is managed using React hooks (`useState`, `useEffect`). Global state or complex state management libraries are not currently in use.
-   **Styling**: Basic CSS is used for styling, located in `src/styles.css`.
-   **API (Commands)**: All backend functionality exposed to the frontend must be defined as a `#[tauri::command]` in the Rust code. When adding a new command, ensure it is added to one of the `.invoke()` calls in `src-tauri/src/main.rs`.
-   **Error Handling**: Backend commands should return a `Result<T, E>` where `E` is a serializable error type. This allows the frontend to handle success and failure cases gracefully.

## Key Files & Directories

-   `package.json`: Defines frontend dependencies and scripts.
-   `src/App.tsx`: The root component of the React application.
-   `src-tauri/Cargo.toml`: Defines Rust dependencies for the backend.
-   `src-tauri/src/main.rs`: The entry point for the Rust backend, where the Tauri application is initialized.
-   `src-tauri/src/commands.rs`: Contains the collection of Rust functions exposed to the frontend.
-   `src-tauri/src/chronograph_engine.rs`: The core business logic for analyzing repositories resides here.
-   `tauri.conf.json`: Configuration file for the Tauri application, including window settings and permissions.
