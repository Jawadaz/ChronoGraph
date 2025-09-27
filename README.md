# ChronoGraph Frontend

React + TypeScript frontend for ChronoGraph dependency analysis tool.

## Architecture

### Key Components
**Analysis & Caching**:
- **Cache Management (`src/components/RepositoryManager.tsx`)**: Dual-tab interface for repository and analysis cache management
- **Tauri Integration**: Frontend commands for cache statistics, cleanup, and repository-specific cache clearing

**Graph & Visualization**:
- **Tree Structure (`src/utils/treeStructure.ts`)**: Repository-agnostic tree building from Lakos dependency data
- **Tree Transforms (`src/utils/treeBasedGraphTransforms.ts`)**: Converts dependency data to Cytoscape graph elements
- **Tree Visualization (`src/components/TreeBasedCytoscapeGraph.tsx`)**: Interactive tree-based dependency graph

### Latest Features (Analysis Caching & UI)
Major improvements to performance and user interface:

1. **Analysis Result Caching**: 85-95% performance improvement through intelligent caching of analysis results
2. **Cache Management UI**: Professional dual-tab interface with repository and analysis cache controls
3. **Real-time Cache Statistics**: Live monitoring of cache hit rates, storage usage, and performance metrics
4. **Advanced Graph Settings**: Complete settings panel redesign with right-side positioning, collapsible interface, and compact layout
5. **Comprehensive Layout Controls**: Full Dagre layout parameter control including orientation, alignment, algorithm selection, margins, and animations
6. **Dynamic Weight Mapping**: Intelligent arrow thickness scaling that adapts to current graph weight range for optimal visual distinction
7. **Professional UI Design**: Space-efficient horizontal controls, proper scrollbars, and responsive layout
8. **Tree-Based View Foundation**: Robust path normalization, state propagation, and node optimization for future enhancements

### Test Coverage
**Frontend Tests**:
```bash
# Run all frontend tests
npm test

# Run tree structure tests
npm test -- --testNamePattern="TreeStructure"

# Run tree transform tests
npm test -- --testNamePattern="TreeBasedGraphTransforms"
```

**Backend Tests** (from `src-tauri/`):
```bash
# Run all Rust tests including cache tests
cargo test

# Run only cache tests
cargo test analysis_cache
```

## Development

### Prerequisites
- Node.js 18+
- Rust 1.70+ (for Tauri desktop app)

### Commands
```bash
# Install dependencies
npm install

# Web development server
npm run dev

# Desktop development
npm run tauri:dev

# Run tests
npm test

# Type checking
npm run type-check
```

## Recommended IDE Setup

**Essential Extensions**:
- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

**Testing Extensions**:
- [Jest Extension](https://marketplace.visualstudio.com/items?itemName=Orta.vscode-jest) - Run/debug frontend tests with CodeLens
- [Test Explorer UI](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) - Unified test tree view
- **Rust Analyzer** automatically provides CodeLens for running/debugging Rust tests

**Quick Commands**:
- **Ctrl+Shift+P** → "Test: Run All Tests" (runs both frontend and backend)
- **Ctrl+Shift+P** → "Jest: Start Runner" (watches frontend tests)
- **Ctrl+Shift+P** → "Rust Analyzer: Run Tests" (runs Rust tests)
