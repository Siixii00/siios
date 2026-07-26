# Facebook App — Meta Design System Implementation

## Goal
Rewrite `js/apps/facebook/style.css` using Meta's design tokens from `DESIGN-meta.md`. Convert from dark theme to light theme (white canvas).

## Design Token Mapping

### Colors
| Element | Meta Token | Value |
|---|---|---|
| Canvas (page bg) | `colors.canvas` | `#ffffff` |
| Surface soft | `colors.surface-soft` | `#f1f4f7` |
| Primary text | `colors.ink` | `#1c1e21` |
| Secondary text | `colors.charcoal` | `#444950` |
| Muted text | `colors.steel` | `#5d6c7b` |
| Weakest text | `colors.stone` | `#8595a4` |
| Border/hairline | `colors.hairline` | `#ced0d4` |
| Soft border | `colors.hairline-soft` | `#dee3e9` |
| Primary accent | `colors.primary` | `#0064e0` |
| FB Blue | `colors.fb-blue` | `#1876f2` |
| Success | `colors.success` | `#31a24c` |
| Attention | `colors.attention` | `#f2a918` |
| Critical | `colors.critical` | `#e41e3f` |

### Typography
| Element | Meta Token | Value |
|---|---|---|
| Body text | `typography.body-md` | 16px/400/1.50, -0.16px tracking |
| Body bold | `typography.body-md-bold` | 16px/700/1.50 |
| Small text | `typography.body-sm` | 14px/400/1.43, -0.14px tracking |
| Small bold | `typography.body-sm-bold` | 14px/700/1.43 |
| Caption | `typography.caption` | 12px/400/1.33 |
| Heading | `typography.heading-sm` | 24px/500/1.25 |
| Subtitle | `typography.subtitle-lg` | 18px/700/1.44 |
| Button | `typography.button-md` | 14px/700/1.43, -0.14px tracking |

Font family: Optimistic VF fallback to system fonts (no Google Fonts needed for app).

### Border Radius
| Element | Token | Value |
|---|---|---|
| Buttons/pills | `rounded.full` | 100px |
| Cards | `rounded.xxxl` | 32px |
| Inputs | `rounded.lg` | 8px |
| Small items | `rounded.xl` | 16px |
| Circle avatars | `rounded.circle` | 50% |

### Spacing
| Token | Value |
|---|---|
| `spacing.xxs` | 4px |
| `spacing.xs` | 8px |
| `spacing.sm` | 10px |
| `spacing.md` | 12px |
| `spacing.base` | 16px |
| `spacing.lg` | 20px |
| `spacing.xl` | 24px |
| `spacing.xxl` | 32px |

## Component Styles

### Topbar
- Background: `canvas` white
- Border-bottom: `1px solid hairline-soft`
- Padding: `46px 16px 16px` (safe area + content)
- Layout: flex, space-between
- Height: auto

### Sidebar
- Background: `canvas` white
- Width: 280px (desktop), hidden on mobile
- Nav items: flex row, padding `spacing.md`, border-radius `rounded.lg`
- Active state: background `surface-soft`, text `ink`

### Feed
- Background: `surface-soft` (#f1f4f7)
- Max-width: 680px
- Padding: `spacing.base`

### Cards (posts, composer)
- Background: `canvas` white
- Border-radius: `rounded.xxxl` (32px)
- Border: `1px solid hairline-soft`
- Padding: `spacing.xl`
- Shadow: none (flat design per Meta spec)

### Buttons
- Primary CTA: background `primary` (#0064e0), text white, radius `rounded.full`
- Secondary: background transparent, border `2px solid ink-deep`, radius `rounded.full`
- Ghost: background transparent, border `2px solid rgba(10,19,23,0.12)`
- Icon buttons: 40x40px circle, background `canvas`

### Reaction picker
- Background: `canvas` white
- Border-radius: `rounded.full`
- Padding: `spacing.xs`
- Shadow: subtle elevation
- Icons: 32x32px

### Inputs
- Background: `canvas`
- Border: `1px solid hairline`, radius `rounded.lg`
- Focus: border `2px solid fb-blue`
- Height: 44px

### Avatars
- Size variants: 32px (sm), 40px (default), 56px (lg)
- Border-radius: `rounded.circle`
- Background: `surface-soft`

## Responsive
- < 768px: sidebar hidden, feed full-width, right sidebar hidden
- Topbar: search collapses, actions stay

## Files to Modify
1. `js/apps/facebook/style.css` — full rewrite with Meta tokens

## Validation
- Visual check: white canvas, no dark backgrounds
- Visual check: pill-shaped buttons (rounded.full = 100px)
- Visual check: 32px rounded cards
- Visual check: cobalt blue (#0064e0) primary buttons
- Visual check: proper text hierarchy (ink/charcoal/steel)
