// 年齡計算的純邏輯（沒有任何瀏覽器相依），方便自動化測試
export const ADULT_AGE = 18;

const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export function ageOf(birth, now = new Date()) {
    if (!birth) return 0;
    const d = parse(birth);
    let age = now.getFullYear() - d.getFullYear();
    if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
    return age;
}

// 沒有生日資料時一律當成未成年
export const isAdultOn = (birth, now = new Date()) => !!birth && ageOf(birth, now) >= ADULT_AGE;

// 滿 18 歲的那一天（2 月 29 日出生者在非閏年會落在 3 月 1 日）
export function unlockDateOf(birth) {
    if (!birth) return null;
    const d = parse(birth);
    return new Date(d.getFullYear() + ADULT_AGE, d.getMonth(), d.getDate());
}

export const fmtDate = d => d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();

export function toBirthString(y, m, d, now = new Date()) {
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) throw new Error('這一天不存在，請重新選擇');
    if (date > now) throw new Error('生日不能是未來的日期');
    if (y < 1900) throw new Error('請輸入正確的出生年份');
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
