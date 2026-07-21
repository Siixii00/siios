# iOS Classic AI PWA - Implementation Plan

## Project Overview

A Progressive Web App for AI character interactions with:
- **System UI**: iOS style (Settings, World Info, Entry Editor, API Config)
- **Chat Interface**: KakaoTalk style (Chats list, Chat Detail)

**Tech Stack**: HTML + Tailwind CSS v3 (CDN) + Vanilla JavaScript + IndexedDB (idb library)
**Deployment**: Vercel (static hosting, no build step)

---

## Design Systems

### iOS Design System (System UI)

```css
:root {
  --color-primary: #007AFF;
  --color-background: #F2F2F7;
  --color-surface: #FFFFFF;
  --color-text: #000000;
  --color-muted: #8E8E93;
  --color-accent: #34C759;
  --color-border: #C6C6C8;
  --color-nav-bg: rgba(255, 255, 255, 0.75);
  --font-primary: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  --radius-group: 10px;
  --radius-bubble: 18px;
  --spacing-edge: 16px;
}
```

**Key Styles**:
- `backdrop-filter: blur(20px)` for nav bars
- 0.5px hairline borders (`#C6C6C8`)
- Large Title navigation (34px SF Pro Display Bold)
- Grouped list style with 10px radius

### Kakao Design System (Chat Interface)

```css
:root {
  --kakao-yellow: #FFE600;
  --kakao-brown: #3C1E1E;
  --chat-bg: #ABC1D1;
  --bubble-user: #FFE600;
  --bubble-other: #FFFFFF;
  --text-primary: #191919;
  --text-secondary: #666666;
}
```

**Typography**: Be Vietnam Pro (Google Fonts CDN)

**Key Styles**:
- Chat background: `#ABC1D1`
- User bubbles: `#FFE600` (Kakao Yellow), right-aligned
- AI bubbles: `#FFFFFF`, left-aligned
- Bubble tails via CSS pseudo-elements

---

## Architecture

```
/
├── index.html              # Entry point, redirects to chats.html
├── chats.html              # Chat list (Kakao style)
├── chat.html               # Chat detail (Kakao style)
├── world-info.html         # World info list (iOS style)
├── entry-editor.html       # Entry editor (iOS style)
├── settings.html           # Settings (iOS style)
├── api-config.html         # API configuration (iOS style)
├── css/
│   └── shared.css          # Shared styles (iOS + Kakao tokens)
├── js/
│   ├── app.js              # App initialization, routing
│   ├── db.js               # IndexedDB wrapper (idb library)
│   ├── api.js              # LLM API client
│   ├── components.js       # Reusable UI components
│   └── pages/              # Page-specific logic
│       ├── chats.js
│       ├── chat.js
│       ├── world-info.js
│       ├── entry-editor.js
│       ├── settings.js
│       └── api-config.js
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
└── assets/
    └── icons/              # PWA icons
```

---

## Data Models (IndexedDB)

### Database: `ios-classic-ai`

```javascript
// Chats store
{
  id: "uuid",
  character_id: "uuid",
  character_name: "string",
  character_avatar: "url",
  last_message: "string",
  last_updated: "timestamp",
  unread: "number"
}

// Messages store
{
  id: "uuid",
  chat_id: "uuid",
  role: "user" | "assistant",
  content: "string",
  timestamp: "timestamp"
}

// WorldInfo store
{
  id: "uuid",
  name: "string",
  keywords: ["string"],
  content: "string",
  insertion: "before" | "after" | "system",
  priority: "number",
  enabled: "boolean",
  created_at: "timestamp",
  updated_at: "timestamp"
}

// Characters store
{
  id: "uuid",
  name: "string",
  avatar: "url",
  description: "string",
  personality: "string",
  system_prompt: "string",
  created_at: "timestamp"
}

// Settings store (singleton key-value)
{
  key: "api_url" | "api_key" | "context_size" | "temperature" | "top_p" | "frequency_penalty" | "presence_penalty" | "stream_responses",
  value: "any"
}
```

---

## Screen Specifications

### 1. Chats (Kakao Style)

**Route**: `/chats.html`

**Layout**:
- Header: 56px, title "聊天", search/create/settings icons
- Main: Scrollable chat list
- Bottom Nav: 64px, 3 tabs (Friends, Chats active, Explore, More)
- FAB: 56x56px, Kakao Yellow, bottom-right

**Chat Cell** (72px height):
- Avatar: 56px rounded
- Name: 18px bold, text-primary
- Preview: 14px, text-secondary, truncate
- Timestamp: 12px, text-secondary
- Unread badge: Kakao Yellow pill

**Reference**: `kakao_style_4/code.html`

### 2. Chat Detail (Kakao Style)

**Route**: `/chat.html?id={chat_id}`

**Layout**:
- Header: Fixed, 56px, character name centered, back button + menu
- Main: Scrollable messages, padding-bottom for input
- Input: Fixed bottom, white background, expanding textarea

**Message Bubbles**:
- User: `#FFE600`, right-aligned, 14px radius, tail on right
- AI: `#FFFFFF`, left-aligned, 14px radius, tail on left, avatar + name above

**Bubble Tail CSS** (from `kakao_style_2/code.html`):
```css
.bubble-left::after {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 10px solid #FFFFFF;
}

.bubble-right::after {
  content: '';
  position: absolute;
  right: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 10px solid #FFE600;
}
```

**Reference**: `kakao_style_2/code.html`

### 3. World Info (iOS Style)

**Route**: `/world-info.html`

**Layout**:
- Header: Large Title "World Info", "+" button, search bar
- Main: Grouped list (white cards, 10px radius)
- Bottom Nav: 83px, 3 tabs (Chats, World Info active, Settings)

**Entry Cell** (64px min-height):
- Name: 17px semibold
- Preview: 15px, ios-muted, line-clamp-2
- Chevron: right

**Search**: 36px height, `rgba(118, 118, 128, 0.12)` background

**Reference**: `world_info/code.html`

### 4. Entry Editor (iOS Style)

**Route**: `/entry-editor.html?id={entry_id}` (null for new)

**Layout**:
- Header: "Cancel" | "New Entry" | "Done" (bold)
- Form: Grouped list sections

**Fields**:
- Keywords: Text input, chips display
- Content: 200px textarea
- Insertion: Segmented control (Before, After, System)
- Priority: Number input or slider
- Enabled: Toggle

**Reference**: `ios_style_1/code.html`

### 5. Settings (iOS Style)

**Route**: `/settings.html`

**Layout**:
- Header: Large Title "設定"
- Main: Grouped sections
- Bottom Nav: Settings tab active

**Sections**:
1. Profile Card: Avatar, "Sign in with GitHub"
2. Account: Cloud Sync (toggle), Backup
3. App Settings: Appearance, Notifications, Language
4. Intelligence: API Settings
5. About: Version, Terms, GitHub

**Reference**: `ios_style_2/code.html`

### 6. API Config (iOS Style)

**Route**: `/api-config.html`

**Layout**:
- Header: Inline title "API 設定", back button
- Main: Grouped forms

**Fields**:
- API URL: Full-width input, `https://...` placeholder
- API Key: Password input, "sk-..." placeholder
- Context Size: Slider or input
- Test Button: Full-width, primary blue
- Status: 12px dot (green/red)

**Generation Parameters** (from `ios_style_4/code.html`):
- Temperature: 0-2, step 0.1, default 0.7
- Top P: 0-1, step 0.05, default 1.0
- Frequency Penalty: -2 to 2, step 0.1, default 0
- Presence Penalty: -2 to 2, step 0.1, default 0

**Reference**: `ios_style_4/code.html`

---

## Implementation Phases

### Phase 1: Foundation (Day 1)

1. **Setup Project Structure**
   - Create directory structure
   - Setup `manifest.json` for PWA
   - Create `sw.js` service worker
   - Create shared CSS with design tokens

2. **Database Layer** (`js/db.js`)
   - Initialize IndexedDB with idb library
   - Create stores: chats, messages, worldInfo, characters, settings
   - CRUD operations for each store

3. **Shared Components** (`js/components.js`)
   - iOS Nav Bar (Large Title)
   - iOS Inline Nav Bar
   - iOS Grouped List
   - iOS List Cell
   - iOS Search Bar
   - iOS Segmented Control
   - iOS Toggle
   - iOS Slider
   - Kakao Bottom Nav
   - Kakao FAB
   - Kakao Chat Cell
   - Kakao Chat Bubble

### Phase 2: iOS Screens (Day 2)

4. **Settings Page** (`settings.html`)
   - Large Title header
   - Grouped sections with icons
   - Navigation to API Config

5. **API Config Page** (`api-config.html`)
   - Inline header
   - Form inputs with validation
   - Test connection functionality
   - Generation parameters with sliders

6. **World Info Page** (`world-info.html`)
   - Large Title + Search
   - Grouped list with search filtering
   - Empty state

7. **Entry Editor Page** (`entry-editor.html`)
   - Form with validation
   - Keywords as chips
   - Segmented control for insertion
   - Save/Cancel actions

### Phase 3: Chat Interface (Day 3)

8. **Chats List Page** (`chats.html`)
   - Header with actions
   - Chat cells with avatars
   - Unread badges
   - FAB for new chat
   - Bottom nav

9. **Chat Detail Page** (`chat.html`)
   - Inline header with character name
   - Message list with bubble tails
   - Expanding input area
   - Send button (active when text present)
   - Keyboard handling

### Phase 4: Integration (Day 4)

10. **API Client** (`js/api.js`)
    - OpenAI-compatible API client
    - Streaming support
    - World Info injection
    - Error handling

11. **Routing & State** (`js/app.js`)
    - URL parameter parsing
    - Page initialization
    - Global state management

12. **PWA Features**
    - Offline support via service worker
    - Install prompt
    - Background sync (future)

### Phase 5: Polish (Day 5)

13. **Micro-interactions**
    - Button press feedback
    - Scroll header transitions
    - Haptic feedback (vibration API)
    - Loading states

14. **Edge Cases**
    - Empty states for all lists
    - Error handling
    - Offline mode

15. **Testing & Deployment**
    - Manual testing
    - Vercel deployment
    - PWA installation test

---

## CDN Dependencies

```html
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet"/>

<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>

<!-- IndexedDB Wrapper -->
<script src="https://cdn.jsdelivr.net/npm/idb@7/build/umd/index.min.js"></script>
```

---

## PWA Manifest

```json
{
  "name": "iOS Classic AI",
  "short_name": "AI Companion",
  "description": "AI character interactions PWA",
  "start_url": "/chats.html",
  "display": "standalone",
  "background_color": "#F2F2F7",
  "theme_color": "#007AFF",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Key Flows Implementation

### Configure LLM API

1. User on Settings -> taps "API 設定"
2. Opens `api-config.html`
3. User enters URL, Key
4. Taps "Test Connection" -> shows loading spinner
5. Success: green dot, "Connected"
6. Error: red text below form

### Add World Lore

1. User on World Info -> taps "+" in header
2. Opens `entry-editor.html` (no id param)
3. User fills keywords, content, insertion strategy
4. Taps "Done" -> validates, saves to IndexedDB
5. Returns to World Info list
6. Shows success toast

### Send Message

1. User on Chat Detail -> types in input
2. Send button activates (Kakao Yellow)
3. Tap send -> message saved to IndexedDB
4. Optimistic render: user bubble appears
5. API call with World Info context
6. Stream response -> AI bubble updates
7. Save complete message to IndexedDB

---

## Notes

- **Font Strategy**: iOS screens use `-apple-system`, chat uses `Be Vietnam Pro`
- **Bubble Radius**: 18px per PRD, with tail for direction
- **Hairline Borders**: 0.5px for iOS authenticity
- **Safe Areas**: Use `env(safe-area-inset-*)` for notched devices
- **Scroll Behavior**: Hide scrollbars but keep functionality
- **Touch Feedback**: `active:scale-95` for buttons, background change for cells
