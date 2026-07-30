const fs = require('fs');
let c = fs.readFileSync('src/app/settings/page.tsx', 'utf8');

// Undo the blind replacement
c = c.replace(/import \{ Building2, /g, 'import { ');

// Manually add Building2 to the lucide-react import block if it's missing
if (!c.includes('Building2') && c.includes('lucide-react')) {
   c = c.replace(/import\s*\{\s*/, 'import { Building2, ');
}

fs.writeFileSync('src/app/settings/page.tsx', c);
console.log('Fixed imports in settings/page.tsx');
