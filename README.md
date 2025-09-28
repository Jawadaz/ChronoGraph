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

### Latest Features (UI/UX & Testing)
Major improvements to user interface and automated testing:

1. **Scroll Bar Elimination**: Complete fix for all unwanted inner and outer scroll bars
2. **Layout Constraints**: Proper viewport height management preventing content overflow
3. **Document-Level Fixes**: Global CSS reset preventing page-level scrolling issues
4. **Playwright Testing Suite**: Comprehensive UI regression testing with real-time feedback
5. **Visual Regression Testing**: Screenshot comparison for layout consistency verification
6. **Automated UI Detection**: Tests that automatically detect scroll bar and layout issues
7. **Watch Mode Testing**: Real-time test feedback during development
8. **CI/CD Ready**: Test configuration optimized for continuous integration

### Previous Features (Analysis Caching & Controls)
Performance and interface improvements:

1. **Analysis Result Caching**: 85-95% performance improvement through intelligent caching of analysis results
2. **Cache Management UI**: Professional dual-tab interface with repository and analysis cache controls
3. **Real-time Cache Statistics**: Live monitoring of cache hit rates, storage usage, and performance metrics
4. **Advanced Graph Settings**: Complete settings panel redesign with right-side positioning, collapsible interface, and compact layout
5. **Comprehensive Layout Controls**: Full Dagre layout parameter control including orientation, alignment, algorithm selection, margins, and animations
6. **Dynamic Weight Mapping**: Intelligent arrow thickness scaling that adapts to current graph weight range for optimal visual distinction
7. **Professional UI Design**: Space-efficient horizontal controls, proper scrollbars, and responsive layout
8. **Tree-Based View Foundation**: Robust path normalization, state propagation, and node optimization for future enhancements

### Test Coverage
**Unit Tests (Jest)**:
```bash
# Run all unit tests
npm test

# Run tree structure tests
npm test -- --testNamePattern="TreeStructure"

# Run tree transform tests
npm test -- --testNamePattern="TreeBasedGraphTransforms"
```

**UI Tests (Playwright)**:
```bash
# Run all UI tests
npm run test:ui

# Run web-only tests
npm run test:ui:web

# Run with visible browser for debugging
npm run test:ui:headed

# Watch mode for real-time feedback
npm run test:ui:watch

# View test results
npm run test:ui:report
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
