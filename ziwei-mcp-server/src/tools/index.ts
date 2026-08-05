import { MCPTool, MCPToolCall, FortuneResult } from '../types';
import { analyzeBirth } from '../lib/ziwei-engine';

export const AVAILABLE_TOOLS: MCPTool[] = [
  {
    name: 'ziwei_analyze_birth',
    description: '根據出生年月日時間進行紫微斗數排盤分析',
    inputSchema: {
      type: 'object',
      properties: {
        birth_date: { type: 'string', description: '出生日期 YYYY-MM-DD' },
        birth_time: { type: 'string', description: '出生時間 HH:mm' },
        birth_location: { type: 'string', description: '出生地城市名' },
        calendar_type: { 
          type: 'string', 
          enum: ['solar', 'lunar'],
          description: '國曆或農曆'
        },
        gender: { 
          type: 'string', 
          enum: ['male', 'female'],
          description: '性別'
        }
      },
      required: ['birth_date', 'birth_time', 'gender']
    }
  }
];

export async function handleToolCall(call: MCPToolCall): Promise<any> {
  switch (call.name) {
    case 'ziwei_analyze_birth':
      return await analyzeBirth(call.arguments);
    
    default:
      throw new Error(`未知的工具: ${call.name}`);
  }
}