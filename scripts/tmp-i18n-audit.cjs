const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return /\.(ts|tsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
}

const files = walk(path.join(process.cwd(), 'app'));
const ar = fs.readFileSync(path.join(process.cwd(), 'locales', 'ar.js'), 'utf8');
const keys = new Set([...ar.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((match) => match[1]));
for (const match of ar.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
  keys.add(match[1]);
}

const missing = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/i18n\.t\('([^']+)'/g)) {
    const key = match[1];
    const topLevelKey = key.split('.')[0];
    if (!keys.has(topLevelKey) && !key.startsWith('cities.')) {
      missing.set(key, (missing.get(key) || 0) + 1);
    }
  }
}

for (const [key, count] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`${key}\t${count}`);
}
