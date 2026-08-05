import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AVAILABLE_TOOLS, handleToolCall } from './tools';
import { MCPToolCall } from './types';

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

app.get('/', (c) => {
  return c.json({
    name: 'ziwei-mcp-server',
    version: '1.0.0',
    description: '紫微斗數 MCP Server',
    endpoints: {
      '/tools': 'GET - 列出可用工具',
      '/tools/call': 'POST - 調用工具'
    }
  });
});

app.get('/tools', (c) => {
  return c.json({
    tools: AVAILABLE_TOOLS
  });
});

app.post('/tools/call', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.name) {
      return c.json({ error: '缺少工具名稱' }, 400);
    }
    
    const call: MCPToolCall = {
      name: body.name,
      arguments: body.arguments || body.params || {}
    };
    
    const result = await handleToolCall(call);
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Tool call error:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '處理失敗'
    }, 500);
  }
});

app.options('*', (c) => {
  return c.text('', 204);
});

export default app;