const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'new-file', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

const replacements = [
  // Sticky header
  ["{isSaving ? <Loader2 className=\"animate-spin h-4 w-4\"/> : 'Save'}", "{isSaving ? <Loader2 className=\"animate-spin h-4 w-4\"/> : 'پاشەکەوتکردن'}"],
  
  // Left inputs
  ['placeholder="Name"', 'placeholder="ناونیشانی جەرد (فایل)"'],
  ['placeholder="Category"', 'placeholder="پرۆژە / پۆلێن"'],
  ['placeholder="User"', 'placeholder="کۆگادار / بەکارهێنەر"'],
  
  // Sources configuration
  ['const sources = ["Showroom", "Ashley Store", "Huana Store"];', 'const sources = [{ value: "Showroom", label: "شۆڕوم (Showroom)" }, { value: "Ashley Store", label: "کۆگای ئاشلی (Ashley Store)" }, { value: "Huana Store", label: "کۆگای هوئانا (Huana Store)" }];'],
  ['{sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}', '{sources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}'],
  
  // Classification
  ['Classification / Folder', 'پۆلێنکردن / فۆڵدەر'],
  ['placeholder="Select classification"', 'placeholder="پۆلێنکردن هەڵبژێرە"'],
  ['<SelectItem value="Bedroom">Bedroom</SelectItem>', '<SelectItem value="Bedroom">ژووری خەوتن (Bedroom)</SelectItem>'],
  ['<SelectItem value="Dining Room">Dining Room</SelectItem>', '<SelectItem value="Dining Room">ژووری نانخواردن (Dining Room)</SelectItem>'],
  ['<SelectItem value="Living Room">Living Room</SelectItem>', '<SelectItem value="Living Room">ژووری دانیشتن (Living Room)</SelectItem>'],
  ['<SelectItem value="Kitchen">Kitchen</SelectItem>', '<SelectItem value="Kitchen">مەتبەخ (Kitchen)</SelectItem>'],
  ['<SelectItem value="Office">Office</SelectItem>', '<SelectItem value="Office">نووسینگە (Office)</SelectItem>'],
  ['<SelectItem value="Outdoor">Outdoor</SelectItem>', '<SelectItem value="Outdoor">دەرەوە (Outdoor)</SelectItem>'],
  ['<SelectItem value="Hallway">Hallway</SelectItem>', '<SelectItem value="Hallway">ڕاڕەو (Hallway)</SelectItem>'],
  ['<SelectItem value="Warehouse">Warehouse</SelectItem>', '<SelectItem value="Warehouse">کۆگا (Warehouse)</SelectItem>'],
  ['<SelectItem value="Others">Others</SelectItem>', '<SelectItem value="Others">وانی تر (Others)</SelectItem>'],
  
  // Table headers
  ['Placement Note</TableHead>', 'تێبینی شوێن (ڕەفە)</TableHead>'],
  
  // Table row inputs
  ['placeholder="Item model"', 'placeholder="مۆدێلی کاڵا"'],
  ['locationsSelected.length > 0 ? `${locationsSelected.length} Selected` : "Select"', 'locationsSelected.length > 0 ? `${locationsSelected.length} دیاریکراو` : "هەڵبژێرە"'],
  ['Select Multi-Locations', 'هەڵبژاردنی چەند شوێنێک'],
  ['Manage zones for', 'بەڕێوەبردنی ناوچەکان بۆ'],
  ['`Warehouse ${parts[1]} - Floor ${parts[2]}`', '`کۆگای ${parts[1]} - نهۆمی ${parts[2]}`'],
  ["`Floor ${parts[1]}${parts[2] === 'O' ? ' (Office)' : ` (Area ${parts[2]})`}`", "`نهۆمی ${parts[1]}${parts[2] === 'O' ? ' (نووسینگە)' : ` (ناوچەی ${parts[2]})`}`"],
  ['Complete Selection', 'تەواوکردنی هەڵبژاردن'],
  ['placeholder="e.g. Rack B"', 'placeholder="بۆ نموونە: ڕەفەی B"'],
  
  // Toast notifications
  ["'Missing Information', description: 'Please fill out all file details and add at least one item.'", "'زانیاری کەمە', description: 'تکایە هەموو خانەکان پڕبکەرەوە و لانیکەم یەک کاڵا زیادبکە.'"],
];

replacements.forEach(([target, replacement]) => {
  if (content.includes(target)) {
    content = content.split(target).join(replacement);
  } else {
    console.warn(`Target not found in new-file file: ${target}`);
  }
});

fs.writeFileSync(pagePath, content, 'utf8');
console.log('New file page translated successfully!');
