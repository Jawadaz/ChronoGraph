# ChronoGraph Frontend

React + TypeScript frontend for ChronoGraph dependency analysis tool.

## Architecture

### Key Components
- **Tree Structure (`src/utils/treeStructure.ts`)**: Repository-agnostic tree building from Lakos dependency data
- **Tree Transforms (`src/utils/treeBasedGraphTransforms.ts`)**: Converts dependency data to Cytoscape graph elements
- **Tree Visualization (`src/components/TreeBasedCytoscapeGraph.tsx`)**: Interactive tree-based dependency graph

### Latest Features (Advanced UI & Controls)
Major improvements to graph visualization and user interface:

1. **Advanced Graph Settings**: Complete settings panel redesign with right-side positioning, collapsible interface, and compact layout
2. **Comprehensive Layout Controls**: Full Dagre layout parameter control including orientation, alignment, algorithm selection, margins, and animations
3. **Dynamic Weight Mapping**: Intelligent arrow thickness scaling that adapts to current graph weight range for optimal visual distinction
4. **Professional UI Design**: Space-efficient horizontal controls, proper scrollbars, and responsive layout
5. **Tree-Based View Foundation**: Robust path normalization, state propagation, and node optimization for future enhancements

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
