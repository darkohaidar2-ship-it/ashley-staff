const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/**/*.{ts,tsx}');
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;
  if (c.includes('captionLayout="dropdown-nav"')) {
    c = c.replace(/captionLayout="dropdown-nav"/g, 'captionLayout="dropdown"');
  }
  if (c.includes('locationId')) {
    c = c.replace(/item\.locationId/g, 'item.locationIds?.[0]');
    c = c.replace(/result\.locationId/g, 'result.locationIds?.[0]');
  }
  if (c.includes('WAREHOUSE_COLORS.HUANA.background')) {
    c = c.replace(/WAREHOUSE_COLORS\.HUANA\.background/g, 'WAREHOUSE_COLORS.HUANA.bg');
  }
  if (c.includes('WAREHOUSE_COLORS.ASHLEY.background')) {
    c = c.replace(/WAREHOUSE_COLORS\.ASHLEY\.background/g, 'WAREHOUSE_COLORS.ASHLEY.bg');
  }
  if (c.includes('(e: Event) =>')) {
    c = c.replace(/\(e: Event\) =>/g, '(e: React.FormEvent) =>');
  }
  if (c.includes('Dispatch<SetStateAction<Date | undefined>>')) {
    // This requires a more specific fix, let's leave it for manual or specific replace
  }
  if (original !== c) {
    fs.writeFileSync(f, c);
    console.log('Fixed file ' + f);
  }
});
