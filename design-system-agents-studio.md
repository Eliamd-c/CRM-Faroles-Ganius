# FarolesGenius Agents Studio - Design System

**Generated with UI/UX Pro Max Skill**  
**Product Type**: AI/Chatbot Platform + B2B SaaS  
**Stack**: Express.js + Vanilla HTML/CSS/JS  
**Theme**: Dark Mode with Glassmorphism  
**Status**: Master Source of Truth

---

## 1. ACCESSIBILITY (PRIORITY 1 - CRITICAL) 🚨

### Contrast Requirements
- **Minimum**: WCAG AA (4.5:1 for text)
- **Target**: WCAG AAA (7:1 for body copy)
- **Dark Mode Contrast**:
  - Background: `#0f0f12` (near black, OLED-optimized)
  - Primary Text: `#e0e0e0` (high contrast)
  - Secondary Text: `#9ba1a6` (4.8:1 ratio)
  - Do NOT use: Gray-on-gray, low-contrast combinations

### Keyboard Navigation
- All interactive elements must be keyboard-accessible
- Focus rings: ALWAYS visible (min 2px, color: `#4da3ff`)
- Tab order: logical flow left→right, top→bottom
- Skip links: present for long navigation

### Icon Requirements
- NO icon-only buttons without text labels
- All icons must have `aria-label` or accompanying text
- Use SVG (not emoji) for UI icons
- Minimum size: 24×24px

### ARIA Labels
- Modals: `role="dialog"` + `aria-labelledby`
- Forms: `<label>` for all inputs (not placeholder-only)
- Links: descriptive text (not "click here")
- Live regions: `aria-live="polite"` for status updates

---

## 2. TOUCH & INTERACTION (PRIORITY 2 - CRITICAL) 🖱️

### Touch Targets
- Minimum size: **44×44px** (mobile)
- Desktop buttons: 40×40px minimum
- Spacing between targets: **8px minimum**

### Loading & Feedback
- Loading states: spinner + text ("Cargando...")
- No instant state changes (minimum 150ms feedback)
- Buttons show disabled state during submission
- Success/error feedback within 300ms

### Interaction States
- ✅ Hover: Background color +10% brightness
- ✅ Focus: 2px focus ring (#4da3ff)
- ✅ Active: Scale 0.98 + darker bg
- ✅ Disabled: opacity 0.5 + cursor: not-allowed

---

## 3. PERFORMANCE (PRIORITY 3 - HIGH) ⚡

### Image Optimization
- Use WebP/AVIF (with fallback to PNG)
- Lazy load images below fold
- Optimize SVGs (remove unnecessary attributes)
- No uncompressed images in UI

### Layout Stability
- Cumulative Layout Shift (CLS): < 0.1
- Reserve space for lazy-loaded content (aspect-ratio CSS)
- No layout thrashing (batch DOM updates)

### Main Thread Budget
- Route transitions: < 100ms
- Modal opens: < 150ms
- Cache stats update: < 50ms (InstructionService cache)

### Code Splitting
- Modal content: lazy-load on open
- Skills: load on-demand, not on page init
- Charts/visualizations: defer until viewport

---

## 4. STYLE SELECTION (PRIORITY 4 - HIGH) 🎨

### Primary Style: Glassmorphism + Flat Design

**Glassmorphism** (Premium, Modern, AI-native)
```css
background: rgba(30, 30, 35, 0.6);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
```

**Flat Design** (Clear hierarchy, no skeuomorphism)
- No drop shadows (only glassmorphism shadows)
- No gradients (except brand accent)
- Semantic color tokens, not raw hex

### Secondary Styles (Approved Alternatives)
- AI-Native UI: Minimal chrome, focus on content
- Minimalism: Maximum whitespace, clarity

### Anti-Patterns (AVOID)
- ❌ Mixing flat + skeuomorphic randomly
- ❌ Emoji as UI icons (use SVG)
- ❌ Random color combinations (use token system)

---

## 5. LAYOUT & RESPONSIVE (PRIORITY 5 - HIGH) 📱

### Breakpoints
```css
--mobile: 375px
--tablet: 768px
--desktop: 1280px
--wide: 1920px
```

### Mobile-First Approach
1. Design mobile layout first
2. Use `@media (min-width)` for larger screens
3. NO fixed px widths on containers

### Responsive Rules
- Container max-width: 1200px
- No horizontal scroll (except data tables with scroll-x)
- Viewport meta: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Never disable zoom (`user-scalable=no` forbidden)

### Safe Areas (Mobile)
- Bottom nav: leave 60px for safe area (notch, home indicator)
- Sticky elements: account for safe areas

---

## 6. TYPOGRAPHY & COLOR (PRIORITY 6 - MEDIUM) 🎯

### Color Palette

#### Primary Colors
| Token | Value | Usage | Contrast |
|-------|-------|-------|----------|
| `--primary` | `#4da3ff` | CTA buttons, focus rings, active states | 7.2:1 on dark bg |
| `--primary-dark` | `#3b7eff` | Hover state, darker alternative | 8.1:1 |
| `--primary-light` | `#6bb3ff` | Disabled, lighter alternative | 5.2:1 |
| `--accent` | `#6366f1` | AI Purple for special features (instructions) | 6.8:1 |
| `--accent-light` | `#818cf8` | Accent hover state | 5.1:1 |

#### Semantic Colors
| Token | Value | Usage | Notes |
|-------|-------|-------|-------|
| `--success` | `#00d26a` | Checkmarks, saved states, positive feedback | 8.5:1 contrast |
| `--warning` | `#ffb822` | Caution, alerts, non-critical warnings | 7.2:1 contrast |
| `--error` | `#ff6b6b` | Errors, destructive actions, critical alerts | 7.8:1 contrast |
| `--info` | `#4da3ff` | Information icons, helpful hints | Same as primary |

#### Neutral Grays
| Token | Value | Usage | Contrast |
|-------|-------|-------|----------|
| `--bg-base` | `#0f0f12` | Main background (OLED-optimized) | N/A |
| `--bg-elevated` | `#1a1a24` | Cards, panels, elevated surfaces | N/A |
| `--bg-hover` | `#25252f` | Hover state for bg elements | N/A |
| `--text-primary` | `#e0e0e0` | Body text, headings | 7.1:1 |
| `--text-secondary` | `#9ba1a6` | Metadata, helper text | 4.8:1 |
| `--text-tertiary` | `#6b7280` | Disabled text, timestamps | 3.2:1 |
| `--border` | `rgba(255, 255, 255, 0.08)` | Dividers, card borders | 1.5:1 (acceptable for decorative) |

#### Glass Border (Glassmorphism)
```css
--glass-border: rgba(255, 255, 255, 0.08);
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
```

### Typography

#### Font Stack
```css
--font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-family-mono: 'Courier New', monospace;
```

#### Type Scale
```css
/* Base: 16px */
--text-xs: 12px / 1.4
--text-sm: 14px / 1.5
--text-base: 16px / 1.5      /* Body text */
--text-lg: 18px / 1.5
--text-xl: 20px / 1.4
--text-2xl: 24px / 1.3
--text-3xl: 32px / 1.2       /* Headings */
--text-4xl: 40px / 1.1
```

#### Font Weights
```css
--font-light: 300
--font-regular: 400
--font-medium: 500            /* Labels, emphasis */
--font-semibold: 600          /* Headings, strong emphasis */
--font-bold: 700              /* Major headings only */
```

#### Line Heights (Critical for Accessibility)
- Body: 1.5 (24px for 16px base)
- Headings: 1.2-1.4
- Labels: 1.4
- Mono code: 1.6

### Typography Examples

**Heading 1** (Page title)
```css
font-size: 32px;
font-weight: 600;
line-height: 1.2;
letter-spacing: -0.5px;
```

**Heading 2** (Section title)
```css
font-size: 24px;
font-weight: 600;
line-height: 1.3;
```

**Body Text**
```css
font-size: 16px;
font-weight: 400;
line-height: 1.5;
color: var(--text-primary);
```

**Helper Text** (Labels, metadata)
```css
font-size: 13px;
font-weight: 500;
line-height: 1.4;
color: var(--text-secondary);
```

---

## 7. ANIMATION (PRIORITY 7 - MEDIUM) 🎬

### Duration Guidelines
- Micro-interactions: **150-200ms** (button hover, icon change)
- Transitions: **200-300ms** (fade, slide)
- Complex choreography: **300-500ms** (modal open, page transition)

### Easing Functions
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);    /* Standard easing */
--ease-out: cubic-bezier(0, 0, 0.2, 1);         /* Exit faster than enter */
--ease-in: cubic-bezier(0.4, 0, 1, 1);          /* Enter slower */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);  /* Playful bounce */
```

### Motion Principles
1. **Motion conveys meaning** - Not decorative
   - Loading spinner: indicates processing
   - Scale on click: confirms interaction
   - Slide in from edge: reveals content

2. **Spatial continuity** - Objects maintain path/position logic
   - Modal scales from center, not random origin
   - Tooltips appear near trigger element
   - Modals don't "teleport"

3. **Reduced motion respect** (CRITICAL for accessibility)
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

### Animation Examples

**Button Hover**
```css
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

**Modal Enter**
```css
animation: modalEnter 300ms ease-out;
@keyframes modalEnter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

**Loading Spinner**
```css
animation: spin 1s linear infinite;
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### GSAP Motion Presets (for advanced animations)
- **Reveal**: Fade-in + subtle slide-up (200ms)
- **Stagger**: Sequential element animations (50ms delay between)
- **Emphasis**: Scale/rotate for attention (300ms)
- **Exit**: Fade-out + scale-down (faster than enter)

---

## 8. FORMS & FEEDBACK (PRIORITY 8 - MEDIUM) 📋

### Form Layout
- **Visible labels** (always, above input)
- **Helper text** below input (gray, non-bold)
- **Error messages** directly below field (red, icon + text)
- **Success feedback** inline or toast (green, brief)

### Input States
```css
/* Default */
border: 1px solid var(--border);
background: var(--bg-elevated);
color: var(--text-primary);

/* Focus */
border-color: var(--primary);
box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.1);
outline: none;

/* Error */
border-color: var(--error);
background: rgba(255, 107, 107, 0.05);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
background: var(--bg-base);
```

### Validation
- **Inline validation**: Show errors as user types (150ms debounce)
- **Error placement**: Next to field, red icon + message
- **Success indicator**: Green checkmark when valid
- **Progressive disclosure**: Reveal next field only when current is valid

### Feedback Patterns
- **Success toast**: Bottom-right, 3s auto-dismiss
- **Error toast**: Bottom-right, stays until dismissed
- **Loading state**: Spinner + "Cargando..." text
- **Confirmation**: Modal dialog (not alert box)

---

## 9. NAVIGATION PATTERNS (PRIORITY 9 - HIGH) 🧭

### Navigation Hierarchy
```
Top Nav (Global)
├── Logo + Branding
├── Primary Nav (Inicio, Contactos, Flujos, Dashboard, Agents Studio)
└── User Menu (Logout, Settings)

Within Agents Studio:
├── Tab Navigation (6 tabs: Identidad, Conocimiento, etc.)
└── Modal Dialogs (for deep features)
```

### Rules
- **Back behavior**: Always predictable (back button = previous page)
- **Bottom nav**: Reserved for mobile (≤5 items)
- **Deep linking**: All pages must be shareable via URL
- **Breadcrumbs**: For multi-level content (not needed here, tabs sufficient)

### Mobile Navigation
- Hamburger menu for 6+ nav items (collapse to mobile)
- Tab bars: center-aligned, labels always visible
- Avoid nested menus (max 2 levels)

---

## 10. CHARTS & DATA (PRIORITY 10 - LOW) 📊

### Cache Statistics Cards
- **Don't rely on color alone** - Use icons + labels
- **Legends required** for any multi-series chart
- **Tooltips** on hover (show exact values)
- **Accessible colors**: Avoid red-green (colorblind-safe)

### Data Visualization Rules
- Cache stats cards: Simple number + icon + trend
- If future charts needed: Use accessible color palettes (Viridis, Okabe-Ito)
- Always include alt text for charts (`<img alt="...">`)

---

## Spacing Scale (Component Spacing)

```css
--space-xs:   4px      /* Micro-spacing within components */
--space-sm:   8px      /* Small gaps, item spacing */
--space-md:   16px     /* Standard padding, gaps */
--space-lg:   24px     /* Large sections, card margins */
--space-xl:   32px     /* Major layout sections */
--space-2xl:  48px     /* Top-level page margins */
--space-3xl:  64px     /* Screen padding, max width margins */
```

---

## Components Reference

### Cards (Glass + Flat)
```css
.glass-card {
  background: rgba(30, 30, 35, 0.6);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.37);
  transition: all 200ms ease-out;
}

.glass-card:hover {
  background: rgba(30, 30, 35, 0.75);
  border-color: rgba(77, 163, 255, 0.2);
}
```

### Buttons
```css
.btn {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 200ms ease-out;
  white-space: nowrap;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-primary:focus {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Modals
```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalEnter 300ms ease-out;
}
```

### Tabs
```css
.tab-btn {
  padding: 12px 16px;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 200ms ease-out;
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-btn:hover {
  color: var(--text-primary);
}
```

---

## Agents Studio Specific Overrides

### Tab: Instrucciones Dinámicas
- **Stat cards**: Grid 4-column on desktop, 2-column on tablet, 1-column on mobile
- **Stage buttons**: Pill-shaped (border-radius: 20px), active = primary color
- **Editor**: Textarea with real-time character counter
- **Validation**: Inline red message if < 50 or > 5000 chars

### Modal: Configuration
- **Width**: 800px max
- **Tab underline**: Primary color, 2px
- **Content padding**: 24px horizontal, 32px vertical

---

## Pre-Delivery Checklist

### Accessibility ✅
- [ ] Contrast tested (4.5:1 minimum all text)
- [ ] Focus rings visible on all interactive elements
- [ ] Keyboard navigation works (tab, enter, escape)
- [ ] Alt text for all images
- [ ] ARIA labels where needed
- [ ] Color not the only way to convey information

### Interaction ✅
- [ ] Loading states show feedback within 300ms
- [ ] Buttons min 44×44px (mobile) / 40×40px (desktop)
- [ ] Spacing between touch targets ≥ 8px
- [ ] No hover-only interactions (keyboard users must have alternative)

### Performance ✅
- [ ] Images optimized (WebP + fallback)
- [ ] CLS < 0.1
- [ ] Main thread budget < 100ms for route changes
- [ ] Modal open < 150ms
- [ ] No layout thrashing in animations

### Visual Consistency ✅
- [ ] All colors from token system (not raw hex)
- [ ] Typography follows scale (no random sizes)
- [ ] Spacing uses scale (4/8/16/24/32/48/64px)
- [ ] Buttons consistent (hover, focus, active, disabled)
- [ ] Icons are SVG, not emoji
- [ ] Dark mode: all text ≥ 4.8:1 contrast

### Animation ✅
- [ ] Durations: 150-300ms for transitions
- [ ] Easing: ease-out for exits, ease-in-out for transitions
- [ ] Motion is meaningful (not purely decorative)
- [ ] Reduced motion respected (`prefers-reduced-motion`)

### Responsive ✅
- [ ] Mobile-first breakpoints (375 → 768 → 1280)
- [ ] No horizontal scroll
- [ ] Safe areas on mobile (notch, home indicator)
- [ ] Touch targets scale appropriately

---

## Implementation Order (Priority)

1. **Color tokens** (CSS variables) - Global consistency
2. **Typography + spacing scale** - Base foundation
3. **Accessibility** (contrast, focus rings, ARIA) - Non-negotiable
4. **Components** (buttons, cards, modals) - Visual language
5. **Animation** (transitions, easing) - Polish
6. **Responsive** (breakpoints, safe areas) - Mobile
7. **Performance** (optimization, CLS) - Deployment readiness

---

## Files to Update

```
public/css/agents-studio.css
├── Color tokens (CSS variables)
├── Typography scale
├── Component styles (cards, buttons, modals, tabs)
├── Animation/transition rules
├── Accessibility (focus rings, contrast)
└── Responsive breakpoints

public/js/agents-studio.js
├── Focus management (modals, tabs)
├── Loading state feedback (300ms min)
├── Keyboard navigation (escape = close modal)
└── Reduced motion detection

Schema updates (if any)
├── None needed - design is CSS/JS only
```

---

## Reference Documents

- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/
- UI/UX Pro Max: `.claude/skills/ui-ux-pro-max/references/quick-reference.md`
- Glassmorphism specs: https://hype4.academy/articles/design/glassmorphism
- Dark mode best practices: https://web.dev/prefers-color-scheme/

---

**Last Updated**: 2026-08-05  
**Approved By**: Arquitecto-Agentes Supervisor  
**Status**: Ready for Implementation
