const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'locations', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['Section Name', 'ناوی بەش'],
  ['Format</Label>', 'فۆرمات</Label>'],
  ['Zones</Label>', 'ناوچەکان</Label>'],
  ['Add Section', 'زیادکردنی بەش'],
  ['Add Another Floor/Area', 'زیادکردنی نهۆم/ناوچەیەکی تر'],
  ['Preview ({generatedCodes.length} Locations)', 'پێشبینی ({generatedCodes.length} شوێن)'],
  ['Generate {generatedCodes.length} Locations', 'دروستکردنی {generatedCodes.length} شوێن'],
  ['Edit Location Code', 'دەستکاریکردنی کۆدی شوێن'],
  ['Update the full code for this specific zone.', 'تەواوی کۆدەکە بۆ ئەم ناوچەیە نوێ بکەرەوە.'],
  ['Location Code</Label>', 'کۆدی شوێن</Label>'],
  ['Save Changes</Button>', 'پاشەکەوتکردنی گۆڕانکارییەکان</Button>'],
  ['Select the warehouse and fill in the details to generate a unique location code.', 'کۆگاکە هەڵبژێرە و وردەکارییەکان پڕ بکەرەوە بۆ دروستکردنی کۆدی شوێنی تایبەت.'],
  ['Warehouse / Building Name', 'ناوی کۆگا / باڵەخانە'],
  ['e.g. Warehouse 1, Main Building', 'بۆ نموونە: کۆگای ١، باڵەخانەی سەرەکی'],
  ['Floor / Area Name', 'ناوی نهۆم / ناوچە'],
  ['e.g. 1, Level 2', 'بۆ نموونە: ١، نهۆمی ٢'],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in locations file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Locations page translated successfully!');
