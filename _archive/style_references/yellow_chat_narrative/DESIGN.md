---
name: Yellow Chat Narrative
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4b4731'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7c775f'
  outline-variant: '#cdc7aa'
  surface-tint: '#6a5f00'
  primary: '#6a5f00'
  on-primary: '#ffffff'
  primary-container: '#ffe600'
  on-primary-container: '#726600'
  inverse-primary: '#dec800'
  secondary: '#7b5454'
  on-secondary: '#ffffff'
  secondary-container: '#fecbc9'
  on-secondary-container: '#7a5353'
  tertiary: '#006a6a'
  on-tertiary: '#ffffff'
  tertiary-container: '#00feff'
  on-tertiary-container: '#007272'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#fde400'
  primary-fixed-dim: '#dec800'
  on-primary-fixed: '#201c00'
  on-primary-fixed-variant: '#504700'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#ecbab9'
  on-secondary-fixed: '#2f1313'
  on-secondary-fixed-variant: '#613d3d'
  tertiary-fixed: '#00fbfc'
  tertiary-fixed-dim: '#00dcdd'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f50'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  kakao-yellow: '#FFE600'
  kakao-brown: '#3C1E1E'
  chat-bg: '#ABC1D1'
  bubble-user: '#FFE600'
  bubble-other: '#FFFFFF'
  text-primary: '#191919'
  text-secondary: '#666666'
typography:
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  title-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  chat-text:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 20px
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-side: 16px
  gutter: 12px
  tab-bar-height: 64px
  chat-gap: 8px
  bubble-padding: 10px 14px
---

## Brand & Style

This design system is inspired by the playful, efficient, and ubiquitous nature of modern mobile messaging. The aesthetic prioritizes immediate recognition and high legibility through a "Playful Corporate" lens. It balances a vibrant, energetic primary palette with a grounded, functional structural system.

The design style is **Corporate / Modern** with a **Tactile** twist. It utilizes soft, approachable shapes and subtle depth to make digital interactions feel friendly and responsive. The core experience is built around conversational fluidity, using high-contrast accents to guide the user's eye toward primary actions and navigation points.

## Colors

The palette is anchored by the iconic Kakao Yellow, which serves as the primary identifier for brand moments and user-originated content. 

- **Primary:** The Yellow (#FFE600) is reserved for high-visibility elements like the user's own chat bubbles, primary action buttons, and active states.
- **Contrast:** The Dark Brown (#3C1E1E) provides a softer, more organic contrast than pure black. It is used for typography on yellow backgrounds and for primary iconography.
- **Backgrounds:** General application backgrounds should remain off-white or light gray (#F9F9F9) to maintain a clean feel. However, the specific chat interface uses a muted blue-gray (#ABC1D1) to make the yellow and white chat bubbles pop.
- **System Colors:** Success, error, and warning states should use standard semantic hues but with slightly rounded saturations to match the friendly brand voice.

## Typography

The system utilizes **Be Vietnam Pro** to emulate the clean, contemporary feel of system fonts while adding a touch of warmth and approachability. 

- **Hierarchy:** Use bold weights for headers and names in the chat list to ensure quick scanning. 
- **Chat Bubbles:** The `chat-text` level is optimized for long-form reading within bubbles, featuring a slightly tighter line height than standard body text to keep conversations compact.
- **Labels:** Use `label-md` for timestamps and secondary metadata, often paired with the secondary text color or white when placed against dark backgrounds.

## Layout & Spacing

This is a **Mobile-First Fluid** layout. The design relies on a strict 4px baseline grid to ensure alignment across different screen densities.

- **Chat Interface:** Messages from the same sender are grouped with a `4px` gap, while messages between different senders use a `12px` gap. 
- **Margins:** Standard horizontal padding for all views is `16px`.
- **Bottom Navigation:** A thick, persistent bottom tab bar (`64px` height) provides a sturdy foundation for the app. Icons within the tab bar are centered with ample touch targets.
- **Safe Areas:** Adhere strictly to device safe areas (notches and home indicators) while maintaining the background color of the active view for a seamless look.

## Elevation & Depth

Hierarchy is achieved through a combination of **Tonal Layers** and **Ambient Shadows**.

- **Surfaces:** The main background is the lowest level. Chat bubbles and cards sit one level above. 
- **Shadows:** Use extremely soft, low-opacity shadows (e.g., `0px 2px 8px rgba(0,0,0,0.05)`) for cards and floating action buttons. Bubbles themselves do not typically use shadows but rely on color contrast against the chat background.
- **Active States:** When a list item or button is pressed, it should use a subtle gray overlay or a slight scale-down effect rather than a heavy shadow change to maintain the "soft" feel.

## Shapes

The shape language is defined by friendly, generous curves. 

- **Standard Components:** Most buttons and input fields use a `0.5rem` (8px) radius.
- **Chat Bubbles:** Bubbles use a specific logic: the outer corners are highly rounded (`12px` to `16px`), while the corner pointing toward the sender's side can be slightly sharper to indicate directionality.
- **Avatars:** User profile images should always be rendered as "Squircle" or heavily rounded shapes (approx `12px` radius) rather than perfect circles to feel more modern and organic.

## Components

### Chat Bubbles
- **User Bubble:** Background: `#FFE600`; Text: `#3C1E1E`. Aligned to the right.
- **Other/AI Bubble:** Background: `#FFFFFF`; Text: `#191919`. Aligned to the left.
- **Shape:** Softly rounded corners with a small tail or directional bias.

### Buttons
- **Primary:** Solid Kakao Yellow with Brown text. No border.
- **Secondary:** Light gray or ghost buttons with Brown icons.

### Tab Bar
- **Style:** Thick (`64px`), solid white or very light gray background.
- **Icons:** Large, clear stroke icons (`24px-28px`). The active icon should be the primary Brown or a filled version of the stroke icon.

### Input Fields
- **Chat Input:** A white, rounded rectangle that expands vertically. The "Send" button is a simple icon that turns Yellow only when text is present.

### Lists
- **Chat List:** High-density rows with a `12px` avatar on the left, name in bold, and a truncated message preview. Right-aligned timestamp in a smaller, lighter font.