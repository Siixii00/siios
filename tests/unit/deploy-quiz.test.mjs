import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY_QUIZ, findQuizAnswer } from '../../js/apps/help/deploy-quiz.js';

// 問答裡的「開啟」按鈕要導到真的存在的頁面
const ROUTES = new Set(['/settings', '/mcp-market', '/settings/synth', '/settings/discord/guide']);

test('部署問答：編號不重複、每題都有說明與步驟、開啟路徑存在', () => {
    const ids = DEPLOY_QUIZ.options.map(o => o.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const o of DEPLOY_QUIZ.options) {
        assert.ok(o.label && o.need && o.steps.length, o.id);
        if (o.open) assert.ok(ROUTES.has(o.open.path), `${o.id}: ${o.open.path}`);
    }
});

test('findQuizAnswer：找得到、找不到回 null', () => {
    assert.equal(findQuizAnswer('discord').id, 'discord');
    assert.equal(findQuizAnswer('nope'), null);
});
