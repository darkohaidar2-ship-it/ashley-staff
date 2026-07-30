const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/**/*.{ts,tsx}');
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let original = c;
  if (c.includes('locationIds?.[0]s')) {
    c = c.replace(/locationIds\?\.\[0\]s/g, 'locationIds');
  }
  if (original !== c) {
    fs.writeFileSync(f, c);
    console.log('Fixed file ' + f);
  }
});
