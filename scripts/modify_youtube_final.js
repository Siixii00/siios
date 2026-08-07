const fs = require('fs');
const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Step 1: Add import
if (!content.includes('buildAppContext')) {
    const oldImport = "import APIClient from '../../api.js';";
    const newImport = oldImport + "\nimport { buildAppContext } from '../../core/app-context-builder.js';";
    content = content.replace(oldImport, newImport);
}

// Step 2: Modify generateLLMContent function
const oldFunc = sync function generateLLMContent(prompt, maxRetries = 2) {
    const settings = await APIClient.getSettings();
    
    if (!settings.api_url || !settings.api_key) {
        return null;
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(\\/v1/chat/completions\, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \Bearer \\
                },
                body: JSON.stringify({
                    model: settings.model || 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.8,
                    max_tokens: 200
                })
            });
            
            if (!response.ok) continue;
            
            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || null;
        } catch {
            if (attempt < maxRetries) continue;
        }
    }
    return null;
};

const newFunc = sync function generateLLMContent(prompt, characterId = null, maxRetries = 2) {
    const settings = await APIClient.getSettings();
    
    if (!settings.api_url || !settings.api_key) {
        return null;
    }
    
    const context = await buildAppContext({ characterId });
    
    const messages = [];
    if (context.systemPrompt) {
        messages.push({ role: 'system', content: context.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(\\/v1/chat/completions\, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \Bearer \\
                },
                body: JSON.stringify({
                    model: settings.model || 'gpt-3.5-turbo',
                    messages,
                    temperature: 0.8,
                    max_tokens: 200
                })
            });
            
            if (!response.ok) continue;
            
            const data = await response.json();
            return data.choices?.[0]?.message?.content?.trim() || null;
        } catch {
            if (attempt < maxRetries) continue;
        }
    }
    return null;
};

content = content.replace(oldFunc, newFunc);

// Step 3: Update generateLLMContent calls
content = content.replace(/const reaction = await generateLLMContent\(prompt\);/g, 'const reaction = await generateLLMContent(prompt, char?.id);');
content = content.replace(/const comment = await generateLLMContent\(prompt\);/g, 'const comment = await generateLLMContent(prompt, char?.id);');
content = content.replace(/const title = await generateLLMContent\(prompt\);/g, 'const title = await generateLLMContent(prompt, char?.id);');
content = content.replace(/const desc = await generateLLMContent\(prompt\);/g, 'const desc = await generateLLMContent(prompt, char?.id);');
content = content.replace(/const content = await generateLLMContent\(prompt\);/g, 'const adContent = await generateLLMContent(prompt, char?.id);');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Modifications completed');