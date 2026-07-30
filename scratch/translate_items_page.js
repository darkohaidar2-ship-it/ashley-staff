const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'items', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['Nexus Intelligence System', 'سیستمی زانیاری نێکسیوس'],
  ['Automated Data Synchronization Protocol v4.0', 'پرۆتۆکۆلی هاوکاتکردنی داتای ئۆتۆماتیکی v4.0'],
  ['Audit Qty</TableHead>', 'بڕی وردبینراو</TableHead>'],
  ['Status</TableHead>', 'دۆخی کۆگا</TableHead>'],
  ['Audit Note</TableHead>', 'تێبینی وردبینی</TableHead>'],
  ['Orig: {item.quantity}', 'سەرەکی: {item.quantity}'],
  ['ALL LOCATIONS', 'هەموو شوێنەکان'],
  ['+ Add Row', '+ زیادکردنی ڕیز'],
  ['New Qty', 'بڕی نوێ'],
  ['Cond. Qty', 'بڕی بەپێی دۆخ'],
  ['Notes', 'تێبینی'],
  ['Entry Note', 'تێبینی تۆمار'],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in items file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Items page translated successfully!');
