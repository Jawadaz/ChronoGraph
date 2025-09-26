# Graph Visualization Requirements

## Overview

ChronoGraph requires a hierarchical clustered graph layout similar to yEd's automatic layout system. This document captures the detailed requirements for implementing a sophisticated visualization approach that improves dependency graph readability and organization.

## Core Visualization Concept

**Target**: A **compound hierarchical layout** where:
- Folders are visual containers/clusters that can expand/collapse
- Files are individual leaf nodes that participate in dependency relationships
- Only leaf nodes (files or collapsed folders) have dependency arrows
- Layout respects hierarchical grouping while showing dependency flow
- Mixed representation with proper layering and bounded relationships

## User Requirements & Specifications

### 1. Container Expand/Collapse Behavior

**Requirement**: Folders can be expanded or collapsed, triggering intelligent layout updates.

**Specifications**:
- **Stable Layout**: If expansion doesn't significantly change size (e.g., single leaf folder or file), maintain stable positioning
- **Dynamic Relayout**: For major size changes, trigger relayout with smooth transitions
- **State Management**: Maintain expand/collapse state during navigation and filtering operations

**Example**:
```
lib/ (collapsed) -> single container node with edges
lib/ (expanded) -> container box with child nodes, no direct edges to container
```

### 2. Edge Routing Rules

**Requirement**: Clear distinction between container nodes and dependency participants.

**Specifications**:
- **Expanded Folders**: Never have incoming or outgoing arrows directly
- **Collapsed Folders**: Can have edges as they represent leaf nodes
- **Files**: Always participate in dependency relationships as leaf nodes
- **Container Children**: Only children of expanded folders can be sources/targets of arrows

**Visual Logic**:
```
Container (expanded):  [Folder] ── no edges to folder itself
                          ├── file1.dart ──→ external_target
                          └── file2.dart ←── external_source

Container (collapsed): [Folder] ──→ external_target (folder acts as leaf)
```

### 3. Layout Priority & Conflict Resolution

**Requirement**: Balance between hierarchical grouping and dependency flow direction.

**Specifications**:
- **Primary**: Respect hierarchical folder structure
- **Secondary**: Optimize for dependency flow (layered layout)
- **Conflict Highlighting**: Develop technique to visualize when hierarchical grouping diverges from optimal dependency flow
- **Future Enhancement**: Highlight divergence with visual indicators (colors, annotations)

### 4. Visual Distinction Standards

**Requirement**: Clear differentiation between files and folders.

**Specifications**:
- **Files**: Circle shape, consistent sizing based on metrics
- **Collapsed Folders**: Rounded rectangle shape, distinct border styling
- **Expanded Folders**: Container rectangles with dashed/dotted borders
- **Sizing**: Containers dynamically resize based on contents
- **Colors**: Maintain instability-based coloring for files, neutral colors for containers

### 5. Zoom & Navigation Behavior

**Requirement**: Folder level selection equivalent to progressive expansion.

**Specifications**:
- **Level 1**: Root folders expanded, deeper levels collapsed
- **Level 2**: First two levels expanded, deeper collapsed
- **Dynamic Sizing**: Folders change size based on expansion state
- **Stable Layout**: Apply stable layout principles from requirement #1
- **View Root Context**: Current view root becomes base for level counting

**Example with `lib` as view root**:
```
Level 1: lib/
         ├── [config/] (collapsed)
         ├── [ui/] (collapsed)
         └── main.dart

Level 2: lib/
         ├── config/
         │   ├── deps.dart
         │   └── auth.dart
         ├── ui/
         │   └── screen.dart
         └── main.dart
```

### 6. Progressive Loading & Tree-based Filtering

**Requirement**: Foundation for advanced filtering system.

**Specifications**:
- **Current**: Root folder with progressive level expansion
- **Future**: Tree UI with selective include/exclude per folder/file
- **Flexibility**: View root can be any folder, not necessarily tree root
- **Multi-level Selection**: Users can pick folders/files from different levels and branches
- **Selective Dependencies**: Show only dependencies relevant to selected items
- **State Preservation**: Maintain selection and expansion states during navigation

**Future Tree UI Vision**:
```
☐ lib/                    (include/exclude checkbox)
  ☑ config/               (selected for inclusion)
    ☑ deps.dart          (selected)
    ☐ auth.dart          (excluded)
  ☐ ui/                   (excluded branch)
    ☐ screen.dart
  ☑ main.dart             (selected individual file)
```

## Technical Architecture Requirements

### Data Structure

**Hierarchical Graph Data**:
```typescript
interface HierarchicalNode {
  id: string;
  label: string;
  type: 'file' | 'folder';
  path: string;
  parent?: string;           // Parent folder ID
  children?: string[];       // Child node IDs
  isExpanded: boolean;       // Current expansion state
  isLeaf: boolean;          // Can participate in edges
  metrics: NodeMetrics;      // Size, instability, etc.
}

interface CompoundEdge {
  source: string;            // Must be leaf node ID
  target: string;            // Must be leaf node ID
  weight: number;
  type: string;
  originalDependencies: Dependency[];
}
```

### Layout Engine Requirements

**Hierarchical Layout Algorithm**:
- Support for compound/parent-child relationships
- Automatic layering based on dependency direction
- Dynamic container sizing
- Efficient relayout for expand/collapse operations
- Edge routing around container boundaries

**Layout Stability**:
- Detect minimal vs. major size changes
- Implement smooth transitions for relayout
- Preserve relative positioning when possible
- Optimize for minimal visual disruption

### Rendering Requirements

**Container Rendering**:
- Visual distinction between expanded/collapsed states
- Dynamic border styling (solid for collapsed, dashed for expanded)
- Automatic sizing based on content
- Proper z-index ordering (containers behind, nodes on top)

**Edge Rendering**:
- Smart routing around container boundaries
- Visual distinction for intra-container vs. inter-container dependencies
- Proper arrowhead positioning for leaf nodes only
- Performance optimization for large graphs

## Implementation Guidelines

### Phase 1: Foundation
1. **Library Selection**: Choose appropriate graph library (Cytoscape.js, D3.js with extensions, or custom)
2. **Data Transformation**: Convert current flat structure to hierarchical compound nodes
3. **Basic Container Rendering**: Implement expand/collapse visual states
4. **Edge Routing**: Ensure edges only connect to leaf nodes

### Phase 2: Layout Intelligence
1. **Hierarchical Algorithm**: Implement compound node layout
2. **Stability Detection**: Add logic for stable vs. dynamic relayout decisions
3. **Container Sizing**: Automatic sizing based on contents
4. **Smooth Transitions**: Animation system for expand/collapse

### Phase 3: Advanced Features
1. **Conflict Highlighting**: Visual indicators for hierarchical vs. dependency flow conflicts
2. **Tree UI Foundation**: Prepare data structures for selective filtering
3. **Performance Optimization**: Efficient updates for large codebases
4. **State Management**: Persistent expand/collapse and selection states

### Phase 4: Tree-based Filtering
1. **Tree UI Implementation**: Checkbox-based include/exclude interface
2. **Selective Dependencies**: Filter dependencies based on selected nodes
3. **Multi-level Selection**: Support for complex selection patterns
4. **View Root Flexibility**: Any folder can serve as view root

## Success Criteria

### Visual Quality
- ✅ Clear distinction between files and folders
- ✅ Professional appearance with advanced controls
- ✅ Dynamic weight-to-thickness mapping for arrow clarity
- ✅ Proper edge routing without overlaps
- ✅ Space-efficient settings panel design

### Functionality
- ✅ Comprehensive layout parameter control (orientation, alignment, spacing)
- ✅ Real-time settings updates with smooth animations
- ✅ Collapsible settings interface without space artifacts
- ✅ Persistent settings storage across sessions
- ✅ Dynamic algorithm selection (Network Simplex, Tight Tree, Longest Path)

### Performance
- ✅ Intelligent weight range detection for optimal arrow thickness
- ✅ Efficient settings updates with minimal re-rendering
- ✅ Smooth interaction for graphs up to 1000+ nodes
- ✅ Memory-efficient state management

### Extensibility
- ✅ Foundation ready for tree-based filtering
- ✅ Modular settings architecture for future enhancements
- ✅ Support for additional layout algorithms
- ✅ Prepared for advanced visualization features

## Future Enhancements

### Conflict Visualization
Develop techniques to highlight when hierarchical grouping diverges from optimal dependency flow:
- Color coding for "natural" vs. "forced" groupings
- Overlay indicators showing alternative layouts
- Metrics showing grouping efficiency vs. dependency clarity

### Advanced Tree Filtering
- Drag-and-drop folder organization
- Saved filter presets
- Dependency impact analysis for selections
- Real-time dependency updates during filtering

### Layout Algorithms
- Multiple layout options (organic, hierarchical, circular)
- User-customizable layout parameters
- AI-assisted optimal layout suggestions
- Performance benchmarking and optimization

---

**Document Version**: 1.0
**Last Updated**: 2025-09-14
**Status**: Requirements Specification
**Next Phase**: Technical Implementation Planning