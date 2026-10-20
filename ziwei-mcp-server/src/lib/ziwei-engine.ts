import { Solar, Lunar } from 'lunar-javascript';
import { BirthData, ZiweiChart, Palace, RuntimeContext, FortuneResult } from '../types';

// 紫微斗數排盤（三合派常用算法）：
// 農曆生日 → 命宮／身宮 → 十二宮與天干 → 五行局 → 紫微與天府兩個星系 → 輔星 → 本命四化 → 大限。
// 全部是確定性的計算，沒有任何隨機或假資料；以 iztro 的結果做過交叉驗證（見 test/）。

export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const PALACE_NAMES = ['命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮', '遷移宮', '交友宮', '官祿宮', '田宅宮', '福德宮', '父母宮'];

// 各宮位代表的生活面向（用來把流年／流月／流日命宮翻成白話，只描述「關注焦點」，不下吉凶斷語）
const PALACE_THEMES: Record<string, string> = {
    命宮: '自我、個性與整體狀態',
    兄弟宮: '手足、朋友與同輩往來',
    夫妻宮: '感情、伴侶與親密關係',
    子女宮: '子女、創作與晚輩關係',
    財帛宮: '金錢、收入與資源運用',
    疾厄宮: '身體、健康與生活作息',
    遷移宮: '外出、旅行與對外的人際',
    交友宮: '朋友、同事與人脈',
    官祿宮: '事業、工作與學業',
    田宅宮: '家庭、住所與不動產',
    福德宮: '心情、興趣與精神生活',
    父母宮: '長輩、上司與文書事務'
};

const mod = (n: number, m = 12) => ((n % m) + m) % m;

// 六十甲子納音（每兩個一組），取最後一個字當五行
const NAYIN = ['海中金', '爐中火', '大林木', '路旁土', '劍鋒金', '山頭火', '澗下水', '城頭土', '白蠟金', '楊柳木', '泉中水', '屋上土', '霹靂火', '松柏木', '長流水', '砂中金', '山下火', '平地木', '壁上土', '金箔金', '覆燈火', '天河水', '大驛土', '釵釧金', '桑柘木', '大溪水', '砂中土', '天上火', '石榴木', '大海水'];
const JU_BY_ELEMENT: Record<string, { n: number; name: string }> = {
    水: { n: 2, name: '水二局' }, 木: { n: 3, name: '木三局' }, 金: { n: 4, name: '金四局' }, 土: { n: 5, name: '土五局' }, 火: { n: 6, name: '火六局' }
};

// 四化：年天干 → [祿, 權, 科, 忌] 的星名
const SIHUA_TABLE: Record<string, [string, string, string, string]> = {
    甲: ['廉貞', '破軍', '武曲', '太陽'],
    乙: ['天機', '天梁', '紫微', '太陰'],
    丙: ['天同', '天機', '文昌', '廉貞'],
    丁: ['太陰', '天同', '天機', '巨門'],
    戊: ['貪狼', '太陰', '右弼', '天機'],
    己: ['武曲', '貪狼', '天梁', '文曲'],
    庚: ['太陽', '武曲', '太陰', '天同'],
    辛: ['巨門', '太陽', '文曲', '文昌'],
    壬: ['天梁', '紫微', '左輔', '武曲'],
    癸: ['破軍', '巨門', '太陰', '貪狼']
};
const SIHUA_KEYS = ['祿', '權', '科', '忌'] as const;

// 祿存位置（年天干）、天魁／天鉞
const LU_CUN = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
const KUI_YUE: Record<string, [number, number]> = { 甲: [1, 7], 戊: [1, 7], 庚: [1, 7], 乙: [0, 8], 己: [0, 8], 丙: [11, 9], 丁: [11, 9], 壬: [3, 5], 癸: [3, 5], 辛: [6, 2] };

export interface NormalizedBirth {
    lunarYear: number;
    lunarMonth: number; // 已處理閏月（閏月 15 日之後算下個月）
    lunarDay: number;
    yearStem: number;
    yearBranch: number;
    hourIndex: number; // 子=0 … 亥=11
    isMale: boolean;
}

function parseTime(t: string): { h: number; mi: number } {
    const m = /^(\d{1,2}):(\d{2})/.exec((t || '').trim());
    if (!m) throw new Error('出生時間格式錯誤，應為 HH:mm');
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) throw new Error('出生時間超出範圍');
    return { h, mi };
}

// 閏月：閏月的前半個月算本月，15 日之後算下個月（紫微斗數常見的處理）
function effectiveLunarMonth(lunar: any): number {
    const m = lunar.getMonth();
    if (m >= 0) return m;
    return -m + (lunar.getDay() > 15 ? 1 : 0);
}

export function normalizeBirth(data: BirthData): NormalizedBirth {
    const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec((data.birth_date || '').trim());
    if (!dm) throw new Error('出生日期格式錯誤，應為 YYYY-MM-DD');
    const [y, m, d] = [+dm[1], +dm[2], +dm[3]];
    const { h } = parseTime(data.birth_time);
    if (data.gender !== 'male' && data.gender !== 'female') throw new Error('性別必須是 male 或 female');

    let lunar: any = data.calendar_type === 'lunar' ? Lunar.fromYmd(y, m, d) : Solar.fromYmd(y, m, d).getLunar();
    // 23:00～23:59 是「晚子時」：和多數排盤軟體（含 iztro）一樣，從 23 點起算隔天的日期，時辰仍是子時
    if (h === 23) lunar = lunar.next(1);
    const hourIndex = Math.floor(((h + 1) % 24) / 2);
    return {
        lunarYear: lunar.getYear(),
        lunarMonth: effectiveLunarMonth(lunar),
        lunarDay: lunar.getDay(),
        yearStem: STEMS.indexOf(lunar.getYearGan()),
        yearBranch: BRANCHES.indexOf(lunar.getYearZhi()),
        hourIndex,
        isMale: data.gender === 'male'
    };
}

// 地支 b 所在宮位的天干（五虎遁：由年天干決定寅宮的天干，之後依序遞增）
function stemAtBranch(yearStem: number, branch: number): number {
    const yinStem = ((yearStem % 5) * 2 + 2) % 10;
    return (yinStem + mod(branch - 2)) % 10;
}

function nayinElement(stem: number, branch: number): string {
    for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return NAYIN[Math.floor(i / 2)].slice(-1);
    throw new Error('納音查詢失敗');
}

// 紫微星所在地支：以農曆日與五行局數推算
function locateZiwei(day: number, ju: number): number {
    let x = 0;
    while ((day + x) % ju !== 0) x++;
    const q = (day + x) / ju;
    return mod(q + 1 + (x % 2 === 0 ? x : -x));
}

export function buildChart(b: NormalizedBirth): ZiweiChart & { ju: number; stars_by_branch: string[][] } {
    // 命宮、身宮：從寅宮起正月順數到生月，再由此逆數（命）／順數（身）生時
    const ming = mod(2 + (b.lunarMonth - 1) - b.hourIndex);
    const shen = mod(2 + (b.lunarMonth - 1) + b.hourIndex);

    const mingStem = stemAtBranch(b.yearStem, ming);
    const element = nayinElement(mingStem, ming);
    const juInfo = JU_BY_ELEMENT[element];

    const ziwei = locateZiwei(b.lunarDay, juInfo.n);
    const tianfu = mod(4 - ziwei);

    const starsByBranch: string[][] = Array.from({ length: 12 }, () => []);
    const place = (name: string, branch: number) => starsByBranch[mod(branch)].push(name);

    // 紫微星系（逆行）與天府星系（順行）
    const ziweiGroup: Array<[string, number]> = [['紫微', 0], ['天機', -1], ['太陽', -3], ['武曲', -4], ['天同', -5], ['廉貞', -8]];
    const tianfuGroup: Array<[string, number]> = [['天府', 0], ['太陰', 1], ['貪狼', 2], ['巨門', 3], ['天相', 4], ['天梁', 5], ['七殺', 6], ['破軍', 10]];
    ziweiGroup.forEach(([n, o]) => place(n, ziwei + o));
    tianfuGroup.forEach(([n, o]) => place(n, tianfu + o));
    const majorNames = new Set([...ziweiGroup, ...tianfuGroup].map(([n]) => n));

    // 輔星與煞星
    const aux: Array<[string, number]> = [
        ['左輔', 4 + (b.lunarMonth - 1)],
        ['右弼', 10 - (b.lunarMonth - 1)],
        ['文昌', 10 - b.hourIndex],
        ['文曲', 4 + b.hourIndex]
    ];
    const lu = LU_CUN[b.yearStem];
    aux.push(['祿存', lu], ['擎羊', lu + 1], ['陀羅', lu - 1]);
    const [kui, yue] = KUI_YUE[STEMS[b.yearStem]];
    aux.push(['天魁', kui], ['天鉞', yue]);
    const trio = [2, 6, 10].includes(b.yearBranch) ? 'fire' : [8, 0, 4].includes(b.yearBranch) ? 'water' : [5, 9, 1].includes(b.yearBranch) ? 'metal' : 'wood';
    const huoStart = { fire: 1, water: 2, metal: 3, wood: 9 }[trio];
    const lingStart = trio === 'fire' ? 3 : 10;
    aux.push(['火星', huoStart + b.hourIndex], ['鈴星', lingStart + b.hourIndex]);
    aux.push(['地劫', 11 + b.hourIndex], ['地空', 11 - b.hourIndex]);
    aux.forEach(([n, br]) => place(n, br));

    // 本命四化：年天干決定哪四顆星化祿權科忌
    const sihuaStars = SIHUA_TABLE[STEMS[b.yearStem]];
    const branchOfStar = (name: string) => starsByBranch.findIndex(list => list.includes(name));
    const sihua: Record<string, string> = {};
    const sihuaPalace: Record<string, string> = {};
    const palaceOfBranch = (branch: number) => PALACE_NAMES[mod(ming - branch)];
    SIHUA_KEYS.forEach((k, i) => {
        sihua[k] = sihuaStars[i];
        const br = branchOfStar(sihuaStars[i]);
        if (br >= 0) sihuaPalace[k] = palaceOfBranch(br);
    });

    // 大限：陽男陰女順行，陰男陽女逆行；每宮十年，起運歲數＝五行局數
    const yang = b.yearStem % 2 === 0;
    const forward = (b.isMale && yang) || (!b.isMale && !yang);
    const palaces: Palace[] = PALACE_NAMES.map((name, k) => {
        const branch = mod(ming - k);
        const step = forward ? mod(branch - ming) : mod(ming - branch);
        const from = juInfo.n + step * 10;
        return {
            name,
            position: k + 1,
            branch: BRANCHES[branch],
            stem: STEMS[stemAtBranch(b.yearStem, branch)],
            stars: starsByBranch[branch].filter(s => majorNames.has(s)),
            minor_stars: starsByBranch[branch].filter(s => !majorNames.has(s)),
            sihua: SIHUA_KEYS.filter((_, i) => starsByBranch[branch].includes(sihuaStars[i])).map(k2 => sihua[k2] + '化' + k2),
            decade: { from, to: from + 9 }
        };
    });

    const major_stars = palaces.flatMap(p => p.stars.map(s => ({ name: s, palace: p.name, branch: p.branch })));

    return {
        twelve_palaces: palaces,
        major_stars,
        sihua: sihua as any,
        sihua_palaces: sihuaPalace,
        element: juInfo.name,
        ming_gong: { branch: BRANCHES[ming], stem: STEMS[mingStem] },
        shen_gong: { branch: BRANCHES[shen], palace: palaceOfBranch(shen) },
        lunar_birth: { year: b.lunarYear, month: b.lunarMonth, day: b.lunarDay, year_ganzhi: STEMS[b.yearStem] + BRANCHES[b.yearBranch] },
        ju: juInfo.n,
        stars_by_branch: starsByBranch
    } as any;
}

// 以台北時間（UTC+8）取「今天」
function taipeiToday(now: Date) {
    const t = new Date(now.getTime() + 8 * 3600 * 1000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function buildRuntime(b: NormalizedBirth, chart: ZiweiChart, now: Date = new Date()): RuntimeContext & Record<string, any> {
    const { y, m, d } = taipeiToday(now);
    const lunar: any = Solar.fromYmd(y, m, d).getLunar();
    const ming = BRANCHES.indexOf((chart as any).ming_gong.branch);
    const palaceAt = (branch: number) => PALACE_NAMES[mod(ming - branch)];

    const taiSui = BRANCHES.indexOf(lunar.getYearZhi());
    const yearStem = STEMS.indexOf(lunar.getYearGan());
    const lunarMonth = effectiveLunarMonth(lunar);

    // 流年命宮＝太歲所在的宮位；流月、流日用「斗君」往後推
    const douJun = mod(taiSui - (b.lunarMonth - 1) + b.hourIndex);
    const monthBranch = mod(douJun + (lunarMonth - 1));
    const dayBranch = mod(monthBranch + (lunar.getDay() - 1));

    const sihuaStars = SIHUA_TABLE[STEMS[yearStem]];
    const stars = (chart as any).stars_by_branch as string[][];
    const liuNianSihua: Record<string, string> = {};
    const liuNianSihuaPalace: Record<string, string> = {};
    SIHUA_KEYS.forEach((k, i) => {
        liuNianSihua[k] = sihuaStars[i];
        const br = stars.findIndex(list => list.includes(sihuaStars[i]));
        if (br >= 0) liuNianSihuaPalace[k] = palaceAt(br);
    });

    return {
        liu_nian: lunar.getYear(),
        liu_yue: lunarMonth,
        liu_ri: lunar.getDay(),
        liu_nian_temple: palaceAt(taiSui),
        liu_yue_temple: palaceAt(monthBranch),
        liu_ri_temple: palaceAt(dayBranch),
        liu_nian_ganzhi: STEMS[yearStem] + BRANCHES[taiSui],
        liu_nian_sihua: liuNianSihua,
        liu_nian_sihua_palaces: liuNianSihuaPalace,
        solar_today: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    };
}

// 白話摘要：只陳述「命盤事實」與各宮位代表的面向，不做吉凶預言
export function buildSummary(chart: any, runtime: any) {
    const main = chart.twelve_palaces[0].stars.join('、') || '無主星（借對宮）';
    const sihua = SIHUA_KEYS.map(k => `${chart.sihua[k]}化${k}`).join('、');
    const base = `命宮在${chart.ming_gong.stem}${chart.ming_gong.branch}，主星：${main}；${chart.element}；本命四化：${sihua}。`;
    const liuNian = SIHUA_KEYS.map(k => `${runtime.liu_nian_sihua[k]}化${k}` + (runtime.liu_nian_sihua_palaces[k] ? `（入${runtime.liu_nian_sihua_palaces[k]}）` : '')).join('、');
    return {
        base,
        yearly: `${runtime.liu_nian}年（${runtime.liu_nian_ganzhi}）流年命宮在「${runtime.liu_nian_temple}」，今年的關注焦點偏向${PALACE_THEMES[runtime.liu_nian_temple]}。流年四化：${liuNian}。`,
        monthly: `農曆${runtime.liu_yue}月流月命宮在「${runtime.liu_yue_temple}」，這個月的關注焦點偏向${PALACE_THEMES[runtime.liu_yue_temple]}。`,
        daily: `農曆${runtime.liu_yue}月${runtime.liu_ri}日流日命宮在「${runtime.liu_ri_temple}」，今天的關注焦點偏向${PALACE_THEMES[runtime.liu_ri_temple]}。`
    };
}

export async function analyzeBirth(data: BirthData, now: Date = new Date()): Promise<FortuneResult> {
    const birth = normalizeBirth(data);
    const chart: any = buildChart(birth);
    const runtime = buildRuntime(birth, chart, now);
    const fortune_summary = buildSummary(chart, runtime);
    delete chart.stars_by_branch; // 內部用，不輸出
    return { chart, runtime, fortune_summary, events: [] } as any;
}
