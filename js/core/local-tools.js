import { SettingsDB, UsersDB, HealthDB } from '../db.js';
import { addEvent } from './calendar.js';
import { saveInteractionMemory } from './memory-saver.js';

// App 內建工具：資料就在這台裝置上（行事曆、健康紀錄、記憶），所以直接在 App 內執行，
// 不需要架設 Worker。名稱與參數刻意和「神秘門」市集的同名工具一致，角色看到的是同一組工具。

const pad = n => String(n).padStart(2, '0');

function parseDateTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return {
        dateStr: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
        time: /\d{1,2}:\d{2}/.test(String(value)) ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''
    };
}

async function resolveUser(context) {
    if (context?.userId) return { id: context.userId };
    return (await UsersDB.getAll())[0] || null;
}

export const LOCAL_TOOLS = [
    {
        name: 'set_reminder',
        description: '在使用者的行事曆（時間樹）建立一則提醒。目前不支援重複提醒。',
        parameters: {
            type: 'object',
            properties: {
                message: { type: 'string', description: '提醒內容' },
                time: { type: 'string', description: '提醒時間（ISO 格式，例如 2026-10-20T09:00）' },
                repeat: { type: 'boolean', description: '是否重複（目前不支援，會被忽略）' }
            },
            required: ['message', 'time']
        },
        async run(args) {
            const when = parseDateTime(args.time);
            if (!when) return { success: false, error: '時間格式無效，請使用 ISO 格式，例如 2026-10-20T09:00' };
            if (!String(args.message || '').trim()) return { success: false, error: '提醒內容不能是空的' };
            await addEvent({ title: '⏰ ' + String(args.message).trim(), dateStr: when.dateStr, time: when.time });
            return { success: true, scheduled: when.dateStr + (when.time ? ' ' + when.time : ''), repeat_supported: false, ...(args.repeat ? { note: '重複提醒尚未支援，只建立了一次' } : {}) };
        }
    },
    {
        name: 'create_event',
        description: '在使用者的行事曆（時間樹）新增一個事件。',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: '事件標題' },
                datetime: { type: 'string', description: '日期時間（ISO 格式）' },
                location: { type: 'string', description: '地點' },
                notes: { type: 'string', description: '備註' }
            },
            required: ['title', 'datetime']
        },
        async run(args) {
            const when = parseDateTime(args.datetime);
            if (!when) return { success: false, error: '日期時間格式無效，請使用 ISO 格式，例如 2026-10-20T14:30' };
            if (!String(args.title || '').trim()) return { success: false, error: '事件標題不能是空的' };
            const title = String(args.title).trim() + (args.location ? '（' + args.location + '）' : '');
            await addEvent({ title, dateStr: when.dateStr, time: when.time });
            return { success: true, scheduled: when.dateStr + (when.time ? ' ' + when.time : ''), title };
        }
    },
    {
        name: 'log_medication',
        description: '把使用者的用藥記錄到「健康」app 的用藥清單（已有同名藥物則只更新備註）。',
        parameters: {
            type: 'object',
            properties: {
                medication: { type: 'string', description: '藥物名稱' },
                dosage: { type: 'string', description: '劑量' },
                taken: { type: 'boolean', description: '是否已服用', default: true }
            },
            required: ['medication']
        },
        async run(args, context) {
            const name = String(args.medication || '').trim();
            if (!name) return { success: false, error: '藥物名稱不能是空的' };
            const user = await resolveUser(context);
            if (!user) return { success: false, error: '尚未建立使用者面具，無法記錄用藥' };
            const stamp = new Date().toLocaleString('zh-TW', { hour12: false });
            const note = (args.taken === false ? '未服用' : '已服用') + '（' + stamp + '，由角色記錄）';
            const existing = (await HealthDB.getByType(user.id, 'medication')).find(m => m.medication_name === name);
            if (existing) {
                await HealthDB.update(existing.id, { notes: note, ...(args.dosage ? { dosage: args.dosage } : {}) });
                return { success: true, recorded: true, created: false };
            }
            await HealthDB.createMedication({ user_id: user.id, medication_name: name, dosage: args.dosage || '', notes: note });
            return { success: true, recorded: true, created: true };
        }
    },
    {
        name: 'log_period_symptom',
        description: '把使用者回報的經期不適症狀存成角色的記憶。',
        parameters: {
            type: 'object',
            properties: {
                symptom: { type: 'string', enum: ['頭痛', '腹痛', '腰痠', '情緒低落', '食慾改變', '疲勞'] },
                severity: { type: 'number', minimum: 1, maximum: 5, description: '嚴重程度 1-5' },
                notes: { type: 'string', description: '備註' }
            },
            required: ['symptom']
        },
        async run(args, context) {
            if (!context?.characterId) return { success: false, error: '沒有角色上下文，無法存成記憶' };
            const memory = await saveInteractionMemory({
                characterId: context.characterId,
                userId: context.userId || '',
                sourceApp: 'health',
                sourceType: 'interaction',
                sourceSubtype: 'health',
                content: '使用者回報了經期症狀：' + args.symptom + (args.severity ? '（嚴重程度 ' + args.severity + '/5）' : '') + (args.notes ? '，' + args.notes : ''),
                importance: 0.7
            });
            return memory ? { success: true, recorded: true } : { success: false, error: '存入記憶失敗' };
        }
    },
    {
        name: 'track_mood',
        description: '把使用者此刻的心情存成角色的記憶。',
        parameters: {
            type: 'object',
            properties: {
                mood: { type: 'string', enum: ['開心', '平靜', '焦慮', '難過', '憤怒', '疲憊'] },
                reason: { type: 'string', description: '原因（選填）' },
                intensity: { type: 'number', minimum: 1, maximum: 5 }
            },
            required: ['mood']
        },
        async run(args, context) {
            if (!context?.characterId) return { success: false, error: '沒有角色上下文，無法存成記憶' };
            const memory = await saveInteractionMemory({
                characterId: context.characterId,
                userId: context.userId || '',
                sourceApp: 'health',
                sourceType: 'interaction',
                sourceSubtype: 'health',
                content: '使用者現在的心情是「' + args.mood + '」' + (args.intensity ? '（強度 ' + args.intensity + '/5）' : '') + (args.reason ? '，原因：' + args.reason : ''),
                importance: 0.6
            });
            return memory ? { success: true, recorded: true } : { success: false, error: '存入記憶失敗' };
        }
    }
];

export const LOCAL_MCP_ID = 'local';
const ENABLED_KEY = 'local_tools_enabled';

export async function isLocalToolsEnabled() {
    return (await SettingsDB.get(ENABLED_KEY)) !== false;
}

export const setLocalToolsEnabled = enabled => SettingsDB.set(ENABLED_KEY, !!enabled);

export async function runLocalTool(name, args, context) {
    const tool = LOCAL_TOOLS.find(t => t.name === name);
    if (!tool) return { success: false, error: 'Unknown local tool: ' + name };
    try {
        return { success: true, result: await tool.run(args || {}, context || {}) };
    } catch (e) {
        return { success: false, error: e.message || String(e) };
    }
}
