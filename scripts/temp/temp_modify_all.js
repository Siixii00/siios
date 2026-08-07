const fs = require('fs');
const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Modify generateCharReaction to use characterId
content = content.replace(
    'const reaction = await generateLLMContent(prompt);',
    'const reaction = await generateLLMContent(prompt, char?.id);'
);

// 2. Modify generateCharLiveComment to use characterId
content = content.replace(
    'const comment = await generateLLMContent(prompt);',
    'const comment = await generateLLMContent(prompt, char?.id);'
);

// 3. Modify generateVideoTitle to use characterId
content = content.replace(
    'const title = await generateLLMContent(prompt);',
    'const title = await generateLLMContent(prompt, char?.id);'
);

// 4. Modify generateVideoDescription to use characterId
content = content.replace(
    'const desc = await generateLLMContent(prompt);',
    'const desc = await generateLLMContent(prompt, char?.id);'
);

// 5. Modify generateAdContent to use characterId
content = content.replace(
    'const content = await generateLLMContent(prompt);',
    'const content = await generateLLMContent(prompt, char?.id);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('All LLM functions modified to use buildAppContext');
