const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'archive', '[id]', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  ['Focus Mode', 'دۆخی سەرنجدان'],
  ['Confirm Deletion', 'دڵنیابوون لە سڕینەوە'],
  ['Are you sure you want to delete', 'دڵنیایت دەتەوێت بسڕیتەوە'],
  ['This action cannot be undone.', 'ئەم کردارە ناگەڕێنرێتەوە.'],
  ['Cancel</AlertDialogCancel>', 'پاشگەزبوونەوە</AlertDialogCancel>'],
  ['Delete File</AlertDialogAction>', 'سڕینەوەی فایل</AlertDialogAction>'],
  ['Exit Focus Mode', 'چوونەدەرەوە لە دۆخی سەرنجدان'],
  ['Storage Context', 'کۆنتێکستی کۆگا'],
  ['placeholder="Context"', 'placeholder="کۆنتێکست"'],
  ['SelectItem value="Ashley Store">Ashley Store', 'SelectItem value="Ashley Store">کۆگای ئاشلی (Ashley Store)'],
  ['SelectItem value="Huana Store">Huana Store', 'SelectItem value="Huana Store">کۆگای هوئانا (Huana Store)'],
  ['SelectItem value="Showroom">Showroom', 'SelectItem value="Showroom">شۆڕوم (Showroom)'],
  ['Responsible Personnel', 'کارمەندی بەرپرس'],
  ['placeholder="User"', 'placeholder="بەکارهێنەر"'],
  ['Storekeeper</p>', 'کۆگادار</p>'],
  ['Registration Date', 'بەرواری تۆمارکردن'],
  ['No Date', 'بێ بەروار'],
  ['Archive Timestamp', 'مۆری کاتی ئەرشیف'],
  ['Sub-Categorization', 'پۆلێنکردنی لاوەکی'],
  ['placeholder="Set Category"', 'placeholder="پۆلێن دیاری بکە"'],
  ['SelectItem value="Bedroom">Bedroom', 'SelectItem value="Bedroom">ژووری خەوتن (Bedroom)'],
  ['SelectItem value="Dining Room">Dining Room', 'SelectItem value="Dining Room">ژووری نانخواردن (Dining Room)'],
  ['SelectItem value="Living Room">Living Room', 'SelectItem value="Living Room">ژووری دانیشتن (Living Room)'],
  ['SelectItem value="Kitchen">Kitchen', 'SelectItem value="Kitchen">مەتبەخ (Kitchen)'],
  ['SelectItem value="Office">Office', 'SelectItem value="Office">نووسینگە (Office)'],
  ['SelectItem value="Outdoor">Outdoor', 'SelectItem value="Outdoor">دەرەوە (Outdoor)'],
  ['SelectItem value="Hallway">Hallway', 'SelectItem value="Hallway">ڕاڕەو (Hallway)'],
  ['SelectItem value="Warehouse">Warehouse', 'SelectItem value="Warehouse">کۆگا (Warehouse)'],
  ['SelectItem value="Others">Others', 'SelectItem value="Others">وانی تر (Others)'],
  ['Placement Folder', 'فۆڵدەری دانان'],
  ['Inventory Data Sheet', 'پەڕەی زانیارییەکانی کۆگا'],
  ['placeholder="ALL LOCATIONS"', 'placeholder="هەموو شوێنەکان"'],
  ['SelectItem value="All" className="text-[10px] font-bold uppercase">All Locations', 'SelectItem value="All" className="text-[10px] font-bold uppercase">هەموو شوێنەکان'],
  ['placeholder="Filter rows..."', 'placeholder="فلتەرکردنی ڕیزەکان..."'],
  ['+ Add Row', '+ زیادکردنی ڕیز'],
  ['Orig. Qty', 'بڕی سەرەکی'],
  ['New Qty', 'بڕی نوێ'],
  ['Cond. Qty', 'بڕی بەپێی دۆخ'],
  ['Notes', 'تێبینی'],
  ['Entry Note', 'تێبینی تۆمار'],
  
  // Statuses
  ['SelectItem value="Correct">Correct', 'SelectItem value="Correct">دروستە (Correct)'],
  ['SelectItem value="Less">Less', 'SelectItem value="Less">کەمتر (Less)'],
  ['SelectItem value="More">More', 'SelectItem value="More">زیاتر (More)'],
  ['SelectItem value="Qty Changed">Qty Changed', 'SelectItem value="Qty Changed">بڕ گۆڕدرا (Qty Changed)'],
  
  // Conditions
  ['SelectItem value="Packaged">Packaged', 'SelectItem value="Packaged">پێچراوی تەواو (Packaged)'],
  ['SelectItem value="Wrapped">Wrapped', 'SelectItem value="Wrapped">پێچراو (Wrapped)'],
  ['SelectItem value="Damaged">Damaged', 'SelectItem value="Damaged">تێکچوو (Damaged)'],
  ['SelectItem value="Need Wrapped">Need Wrapped', 'SelectItem value="Need Wrapped">پێویستی بە پێچانەوەیە (Need Wrapped)'],
  
  // Locations Select Alert
  ['Location Assignment</AlertDialogTitle>', 'دیاریکردنی شوێن</AlertDialogTitle>'],
  ['Manage zones for', 'بەڕێوەبردنی ناوچەکان بۆ'],
  ['Done</AlertDialogAction>', 'تەواو</AlertDialogAction>'],
  ['SelectItem value="none">None', 'SelectItem value="none">هیچ (None)'],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Page completed successfully!');
