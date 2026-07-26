# Plan: Apply Riso Design System to Memory System UI

## Context

The SXIOS app is a PWA with an iOS-phone-simulator interface. It currently uses two design languages:
- **iOS-style** for utility/settings screens (including Memory screens)
- **KakaoTalk-style** for chat screens

The user wants to apply the **Riso design system** (from `DESIGN_riko.md` and `SKILL_riko.md`) to improve the memory system's visual appearance.

### Riso Design System Tokens
| Token | Value | Role |
|---|---|---|
| Primary | `#F237A1` | Fluorescent pink — sole interaction driver (buttons, links, active states) |
| Secondary | `#2C40A7` | Deep federal-blue — headings, structure, offset print-shadow |
| Success | `#16A34A` | Status |
| Warning | `#D97706` | Status |
| Danger | `#DC2626` | Destructive actions |
| Surface | `#FFFFFF` | Paper-like warm white background |
| Text | `#111827` | Primary text |
| Neutral | `#FFFFFF` | Derived neutral |
| Font (h1/body) | `Space Grotesk` | Primary & display font |
| Font (label-caps) | `Overpass Mono` | Mono/label font |
| Typography scale | 12/14/16/20/24/32 | px sizes |
| Rounded sm | 4px | Small radius |
| Rounded md | 8px | Medium radius |
| Spacing scale | 4/8/12/16/24/32 | px values |

### Riso Brand Character
- Playful, joyful, two-color risograph print aesthetic
- Single warm off-white paper surface through every section
- Fluorescent brand pink reserved as the **sole interaction driver**
- Deep federal-blue secondary carrying every heading and the signature offset print-shadow
- Clean, high-contrast visual style

## Scope

Apply Riso design to the **memory system screens only** (not the entire app):
1. Memory List (`/memory`)
2. Memory Detail (`/memory/:id`)

This is a surgical change — only memory-related CSS and JS are modified. The iOS/Kakao design languages remain for other screens.

## Implementation Steps

### Step 1: Add Riso CSS custom properties to `css/shared.css`

Add a new `:root` block of `--riso-*` tokens alongside existing `--ios-*` and `--kakao-*` tokens. This keeps the change non-destructive — existing screens are unaffected.

```css
:root {
  /* ... existing tokens ... */
  --riso-primary: #F237A1;
  --riso-secondary: #2C40A7;
  --riso-success: #16A34A;
  --riso-warning: #D97706;
  --riso-danger: #DC2626;
  --riso-surface: #FFFFFF;
  --riso-text: #111827;
  --riso-neutral: #FFFFFF;
  --riso-bg: #FFF9F5;
  --font-riso: "Space Grotesk", sans-serif;
  --font-riso-mono: "Overpass Mono", monospace;
  --riso-radius-sm: 4px;
  --riso-radius-md: 8px;
  --riso-spacing-xs: 4px;
  --riso-spacing-sm: 8px;
  --riso-spacing-md: 12px;
  --riso-spacing-lg: 16px;
  --riso-spacing-xl: 24px;
  --riso-spacing-2xl: 32px;
}
```

Note: `--riso-bg` is set to `#FFF9F5` (warm off-white) per the Riso brand's "warm off-white paper surface" description, not the pure `#FFFFFF` surface token.

### Step 2: Add Google Fonts links to `index.html`

Add Space Grotesk and Overpass Mono font imports:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Overpass+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Step 3: Add Riso Tailwind tokens to `index.html`

Extend the Tailwind config with Riso colors, fonts, and radii:

```js
colors: {
  "riso-primary": "#F237A1",
  "riso-secondary": "#2C40A7",
  "riso-success": "#16A34A",
  "riso-warning": "#D97706",
  "riso-danger": "#DC2626",
  "riso-surface": "#FFFFFF",
  "riso-text": "#111827",
  "riso-bg": "#FFF9F5",
},
fontFamily: {
  "riso": ["Space Grotesk", "sans-serif"],
  "riso-mono": ["Overpass Mono", "monospace"],
},
borderRadius: {
  "riso-sm": "4px",
  "riso-md": "8px",
},
```

### Step 4: Create Riso-specific styles in `js/apps/memory/style.css`

This file is currently empty. Add Riso-themed styles for memory components:

**Key design decisions:**
- **Background**: Warm off-white `#FFF9F5` (paper surface)
- **Headings**: Federal-blue `#2C40A7` with offset print-shadow (1px 1px 0 rgba(242,55,161,0.15))
- **Interactive elements** (buttons, links, active nav): Fluorescent pink `#F237A1`
- **Decay stage badges**: Use Riso primary/secondary palette instead of generic green/yellow/orange/red
- **Sensory tags**: Pink-tinted chips instead of blue-100
- **Emotion tags**: Blue-tinted chips instead of purple-100
- **Cards**: White surface with 8px radius, subtle pink-tinted shadow
- **Section headers**: Overpass Mono, uppercase, small caps style
- **Nav bar**: Frosted glass with pink-tinted active state
- **Bottom nav**: Active tab in pink instead of iOS blue

```css
.memory-app {
  font-family: var(--font-riso);
  background-color: var(--riso-bg);
  color: var(--riso-text);
}

.memory-app .ios-header {
  background: rgba(255, 249, 245, 0.85);
  border-bottom-color: rgba(242, 55, 161, 0.1);
}

.memory-app .menu-title {
  font-family: var(--font-riso);
  color: var(--riso-secondary);
  text-shadow: 1px 1px 0 rgba(242, 55, 161, 0.12);
}

.memory-app .ios-back-btn {
  color: var(--riso-primary) !important;
}

.memory-app .ios-grouped-list {
  background-color: var(--riso-surface);
  border-radius: var(--riso-radius-md);
  box-shadow: 0 2px 8px rgba(242, 55, 161, 0.06);
}

.memory-app .ios-list-cell:active {
  background-color: rgba(242, 55, 161, 0.05);
}

.memory-app .ios-list-cell:not(:last-child)::after {
  background-color: rgba(242, 55, 161, 0.08);
}

.memory-app .ios-section-header {
  font-family: var(--font-riso-mono);
  color: var(--riso-secondary);
  letter-spacing: 0.08em;
}

.memory-app .ios-bottom-nav {
  background: rgba(255, 249, 245, 0.85);
  border-top-color: rgba(242, 55, 161, 0.1);
}

.memory-app .ios-bottom-nav-item.active {
  color: var(--riso-primary);
}

.memory-app .ios-search-bar {
  background-color: rgba(242, 55, 161, 0.06);
}

.memory-app .ios-segmented-control {
  background-color: rgba(44, 64, 167, 0.08);
}

.memory-app .ios-segment.active {
  background-color: var(--riso-surface);
  color: var(--riso-primary);
  box-shadow: 0 1px 3px rgba(242, 55, 161, 0.15);
}

/* Riso decay badges */
.memory-app .decay-badge-fresh { background: var(--riso-primary); color: white; }
.memory-app .decay-badge-fading { background: var(--riso-secondary); color: white; }
.memory-app .decay-badge-decaying { background: var(--riso-warning); color: white; }
.memory-app .decay-badge-weak { background: var(--riso-danger); color: white; }

/* Riso dot indicators */
.memory-app .decay-dot-fresh { background: var(--riso-primary); }
.memory-app .decay-dot-fading { background: var(--riso-secondary); }
.memory-app .decay-dot-decaying { background: var(--riso-warning); }
.memory-app .decay-dot-weak { background: var(--riso-danger); }

/* Riso sensory tags */
.memory-app .riso-sensory-tag {
  background: rgba(242, 55, 161, 0.1);
  color: var(--riso-primary);
  font-family: var(--font-riso);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--riso-radius-sm);
}

/* Riso emotion tags */
.memory-app .riso-emotion-tag {
  background: rgba(44, 64, 167, 0.1);
  color: var(--riso-secondary);
  font-family: var(--font-riso);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: var(--riso-radius-sm);
}

/* Riso action buttons */
.memory-app .riso-action-btn {
  color: var(--riso-primary);
  font-family: var(--font-riso);
  font-weight: 600;
}

.memory-app .riso-danger-btn {
  color: var(--riso-danger);
  font-family: var(--font-riso);
  font-weight: 600;
}

/* Riso large title */
.memory-app .riso-large-title {
  font-family: var(--font-riso);
  font-size: 32px;
  font-weight: 700;
  color: var(--riso-secondary);
  text-shadow: 1px 1px 0 rgba(242, 55, 161, 0.12);
  line-height: 1.2;
}

/* Riso empty state */
.memory-app .riso-empty-icon {
  color: var(--riso-primary);
  opacity: 0.3;
}

.memory-app .riso-empty-title {
  color: var(--riso-secondary);
  font-family: var(--font-riso);
}

.memory-app .riso-empty-text {
  color: var(--riso-text);
  opacity: 0.5;
  font-family: var(--font-riso);
}
```

### Step 5: Update `js/apps/memory/index.js` to use Riso classes

**Memory List (`renderMemoryList`):**
- Change root container class from `app-container bg-ios-bg` to `app-container memory-app`
- Update `getDecayStage` to return Riso badge/dot class names instead of Tailwind color classes
- Replace `bg-green-500`/`bg-yellow-500`/`bg-orange-500`/`bg-red-500` with `decay-dot-*`/`decay-badge-*` classes
- Replace `text-ios-blue` on action buttons with `riso-action-btn`
- Replace `text-ios-muted` on empty state with Riso empty classes
- Replace `bg-blue-100 text-blue-700` sensory tags with `riso-sensory-tag` (in detail view)

**Memory Detail (`renderMemoryDetail`):**
- Change root container class to `app-container memory-app`
- Replace `bg-purple-100 text-purple-700` emotion tags with `riso-emotion-tag`
- Replace `text-ios-blue` action buttons with `riso-action-btn`
- Replace `text-red-500` delete button with `riso-danger-btn`
- Replace `bg-blue-100 text-blue-700` sensory tags with `riso-sensory-tag`

### Step 6: Verify

- Open the app in browser, navigate to `/memory` and `/memory/:id`
- Confirm: warm off-white background, pink interactive elements, blue headings with print-shadow, Riso-styled badges/tags
- Confirm: other screens (chats, settings, world-info) are unchanged
- Confirm: no console errors from missing fonts or undefined CSS variables

## Files Modified

| File | Change |
|---|---|
| `css/shared.css` | Add `--riso-*` CSS custom properties |
| `index.html` | Add Space Grotesk + Overpass Mono font links, extend Tailwind config |
| `js/apps/memory/style.css` | Add all Riso-themed memory component styles |
| `js/apps/memory/index.js` | Update class names to use Riso tokens/badges |

## Risks

- **Font loading**: Space Grotesk and Overpass Mono are Google Fonts — CDN dependency. Mitigated by existing pattern (app already loads Be Vietnam Pro and Inter from Google Fonts).
- **Scope creep**: Only memory screens are changed. Other screens remain iOS/Kakao-styled. The `memory-app` class prefix ensures styles don't leak.
- **WCAG contrast**: Pink `#F237A1` on white `#FFF9F5` has contrast ratio ~3.5:1, which passes AA for large text but not for small text. For small text, use `#2C40A7` (blue) or `#111827` (text). Pink is reserved for interactive/large elements per Riso spec.

## Open Questions

None — the design tokens are fully specified in `DESIGN_riko.md` and `SKILL_riko.md`.
