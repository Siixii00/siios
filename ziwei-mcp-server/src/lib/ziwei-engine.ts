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
    
    const chart: ZiweiChart = {
      twelve_palaces: generateMockPalaces(),
      major_stars: generateMockStars(),
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

function generateMockPalaces() {
  const palaces = [
    '命宮', '兄弟宮', '夫妻宮', '子女宮', '財帛宮', '疾厄宮',
    '遷移宮', '交友宮', '官祿宮', '田宅宮', '福德宮', '父母宮'
  ];
  
  return palaces.map((name, index) => ({
    name,
    position: index + 1,
    stars: ['紫微', '天機'],
    sihua: undefined
  }));
}

function generateMockStars() {
  return [
    { name: '紫微', palace: '命宮', brightness: 1 },
    { name: '天機', palace: '兄弟宮', brightness: 1 }
  ];
}

function calculateRuntimeContext(chart: ZiweiChart, today: Date): RuntimeContext {
  const liu_nian = today.getFullYear();
  const liu_yue = today.getMonth() + 1;
  const liu_ri = today.getDate();
  
  return {
    liu_nian,
    liu_yue,
    liu_ri,
    liu_nian_temple: '命宮',
    liu_yue_temple: '兄弟宮',
    liu_ri_temple: '夫妻宮'
  };
}

function generateFortuneSummary(chart: ZiweiChart, runtime: RuntimeContext): string {
  return `${runtime.liu_nian}年運勢：命宮主星紫微，事業運旺盛，適合發展領導能力。` +
         `${runtime.liu_yue}月運勢：兄弟宮有吉星，人際關係和諧。` +
         `今日${runtime.liu_ri}日：適合處理重要事務，財運平穩。`;
}