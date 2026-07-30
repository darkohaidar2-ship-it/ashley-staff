const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules')) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Target inline React expressions with _desc
    content = content.replace(/<CardDescription[^>]*>\s*\{t\('[^']*_desc'(?:,\s*\{[^}]*\})?\)\}\s*<\/CardDescription>/g, '');
    content = content.replace(/<DialogDescription[^>]*>\s*\{t\('[^']*_desc'(?:,\s*\{[^}]*\})?\)\}\s*<\/DialogDescription>/g, '');
    content = content.replace(/<p[^>]*text-muted-foreground[^>]*>\s*\{t\('[^']*_desc'(?:,\s*\{[^}]*\})?\)\}\s*<\/p>/g, '');
    
    // Some descriptions don't have t()
    // but the prompt said "all extra text ... that auto entred for descrpted"
    // Let's also remove straight up descriptions containing _desc if embedded.
    
    // Also remove generic inline {t('xyz_desc')} if lonely
    content = content.replace(/\{t\('[^']*_desc'\)\}/g, '""');

    // Remove descriptions without `_desc` that are just hardcoded? The prompt said "auto entred for descrpted". This means descriptions.
    // They literally just want a clean UI. Let's delete all CardDescription regardless if we can. But wait, `items_in_list_count` is inside CardDescription!
    
    if (original !== content) {
        fs.writeFileSync(file, content);
        count++;
        console.log("Cleaned:", file);
    }
});
console.log('Cleaned files:', count);
