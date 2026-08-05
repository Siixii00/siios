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
  sihua: Sihua;
  element: string;
}

export interface Palace {
  name: string;
  position: number;
  stars: string[];
  sihua?: string;
}

export interface Star {
  name: string;
  palace: string;
  brightness: number;
}

export interface Sihua {
  lu: string;
  quan: string;
  ke: string;
  ji: string;
}

export interface FortuneResult {
  chart: ZiweiChart;
  runtime: RuntimeContext;
  fortune_summary: string;
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
  inputSchema: any;
}

export interface MCPToolCall {
  name: string;
  arguments: any;
}