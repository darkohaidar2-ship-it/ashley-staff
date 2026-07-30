const fs = require('fs');

function replaceFile(path, search, replacement) {
    if (!fs.existsSync(path)) return;
    let content = fs.readFileSync(path, 'utf8');
    if (content.includes(search)) {
        content = content.replace(new RegExp(search, 'g'), replacement);
        fs.writeFileSync(path, content);
        console.log('Fixed ' + path);
    }
}

// Fix StagedItemsPrintView & TransmitReportPdf background -> bg
replaceFile('src/components/transmit/StagedItemsPrintView.tsx', 'WAREHOUSE_COLORS.HUANA.background', 'WAREHOUSE_COLORS.HUANA.bg');
replaceFile('src/components/transmit/StagedItemsPrintView.tsx', 'WAREHOUSE_COLORS.ASHLEY.background', 'WAREHOUSE_COLORS.ASHLEY.bg');
replaceFile('src/components/transmit/TransmitReportPdf.tsx', 'WAREHOUSE_COLORS.HUANA.background', 'WAREHOUSE_COLORS.HUANA.bg');
replaceFile('src/components/transmit/TransmitReportPdf.tsx', 'WAREHOUSE_COLORS.ASHLEY.background', 'WAREHOUSE_COLORS.ASHLEY.bg');

// Fix TopNavbar profileImage
replaceFile('src/components/layout/TopNavbar.tsx', 'user?.profileImage', 'null /* user?.profileImage */');

// Fix Backup Reminder isAnonymous
replaceFile('src/components/shared/backup-reminder.tsx', 'user.isAnonymous', 'false');

// Fix transmit error
replaceFile('src/app/public-transmit/page.tsx', 'item.locationIds', 'item.storage');

// Fix missing Building2 import
replaceFile('src/app/settings/page.tsx', 'import {', 'import { Building2,');

console.log('Done additional fixes');
