const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'archive', '[id]', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

content = content.replace('Exit دۆخی سەرنجدان', 'چوونەدەرەوە لە دۆخی سەرنجدان');
content = content.replace('italic">None</span>', 'italic">هیچ</span>');

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Fixed archive page successfully!');
