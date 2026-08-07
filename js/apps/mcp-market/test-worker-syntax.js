import { TOOLS_CATALOG } from './tools-catalog.js';
import { generateZipContent } from './code-templates.js';

const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
};

function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warning: '\x1b[33m'
    };
    const reset = '\x1b[0m';
    console.log(`${colors[type]}${message}${reset}`);
}

function validateJavaScriptSyntax(code, filename) {
    try {
        new Function(code);
        return { valid: true };
    } catch (error) {
        return { 
            valid: false, 
            error: error.message,
            line: error.lineNumber || 'unknown'
        };
    }
}

function checkRequiredImports(code) {
    const issues = [];
    
    if (!code.includes('export default')) {
        issues.push('缺少 export default');
    }
    
    if (!code.includes('fetch(request, env, ctx)')) {
        issues.push('缺少 fetch 處理函數');
    }
    
    if (!code.includes('/tools') || !code.includes('/tools/call')) {
        issues.push('缺少必要的端點定義');
    }
    
    return issues;
}

function checkEnvironmentVariables(code, toolIds) {
    const requiredEnvVars = [];
    
    toolIds.forEach(id => {
        const tool = TOOLS_CATALOG.find(t => t.id === id);
        if (tool?.requires) {
            tool.requires.forEach(req => {
                if (req.includes('API Key') || req.includes('API')) {
                    const envVar = req.match(/[A-Z_]+_KEY|[A-Z_]+_API/);
                    if (envVar) {
                        requiredEnvVars.push(envVar[0]);
                    }
                }
            });
        }
    });
    
    const missingEnvVars = [];
    requiredEnvVars.forEach(envVar => {
        if (!code.includes(`env.${envVar}`) && !code.includes(envVar)) {
            missingEnvVars.push(envVar);
        }
    });
    
    return missingEnvVars;
}

function validateToolDefinitions(code, toolIds) {
    const issues = [];
    
    toolIds.forEach(id => {
        const tool = TOOLS_CATALOG.find(t => t.id === id);
        if (!tool) {
            issues.push(`工具 ${id} 不在 TOOLS_CATALOG 中`);
            return;
        }
        
        if (!code.includes(`name: '${tool.name}'`)) {
            issues.push(`缺少工具定義: ${tool.name} (${id})`);
        }
        
        if (!code.includes(`case '${tool.name}':`)) {
            issues.push(`缺少工具執行邏輯: ${tool.name} (${id})`);
        }
    });
    
    return issues;
}

async function testSingleTool(toolId) {
    log(`\n測試工具: ${toolId}`, 'info');
    
    try {
        const files = generateZipContent([toolId]);
        const workerCode = files['worker.js'];
        
        if (!workerCode) {
            throw new Error('無法生成 worker.js');
        }
        
        const syntaxResult = validateJavaScriptSyntax(workerCode, 'worker.js');
        if (!syntaxResult.valid) {
            throw new Error(`語法錯誤 (行 ${syntaxResult.line}): ${syntaxResult.error}`);
        }
        
        const importIssues = checkRequiredImports(workerCode);
        if (importIssues.length > 0) {
            log(`  ⚠ 匯入問題: ${importIssues.join(', ')}`, 'warning');
        }
        
        const envIssues = checkEnvironmentVariables(workerCode, [toolId]);
        if (envIssues.length > 0) {
            log(`  ⚠ 需要設定環境變數: ${envIssues.join(', ')}`, 'warning');
        }
        
        const toolIssues = validateToolDefinitions(workerCode, [toolId]);
        if (toolIssues.length > 0) {
            throw new Error(`工具定義問題: ${toolIssues.join(', ')}`);
        }
        
        log(`  ✓ 通過`, 'success');
        testResults.passed++;
        return true;
        
    } catch (error) {
        log(`  ✗ 失敗: ${error.message}`, 'error');
        testResults.failed++;
        testResults.errors.push({
            tool: toolId,
            error: error.message
        });
        return false;
    }
}

async function testMultipleTools(toolIds) {
    const combinationName = toolIds.slice(0, 3).join('+') + (toolIds.length > 3 ? '...' : '');
    log(`\n測試組合: ${combinationName} (${toolIds.length} 個工具)`, 'info');
    
    try {
        const files = generateZipContent(toolIds);
        const workerCode = files['worker.js'];
        
        if (!workerCode) {
            throw new Error('無法生成 worker.js');
        }
        
        const syntaxResult = validateJavaScriptSyntax(workerCode, 'worker.js');
        if (!syntaxResult.valid) {
            throw new Error(`語法錯誤 (行 ${syntaxResult.line}): ${syntaxResult.error}`);
        }
        
        const importIssues = checkRequiredImports(workerCode);
        if (importIssues.length > 0) {
            log(`  ⚠ 匯入問題: ${importIssues.join(', ')}`, 'warning');
        }
        
        const toolIssues = validateToolDefinitions(workerCode, toolIds);
        if (toolIssues.length > 0) {
            throw new Error(`工具定義問題: ${toolIssues.join(', ')}`);
        }
        
        log(`  ✓ 通過`, 'success');
        testResults.passed++;
        return true;
        
    } catch (error) {
        log(`  ✗ 失敗: ${error.message}`, 'error');
        testResults.failed++;
        testResults.errors.push({
            tools: toolIds,
            error: error.message
        });
        return false;
    }
}

async function runAllTests() {
    log('\n========================================', 'info');
    log('MCP Worker 程式碼語法檢查測試', 'info');
    log('========================================\n', 'info');
    
    const allToolIds = TOOLS_CATALOG.map(t => t.id);
    testResults.total = allToolIds.length + 3;
    
    log(`總共 ${allToolIds.length} 個工具\n`, 'info');
    
    for (const toolId of allToolIds) {
        await testSingleTool(toolId);
    }
    
    log('\n----------------------------------------', 'info');
    log('測試工具組合', 'info');
    log('----------------------------------------', 'info');
    
    await testMultipleTools(['daily_weather', 'daily_reminder', 'daily_recipe']);
    
    await testMultipleTools(allToolIds.slice(0, 5));
    
    await testMultipleTools(allToolIds);
    
    log('\n========================================', 'info');
    log('測試結果摘要', 'info');
    log('========================================', 'info');
    log(`總測試數: ${testResults.total}`, 'info');
    log(`通過: ${testResults.passed}`, 'success');
    log(`失敗: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
    
    if (testResults.errors.length > 0) {
        log('\n失敗詳情:', 'error');
        testResults.errors.forEach((err, i) => {
            log(`${i + 1}. ${err.tool || err.tools?.join('+')}: ${err.error}`, 'error');
        });
    }
    
    log('\n測試完成！', testResults.failed === 0 ? 'success' : 'warning');
    
    return testResults;
}

if (typeof window === 'undefined') {
    runAllTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runAllTests, testSingleTool, testMultipleTools };