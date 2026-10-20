# Plan: Notion-Style Exchange Diary & Personal Wiki Redesign

## Context

The SXIOS project is a PWA simulating a phone OS in the browser. It uses vanilla JS with hash-based routing, IndexedDB (via `idb`), and Tailwind CSS loaded from CDN. Apps are registered as ES modules in `js/apps/` with a standard pattern: `index.js` (logic + render) + `style.css` (scoped styles).

Both `exchange-diary` and `personal-wiki` already exist as minimal prototypes. The task is to **redesign them using the Notion design language** from `docs/design/DESIGN-notion.md` and **add substantial functionality**.

**Key constraint**: These are NOT separate Next.js projects — they are apps within the existing SXIOS PWA framework. The user's earlier answer about "Next.js + Tailwind" and "two independent projects" needs to be reconciled with the actual codebase, which is a vanilla JS PWA. The redesign must work within the existing architecture.

## Design System: Notion Tokens → CSS Custom Properties

Map `DESIGN-notion.md` tokens to CSS variables scoped under each app's root class:

| Notion Token | CSS Variable | Value |
|---|---|---|
| `colors.primary` | `--nt-primary` | #0075de |
| `colors.primary-active` | `--nt-primary-active` | #005bab |
| `colors.secondary` | `--nt-secondary` | #213183 |
| `colors.on-primary` | `--nt-on-primary` | #ffffff |
| `colors.canvas` | `--nt-canvas` | #ffffff |
| `colors.canvas-soft` | `--nt-canvas-soft` | #f6f5f4 |
| `colors.surface` | `--nt-surface` | #ffffff |
| `colors.ink` | `--nt-ink` | #000000 |
| `colors.ink-secondary` | `--nt-ink-secondary` | #31302e |
| `colors.ink-muted` | `--nt-ink-muted` | #615d59 |
| `colors.ink-faint` | `--nt-ink-faint` | #a39e98 |
| `colors.hairline` | `--nt-hairline` | #e6e6e6 |
| `colors.accent-sky` | `--nt-accent-sky` | #62aef0 |
| `colors.accent-purple` | `--nt-accent-purple` | #d6b6f6 |
| `colors.accent-pink` | `--nt-accent-pink` | #ff64c8 |
| `colors.accent-orange` | `--nt-accent-orange` | #dd5b00 |
| `colors.accent-teal` | `--nt-accent-teal` | #2a9d99 |
| `colors.accent-green` | `--nt-accent-green` | #1aae39 |
| `rounded.xs` | `--nt-r-xs` | 4px |
| `rounded.sm` | `--nt-r-sm` | 5px |
| `rounded.md` | `--nt-r-md` | 8px |
| `rounded.lg` | `--nt-r-lg` | 12px |
| `rounded.xl` | `--nt-r-xl` | 16px |
| `rounded.full` | `--nt-r-full` | 9999px |
| `spacing.xxs` | `--nt-s-xxs` | 4px |
| `spacing.xs` | `--nt-s-xs` | 8px |
| `spacing.sm` | `--nt-s-sm` | 12px |
| `spacing.md` | `--nt-s-md` | 16px |
| `spacing.lg` | `--nt-s-lg` | 24px |
| `spacing.xl` | `--nt-s-xl` | 28px |
| `spacing.xxl` | `--nt-s-xxl` | 32px |

Typography: Use `Inter` (already loaded in `index.html`) with Notion's letter-spacing values applied via CSS classes.

---

## App 1: Exchange Diary (交換日記)

### Current State
- Basic mood selector + textarea + flat entry list
- Data stored via `SettingsDB` as a single JSON blob
- No multi-user support, no calendar view, no image support

### Redesigned Features

#### 1. Multi-User Profile System
- Add a "writer selector" at the top: 2-3 named profiles with avatar colors
- Each entry tagged with `writerId`
- Profile management: simple name + color picker (stored in SettingsDB)
- Data key: `diary_profiles`

#### 2. Calendar View (Primary View)
- Monthly calendar grid on the warm `canvas-soft` background
- Days with entries show a colored dot per writer (sticker palette colors)
- Tap a day → slide-in panel showing that day's entries
- Current day highlighted with `primary` blue ring
- Navigation: prev/next month arrows

#### 3. Entry Writing View
- Full-screen editor triggered by tapping a date or FAB
- Writer indicator (avatar + name) at top
- Mood selector as Notion-style pill badges (`badge-pill` component)
- Rich text area with basic formatting: **bold**, *italic*, ~strikethrough~
- Image attachment via file input → base64 stored in IndexedDB
- Save button: `button-primary` style (pill, Notion blue)

#### 4. Entry Reading View
- Entries displayed as `feature-card` style (white surface, 12px radius, 24px padding)
- Each entry shows: writer avatar, mood icon, timestamp, content
- Other writer's entries have a subtle left border in their profile color
- "Reply" action: adds a nested reply entry under the original

#### 5. Timeline/List View (Secondary View)
- Segmented control: Calendar | Timeline
- Timeline shows all entries in reverse chronological order
- Grouped by date with date headers in `eyebrow` typography

### Data Schema (IndexedDB via SettingsDB)

```
diary_profiles: [
  { id, name, color (from sticker palette) }
]
diary_entries: [
  { id, date (ISO date string), writerId, mood, content (HTML), images: [base64], replyTo: entryId|null, createdAt }
]
diary_active_writer: writerId string
```

### UI Structure

```
┌─────────────────────────┐
│ ← 返回    交換日記    ⚙ │  ← nav-bar (white, ink text)
├─────────────────────────┤
│  🧑‍🎨 小多  🧑‍💻 阿嗨      │  ← writer selector pills
├─────────────────────────┤
│  Calendar | Timeline    │  ← segmented control
├─────────────────────────┤
│     July 2026           │
│  一 二 三 四 五 六 日    │
│        1  2  3  4  5    │  ← calendar grid
│  6  7  8  9 10 11 12    │     dots for entries
│ 13 14 15 16 17 18 19    │
│ 20 21 22 23 24 25 26    │
│ 27 28 29 30 31          │
├─────────────────────────┤
│  [7/26 entries slide-in]│  ← day detail panel
│  ┌───────────────────┐  │
│  │ 🧑‍🎨 晴朗  7/26    │  │  ← feature-card
│  │ 今天去公園散步...  │  │
│  └───────────────────┘  │
│         [+ 寫日記]      │  ← FAB / button-primary
└─────────────────────────┘
```

### Files to Modify
- `js/apps/exchange-diary/index.js` — complete rewrite
- `js/apps/exchange-diary/style.css` — complete rewrite with Notion design tokens

---

## App 2: Personal Wiki (個人 Wiki)

### Current State
- Flat list of pages with title + plain textarea editor
- No page hierarchy, no block editing, no search, no linking

### Redesigned Features

#### 1. Block-Based Editor
Each page is a sequence of blocks. Block types for MVP:

| Block Type | Render | Edit |
|---|---|---|
| `text` | Plain text paragraph | Inline contenteditable |
| `heading1` | 40px/700 heading | Inline contenteditable |
| `heading2` | 26px/700 heading | Inline contenteditable |
| `heading3` | 22px/700 heading | Inline contenteditable |
| `bulleted-list` | Bullet point | Inline contenteditable with bullet |
| `numbered-list` | Numbered item | Inline contenteditable with number |
| `todo` | Checkbox + text | Toggle + inline contenteditable |
| `divider` | Hairline rule | Non-editable |
| `quote` | Indented quote block | Inline contenteditable |
| `image` | Image block | File upload → base64 |
| `page-link` | Linked page reference | Page picker dropdown |

Block interactions:
- Click empty area below last block → create new `text` block
- Type `/` at start of empty block → block type menu (command palette)
- Enter at end of block → create new `text` block below
- Backspace on empty block → delete block, focus previous
- Drag handle (⋮⋮) on hover → reorder blocks

#### 2. Page Tree Sidebar
- Left sidebar with collapsible page tree
- Root pages + nested children (1 level of nesting for MVP)
- Active page highlighted with `primary` blue indicator (`ex-app-shell-row` style)
- "New page" button at bottom of sidebar
- Breadcrumb navigation at top of editor area

#### 3. Search
- Search bar in sidebar header (`text-input` style: 4px radius, hairline border)
- Searches page titles and block content
- Results shown as a dropdown list; click to navigate

#### 4. Page Operations
- Rename: click title to edit inline
- Delete: context menu or swipe action
- Duplicate: context menu option
- Cover image: optional cover at top of page (image block stretched full-width)

### Data Schema

```
wiki_pages: [
  {
    id,
    title,
    parentId: null | pageId,
    blocks: [
      { id, type, content, checked (for todo), metadata }
    ],
    coverImage: null | base64,
    icon: null | emoji,
    createdAt,
    updatedAt
  }
]
wiki_recent_pages: [pageId, pageId, ...]  // last 10 visited
```

### UI Structure

```
┌────────┬──────────────────────────┐
│ Wiki   │  📄 Page Title           │  ← heading-2
│ ────── │  Wiki > Parent > Current │  ← breadcrumb (caption)
│ 🔍     │                          │
│ ────── │  ┌────────────────────┐  │
│ 📄 Home│  │ Heading 1          │  │  ← block
│ 📄 Proj│  │ Text paragraph...  │  │  ← block
│  📄 Sub│  │ ☑ Todo item        │  │  ← todo block
│ 📄 Note│  │ ○ Bullet point     │  │  ← list block
│ ────── │  │ ─────────────      │  │  ← divider
│ + New  │  │ > Quote block      │  │  ← quote block
│        │  │ [Linked Page →]    │  │  ← page-link block
│        │  └────────────────────┘  │
│        │                          │
│        │  Type / for commands...  │  ← placeholder
└────────┴──────────────────────────┘

Mobile: sidebar as slide-out drawer, toggle via hamburger
```

### Command Palette (Slash Menu)
When user types `/` in an empty block, show a floating menu:

```
┌──────────────────┐
│ 🔍 Search blocks │
│ ──────────────── │
│ H1  Heading 1    │
│ H2  Heading 2    │
│ H3  Heading 3    │
│ •   Bulleted List│
│ 1.  Numbered List│
│ ☑   To-do        │
│ ──  Divider      │
│ ❝  Quote         │
│ 🖼  Image         │
│ 🔗 Page Link     │
└──────────────────┘
```

Styled as `ex-modal-card`: white surface, 16px radius, Level-2 shadow.

### Files to Modify
- `js/apps/personal-wiki/index.js` — complete rewrite
- `js/apps/personal-wiki/style.css` — complete rewrite with Notion design tokens

---

## Shared: Notion Design System CSS

Create a shared CSS file `css/notion-tokens.css` containing all CSS custom properties. Both apps import this via their style.css or via the registry's `loadStyle` mechanism.

### File Structure
```
css/notion-tokens.css    ← NEW: shared design tokens
js/apps/exchange-diary/
  index.js               ← REWRITE
  style.css              ← REWRITE
js/apps/personal-wiki/
  index.js               ← REWRITE
  style.css              ← REWRITE
```

---

## Implementation Order

1. **Create `css/notion-tokens.css`** — all CSS custom properties from the design spec
2. **Rewrite `exchange-diary/style.css`** — Notion-styled components using tokens
3. **Rewrite `exchange-diary/index.js`** — multi-user profiles, calendar view, timeline view, entry editor with mood pills, image support
4. **Rewrite `personal-wiki/style.css`** — Notion-styled sidebar, editor, blocks, slash menu
5. **Rewrite `personal-wiki/index.js`** — page tree sidebar, block-based editor with slash commands, search, page linking, breadcrumbs
6. **Update `index.html`** — add `<link>` to `css/notion-tokens.css`
7. **Test both apps** in the SXIOS PWA shell

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | Stay in SXIOS PWA, not separate Next.js projects | Existing codebase is vanilla JS PWA; extracting to Next.js would break the phone-shell metaphor |
| Data storage | SettingsDB (IndexedDB wrapper) | Consistent with existing pattern; no new dependencies |
| Block editor | Custom implementation, not library | Keeps bundle small; no npm in this project; MVP block types are manageable |
| Multi-user | Local profiles, no auth | 2-3 person use case; no server; profiles are just name+color stored locally |
| Font | Inter (already loaded) | DESIGN-notion.md specifies NotionInter ≈ Inter with negative tracking |
| Image storage | Base64 in IndexedDB | No server available; acceptable for small personal use |

## Risks

- **Block editor complexity**: Custom block editor is the highest-risk item. Slash menu, block reordering, and contenteditable quirks are non-trivial. Mitigation: start with simpler block types (text, heading, todo, divider); add list/image/link in subsequent iterations.
- **IndexedDB size**: Base64 images can bloat storage. Mitigation: compress images to max 800px width before storing; warn at >50MB usage.
- **Contenteditable inconsistencies**: Browser behavior varies. Mitigation: use `input` events and serialize to plain HTML; avoid complex rich-text features in MVP.

## Validation

- Both apps render correctly inside the SXIOS phone frame (desktop) and full-screen (mobile)
- Notion design tokens are consistently applied (warm canvas, Inter type, blue primary, pill CTAs)
- Exchange diary: can create profiles, write entries with moods, view calendar with dots, switch between calendar/timeline
- Wiki: can create pages, add/edit/reorder blocks, use slash menu, navigate page tree, search
- Data persists across page navigation and app restarts
