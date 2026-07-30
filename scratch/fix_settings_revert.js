const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '..', 'src', 'app', 'settings', 'page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Fix variable and type names that were incorrectly translated
content = content.split('  چالاکی,\n').join('  Activity,\n');
content = content.split('چالاکیLog').join('ActivityLog');
content = content.split('isئەدمین').join('isAdmin');
content = content.split('ئەدمینPowerSuite').join('AdminPowerSuite');
content = content.split('setڕۆڵەکان').join('setRoles');

// Also, the tab trigger value for activity might have been affected:
// Let's check '<TabsTrigger value="activity"' and '<TabsContent value="activity"'
// If it was renamed, it should be kept as "activity" for routing/tab reasons.
// My translation script replaced "Activity" -> "چالاکی", so the tab trigger label became:
// '<TabsTrigger value="users" ...> ... <TabsTrigger value="roles" ...> ... <TabsTrigger value="activity" ...><Activity ... /> چالاکی</TabsTrigger>'
// That is fine, but if the value was renamed, let's make sure it's "activity".
content = content.split('value="چالاکی"').join('value="activity"');

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Settings page corrected!');
