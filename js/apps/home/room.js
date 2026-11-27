// 宅家的房間格子：家具佔幾格、用哪塊圖、和風度。只放純邏輯，不碰 DOM，方便測試。
// 圖塊來自 Kenney「Roguelike Indoor pack」（CC0，見 assets/stay/Kenney-License.txt）。
export const COLS = 7;
export const ROWS = 6;
export const TEA_AT = 50; // 和風度到這個數字就解鎖茶室

// tile：圖塊在素材表上的 [欄, 列]，往右、往下各取 w、h 塊；wa：和風度（簡單、素雅的家具分數高）。
// flat：地毯類，可以被別的家具踩在上面。
export const ART = {
  bed1: { w: 1, h: 1, tile: [8, 8], wa: 10 },
  bed2: { w: 2, h: 1, tile: [14, 8], wa: 6 },
  bed3: { w: 2, h: 1, tile: [14, 6], wa: 3 },
  desk1: { w: 2, h: 1, tile: [4, 4], wa: 10 },
  desk2: { w: 3, h: 1, tile: [23, 10], wa: 0 },
  sofa1: { w: 1, h: 1, tile: [17, 3], wa: 5 },
  sofa2: { w: 2, h: 1, tile: [4, 6], wa: 4 },
  sofa3: { w: 3, h: 1, tile: [4, 7], wa: 2 },
  tv1: { w: 1, h: 1, tile: [22, 4], wa: 3 },
  tv2: { w: 1, h: 1, tile: [21, 4], wa: 0 },
  pl1: { w: 1, h: 1, tile: [17, 0], wa: 4 },
  pl2: { w: 1, h: 1, tile: [16, 0], wa: 8 },
  pl3: { w: 1, h: 1, tile: [16, 0], wa: 10 },
  rug1: { w: 1, h: 1, tile: [24, 0], wa: 12, flat: true },
  rug2: { w: 3, h: 1, tile: [23, 0], wa: 8, flat: true },
  lamp1: { w: 1, h: 1, tile: [16, 6], wa: 5 },
  lamp2: { w: 1, h: 1, tile: [17, 7], wa: 15 },
  shelf1: { w: 2, h: 1, tile: [19, 17], wa: 10 }
};

const rectOf = (id, p) => ({ x: p.x, y: p.y, w: ART[id].w, h: ART[id].h });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// 把家具左上角拉回房間內（拖到邊緣、點到邊角時用）
export function snap(id, x, y) {
  return { x: Math.max(0, Math.min(COLS - ART[id].w, x)), y: Math.max(0, Math.min(ROWS - ART[id].h, y)) };
}

// placed：{格子: 家具id}；pos：{格子: {x, y}}。slot 這件家具放在 (x, y) 行不行
export function canPlace(placed, pos, slot, x, y) {
  const a = ART[placed[slot]];
  if (x < 0 || y < 0 || x + a.w > COLS || y + a.h > ROWS) return false;
  if (a.flat) return true;
  const r = { x, y, w: a.w, h: a.h };
  return Object.keys(placed).every(o => o === slot || ART[placed[o]].flat || !pos[o] || !overlap(r, rectOf(placed[o], pos[o])));
}

// 找第一個放得下的位置：一般家具由上往下（靠牆），地毯由下往上
export function autoPlace(placed, pos, slot) {
  const ys = Array.from({ length: ROWS }, (_, y) => y);
  if (ART[placed[slot]].flat) ys.reverse();
  for (const y of ys) for (let x = 0; x < COLS; x++) if (canPlace(placed, pos, slot, x, y)) return { x, y };
  return null; // 每件家具都只佔一列，最多 6 件實心家具擋不住 6 列，實際上不會發生
}

// 補齊或修正位置（舊存檔沒有位置、位置跑出房間或疊在一起時重新安排）
export function normalize(placed, pos = {}) {
  const sub = {}, out = {};
  for (const slot of Object.keys(placed)) {
    sub[slot] = placed[slot];
    const p = pos[slot];
    out[slot] = p && canPlace(sub, out, slot, p.x, p.y) ? { x: p.x, y: p.y } : autoPlace(sub, out, slot);
  }
  return out;
}

// 這格上最上面的家具（實心優先，其次地毯）；沒有就回傳 null
export function itemAt(placed, pos, x, y) {
  const here = Object.keys(placed).filter(o => pos[o] && overlap({ x, y, w: 1, h: 1 }, rectOf(placed[o], pos[o])));
  return here.find(o => !ART[placed[o]].flat) || here[0] || null;
}

export const waOf = placed => Math.min(100, Object.values(placed).reduce((n, id) => n + (ART[id]?.wa || 0), 0));
