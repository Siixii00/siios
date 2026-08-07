import { SettingsDB, WikiRecordsDB } from '../../db.js';

export async function migrateFromSettingsDB() {
    const migrated = await SettingsDB.get('wiki_migrated_to_records');
    if (migrated) return false;

    const oldPages = await SettingsDB.get('wiki_pages');
    if (!oldPages || !Array.isArray(oldPages) || oldPages.length === 0) {
        await SettingsDB.set('wiki_migrated_to_records', true);
        return false;
    }

    const existingIds = new Set((await WikiRecordsDB.getAll()).map(r => r.id));
    let migratedCount = 0;

    for (const page of oldPages) {
        if (existingIds.has(page.id)) continue;

        const blocks = (page.blocks || []).map(b => ({
            id: b.id || 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
            type: b.type || 'text',
            content: b.content || '',
            checked: b.checked || false,
            metadata: b.metadata || {},
            confidence: null
        }));

        await WikiRecordsDB.create({
            id: page.id,
            page_type: 'note',
            title: page.title || 'Untitled',
            character_id: null,
            source_type: 'manual',
            source_ids: [],
            confidence: 'UNVERIFIED',
            blocks,
            links: [],
            tags: [],
            cover_image: page.coverImage || null,
            icon: page.icon || '📄',
            parent_id: page.parentId || null,
            created_at: page.createdAt || Date.now(),
            updated_at: page.updatedAt || Date.now()
        });
        migratedCount++;
    }

    await SettingsDB.set('wiki_migrated_to_records', true);
    return migratedCount > 0;
}
