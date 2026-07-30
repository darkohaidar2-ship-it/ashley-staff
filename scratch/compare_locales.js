const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'locales');
const enPath = path.join(localesDir, 'en.json');
const kuPath = path.join(localesDir, 'ku.json');

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ku = JSON.parse(fs.readFileSync(kuPath, 'utf8'));

const missingKeys = [];
const englishValuesInKu = [];

for (const key in en) {
  if (!(key in ku)) {
    missingKeys.push(key);
  } else if (ku[key] === en[key] && /^[a-zA-Z\s,.:;'"?!()-]+$/.test(ku[key])) {
    // Value is English and matches exactly, might be untranslated
    // Note: Some values might be proper nouns, but good to check
    englishValuesInKu.push({ key, val: ku[key] });
  }
}

console.log('--- Missing Keys in ku.json ---');
console.log(JSON.stringify(missingKeys, null, 2));

console.log('\n--- Possibly Untranslated Keys (Same as English) ---');
console.log(JSON.stringify(englishValuesInKu, null, 2));
