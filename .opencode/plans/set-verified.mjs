import fs from 'fs';
const [id, status] = process.argv.slice(2);
if (!id || !status) { console.error('usage: set-verified.mjs <ID> <status>'); process.exit(2); }
const p = 'docs/monster-actions-manifest.json';
let t = fs.readFileSync(p, 'utf8');
const key = '"id": "' + id + '"';
const idx = t.indexOf(key);
if (idx < 0) { console.error('id not found'); process.exit(1); }
const start = t.indexOf('"verified": "not verified"', idx);
if (start < 0 || start - idx > 2500) { console.error('verified anchor bad'); process.exit(1); }
t = t.slice(0, start) + '"verified": "' + status + '"' + t.slice(start + '"verified": "not verified"'.length);
fs.writeFileSync(p, t);
const m = JSON.parse(t);
console.log(id + ': ' + m.monsterActionEntries.find(x => x.id === id).verified);
const ids = m.monsterActionEntries.filter(x => x.verified === 'not verified').map(x => x.id);
fs.writeFileSync('.opencode/plans/queue.txt', ids.join('\n') + '\n');
console.log('queue ' + ids.length + ' next ' + (ids[0] || '-'));
