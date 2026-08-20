import { BirthData, ZiweiChart, RuntimeContext, FortuneResult } from '../types';

export async function analyzeBirth(data: BirthData): Promise<FortuneResult> {
  const chart = await generateZiweiChart(data);
  const runtime = calculateRuntimeContext(chart, new Date());
  const fortune_summary = generateFortuneSummary(chart, runtime);
  
  return {
    chart,
    runtime,
    fortune_summary
  };
}

async function generateZiweiChart(data: BirthData): Promise<ZiweiChart> {
  try {
    const lunarDate = await convertToLunar(data);
    const hour = parseHour(data.birth_time);
    const seed = `${data.birth_date}-${data.birth_time}-${data.gender}`;
    
    const chart: ZiweiChart = {
      twelve_palaces: generateMockPalaces(seed),
      major_stars: generateMockStars(seed),
      sihua: {
        lu: '天梁',
        quan: '紫微',
        ke: '天府',
        ji: '武曲'
      },
      element: '水二局'
    };
    
    return chart;
  } catch (error) {
    throw new Error(`排盤失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
  }
}

async function convertToLunar(data: BirthData): Promise<{ year: number; month: number; day: number }> {
  if (data.calendar_type === 'lunar') {
    const parts = data.birth_date.split('-');
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parseInt(parts[2])
    };
  }
  
  const date = new Date(data.birth_date);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  };
}

function parseHour(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0]);
}

function simpleHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFromList(seed: number, list: string[]): string {
  return list[seed % list.length];
}

function generateMockPalaces(seed: string) {
  const palaces = [
    '命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮',
    '遷移宮', '交友宮', '官祿宮', '田宅宮', '福德宮', '父母宮'
  ];
  const hash = simpleHash(seed);
  const mainStars = [
    ['紫微', '天機'],
    ['天同', '巨門'],
    ['天府', '太陰'],
    ['武曲', '天相']
  ];
  const starPool = mainStars[hash % mainStars.length];
  
  return palaces.map((name, index) => {
    const positionHash = simpleHash(`${seed}-${name}`);
    return {
      name,
      position: index + 1,
      stars: positionHash % 3 === 0 ? starPool : ['輔星'],
      sihua: undefined
    };
  });
}

function generateMockStars(seed: string) {
  const stars = [
    { name: '紫微', palace: '命宮', brightness: 1 },
    { name: '天機', palace: '兄弟宮', brightness: 1 },
    { name: '天同', palace: '夫妻宮', brightness: 0 },
    { name: '巨門', palace: '財帛宮', brightness: -1 }
  ];
  const hash = simpleHash(seed);
  return [
    stars[hash % stars.length],
    stars[(hash + 3) % stars.length]
  ];
}

function calculateRuntimeContext(chart: ZiweiChart, today: Date): RuntimeContext {
  const liu_nian = today.getFullYear();
  const liu_yue = today.getMonth() + 1;
  const liu_ri = today.getDate();
  const yearTemple = chart.twelve_palaces[liu_nian % chart.twelve_palaces.length]?.name || '命宮';
  const monthTemple = chart.twelve_palaces[liu_yue % chart.twelve_palaces.length]?.name || '兄弟宮';
  const dayTemple = chart.twelve_palaces[liu_ri % chart.twelve_palaces.length]?.name || '夫妻宮';
  
  return {
    liu_nian,
    liu_yue,
    liu_ri,
    liu_nian_temple: yearTemple,
    liu_yue_temple: monthTemple,
    liu_ri_temple: dayTemple
  };
}

function generateFortuneSummary(chart: ZiweiChart, runtime: RuntimeContext): string {
  const yearStars = chart.major_stars.map(star => star.name).join('、');
  const monthStars = chart.twelve_palaces[runtime.liu_yue - 1]?.stars?.join('、') || '吉星';
  return `${runtime.liu_nian}年運勢：${yearStars}入${runtime.liu_nian_temple}，適合發展領導能力。` +
         `${runtime.liu_yue}月運勢：${monthStars}位於${runtime.liu_yue_temple}，人際關係和諧。` +
         `今日${runtime.liu_ri}日：${runtime.liu_ri_temple}有動向，適合處理重要事務，財運平穩。`;
}