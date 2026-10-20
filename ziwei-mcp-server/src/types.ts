export interface BirthData {
  birth_date: string;
  birth_time: string;
  birth_location?: string;
  calendar_type: 'solar' | 'lunar';
  gender: 'male' | 'female';
}

export interface ZiweiChart {
  twelve_palaces: Palace[];
  major_stars: Star[];
  // 本命四化：key 是「祿權科忌」，value 是化出的星名（前端的 buildZiweiContext 就是讀這個格式）
  sihua: Record<string, string>;
  sihua_palaces?: Record<string, string>;
  element: string;
  ming_gong?: { branch: string; stem: string };
  shen_gong?: { branch: string; palace: string };
  lunar_birth?: { year: number; month: number; day: number; year_ganzhi: string };
}

export interface Palace {
  name: string;
  position: number;
  branch?: string;
  stem?: string;
  stars: string[];
  minor_stars?: string[];
  sihua?: string[];
  decade?: { from: number; to: number };
}

export interface Star {
  name: string;
  palace: string;
  branch?: string;
}

// 前端的快取與 Wiki 卡片讀 daily / monthly / yearly
export interface FortuneSummary {
  base: string;
  yearly: string;
  monthly: string;
  daily: string;
}

export interface FortuneResult {
  chart: ZiweiChart;
  runtime: RuntimeContext;
  fortune_summary: FortuneSummary;
  events: unknown[];
}

export interface RuntimeContext {
  liu_nian: number;
  liu_yue: number;
  liu_ri: number;
  liu_nian_temple: string;
  liu_yue_temple: string;
  liu_ri_temple: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: any;
}
