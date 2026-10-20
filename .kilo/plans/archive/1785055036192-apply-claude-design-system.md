# Plan: Apply Claude Design System to SXIOS App

## Context

The user wants to apply the Claude design system (defined in `docs/SKILL_claude.md` and `docs/design/DESIGN_claude.md`) to the SXIOS mobile web app. The app currently uses an iOS-style design with Kakao-style chat components. The Claude design system is a research-journal aesthetic: warm ivory parchment backgrounds, near-black slate ink, zero shadows, hard-edged contrast, flat buttons with 0px corners, and an asymmetric flat-top/rounded-bottom primary CTA.

## Design Tokens (from DESIGN_claude.md)

| Token | Value |
|-------|-------|
| primary | #141413 |
| secondary | #FAF9F6 |
| success | #16A34A |
| warning | #D97706 |
| danger | #DC2626 |
| surface | #FFFFFF |
| text | #111827 |
| neutral | #FFFFFF |
| h1 font | Anthropic Sans, 2rem |
| body font | Anthropic Sans, 1rem |
| label font | JetBrains Mono, 0.75rem |
| rounded sm | 4px |
| rounded md | 8px |
| spacing sm | 4px |
| spacing md | 8px |
| spacing scale | 4/8/12/16/24/32 |

## Key Design Principles

- Warm ivory parchment (#FAF9F6) as page background — never pure white
- Near-black slate (#141413) as dominant ink
- Zero shadows, zero glow
- Buttons: flat, 0px corners; primary CTA has asymmetric flat-top/rounded-bottom
- Emphasis from typography and underlines, never from color or glow
- Hard-edged contrast, alternating ivory ↔ near-black rhythm
- Typography: Anthropic Sans (UI), JetBrains Mono (labels/caps)
- Minimal chromatic budget: earthy clay accent held in reserve

## Implementation Steps

### Step 1: Add Claude CSS tokens file
Create `css/claude-tokens.css` with all Claude design tokens as CSS custom properties under `:root` (or a `.claude-theme` class selector for future theme switching).

```css
:root {
  --claude-primary: #141413;
  --claude-secondary: #FAF9F6;
  --claude-success: #16A34A;
  --claude-warning: #D97706;
  --claude-danger: #DC2626;
  --claude-surface: #FFFFFF;
  --claude-text: #111827;
  --claude-neutral: #FFFFFF;
  --claude-nav-bg: rgba(250, 249, 246, 0.92);
  --claude-search-bg: rgba(20, 20, 19, 0.06);
  --claude-border: rgba(20, 20, 19, 0.12);
  --claude-muted: #6B6B6B;
  --font-claude: "Anthropic Sans", "Inter", sans-serif;
  --font-claude-mono: "JetBrains Mono", monospace;
  --claude-radius-sm: 4px;
  --claude-radius-md: 8px;
  --claude-radius-none: 0px;
  --claude-radius-cta-bottom: 8px;
  --claude-spacing-xs: 4px;
  --claude-spacing-sm: 8px;
  --claude-spacing-md: 12px;
  --claude-spacing-lg: 16px;
  --claude-spacing-xl: 24px;
  --claude-spacing-2xl: 32px;
}
```

### Step 2: Add Anthropic Sans + JetBrains Mono font imports
In `index.html`, add Google Fonts imports for Inter (as Anthropic Sans fallback) and JetBrains Mono. Anthropic Sans is not publicly available on Google Fonts, so use Inter as the closest public substitute with the same variable `--font-claude` token.

### Step 3: Link claude-tokens.css in index.html
Add `<link rel="stylesheet" href="css/claude-tokens.css?v=1">` after the existing CSS links.

### Step 4: Override shared.css root variables with Claude tokens
In `css/shared.css`, replace the `:root` variable values with Claude design system values. The existing variable names (like `--ios-bg`, `--ios-text`, etc.) will be repurposed to map to Claude tokens so all existing component CSS automatically picks up the new theme:

| Existing Var | New Claude Value |
|---|---|
| --ios-blue | #141413 (primary as accent) |
| --ios-bg | #FAF9F6 (warm ivory) |
| --ios-surface | #FFFFFF |
| --ios-text | #111827 |
| --ios-muted | #6B6B6B |
| --ios-accent | #16A34A |
| --ios-border | rgba(20,20,19,0.12) |
| --ios-nav-bg | rgba(250,249,246,0.92) |
| --ios-search-bg | rgba(20,20,19,0.06) |
| --font-ios-display | "Inter", sans-serif |
| --font-ios-text | "Inter", sans-serif |
| --radius-group | 0px (hard-edged) |
| --radius-bubble | 0px |

Also update the riso tokens to Claude equivalents.

### Step 5: Override ios.css component styles for Claude aesthetic
Key changes:
- Remove all `backdrop-filter: blur()` — Claude uses hard-edged contrast, no glass
- Remove all `box-shadow` references — zero shadows
- `.ios-header` / `.ios-nav-bar`: solid background, no blur, no border-bottom shadow
- `.ios-list-cell:active` → background #E8E6E1 (warm gray)
- `.ios-toggle` → square corners (0px radius), primary color when active
- `.ios-btn` → 0px border-radius, no background blur
- `.ios-btn-primary` → background #141413, color #FAF9F6, border-radius: 0 0 8px 8px (asymmetric CTA)
- `.ios-search-bar` → 0px border-radius
- `.ios-segmented-control` → 0px border-radius, no box-shadow on active segment
- `.ios-input` / `.ios-textarea` → 0px border-radius, focus ring uses primary color
- `.ios-grouped-list` → 0px border-radius
- `.ios-icon-badge` → 0px border-radius
- `.ios-chip` → 0px border-radius
- `.ios-slider` → square thumb, no shadow

### Step 6: Override shared.css global styles for Claude aesthetic
- `body` → font-family: Inter, background: #FAF9F6, color: #111827
- `.ios-btn` → border-radius: 0px
- `.ios-btn-primary` → border-radius: 0 0 8px 8px (asymmetric CTA)
- `.toast` → border-radius: 0px, no backdrop-filter
- `.phone-frame` → update shadow to minimal, border colors to slate
- `.lock-wallpaper` → warm stone gradient (ivory/slate)
- `.home-wallpaper` → warm ivory background
- `.home-app-icon-bg` → 0px border-radius, no box-shadow
- `.home-app-label` → color: #111827, no text-shadow
- `.home-dock` → 0px border-radius, no backdrop-filter, solid warm background
- `.home-dock-icon-bg` → 0px border-radius, no box-shadow
- `.home-page-dot` → slate colors
- Remove all `box-shadow` and `text-shadow` throughout

### Step 7: Override kakao.css for Claude aesthetic
- `.kakao-header` → solid background, no blur, 0px border-radius
- `.kakao-bottom-nav` → solid background, no border-top shadow
- `.kakao-fab` → 0px border-radius, no box-shadow, primary color background
- `.kakao-bubble-left` / `.kakao-bubble-right` → 0px border-radius, no box-shadow, no arrow pseudo-elements
- `.kakao-chat-input-area` → solid background
- `.kakao-chat-textarea` → 0px border-radius
- `.kakao-send-btn` → asymmetric CTA border-radius (0 0 8px 8px)
- `.kakao-unread-badge` → 0px border-radius
- `.kakao-avatar` → 0px border-radius (square avatars)
- `.kakao-avatar-group` → 0px border-radius

### Step 8: Update index.html
- Change `<meta name="theme-color">` from `#007AFF` to `#FAF9F6`
- Change `<body>` classes from `bg-ios-bg text-ios-text` to use Claude tokens
- Add JetBrains Mono font import
- Update tailwind.config colors to include Claude palette
- Update tailwind.config fontFamily to include Claude fonts
- Update tailwind.config borderRadius to include Claude values (0px defaults)

### Step 9: Update homescreen.js
- `.home-app-icon-bg` → remove box-shadow, use 0px border-radius
- `.home-app-label` → dark text on ivory, no text-shadow
- `.home-dock` → solid warm background, no blur, 0px border-radius
- `.home-dock-icon-bg` → 0px border-radius, no box-shadow
- App icon colors → map to Claude palette (primary #141413, muted earthy tones)

### Step 10: Update lockscreen.js
- Lock screen wallpaper → warm stone/ivory gradient
- Time/date text → #111827 on ivory
- Unlock hint → dark text

### Step 11: Update components.js
- `createIOSNavBar` → use Claude font, no blur
- `createKakaoBottomNav` → solid background
- `createKakaoFAB` → 0px corners, no shadow
- `createKakaoBubble` → 0px corners, no arrows
- `createKakaoChatCell` → square avatar

## Files to Modify

1. **css/claude-tokens.css** — NEW: Claude design tokens
2. **css/shared.css** — Override root vars, global styles, remove shadows/blur
3. **css/ios.css** — Override component styles for Claude aesthetic
4. **css/kakao.css** — Override chat component styles
5. **index.html** — Font imports, meta theme-color, tailwind config, body classes
6. **js/homescreen.js** — App icon styling, dock styling
7. **js/lockscreen.js** — Wallpaper colors, text colors
8. **js/components.js** — Component factory adjustments

## Risks

- Anthropic Sans is not available on Google Fonts; will use Inter as closest public substitute
- Removing all blur/shadow effects is a significant visual departure; some components may look "flat" in unexpected ways — need visual verification
- The asymmetric CTA (flat-top/rounded-bottom) is a signature element but may look odd on some button placements — apply only to primary full-width CTAs
- Existing apps (40+ sub-apps) may have inline styles or app-specific CSS that still reference old iOS colors — those would need separate updates

## Validation

- Open the app in browser, verify: warm ivory background, near-black text, zero shadows, zero blur, square corners on all components except primary CTA
- Check lock screen: warm stone gradient, dark text
- Check home screen: square icons, no shadows, dark labels on ivory
- Check chat list: square avatars, flat bubbles, no shadows
- Check settings: flat list cells, no blur nav, square toggles
- Verify all interactive states still work (hover, active, focus-visible)
