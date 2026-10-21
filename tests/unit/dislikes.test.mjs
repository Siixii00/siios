import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDislikes, sameThing, recordDislikes, formatDislikePrompt, findDislikeLeaks, STRONG_COUNT } from '../../js/core/dislikes.js';

const ex = t => extractDislikes(t).phrases;

test('抽取：明確表達討厭、受不了、不能接受、不吃的說法', () => {
    assert.deepEqual(ex('我最討厭香菜了'), ['香菜']);
    assert.deepEqual(ex('我不喜歡被人忽略。'), ['被人忽略']);
    assert.deepEqual(ex('我真的受不了你一直道歉'), ['你一直道歉']);
    assert.deepEqual(ex('我不吃香菜'), ['不吃香菜']);
    assert.deepEqual(ex('別再提我的前任了'), ['提我的前任']);
    assert.deepEqual(ex('我超怕蟲子，千萬不要在我面前提'), ['蟲子', '在我面前提']);
    assert.deepEqual(ex('我討厭：被叫寶貝'), ['被叫寶貝']);
    assert.deepEqual(ex('無法接受劇透'), ['劇透']);
});

test('抽取：否定、問別人、假設、一般的「不要」都不算', () => {
    for (const t of ['我不討厭你', '你討厭香菜嗎？', '你是不是不喜歡我', '如果討厭的話可以說', '你不要走', '不要這樣說啦', '她討厭下雨', '今天天氣很好', '', null, undefined]) {
        assert.deepEqual(ex(t), [], String(t));
    }
    assert.deepEqual(ex('我討厭香菜，你呢？'), ['香菜'], '問號在別的子句，不影響前面的表達');
});

test('抽取：強調的語氣權重為 2；一般為 1；太長的略過', () => {
    assert.equal(extractDislikes('我討厭香菜').weight, 1);
    assert.equal(extractDislikes('我說過很多次了，我討厭香菜').weight, 2);
    assert.equal(extractDislikes('一定要記住，我受不了被打斷').weight, 2);
    assert.deepEqual(ex('我討厭' + '很長的句子'.repeat(10)), []);
    assert.equal(extractDislikes('今天天氣很好').weight, 1);
});

test('同一件事：包含、相鄰字重疊；不同的事不算', () => {
    assert.ok(sameThing('香菜', '吃香菜'));
    assert.ok(sameThing('被人忽略', '被忽略'));
    assert.ok(sameThing('你一直道歉', '一直道歉'));
    assert.ok(sameThing('蟲子', '蟲子'));
    assert.ok(!sameThing('香菜', '蟲子'));
    assert.ok(!sameThing('', '香菜'));
    assert.ok(!sameThing('被打斷', '被忽略'));
});

test('記錄：同一件事累加次數、留下說得較完整的；強調一次算 2；來源去重；手動的不會被丟掉', () => {
    let list = recordDislikes([], ['香菜'], { source: 'chat', now: 1 });
    assert.deepEqual([list[0].text, list[0].count], ['香菜', 1]);
    list = recordDislikes(list, ['不吃香菜'], { source: 'dating', now: 2 });
    assert.equal(list.length, 1);
    assert.deepEqual([list[0].text, list[0].count, list[0].lastAt, list[0].sources], ['不吃香菜', 2, 2, ['chat', 'dating']]);
    list = recordDislikes(list, ['香菜'], { weight: 2, source: 'chat', now: 3 });
    assert.equal(list[0].count, 4);
    assert.equal(list[0].sources.length, 2);
    const many = recordDislikes([{ id: 'm', text: '手動新增的', count: 1, lastAt: 0, firstAt: 0, sources: ['manual'], manual: true }],
        Array.from({ length: 60 }, (_, i) => '第' + String.fromCharCode(0x4e00 + i * 7) + '種奇怪的東西' + i), { source: 'chat', now: 5 });
    assert.ok(many.length <= 40 && many.some(x => x.id === 'm'));
    const input = [{ id: 'a', text: '香菜', count: 1, sources: [] }];
    recordDislikes(input, ['香菜']);
    assert.equal(input[0].count, 1, '不改動傳進來的清單');
});

test('提示詞：沒有就空；次數多的在前並標註反覆強調；有明確的遵守要求；最多 15 條', () => {
    assert.equal(formatDislikePrompt([]), '');
    assert.equal(formatDislikePrompt(null), '');
    const p = formatDislikePrompt([{ text: '香菜', count: 1, lastAt: 1 }, { text: '被打斷', count: STRONG_COUNT + 1, lastAt: 2 }]);
    assert.ok(p.indexOf('被打斷') < p.indexOf('香菜'));
    assert.match(p, /- 被打斷（特別在意）/);
    assert.match(p, /- 香菜\n/);
    assert.match(p, /務必在回覆與行動中避開/);
    const lots = formatDislikePrompt(Array.from({ length: 30 }, (_, i) => ({ text: '東西' + i, count: 1, lastAt: i })));
    assert.equal(lots.split('\n').filter(l => /^- 東西/.test(l)).length, 15);
});

test('提示詞是「安靜地做到」：明講是背景資訊、不要說明避開了什麼、不要邀功、不要刻意繞著說；不是嚴厲的禁令', () => {
    const p = formatDislikePrompt([{ text: '香菜', count: 3, lastAt: 1 }]);
    assert.match(p, /背景資訊，不是話題/);
    assert.match(p, /不要主動提到它們/);
    assert.match(p, /我特地幫你避開／挑掉／沒放/);
    assert.match(p, /不必讓對方知道你記得，也不必邀功/);
    assert.match(p, /不要為了表現體貼而刻意繞著它們說話/);
    assert.match(p, /不要因為這份清單讓整段回覆變得小心翼翼/);
    assert.ok(!p.includes('絕對不可以碰'), '嚴厲的字眼會讓模型一直提到它');
});

test('偵測不自然的提及：沒人問卻提到討厭的事算；用戶自己提起的不算；不相干的不算', () => {
    const items = [{ text: '香菜' }, { text: '不吃蔥' }, { text: '被打斷' }, { text: '嗯' }];
    assert.deepEqual(findDislikeLeaks('好喔，我特地幫你挑掉了香菜，放心吃吧。', '今天吃什麼', items), ['香菜']);
    assert.deepEqual(findDislikeLeaks('記得你不吃蔥，所以沒有放。', '午餐做好了嗎', items), ['不吃蔥'], '「不吃蔥」用蔥比對');
    assert.deepEqual(findDislikeLeaks('香菜的味道確實很特別呢。', '你喜歡香菜嗎', items), [], '用戶自己提起的，回應是自然的');
    assert.deepEqual(findDislikeLeaks('今天的湯很好喝，來一碗吧。', '今天吃什麼', items), []);
    assert.deepEqual(findDislikeLeaks('嗯嗯，我知道了。', '好', items), [], '太短的項目不比對');
    assert.deepEqual(findDislikeLeaks('', '', items), []);
    assert.deepEqual(findDislikeLeaks('香菜', '', null), []);
});
