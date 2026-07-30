const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'settings', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['Members', 'کارمەندان'],
  ['Roles', 'ڕۆڵەکان'],
  ['Activity', 'چالاکی'],
  ['Data Mgr', 'ڕێکخستنی داتا'],
  ['Nexus Data Export', 'هەناردەکردنی داتای نێکسیوس'],
  ['Nexus Data Import', 'هاوردەکردنی داتای نێکسیوس'],
  ['Strips all branding images', 'سڕینەوەی هەموو لۆگۆ و وێنەکان'],
  ['Terminal Purge Protocol', 'پرۆتۆکۆلی سڕینەوەی گشتی'],
  ['Abort', 'پاشگەزبوونەوە'],
  ['Save Configuration', 'پاشەکەوتکردنی ڕێکخستنەکان'],
  ['Provision New Access Tier', 'دروستکردنی ڕۆڵی نوێ'],
  ['Role Designation Name', 'ناوی ڕۆڵ'],
  ['Initialize Role', 'دروستکردنی ڕۆڵ'],
  ['Translations Architecture', 'پێکهاتەی وەرگێڕانەکان'],
  ['Media Hub', 'ناوەندی میدیا'],
  ['Admin', 'ئەدمین'],
  ['Dashboard News Ticker', 'شریتی هەواڵی داشبۆرد'],
  ['Announcement Text', 'دەقی ڕاگەیاندن'],
  ['Live Preview', 'پێشبینی ڕاستەوخۆ'],
  ['Terminal Typography', 'فۆنت و شێوازی نووسین'],
  ['Upload TTF Font File', 'بارکردنی فایلی فۆنتی TTF'],
  ['Typography Weight Audit', 'پشکنینی فۆنت'],
  ['Login Device Videos', 'ڤیدیۆکانی لاپەڕەی چوونەژوورەوە'],
  ['Laptop Screen', 'شاشەی لاپتۆپ'],
  ['Tablet Screen', 'شاشەی تابلێت'],
  ['Phone Screen', 'شاشەی مۆبایل'],
  ['Asset Destination', 'کۆگای مەبەست'],
  ['Document Engine Configuration', 'ڕێکخستنی سیستەمی بەڵگەنامەکان'],
  ['Card Architecture', 'دیزاینی کارتەکان'],
  ['ALL UPPERCASE', 'پیتی گەورە (ALL UPPERCASE)'],
  ['Capitalize First Letter', 'پیتی یەکەم گەورە'],
  ['Main Hub Typography', 'فۆنتی داشبۆردی سەرەکی'],
  ['Global Dashboard Font Size', 'قەبارەی فۆنتی داشبۆردی گشتی'],
  ['Command Sidebar Configuration', 'ڕێکخستنی سایدباری فەرمانەکان'],
  ['Sidebar Font Size', 'قەبارەی فۆنتی سایدبار'],
  ['System Interface Scaling', 'پێوەری ڕووکاری سیستەم'],
  ['Global Text Scale', 'قەبارەی دەقی گشتی'],
  ['Branch Display Identity', 'ناسنامەی نیشاندانی لق'],
  ['Branch Indicator Size', 'قەبارەی نیشاندەری لق'],
  ['Command Sector', 'کەرتی فەرمانەکان'],
  ['Hub Architecture Data', 'داتای پێکهاتەی داشبۆرد'],
  ['Small Caption Element', 'سەردێڕی بچووک'],
  ['New Linguistic Anchor', 'سەرچاوەی زمانەوانی نوێ'],
  ['English Translation', 'وەرگێڕانی ئینگلیزی'],
  ['Kurdish Translation', 'وەرگێڕانی کوردی'],
  ['Initialize Translation', 'دروستکردنی وەرگێڕان'],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in settings file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Settings page translated successfully!');
