import fs from 'fs';
const [id, status] = process.argv.slice(2);
if (!id || !status) { console.error('usage: mark-row.mjs <ID> <status>'); process.exit(1); }
const p = 'docs/automations-manifest.json';
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
const row = m.automationEntries.find((r) => r.id === id);
if (!row) { console.error('row not found: ' + id); process.exit(1); }
if (row.verified !== 'not verified') { console.error('unexpected current status for ' + id + ': ' + row.verified); process.exit(1); }
row.verified = status;
fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
const q = m.automationEntries.filter((r) => r.verified === 'not verified').map((r) => r.id);
fs.writeFileSync('.opencode/plans/queue.txt', q.join('\n') + '\n');
console.log('set ' + id + ' | queue: ' + q.length + ' | next: ' + (q[0] || 'none'));
