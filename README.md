# ChronoGraph Frontend

React + TypeScript frontend for ChronoGraph dependency analysis tool.

## Architecture

### Key Components
- **Tree Structure (`src/utils/treeStructure.ts`)**: Repository-agnostic tree building from Lakos dependency data
- **Tree Transforms (`src/utils/treeBasedGraphTransforms.ts`)**: Converts dependency data to Cytoscape graph elements
- **Tree Visualization (`src/components/TreeBasedCytoscapeGraph.tsx`)**: Interactive tree-based dependency graph

### Recent Fixes (Tree-Based View)
Fixed critical issue where tree-based view showed system paths instead of clean project structure:

1. **Simplified Path Filtering**: Reduced overly aggressive filtering in `isLikelyProjectPath()`
2. **Intelligent Path Normalization**: Added system prefix stripping for paths like `tmp/chronograph/cache/project/...`
3. **Comprehensive Testing**: Added unit tests covering real-world compass_app scenarios

### Test Coverage
```bash
# Run tree structure tests
npm test -- --testNamePattern="TreeStructure"

# Run tree transform tests
npm test -- --testNamePattern="TreeBasedGraphTransforms"
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

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
