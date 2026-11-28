// 農場的遊戲性規則：幸運收成、作物精通、旅行商人的提案。只放純函式，不碰 DOM，方便測試。
export const MASTERY_AT = [8, 25, 60]; // 同一種作物收成幾次，拿到 1、2、3 星
export const LUCK_HARVESTS = 5; // 幸運符可以用幾次收成
const GOLDEN_BASE = 0.08; // 金色收成（產量 ×3）的基本機率
const GOLDEN_LUCK = 0.25; // 幸運符期間的額外機率

export const starsOf = count => MASTERY_AT.filter(t => count >= t).length;
export const perkOf = stars => 0.05 * stars; // 每顆星讓這種作物縮短 5% 生長時間
export const masteryReward = (crop, star) => Math.round(crop.sell * 2 * star);
export const goldenChance = luck => GOLDEN_BASE + (luck > 0 ? GOLDEN_LUCK : 0);
export const rollGolden = (rng, luck) => rng() < goldenChance(luck);

// 像素版改版後下架的作物（素材沒有對應的圖）。舊存檔裡這些作物的種子與庫存，按原價退錢。
export const REMOVED_CROPS = { c9: { seed: 200, sell: 700 }, c10: { seed: 160, sell: 540 }, c11: { seed: 280, sell: 1000 }, c12: { seed: 400, sell: 1500 } };

export function migrateSaved(saved) {
  let refund = 0;
  const out = { ...saved };
  out.plots = (saved.plots || []).map(p => { if (p && REMOVED_CROPS[p.cropId]) { refund += REMOVED_CROPS[p.cropId].seed; return null; } return p; });
  out.inv = {};
  for (const [id, n] of Object.entries(saved.inv || {})) { if (REMOVED_CROPS[id]) refund += REMOVED_CROPS[id].sell * n; else out.inv[id] = n; }
  if ((saved.orders?.list || []).some(o => REMOVED_CROPS[o.item])) out.orders = { date: '', list: [] }; // 訂單要下架的作物：整批重開
  if (saved.mastery) out.mastery = Object.fromEntries(Object.entries(saved.mastery).filter(([id]) => !REMOVED_CROPS[id]));
  return { saved: out, refund };
}

// 旅行商人每天來一次。倉庫裡有 2 件以上的東西，就開價收購或換幸運符；否則直接送幸運符。
export function visitorOffer(inv, priceOf) {
  const best = Object.keys(inv).filter(id => inv[id] >= 2).sort((a, b) => inv[b] * priceOf(b) - inv[a] * priceOf(a))[0];
  if (!best) return { kind: 'gift' };
  const qty = Math.min(inv[best], 5);
  return { kind: 'trade', item: best, qty, pay: Math.round(qty * priceOf(best) * 1.5), swap: Math.min(inv[best], 3) };
}
