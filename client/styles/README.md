# LoomVTT CSS Architecture

## Overview

This document describes the modular CSS architecture for LoomVTT, designed to maintain visual consistency while improving code organization and maintainability.

## Architecture Structure

The CSS system follows a modular architecture with clear separation of concerns:

```
src/styles/
├── main.css                 # Main entry point - imports all modules
├── tokens.css              # Design tokens (colors, typography, spacing)
├── base.css                # Base HTML element styles
├── foundation.css          # Foundation utilities and grid system
├── components/              # Reusable UI components
│   ├── buttons.css         # Button component variations
│   ├── cards.css          # Card component system
│   └── ...                 # Additional components
├── modules/                # Screen-specific modules
│   ├── foundation.css      # Foundation utilities
│   └── setup.css          # Setup screen styles
├── screens.css             # Screen-specific layouts
└── windows.css             # Window component styles
```

## Design Tokens

### Color System
- `--color-bg-deep`: Deep background (#0a0a0a)
- `--color-bg-dark`: Dark background (#1a1713)
- `--color-bg-medium`: Medium background (#2d2825)
- `--color-bg-surface`: Surface background (#3d3430)
- `--color-text-primary`: Primary text (#e0d6cc)
- `--color-text-secondary`: Secondary text (#a0928a)
- `--color-text-muted`: Muted text (#6b5d56)
- `--color-accent`: Primary accent (#e49a42)
- `--color-accent-hover`: Accent hover (#d6892f)
- `--color-success`: Success (#34d399)
- `--color-warning`: Warning (#fbbf24)
- `--color-danger`: Danger (#ef4444)
- `--color-info`: Info (#3b82f6)

### Typography
- `--font-display`: Cinzel, serif (headings)
- `--font-ui`: Inter, sans-serif (body text)
- `--font-mono`: JetBrains Mono, monospace (code)

### Spacing
- `--spacing-xs`: 0.25rem (4px)
- `--spacing-sm`: 0.5rem (8px)
- `--spacing-md`: 1rem (16px)
- `--spacing-lg`: 1.5rem (24px)
- `--spacing-xl`: 2rem (32px)

### Border Radius
- `--radius-sm`: 2px
- `--radius-md`: 4px
- `--radius-lg`: 8px
- `--radius-full`: 9999px

### Shadows
- `--shadow-sm`: 0 1px 2px rgba(0, 0, 0, 0.1)
- `--shadow-md`: 0 4px 6px rgba(0, 0, 0, 0.1)
- `--shadow-lg`: 0 10px 15px rgba(0, 0, 0, 0.1)
- `--shadow-glow`: 0 0 20px rgba(228, 154, 66, 0.3)

### Transitions
- `--transition-fast`: 150ms ease
- `--transition-normal`: 300ms ease
- `--transition-slow`: 500ms ease

## Component System

### Button Component
The button component provides various styles and states:

```css
/* Base button */
.btn {
  background: var(--color-accent);
  color: var(--color-bg-deep);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm, 2px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* Variants */
.btn-secondary, .btn-outline, .btn-ghost, .btn-danger, .btn-success, .btn-info, .btn-warning

/* Sizes */
.btn-sm, .btn-lg, .btn-xs

/* States */
.btn:hover, .btn:active, .btn:focus, .btn:disabled, .btn.loading
```

### Card Component
Flexible content container with various layouts:

```css
/* Base card */
.card {
  background: var(--color-bg-medium);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg, 8px);
  overflow: hidden;
  transition: all var(--transition-fast);
}

/* Sizes */
.card-sm, .card-lg, .card-xl

/* Layouts */
.card-header, .card-body, .card-footer, .card-content

/* Features */
.card-cover, .card-actions, .card-tags, .card-status, .card-badge, .card-icon
```

## Utility Classes

### Spacing Utilities
```css
/* Margin */
.mt-1, .mt-2, .mt-3, .mt-4, .mt-5
.mb-1, .mb-2, .mb-3, .mb-4, .mb-5
.ml-1, .ml-2, .ml-3, .ml-4, .ml-5
.mr-1, .mr-2, .mr-3, .mr-4, .mr-5

/* Padding */
.p-1, .p-2, .p-3, .p-4, .p-5
```

### Display Utilities
```css
.block, .inline-block, .inline, .flex, .inline-flex, .grid, .hidden
```

### Flexbox Utilities
```css
.flex-col, .flex-row, .flex-wrap, .flex-nowrap
.items-start, .items-end, .items-center, .items-stretch
.justify-start, .justify-end, .justify-center, .justify-between, .justify-around
```

### Color Utilities
```css
.text-primary, .text-secondary, .text-muted, .text-accent
.bg-surface, .bg-medium, .bg-dark, .bg-deep
.border-primary, .border-secondary, .border-accent
```

### Responsive Utilities
```css
.sm\:hidden, .md\:hidden, .lg\:hidden, .xl\:hidden
.sm\:block, .md\:block, .lg\:block, .xl\:block
```

## Screen-Specific Modules

### Setup Module
Handles the setup hub and configuration screens:

```css
.setup-hub {
  display: grid;
  grid-template-columns: 1fr 320px;
  height: 100vh;
  gap: 0;
}

.setup-hub-main {
  display: flex;
  flex-direction: column;
}

.setup-hub-sidebar {
  background: var(--color-bg-dark);
  border-left: 1px solid var(--color-border);
}
```

## Best Practices

### CSS Methodologies
- **BEM (Block Element Modifier)**: Used for component naming
- **SMACSS**: Organized into categories (foundation, components, modules)
- **Utility-First**: Comprehensive utility classes for common patterns

### Performance Optimization
- CSS containment for component isolation
- Efficient selectors (avoid deep nesting)
- Critical CSS for above-the-fold content
- Lazy loading for non-critical styles

### Accessibility
- Focus indicators for keyboard navigation
- Reduced motion support
- High contrast color ratios
- Semantic HTML structure

### Responsive Design
- Mobile-first approach
- Fluid layouts with relative units
- Breakpoints at 640px, 768px, 1024px, 1280px
- Touch-friendly interactive elements

## Migration Guide

### From Legacy CSS
1. Replace component classes with new modular equivalents
2. Use utility classes for common patterns
3. Follow BEM naming conventions
4. Implement responsive design patterns

### Integration Steps
1. Import `main.css` as the main entry point
2. Replace old component styles with new modular imports
3. Update HTML to use new utility classes
4. Test visual consistency across screens

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid and Flexbox
- CSS Custom Properties
- Media queries
- Transforms and animations

## Future Enhancements

- CSS-in-JS integration for dynamic styles
- Theme switching system
- Dark/light mode support
- Component library documentation
- Automated testing with visual regression

## Contributing

When adding new components:
1. Follow the existing modular structure
2. Use BEM naming conventions
3. Include responsive design
4. Add accessibility considerations
5. Document in README.md

When modifying existing components:
1. Maintain backward compatibility
2. Test across all screen sizes
3. Update documentation
4. Consider performance implications