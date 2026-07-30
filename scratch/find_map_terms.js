const fs = require('fs');
const path = require('path');

const rootDir = 'c:/Users/Diwan-ashley/OneDrive/Ashley_Archive_Cloud/OneDrive/DAro/ashley project/New-Ashley-main/New-Ashley-main/src';

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchFiles(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.json')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('warehouse') || content.includes('Warehouse') || 
                content.includes('floor') || content.includes('Floor') || 
                content.includes('zone') || content.includes('Zone') || 
                content.includes('rack') || content.includes('Rack') || 
                content.includes('bin') || content.includes('Bin') || 
                content.includes('quantity') || content.includes('Quantity') || 
                content.includes('QTY') || content.includes('qty') ||
                content.includes('hall') || content.includes('Hall') ||
                content.includes('نهۆم') || content.includes('ناوچە') ||
                content.includes('کۆگا')) {
                
                // Print matching file
                console.log(fullPath.replace(rootDir, ''));
            }
        }
    }
}

searchFiles(rootDir);
