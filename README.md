# ChronoGraph Frontend

React + TypeScript frontend for ChronoGraph dependency analysis tool.

## Architecture

### Key Components
- **Tree Structure (`src/utils/treeStructure.ts`)**: Repository-agnostic tree building from Lakos dependency data
- **Tree Transforms (`src/utils/treeBasedGraphTransforms.ts`)**: Converts dependency data to Cytoscape graph elements
- **Tree Visualization (`src/components/TreeBasedCytoscapeGraph.tsx`)**: Interactive tree-based dependency graph

### Recent Fixes (Tree-Based View)
Major fixes to tree-based dependency visualization system:

1. **Path Normalization & Root Detection**: Fixed system path issues and improved root detection
2. **Tree State Propagation**: Corrected checkbox state propagation with proper semantics
3. **Graph Node Optimization**: Half-checked nodes now act as stopping points for clean node counts
4. **Comprehensive Testing**: Added unit tests covering real-world scenarios and edge cases

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
