const fs = require('fs');
const path = require('path');

const kuPath = path.join(__dirname, '..', 'src', 'locales', 'ku.json');
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));

const updates = {
  "data_management_desc": "پاڵپشتی یان گێڕانەوەی هەموو داتاکانی ئەپڵیکەیشنەکە. داتاکانت لە وێبگەڕەکەدا پاشەکەوت دەکرێن، بۆیە دڵنیابە لە ئەنجامدانی پاڵپشتی بەردەوام.",
  "done": "تەواو",
  "waiting": "چاوەڕوانە",
  "request_deleted": "داواکاری سڕایەوە",
  "request_for_model_deleted": "داواکارییەکە بۆ {model} سڕایەوە.",
  "request_updated": "داواکاری نوێکرایەوە",
  "request_for_model_updated": "داواکارییەکە بۆ {model} نوێکرایەوە.",
  "edit_request": "دەستکاریکردنی داواکاری",
  "confirm_delete_request": "دڵنیای لە سڕینەوەی داواکارییەکە بۆ {model}؟",
  "no_requests_for_month": "هیچ داواکارییەکی کڕین بۆ ئەم مانگە نەدۆزرایەوە."
};

const updatedKu = { ...ku, ...updates };

fs.writeFileSync(kuPath, JSON.stringify(updatedKu, null, 2), 'utf8');
console.log('ku.json has been successfully updated!');
