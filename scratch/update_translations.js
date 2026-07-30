const fs = require('fs');
const path = require('path');

const projectRoot = 'c:/Users/Diwan-ashley/OneDrive/Ashley_Archive_Cloud/OneDrive/DAro/ashley project/New-Ashley-main/New-Ashley-main';

const filesToUpdate = [
    path.join(projectRoot, 'src/locales/ku.json'),
    path.join(projectRoot, 'src/app/locales/ku.json')
];

const enFilesToUpdate = [
    path.join(projectRoot, 'src/locales/en.json'),
    path.join(projectRoot, 'src/app/locales/en.json')
];

const kuUpdates = {
    "dashboard": "داشبۆرد",
    "locations": "خانەکان",
    "warehouse_map": "نەخشەی کۆگا",
    "import": "هاوردەکردن",
    "qty": "عدد",
    "zone": "زۆن",
    "rack": "خانە",
    "bin": "خانە",
    "select_floor": "قات هەڵبژێرە...",
    "all_floors": "هەموو قاتەکان",
    "floor": "قات",
    "select_ashley_floor": "قات هەڵبژێرە...",
    "select_area": "زۆن هەڵبژێرە...",
    "all_areas_on_floor_3": "هەموو زۆنەکانی قاتی ٣",
    "area": "زۆن",
    "quantity": "عدد",
    "qty_per_condition": "عدد / دۆخ.",
    "location": "خانە",
    "ashley_warehouse_map": "کۆگایی ئاشڵی",
    "floor_4": "قاتی ٤",
    "floor_3": "قاتی ٣",
    "area_1": "زۆنی ١",
    "area_2_office": "زۆنی ٢ (نووسینگە)",
    "no_ashley_locations_found": "هیچ خانەیەکی ئاشڵی نەدۆزرایەوە",
    "no_ashley_locations_found_desc": "بڕۆ بۆ 'بەڕێوەبردنی خانەکان' بۆ دروستکردنی کۆدی کۆگاکان.",
    "manage_locations": "بەڕێوەبردنی خانەکان",
    "items_in_location": "کاڵاکان لە خانەی: {locationName}",
    "quantity_short": "عدد",
    "no_items_in_this_location": "هیچ کاڵایەک لەم خانەیەدا نەدۆزرایەوە.",
    "huana_warehouse_map": "کۆگایی هوانە",
    "no_huana_locations_found": "هیچ خانەیەکی هوانە نەدۆزرایەوە",
    "no_huana_locations_found_desc": "بڕۆ بۆ 'بەڕێوەبردنی خانەکان' بۆ دروستکردنی کۆدی کۆگاکان.",
    "source_location": "سەرچاوە / خانە",
    "ashley_map": "کۆگایی ئاشڵی",
    "huana_map": "کۆگایی هوانە",
    "add_location": "زیادکردنی خانە",
    "confirm_delete_all_locations": "ئەمە هەموو {count} خانەکانی کۆگاکردن بە شێوەیەکی هەمیشەیی دەسڕێتەوە. ئەم کردارە ناتوانرێت هەڵبوەشێنرێتەوە.",
    "add_new_location": "زیادکردنی کۆدی خانەی کۆگاکردنی نوێ",
    "incomplete_code_desc": "تکایە هەموو خانەکان پڕبکەرەوە بۆ دروستکردنی کۆدی خانەی دروست.",
    "duplicate_code_desc": "ئەم کۆدی خانەیە پێشتر بوونی هەیە.",
    "location_added": "خانە زیادکرا",
    "location_added_desc": "{code} بۆ خانەکانی کۆگاکردنت زیادکرا.",
    "select_ashley_area": "زۆن هەڵبژێرە...",
    "search_item_by_model_desc": "خانەی کاڵاکان لە هەموو فایلەکانی ئێکسڵدا بدۆزەرەوە.",
    "filters_desc": "کۆگا و زۆنێک هەڵبژێرە بۆ کەمکردنەوەی لیستی خانەکان.",
    "no_locations_match_filters": "هیچ خانەیەک لەگەڵ فلتەرەکاندا ناگونجێت",
    "no_locations_match_filters_desc": "هەوڵ بدە فلتەرەکان ڕێکبخەیتەوە یان بیسڕیتەوە بۆ بینینی خانەی زیاتر.",
    "no_locations_found": "هیچ خانەیەک نەدۆزرایەوە",
    "no_locations_found_desc": "دەست پێ بکە بە زیادکردنی یەکەم خانەی کۆگاکردنت یان هەموویان دروست بکە.",
    "select_huana_warehouse": "کۆگایی هوانە هەڵبژێرە...",
    "all_huana_warehouses": "هەموو کۆگاکانی هوانە"
};

const enUpdates = {
    "dashboard": "Dashboard",
    "locations": "Locations",
    "warehouse_map": "Warehouse Map",
    "import": "Import",
    "qty": "QTY",
    "zone": "Zone",
    "rack": "Rack",
    "bin": "Bin"
};

// Update Kurdish translations
for (const filepath of filesToUpdate) {
    if (fs.existsSync(filepath)) {
        console.log(`Updating ${filepath}`);
        const currentData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const updatedData = { ...currentData, ...kuUpdates };
        fs.writeFileSync(filepath, JSON.stringify(updatedData, null, 2), 'utf8');
    } else {
        console.log(`File not found: ${filepath}`);
    }
}

// Update English translations
for (const filepath of enFilesToUpdate) {
    if (fs.existsSync(filepath)) {
        console.log(`Updating ${filepath}`);
        const currentData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        const updatedData = { ...currentData, ...enUpdates };
        fs.writeFileSync(filepath, JSON.stringify(updatedData, null, 2), 'utf8');
    } else {
        console.log(`File not found: ${filepath}`);
    }
}

console.log("Translations update complete.");
