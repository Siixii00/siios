# Album App Redesign — Zapier Design System

## Context
The album app (`js/apps/album/`) currently uses a dark iOS-style theme with overlapping header elements (back button, title, tab bar). The user wants to:
1. Rebuild the album app using the Zapier design system from `docs/design/DESIGN-zapier.md`
2. Fix the header layout so the back button and title don't overlap
3. Reserve proper space for the title bar (back button + title + actions)

## Design System Mapping (Zapier → Album)

| Element | Zapier Token | Value |
|---|---|---|
| Page background | `colors.canvas` | `#fffefb` |
| Card/surface | `colors.canvas-soft` | `#f8f4f0` |
| Primary text | `colors.ink` | `#201515` |
| Secondary text | `colors.body` | `#605d52` |
| Muted text | `colors.body-mid` | `#939084` |
| Weakest text | `colors.mute` | `#c5c0b1` |
| CTA / Active accent | `colors.primary` | `#ff4f00` |
| CTA text on primary | `colors.on-primary` | `#fffefb` |
| Dark surface | `colors.ink` | `#201515` |
| Border radius (cards/buttons) | `rounded.md` | `12px` |
| Border radius (inputs/pills) | `rounded.sm` | `6px` |
| Border radius (badges) | `rounded.pill` | `9999px` |
| Body font | Inter, 400/600 | system-ui fallback |
| Title font | Inter, 600, 17px | `typography.body-sm-strong` |
| Tab label font | Inter, 400, 16px | `typography.body-sm` |
| Active tab indicator | `colors.primary` | `#ff4f00` |
| Spacing unit | 4px base | `spacing.*` tokens |

## Implementation Steps

### Step 1: Rewrite `js/apps/album/style.css`

Replace the entire CSS with Zapier-themed styles. Key changes:

**Root variables:**
```css
.album-app {
    --zapier-canvas: #fffefb;
    --zapier-canvas-soft: #f8f4f0;
    --zapier-ink: #201515;
    --zapier-ink-soft: #2f2a26;
    --zapier-body: #605d52;
    --zapier-body-mid: #939084;
    --zapier-mute: #c5c0b1;
    --zapier-primary: #ff4f00;
    --zapier-on-primary: #fffefb;
    --zapier-safe-top: env(safe-area-inset-top, 44px);
    ...
}
```

**Header (fixed layout — NO overlapping):**
- Use `position: sticky; top: 0; z-index: 10` so header stays visible
- Flex row: `[back-btn] [title (flex:1, center)] [action-btn]`
- NO `position: absolute` on any header child
- Background: `var(--zapier-canvas)` with subtle bottom border `1px solid var(--zapier-mute)`
- Padding-top: `calc(var(--zapier-safe-top) + 8px)`
- Min-height: `calc(var(--zapier-safe-top) + 44px)` — enough for safe area + 44px nav bar

**Back button:**
- Color: `var(--zapier-ink)`
- Font: Inter 16px 400
- Icon: `fa-chevron-left` + "返回" text
- `flex-shrink: 0`

**Title:**
- Font: Inter 17px 600, color `var(--zapier-ink)`
- `flex: 1; text-align: center`
- `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`

**Action button (+):**
- Color: `var(--zapier-primary)` (orange accent)
- `flex-shrink: 0`

**Tab bar:**
- Background: `var(--zapier-canvas)`
- Border-bottom: `1px solid var(--zapier-mute)`
- Tab buttons: Inter 16px 400, color `var(--zapier-body-mid)`
- Active tab: color `var(--zapier-ink)`, weight 600
- Active indicator: `2px solid var(--zapier-primary)` (orange), width 60% centered
- `flex-shrink: 0`

**Gallery grid:**
- Background: `var(--zapier-canvas-soft)`
- Grid: `repeat(3, 1fr)`, gap `4px`, padding `12px`
- Items: `border-radius: 12px` (rounded.md), overflow hidden
- Source badge: `rounded.pill` badge, background `var(--zapier-ink)`, text `var(--zapier-on-primary)`, Inter 11px

**Empty state:**
- Background: `var(--zapier-canvas-soft)`
- Icon color: `var(--zapier-mute)`
- Text: `var(--zapier-body-mid)`

**Image viewer:**
- Backdrop: `rgba(32, 21, 21, 0.92)` (ink-based dark)
- Action buttons: `border-radius: 12px`, background `rgba(255,255,255,0.12)`, backdrop-filter blur
- Delete button: color `var(--zapier-primary)` (orange for danger)

### Step 2: Update `js/apps/album/index.js`

Minimal HTML structure changes — the CSS handles the visual overhaul. Key adjustments:

1. **Header structure** — keep the current flex layout (back-btn / title / actions) which is already correct from the previous fix. No `position: absolute` elements.
2. **Tab bar** — keep as-is, CSS handles theming.
3. **Gallery items** — update `source-badge` markup to use pill-shaped badge instead of gradient overlay:
   ```html
   <span class="source-badge"><i class="fas fa-{icon}"></i> {label}</span>
   ```
4. **Upload button** — change icon from `fa-plus` to `fa-plus` (same), but style as Zapier `button-primary` (orange, rounded.md) in CSS.

### Step 3: Verify no overlap

The header uses a clean flex layout:
- `display: flex; align-items: center; justify-content: space-between`
- Back button: `flex-shrink: 0` — takes its natural width
- Title: `flex: 1; text-align: center` — fills remaining space, centered
- Actions: `flex-shrink: 0` — takes its natural width
- No `position: absolute` on any child → no overlap possible

## Files to Modify

1. `js/apps/album/style.css` — full rewrite with Zapier design tokens
2. `js/apps/album/index.js` — minor HTML adjustments (badge style, button class)

## Additional Change
3. `index.html` — add Inter Google Fonts link: `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`

## Risks
- The `--safe-top` variable uses a fixed `44px` fallback; should use `env(safe-area-inset-top)` for real devices.

## Validation
- Visual check: back button and title do not overlap
- Visual check: tab bar is below header, not overlapping
- Visual check: Zapier warm-cream palette renders correctly (not dark theme)
- Visual check: orange accent appears on active tab indicator and CTA buttons
- Functional check: tab switching, image upload, image viewer, delete all still work
