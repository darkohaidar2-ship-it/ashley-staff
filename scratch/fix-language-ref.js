import fs from 'fs';
import path from 'path';

const files = [
    "src/app/bonuses/monthly-report/page.tsx",
    "src/app/map-designer/page.tsx",
    "src/app/marketing-feedback/page.tsx",
    "src/app/monthly-report/page.tsx",
    "src/app/login/page.tsx",
    "src/app/overtime/monthly-report/page.tsx",
    "src/app/public-transmit/page.tsx",
    "src/app/items/page.tsx",
    "src/app/public-inventory/page.tsx",
    "src/app/overtime/add/page.tsx",
    "src/app/client-layout.tsx",
    "src/app/expenses/monthly-report/page.tsx",
    "src/app/expenses/add/page.tsx",
    "src/app/employees/page.tsx",
    "src/app/cash-withdrawal/monthly-report/page.tsx",
    "src/components/shared/app-header.tsx",
    "src/app/bonuses/add/page.tsx",
    "src/app/expenses/archive/[id]/page.tsx",
    "src/app/employees/[id]/page.tsx",
    "src/app/cash-withdrawal/add/page.tsx"
];

files.forEach(file => {
    const fullPath = path.resolve(file);
    if (!fs.existsSync(fullPath)) return;

    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if 'language' is used but not destructured from useTranslation()
    const usesLanguage = content.includes('language ===') || content.includes('language ===') || content.includes('language)');
    const destructuresLanguage = /const\s+\{[^}]*language[^}]*\}\s+=\s+useTranslation\(/.test(content);
    
    if (usesLanguage && !destructuresLanguage) {
        console.log(`Fixing ${file}...`);
        content = content.replace(/const\s+\{\s*t\s*\}\s+=\s+useTranslation\(\)/g, 'const { t, language } = useTranslation()');
        content = content.replace(/const\s+\{\s*t\s*\}\s+=\s+useTranslation\(/g, 'const { t, language } = useTranslation(');
        fs.writeFileSync(fullPath, content);
    }
});
