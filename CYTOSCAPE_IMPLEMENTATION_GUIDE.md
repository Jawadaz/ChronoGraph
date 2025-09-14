# Cytoscape.js Implementation Guide - Key References

## Core Compound Node Architecture

### Data Structure
```javascript
// Essential compound node structure from Context7
{
  data: {
    id: 'nodeId',
    parent: 'parentId', // Creates hierarchy
    type: 'file' | 'folder'
  },
  position: { x, y }
}
```

### Critical Implementation Patterns

#### 1. Compound Node Creation
```javascript
// From Context7: Essential parent-child setup
{ data: { id: 'child', parent: 'parentId' } } // Child node
{ data: { id: 'parentId' } } // Parent container
```

#### 2. Edge Rules (Only Leaf Nodes)
```javascript
// Context7: Edges must connect leaf nodes only
// Filter: edges.filter(e => !isExpandedFolder(e.source) && !isExpandedFolder(e.target))
```

#### 3. Hierarchical Selectors
```javascript
'node > node'    // Direct children
'node node'      // All descendants
':parent'        // All compound parents
```

#### 4. Layout Integration
```javascript
// Context7: Layout with compound nodes
var layout = cy.layout({ name: 'dagre', directed: true });
layout.run();
```

#### 5. Dynamic Updates
```javascript
// Context7: Add/remove elements dynamically
cy.add([newElements]);
cy.remove(selector);
cy.layout().run(); // Re-layout
```

## Performance Optimizations (Context7)

- Compound nodes increase rendering cost - use efficiently
- Avoid expensive selectors: `$node node`, `$node -> node`
- Use `background-clip: 'none'` for performance
- Minimize compound parent usage when possible

## Styling Essentials

```javascript
// Context7: Compound parent sizing
'compound-sizing-wrt-labels': 'include'
'min-width': '400px' // Container minimum size
```

## Key Layout Algorithms
- **dagre**: Perfect for hierarchical directed graphs
- **fcose**: Force-directed with compound support
- **cose**: Spring-based compound layout

---

*Extracted from Context7 MCP server - cytoscape/cytoscape.js documentation*