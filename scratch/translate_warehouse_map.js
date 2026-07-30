const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'warehouse-map', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['Warehouse Intelligence View', 'تەماشاکردنی ژیری کۆگا'],
  ['High-Definition Infrastructure Visualization', 'نیشاندانی ژێرخانی کۆگاکان بە ڕوونی بەرز'],
  ['placeholder="FIND RACK, ZONE OR ITEM..."', 'placeholder="بۆ مۆدێل، ناوچە، یان ڕەفە بگەڕێ..."'],
  ['No Global Asset Maps Discovered', 'هیچ نەخشەیەکی گشتی کۆگا نەدۆزرایەوە'],
  ['Building Hub System', 'سیستەمی ناوەندی باڵەخانە'],
  ['Structural Partition', 'پۆلێنکردنی پێکهاتەیی'],
  ['Zones</span>', 'ناوچە</span>'],
  ['Total Capacity', 'کۆی گشتی توانای کۆگا'],
  ['UNLIMITED', 'بێ سنوور'],
  ['Stored Items', 'کاڵا کۆگاکراوەکان'],
  ['Inventory Breakdown', 'شیکردنەوەی کاڵاکان'],
  ['This Zone is Currently Empty', 'ئەم ناوچەیە لە ئێستادا بەتاڵە'],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in map file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Warehouse map page translated successfully!');
