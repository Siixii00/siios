const fs = require('fs');
const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Modify generateLLMContent to accept characterId and use buildAppContext
const oldGenerateLLMContent = `async function generateLLMContent(prompt, maxRetries = 2) {
    const settings = await APIClient.getSettings();
    
    if (!settings.api_url || !settings.api_key) {
        return null;
    }
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(\`\${settings.api_url}/v1/chat/completions\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${settings.api_key}\`
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
}`;

const newGenerateLLMContent = `async function generateLLMContent(prompt, characterId = null, maxRetries = 2) {
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
            const response = await fetch(\`\${settings.api_url}/v1/chat/completions\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${settings.api_key}\`
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
}`;

content = content.replace(oldGenerateLLMContent, newGenerateLLMContent);

fs.writeFileSync(filePath, content, 'utf8');
console.log('generateLLMContent modified successfully');
