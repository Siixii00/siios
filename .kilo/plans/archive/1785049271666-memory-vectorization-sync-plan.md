# Plan: Memory System Vectorization, Classification & Cloud Sync

## Context

SXIOS is a pure client-side PWA with a dormant memory system (`js/core/memory-system/` and `js/core/embedding/` are dead code — never imported at runtime). The user wants to:

1. Activate and enhance the memory system with vectorized storage, 7-type Ombre classification, and sleep-cycle consolidation with LLM-aided merging
2. Set up storage cycles: batch processing during chat, auto-save on app activity, daily AI sleep cycle
3. Deploy to Vercel with Turso for cloud sync of all data (local-first + periodic sync)

**Reference projects**: Ombre-Brain (7 bucket types, LLM-aided merge, dual vectors), Memory3D (5-layer weighted retrieval, keyword-based)

## Decisions Summary

| Decision | Choice |
|---|---|
| Turso architecture | Vercel Serverless Functions + @libsql/client |
| Sleep cycle trigger | Scheduled (02:00-06:00) + manual button |
| Memory classification | 7 types (Ombre full: dynamic/permanent/feel/plan/letter/i/archive) |
| Merge strategy | Vector similarity >0.85 + LLM judgment |
| Cross-chat sharing | Within same character (not cross-character) |
| Chat storage trigger | Batch every 10 messages |
| Sync scope | All data (chats, characters, settings, world-info, memories) |
| Sync strategy | Local-first (IndexedDB) + periodic push to Turso |
| Vercel deployment | Not yet deployed — needs full setup |
| Implementation | 3 phases, each independently verifiable |

---

## Phase 1: Activate Memory System + Vectorization + 7-Type Classification

**Goal**: Wire the dormant memory system into the chat flow, add embedding generation, implement 7-type classification, and batch-process memories every 10 messages.

### Step 1.1: Fix EmbeddingClient bug

**File**: `js/core/embedding/index.js:64`

Change `this.embeddingClient.embed(query)` → `this.embeddingClient.getEmbedding(query)`

### Step 1.2: Add 7-type classification to MemoryDB schema

**File**: `js/db.js`

Update `MemoryDB.create()` defaults to support 7 types. Replace `memory_type: 'episodic'` with:

```javascript
memory_type: data.memory_type || 'dynamic',  // dynamic|permanent|feel|plan|letter|i|archive
```

Add new fields to the memory record:
- `domain` (string) — Ombre domain classification (日常/人際/成長/身心/興趣/數字/事務/內心)
- `status` (string) — for plan type: `active`|`resolved`|`abandoned`
- `resolved` (boolean) — whether the memory has been resolved/digested
- `meaning` (string) — first-person "why this matters" statement (for dual-vector system)
- `embeddingMeaning` (Float32Array|null) — second embedding for the meaning field
- `embeddingMeaningHash` (string) — hash for meaning embedding cache invalidation

Add index on `memory_type` (already exists) and `domain`.

Add `MemoryDB.updateEmbedding(id, embedding, hash, meaningEmbedding?, meaningHash?)` method.

### Step 1.3: Create MemoryClassifier module

**New file**: `js/core/memory-system/memory-classifier.js`

Uses the configured LLM API to classify memories. Prompt sends the memory content and asks for:
- `memory_type`: one of dynamic/permanent/feel/plan/letter/i
- `domain`: one of the 8 Ombre domains
- `meaning`: first-person statement of why this matters
- `importance`: 1-10 integer (mapped to 0-1 for storage)

```javascript
export class MemoryClassifier {
    constructor(apiUrl, apiKey, model) { ... }
    
    async classify(content, context) {
        // Call LLM with classification prompt
        // Returns { memory_type, domain, meaning, importance }
    }
}
```

**Fallback**: If LLM is unavailable, use keyword heuristics:
- Keywords like "永遠", "最重要", "核心" → permanent
- Keywords like "計畫", "待辦", "要記得" → plan
- First-person emotional content → feel
- Self-knowledge statements → i
- Default → dynamic

### Step 1.4: Enhance MemorySystem with classification + dual embedding

**File**: `js/core/memory-system/index.js`

Update `processMessage()` pipeline:
1. Extract sensory (existing)
2. Tag emotion (existing)
3. Tag spatiotemporal (existing)
4. **Classify** via MemoryClassifier (new)
5. Compute importance (existing, enhanced with classification result)
6. **Generate content embedding** via EmbeddingClient (existing, now actually called)
7. **Generate meaning embedding** if meaning field is present (new)
8. Store via MemoryDB.create() with all new fields

Update `retrieveMemories()`:
- Use dual-vector search: compute cosine similarity for both content and meaning embeddings, take the higher score
- Filter by `memory_type` and `domain` when relevant context is available

### Step 1.5: Wire MemorySystem into chat flow

**File**: `js/apps/chats/chat.js`

Add memory processing with batch trigger every 10 messages:

```javascript
// In the message handling flow:
messageCount++;
if (messageCount % 10 === 0) {
    const recentMessages = getLastNMessages(10);
    memorySystem.processBatch(recentMessages, chatId, characterId);
}
```

Add memory context injection before LLM call:
- Retrieve relevant memories via `memorySystem.retrieveMemories()`
- Format as `[Related Memories]` block in the system prompt
- Only inject if `memory_enabled` setting is true

**File**: `js/api.js`

Update `buildMessages()` to accept optional memory context parameter and inject it into the system prompt.

### Step 1.6: Expose embedding + memory settings in UI

**File**: `js/apps/settings/api-config.js`

Add fields for:
- `embedding_url` (text input)
- `embedding_model` (text input, default `text-embedding-3-small`)
- `embedding_dimensions` (number, default 1536)
- `embedding_api_key` (password input)
- `memory_enabled` (toggle switch)
- `memory_decay_rate` (number input)
- `memory_threshold` (number input)

Fix the save functionality to actually persist to `SettingsDB`.

### Step 1.7: Update Memory UI for 7 types

**File**: `js/apps/memory/index.js`

- Add type filter tabs: 全部 / 動態 / 永久 / 情感 / 計畫 / 書信 / 自我 / 歸檔
- Show `domain` and `meaning` in detail view
- Show `status` for plan-type memories
- Add "歸檔" action (sets type to `archive` instead of delete)
- Add "標為永久" action (sets type to `permanent`)

### Step 1.8: Start MemorySystem on app boot

**File**: `js/app.js`

After `initDB()`, instantiate and start MemorySystem:

```javascript
import { MemorySystem } from './core/memory-system/index.js';
const memorySystem = new MemorySystem();
window.App.memorySystem = memorySystem;
await memorySystem.start();
```

### Phase 1 Verification

- [ ] Chat processes messages and creates memories every 10 messages
- [ ] Memories have correct 7-type classification
- [ ] Embeddings are generated and stored (check IndexedDB)
- [ ] Vector search returns relevant memories
- [ ] Memory context appears in LLM prompts when `memory_enabled=true`
- [ ] Settings UI saves embedding + memory config
- [ ] Memory list UI shows 7 types with filters
- [ ] No console errors

---

## Phase 2: Sleep Cycle + Memory Consolidation + Merging

**Goal**: Implement the daily AI sleep cycle with proper phase-based processing, memory merging, and compression.

### Step 2.1: Enhance SleepEngine with phase-based processing

**File**: `js/core/memory-system/sleep-engine.js`

Currently, `processSleepCycle()` treats all phases identically. Enhance to differentiate:

- **NREM 3 (deep sleep, 40-60% progress)**: Declarative memory consolidation
  - Run decay on all dynamic memories
  - Archive memories below threshold (score < 0.3)
  - Auto-resolve plans: importance ≤ 4 AND > 30 days inactive → mark `resolved=true`
  
- **REM (60-80% progress)**: Emotional + procedural consolidation
  - Process `feel` type memories: check for crystallization (if a feel has cosine > 0.7 with ≥ 2 other feels → suggest upgrade to permanent)
  - Reinforce high-access memories (accessCount > 3)
  - Generate emotional trend summary

- **NREM 2 (20-40%, 80-100%)**: Light consolidation
  - Backfill missing embeddings (max 50 per cycle)
  - Update decay factors

### Step 2.2: Implement MemoryMerger module

**New file**: `js/core/memory-system/memory-merger.js`

```javascript
export class MemoryMerger {
    constructor(embeddingClient, llmClassifier) { ... }
    
    async findMergeCandidates(memories) {
        // For each pair of dynamic memories in same domain:
        // 1. Compute cosine similarity of content embeddings
        // 2. If similarity > 0.85, mark as candidate pair
        // Return sorted list of candidate pairs
    }
    
    async mergePair(memory1, memory2) {
        // 1. Call LLM to judge if truly same event (conservative)
        // 2. If yes, call LLM to produce merged content (max 120% of longer memory)
        // 3. Combine sensory/emotional/spatiotemporal data
        // 4. Keep higher importance, sum access counts
        // 5. Delete memory2, update memory1
    }
}
```

LLM merge prompt follows Ombre's "Perspective Rule": preserve first-person voice, never neutralize.

### Step 2.3: Implement MemoryCompressor module

**New file**: `js/core/memory-system/memory-compressor.js`

For memories that are fading but not yet archivable, compress to save space:

```javascript
export class MemoryCompressor {
    constructor(llmClient) { ... }
    
    async compress(memory) {
        // Call LLM to produce dehydrated version:
        // { core_facts, emotion_state, keywords, summary }
        // Store summary as content, move original to compressed_original field
    }
}
```

### Step 2.4: Enhance MemorySystem.runSleepCycle()

**File**: `js/core/memory-system/index.js`

Full sleep cycle flow:

```
1. NREM 1 (0-20%): Load all memories, prepare
2. NREM 2 (20-40%): Backfill missing embeddings (max 50)
3. NREM 3 (40-60%): 
   a. Batch decay all dynamic memories
   b. Archive memories with score < 0.3
   c. Auto-resolve stale plans
   d. Run MemoryMerger on same-domain candidates
4. REM (60-80%):
   a. Check feel crystallization
   b. Reinforce high-access memories
   c. Run MemoryCompressor on fading memories (decayFactor 0.3-0.5)
   d. Generate sleep summary
5. NREM 2 (80-100%): Final embedding backfill, persist all updates
```

### Step 2.5: Add manual sleep trigger to UI

**File**: `js/apps/memory/index.js`

Add a "🌙 睡眠週期" button in the memory list header that calls `memorySystem.runSleepCycle()` manually.

Show sleep progress/status in a modal:
- Current phase (NREM 1/2/3, REM)
- Memories processed count
- Memories archived count
- Memories merged count
- Embeddings backfilled count

### Step 2.6: Add sleep cycle scheduling

**File**: `js/core/memory-system/sleep-engine.js`

Keep the existing 60-second interval check for 02:00-06:00 window. Additionally:

- On app focus/resume (`document.addEventListener('visibilitychange')`), check if we missed a sleep window while backgrounded. If so, trigger a catch-up cycle.
- Store last sleep timestamp in SettingsDB. On app start, if last sleep was > 24h ago, trigger a cycle.

### Step 2.7: Cross-app memory sharing

**File**: `js/app.js`

Add a global event system for inter-app memory sharing:

```javascript
window.App.memoryEvents = new EventTarget();

// Any app can dispatch:
window.App.memoryEvents.dispatchEvent(new CustomEvent('memory-created', { detail: { content, source } }));

// MemorySystem listens and processes:
window.App.memoryEvents.addEventListener('memory-created', (e) => {
    memorySystem.processExternalEvent(e.detail);
});
```

Hook into app lifecycle:
- When switching away from any app (Router `beforeLeave`), save any pending state as a memory
- When returning to an app, retrieve relevant memories

### Phase 2 Verification

- [ ] Sleep cycle runs at scheduled time (02:00-06:00)
- [ ] Manual sleep trigger works and shows progress
- [ ] Phase-based processing differentiates NREM/REM
- [ ] Similar memories are merged (cosine > 0.85 + LLM confirms)
- [ ] Fading memories are compressed
- [ ] Plans auto-resolve after 30 days inactive
- [ ] Feel crystallization detection works
- [ ] Missed sleep windows are caught up on app resume
- [ ] Cross-app memory events fire and are processed
- [ ] Memory UI shows sleep status and manual trigger

---

## Phase 3: Vercel + Turso Cloud Sync

**Goal**: Deploy to Vercel with Turso, sync all data (local-first + periodic push).

### Step 3.1: Initialize Node.js project

**New file**: `package.json`

```json
{
  "name": "sxios",
  "private": true,
  "version": "1.0.0",
  "dependencies": {
    "@libsql/client": "^0.14.0"
  }
}
```

### Step 3.2: Create Vercel configuration

**New file**: `vercel.json`

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,PUT,DELETE,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" }
      ]
    }
  ]
}
```

### Step 3.3: Create Turso database schema

**New file**: `api/_db.js` (shared DB helper)

```javascript
import { createClient } from '@libsql/client';

export function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}
```

Schema (created on first deploy or migration):

```sql
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON blob
  last_updated REAL,
  synced_at REAL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT,
  data TEXT NOT NULL,  -- JSON blob
  timestamp REAL,
  synced_at REAL,
  FOREIGN KEY (chat_id) REFERENCES chats(id)
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  synced_at REAL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  synced_at REAL
);

CREATE TABLE IF NOT EXISTS world_info (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  synced_at REAL
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,  -- JSON blob (includes embeddings as base64)
  chat_id TEXT,
  memory_type TEXT,
  domain TEXT,
  timestamp REAL,
  synced_at REAL
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_domain ON memories(domain);
CREATE INDEX IF NOT EXISTS idx_memories_chat ON memories(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
```

### Step 3.4: Create API endpoints

**New file**: `api/sync.js` — Main sync endpoint

```
POST /api/sync
Body: {
  tables: {
    chats: [{ id, data, last_updated, action: 'upsert'|'delete' }],
    messages: [...],
    characters: [...],
    settings: [...],
    worldInfo: [...],
    memories: [...]
  },
  clientTimestamp: number
}
Response: {
  serverChanges: {
    chats: [...],
    messages: [...],
    ...
  },
  serverTimestamp: number
}
```

Logic:
1. For each incoming record: if `action=upsert`, INSERT OR REPLACE; if `action=delete`, DELETE
2. Query all records where `synced_at > clientTimestamp` to find server-side changes
3. Return server changes to client

**New file**: `api/memories/search.js` — Server-side vector search

```
POST /api/memories/search
Body: { queryVector: number[], threshold: number, limit: number, memoryType?: string, domain?: string }
Response: { results: [{ id, score, data }] }
```

This enables server-side vector search without loading all embeddings to the client.

**New file**: `api/memories/[id].js` — CRUD for individual memories

### Step 3.5: Create client-side SyncEngine

**New file**: `js/core/sync/sync-engine.js`

```javascript
export class SyncEngine {
    constructor() {
        this.syncInterval = 5 * 60 * 1000; // 5 minutes
        this.lastSyncTimestamp = 0;
        this.isSyncing = false;
    }
    
    async start() {
        // Load lastSyncTimestamp from SettingsDB
        // Start periodic sync
        // Listen for online/offline events
        // Sync on app resume from background
    }
    
    async sync() {
        if (this.isSyncing || !navigator.onLine) return;
        this.isSyncing = true;
        
        try {
            // 1. Collect local changes since last sync
            const localChanges = await this.collectLocalChanges();
            
            // 2. Send to server, receive server changes
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tables: localChanges,
                    clientTimestamp: this.lastSyncTimestamp
                })
            });
            
            const { serverChanges, serverTimestamp } = await response.json();
            
            // 3. Apply server changes to IndexedDB
            await this.applyServerChanges(serverChanges);
            
            // 4. Update lastSyncTimestamp
            this.lastSyncTimestamp = serverTimestamp;
            await SettingsDB.set('lastSyncTimestamp', serverTimestamp);
        } finally {
            this.isSyncing = false;
        }
    }
    
    async collectLocalChanges() {
        // For each object store, find records modified since lastSyncTimestamp
        // Need to add a `modified_at` field to all records
    }
    
    async applyServerChanges(serverChanges) {
        // For each table's changes, upsert or delete in IndexedDB
        // Conflict resolution: last-write-wins based on modified_at
    }
}
```

### Step 3.6: Add `modified_at` tracking to all DB operations

**File**: `js/db.js`

Add `modified_at: Date.now()` to every create/update operation across all DB helpers (ChatsDB, MessagesDB, WorldInfoDB, MemoryDB, CharactersDB, SettingsDB).

### Step 3.7: Handle embedding serialization for Turso

Embeddings (Float32Array) cannot be directly stored as JSON. Strategy:
- When syncing to Turso: convert Float32Array to base64 string
- When loading from Turso: convert base64 back to Float32Array
- Store in the `data` JSON blob field

### Step 3.8: Start SyncEngine on app boot

**File**: `js/app.js`

```javascript
import { SyncEngine } from './core/sync/sync-engine.js';
const syncEngine = new SyncEngine();
window.App.syncEngine = syncEngine;
await syncEngine.start();
```

### Step 3.9: Add sync status to Settings UI

**File**: `js/apps/settings/index.js`

Show:
- Sync status (connected/disconnected/syncing)
- Last sync timestamp
- Manual sync button
- Data counts (local vs cloud)

### Step 3.10: Turso + Vercel setup instructions

After code is ready, the user needs to:

1. `npm install` to get @libsql/client
2. Install Turso CLI: `curl -sSfL https://get.turso.tech/install.sh | bash`
3. Create database: `turso db create sxios`
4. Get URL: `turso db show sxios --url`
5. Create auth token: `turso db tokens create sxios`
6. Set Vercel env vars:
   ```
   vercel env add TURSO_DATABASE_URL
   vercel env add TURSO_AUTH_TOKEN
   ```
7. Deploy: `vercel deploy --prod`

### Phase 3 Verification

- [ ] `npm install` succeeds
- [ ] Vercel deploys without errors
- [ ] `/api/sync` endpoint responds
- [ ] Local data syncs to Turso after 5 minutes
- [ ] Server changes are applied to IndexedDB
- [ ] Offline mode works (IndexedDB only)
- [ ] Online resume triggers sync
- [ ] Embeddings survive round-trip (Float32Array → base64 → Float32Array)
- [ ] Settings UI shows sync status
- [ ] All 6 data stores sync correctly

---

## Files Modified (All Phases)

| File | Phase | Change |
|---|---|---|
| `js/core/embedding/index.js` | 1 | Fix `embed()` → `getEmbedding()` bug |
| `js/db.js` | 1+3 | Add 7-type fields to MemoryDB, add `updateEmbedding()`, add `modified_at` to all stores |
| `js/core/memory-system/memory-classifier.js` | 1 | **New** — LLM-based 7-type + domain classification |
| `js/core/memory-system/index.js` | 1+2 | Wire classifier + dual embedding + enhanced sleep cycle |
| `js/apps/chats/chat.js` | 1 | Add batch memory processing every 10 messages + context injection |
| `js/api.js` | 1 | Accept memory context in `buildMessages()` |
| `js/apps/settings/api-config.js` | 1 | Add embedding + memory settings UI + fix save |
| `js/apps/memory/index.js` | 1+2 | 7-type filters, domain/meaning display, sleep trigger, archive action |
| `js/app.js` | 1+2+3 | Start MemorySystem, add memory events, start SyncEngine |
| `js/core/memory-system/memory-merger.js` | 2 | **New** — Vector similarity + LLM merge |
| `js/core/memory-system/memory-compressor.js` | 2 | **New** — LLM-based memory compression |
| `js/core/memory-system/sleep-engine.js` | 2 | Phase-based processing, catch-up on resume |
| `js/core/sync/sync-engine.js` | 3 | **New** — Local-first periodic sync |
| `package.json` | 3 | **New** — @libsql/client dependency |
| `vercel.json` | 3 | **New** — Vercel routing + CORS config |
| `api/_db.js` | 3 | **New** — Turso client helper |
| `api/sync.js` | 3 | **New** — Main sync endpoint |
| `api/memories/search.js` | 3 | **New** — Server-side vector search |
| `api/memories/[id].js` | 3 | **New** — Memory CRUD endpoint |
| `js/apps/settings/index.js` | 3 | Sync status UI |

## Risks

1. **LLM API cost**: Classification + merging + compression all call the LLM. Mitigation: batch operations, cache results, fallback to keyword heuristics when LLM unavailable.
2. **Embedding API availability**: If embedding API is down, memories are stored without vectors. Mitigation: write-first pattern (Ombre approach) — backfill embeddings during sleep cycle.
3. **Turso row limits**: Free tier has 9GB storage. Embeddings are large (1536 floats × 4 bytes = 6KB per memory). Mitigation: compress embeddings, only sync non-archived memories by default.
4. **Sync conflicts**: Two devices editing same record. Mitigation: last-write-wins with `modified_at` timestamp. Acceptable for single-user PWA.
5. **PWA background execution**: Service Worker can't run arbitrary JS on a schedule. Mitigation: catch-up sync on app resume, manual sleep trigger.
6. **Float32Array serialization**: IndexedDB stores Float32Array natively, but JSON/Turso needs base64 conversion. Must handle round-trip correctly.

## Open Questions

None — all major decisions resolved through user interview.
