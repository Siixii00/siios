const fs = require('fs');
const path = require('path');

const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import if not exists
const importLine = "import { buildAppContext } from '../../core/app-context-builder.js';";
if (!content.includes('buildAppContext')) {
    content = content.replace(
        "import APIClient from '../../api.js';",
        `import APIClient from '../../api.js';\n${importLine}`
    );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Import added successfully');
