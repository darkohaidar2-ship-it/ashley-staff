const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const srcDir = path.join(__dirname, '..', 'src');

walkDir(srcDir, filePath => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find JSX text or string literals that look like English words but aren't translations
  // Simple heuristic: look for hardcoded strings in quotes "..." or '...' or tags >...<
  // that have English letters and space, and are not import/require/console/className/tailwind classes.
  // We can just log strings in JSX expressions like >Text Here<
  
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Match JSX text containing English words: e.g. >English Text<
    const jsxTextMatch = line.match(/>\s*([a-zA-Z]{3,}(?:\s+[a-zA-Z]{2,})*)\s*</);
    if (jsxTextMatch) {
      console.log(`${path.relative(srcDir, filePath)}:${index + 1}: ${jsxTextMatch[1]}`);
    }
  });
});
