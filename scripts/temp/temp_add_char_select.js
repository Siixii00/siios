const fs = require('fs');
const filePath = 'E:\\new\\siios\\js\\apps\\youtube\\index.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
    '                </select>\n            </div>\n            <div class="yt-feed"></div>',
    '                </select>\n                <select class="yt-char-select" id="yt-char-select">\n                    <option value="">選擇角色</option>\n                    ${characters.map(c => `<option value="${c.id}">${c.name}</option>`).join(''X')}\n                </select>\n            </div>\n            <div class="yt-feed"></div>'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Character selector added');
