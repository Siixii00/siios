import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    SCENES, SOUVENIRS, MISSION_TARGET, DAILY_GAIN_CAP, emptyRelation, applyAffection, finishDate,
    moodEmoji, souvenirOf, claimSouvenir, visitsOf, gainedToday, customScene
} from '../../js/apps/dating/dating-data.js';

test('心情表情：否定的詞不會被「開心」吃掉，沒有心情就是預設臉', () => {
    assert.equal(moodEmoji('開心'), '😊');
    assert.equal(moodEmoji('不開心'), '😢');
    assert.equal(moodEmoji('不高興'), '😠');
    assert.equal(moodEmoji('害羞'), '😳');
    assert.equal(moodEmoji('期待'), '✨');
    assert.equal(moodEmoji('幸福'), '😊');
    assert.equal(moodEmoji(''), '🙂');
    assert.equal(moodEmoji(null), '🙂');
    assert.equal(moodEmoji('說不上來'), '🙂');
});

test('紀念品：每個內建場景都有一件、不重複；自訂地點沒有', () => {
    for (const s of SCENES) assert.ok(souvenirOf(s), `${s.id} 沒有紀念品`);
    assert.deepEqual(Object.keys(SOUVENIRS).sort(), SCENES.map(s => s.id).sort());
    assert.equal(new Set(Object.values(SOUVENIRS).map(v => v.name)).size, Object.keys(SOUVENIRS).length);
    assert.equal(souvenirOf(customScene('操場', '')), null);
});

test('claimSouvenir：做滿 3 件事、第一次才給；已經有或不夠都不給，也不改動紀錄', () => {
    const cafe = SCENES.find(s => s.id === 'cafe');
    const rel = emptyRelation();
    assert.equal(MISSION_TARGET, 3);
    const short = claimSouvenir(rel, cafe, 2);
    assert.equal(short.souvenir, null);
    assert.equal(short.relation, rel);
    const got = claimSouvenir(rel, cafe, 3);
    assert.equal(got.souvenir.name, '拉花杯墊');
    assert.deepEqual(got.relation.souvenirs, ['cafe']);
    assert.deepEqual(rel.souvenirs, [], '原本的紀錄不會被改動');
    const again = claimSouvenir(got.relation, cafe, 4);
    assert.equal(again.souvenir, null);
    assert.equal(claimSouvenir(rel, customScene('x', 'y'), 9).souvenir, null);
    assert.deepEqual(claimSouvenir({ souvenirs: ['park'] }, cafe, 3).relation.souvenirs, ['park', 'cafe']);
});

test('去過幾次：finishDate 累計，超過 30 筆回憶也不會變少；舊紀錄只有回憶時從回憶算', () => {
    let rel = emptyRelation();
    for (let i = 0; i < 35; i++) rel = finishDate(rel, { id: 'd' + i, sceneId: i % 5 === 0 ? 'park' : 'cafe', endedAt: 1000 + i, summary: 's' });
    assert.equal(rel.history.length, 30);
    assert.equal(visitsOf(rel).park, 7);
    assert.equal(visitsOf(rel).cafe, 28);
    const legacy = { history: [{ sceneId: 'beach' }, { sceneId: 'beach' }, { sceneId: 'cafe' }] };
    assert.deepEqual(visitsOf(legacy), { beach: 2, cafe: 1 });
    const next = finishDate({ ...emptyRelation(), ...legacy }, { sceneId: 'beach', endedAt: 5 });
    assert.equal(visitsOf(next).beach, 3, '舊的回憶要接著往上加，不是從 1 重來');
    assert.deepEqual(visitsOf(undefined), {});
});

test('今日好感：只算今天的；換了一天就歸零', () => {
    const day1 = new Date(2026, 10, 28, 12), day2 = new Date(2026, 10, 29, 12);
    let rel = emptyRelation();
    assert.equal(gainedToday(rel, day1), 0);
    rel = applyAffection(rel, 4, day1).relation;
    rel = applyAffection(rel, 3, day1).relation;
    assert.equal(gainedToday(rel, day1), 7);
    assert.equal(gainedToday(rel, day2), 0);
    assert.equal(gainedToday(undefined, day1), 0);
    assert.ok(gainedToday(rel, day1) <= DAILY_GAIN_CAP);
});
