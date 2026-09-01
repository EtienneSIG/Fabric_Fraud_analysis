// Fails if the locale bundles are not key-for-key identical (translation + fraudIq namespaces).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'src', 'i18n', 'locales');

const load = (name) => JSON.parse(readFileSync(join(localesDir, name), 'utf8'));

function keys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...keys(v, path));
    else out.push(path);
  }
  return out.sort();
}

const groups = {
  translation: ['en.json', 'fr.json', 'es.json', 'zh.json'],
  fraudIq: ['en.fraudiq.json', 'fr.fraudiq.json', 'es.fraudiq.json', 'zh.fraudiq.json'],
};

let failed = false;
for (const [ns, files] of Object.entries(groups)) {
  const ref = keys(load(files[0]));
  const refSet = new Set(ref);
  for (const file of files.slice(1)) {
    const set = new Set(keys(load(file)));
    const missing = ref.filter((k) => !set.has(k));
    const extra = [...set].filter((k) => !refSet.has(k));
    if (missing.length || extra.length) {
      failed = true;
      console.error(`✗ [${ns}] ${file} vs ${files[0]}`);
      if (missing.length) console.error(`   missing: ${missing.join(', ')}`);
      if (extra.length) console.error(`   extra:   ${extra.join(', ')}`);
    }
  }
}

if (failed) {
  console.error('\ni18n key parity check FAILED.');
  process.exit(1);
}
console.log('✓ i18n key parity OK (en/fr/es · translation + fraudIq).');
