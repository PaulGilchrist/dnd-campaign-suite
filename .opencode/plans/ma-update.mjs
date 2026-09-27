// Orchestrator helper: regenerate queue.txt from manifest + print tally.
// Does NOT write the manifest (verified edits are done via byte-safe text edits).
// Usage: node .opencode/plans/ma-update.mjs
import fs from 'fs';

const obj = JSON.parse(fs.readFileSync('docs/monster-actions-manifest.json', 'utf8'));
const nv = obj.monsterActionEntries.filter(r => r.verified === 'not verified').map(r => r.id);
fs.writeFileSync('.opencode/plans/queue.txt', nv.join('\n') + '\n');

const c = {};
for (const r of obj.monsterActionEntries) {
  let v = r.verified;
  if (v.startsWith('broken')) v = 'broken';
  else if (v.startsWith('incomplete')) v = 'incomplete';
  c[v] = (c[v] || 0) + 1;
}
console.log('tally:', JSON.stringify(c), '| queue:', nv.length, '| next:', nv[0] || '(empty)');
