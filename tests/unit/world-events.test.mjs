import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWikitext, analyzeByRules, sectorBias, localDate, SECTORS } from '../../js/apps/invest/world-events.js';

const SAMPLE = `{{Current events|year=2026|month=10|day=19|top=yes}}
<!-- All news items below this line -->
'''Armed conflicts and attacks'''
*[[Yemeni civil war (2014–present)|Yemeni civil war]]
**[[2026 Yemen offensives]]
***A missile attack by the [[Houthis]] kills 53 soldiers at a training center in [[Yemen]]. [https://example.com/a Guardian]<ref>x</ref>
'''Business and economy'''
*A new AI chip factory is announced by a major semiconductor maker. [https://example.com/b AP]
*Short line
`;

test('parseWikitext：只留下有來源連結的新聞本文，並清掉維基語法', () => {
    const items = parseWikitext(SAMPLE);
    assert.equal(items.length, 2);
    assert.equal(items[0].category, 'Armed conflicts and attacks');
    assert.equal(items[0].url, 'https://example.com/a');
    assert.ok(items[0].text.startsWith('A missile attack by the Houthis kills 53 soldiers'));
    assert.ok(!/[\[\]{}<>]|https?:/.test(items[0].text));
    assert.equal(items[1].category, 'Business and economy');
});

test('analyzeByRules：戰事推升能源、原物料、國防；AI 晶片推升半導體', () => {
    const events = analyzeByRules(parseWikitext(SAMPLE));
    const war = events.find(e => e.zh.includes('戰事'));
    assert.ok(war);
    const dirOf = (ev, sector) => ev.impacts.find(i => i.sector === sector)?.dir;
    assert.equal(dirOf(war, '能源'), 1);
    assert.equal(dirOf(war, '國防'), 1);
    assert.equal(dirOf(war, '大盤'), -1);
    const ai = events.find(e => e.zh.includes('人工智慧'));
    assert.ok(ai);
    assert.equal(dirOf(ai, '半導體'), 1);
    assert.ok(events.every(e => e.impacts.every(i => SECTORS.includes(i.sector) && [1, -1].includes(i.dir) && i.strength >= 1 && i.strength <= 3)));
});

test('analyzeByRules：同一類事件最多取兩則、總數不超過 8', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ text: 'A missile strike hits a city number ' + i + ' in a long war', category: 'x', url: 'https://e.com/' + i }));
    const events = analyzeByRules(many);
    assert.equal(events.length, 2);
});

test('sectorBias：今天 100%、昨天 50%、前天 25%，並限制在 ±10%', () => {
    const now = new Date(2026, 9, 20);
    const day = back => localDate(new Date(2026, 9, 20 - back));
    const ev = (sector, dir, strength) => ({ events: [{ impacts: [{ sector, dir, strength }] }] });
    const bias = sectorBias({ [day(0)]: ev('能源', 1, 2), [day(1)]: ev('能源', 1, 2), [day(2)]: ev('能源', -1, 1), [day(3)]: ev('能源', 1, 3) }, now);
    // 0.024 + 0.012 - 0.003（四天前的事件不算）
    assert.ok(Math.abs(bias['能源'] - 0.033) < 1e-9);
    const huge = sectorBias({ [day(0)]: { events: Array.from({ length: 10 }, () => ({ impacts: [{ sector: '國防', dir: 1, strength: 3 }] })) } }, now);
    assert.equal(huge['國防'], 0.1);
    assert.deepEqual(sectorBias({}, now), {});
});
