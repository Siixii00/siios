const fs = require('fs');
const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// Modify generateCharReaction to use characterId
content = content.replace(
    'const reaction = await generateLLMContent(prompt);',
    'const reaction = await generateLLMContent(prompt, char?.id);'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('generateCharReaction modified');
