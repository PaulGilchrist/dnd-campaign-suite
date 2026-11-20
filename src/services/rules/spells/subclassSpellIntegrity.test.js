// @maintained-by-ai
/**
 * Durable rules-data pin for subclass spell references (2026-11-19).
 *
 * public/data/classes.json subclass rows feed the always-prepared lane
 * (spellCalc.js addSubclassAlwaysPreparedSpells) and the wizard preselect
 * lane (getPreSelectedSpells.js getSubclassSpells), BOTH of which resolve a
 * reference by its spell NAME with an exact === match against the ruleset's
 * own spell pool (loadSpells('5e') → /data/spells.json, loadSpells('2024') →
 * /data/2024/spells.json — the lanes never cross pools). spell.index is only
 * a secondary identity: spellCalc gates the grant on the PREREQUISITE index
 * ('<class>-<level>'.split('-')[1]), so a name that misses the pool silently
 * offers nothing selectable on the sheet and in the wizard spell step.
 *
 * Every dangling ref found by the 2026-11-19 census was fixed canonically
 * (typos → intended spell, casing → pool-canonical name, Barskin → Barkskin
 * per the PHB Nature-domain 3rd-level pair Barkskin+Spike Growth — it is a
 * lost-K typo of the spell, not the Dwarf racial trait the backlog guessed);
 * the 2024 twin's Stoneskin ref was re-pointed at the pool's canonical
 * 'Stone Skin' row. This suite locks the invariant so a future data edit can
 * never re-introduce an unresolvable subclass spell ref:
 *
 *  1. EVERY subclass spell reference shape the data actually uses resolves to
 *     EXACTLY ONE row of its own ruleset's pool by name:
 *       5e   — subclasses[].spells[] = {spell:{index,name}, prerequisites}
 *              + feature automation `spell: "<Name>"` bare strings
 *       2024 — majors[].spells[] = {name, level[, landType]} (+ bare strings)
 *              + automation `spell` strings and `spells`/`psionic_spells`
 *                bare-name arrays
 *  2. where a 5e ref carries spell.index it must equal the resolved pool
 *     row's index (kills the name/index mismatch family at the data tier).
 *
 * Disk-read style mirrors spells5eSrdAudit.test.js (readFileSync +
 * drift-throw), so future authored-data edits trip here loudly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const readDisk = (rel) => JSON.parse(readFileSync(resolve(process.cwd(), rel), 'utf8'));
const classes5e = readDisk('public/data/classes.json');
const spells5e = readDisk('public/data/spells.json');
const classes2024 = readDisk('public/data/2024/classes.json');
const spells2024 = readDisk('public/data/2024/spells.json');

function nameIndex(pool) {
  const byName = new Map();
  for (const spell of pool) {
    if (!byName.has(spell.name)) byName.set(spell.name, []);
    byName.get(spell.name).push(spell);
  }
  return byName;
}

const byName5e = nameIndex(spells5e);
const byName24 = nameIndex(spells2024);

// Walks a feature/automation subtree for bare-name spell refs (key `spell`
// strings plus `spells`/`psionic_spells` name arrays). `spellList` keys are
// POOL-KEY pointers ('wizard_spells'), not spell names — deliberately out.
function collectBareRefs(node, push) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectBareRefs(child, push));
    return;
  }
  if (!node || typeof node !== 'object') return;
  Object.entries(node).forEach(([key, value]) => {
    if (key === 'spell' && typeof value === 'string') push(value);
    if ((key === 'spells' || key === 'psionic_spells') && Array.isArray(value)) {
      value.filter((entry) => typeof entry === 'string').forEach((entry) => push(entry));
    }
    collectBareRefs(value, push);
  });
}

// One flat list of every 5e subclass spell ref the data carries.
function refs5e() {
  const refs = [];
  classes5e.forEach((classRow) => {
    (classRow.subclasses || []).forEach((subclass) => {
      const where = `${classRow.name}/${subclass.name}`;
      (subclass.spells || []).forEach((entry) => {
        const prereq = (entry.prerequisites || [])[0] || {};
        refs.push({
          where: `${where} ${prereq.index || 'no-prereq'}`,
          name: entry.spell?.name,
          index: entry.spell?.index ?? null,
        });
      });
      const bare = [];
      collectBareRefs(subclass, (name) => bare.push(name));
      bare.forEach((name) => refs.push({ where: `${where} automation`, name, index: null }));
    });
  });
  return refs;
}

function refs2024() {
  const refs = [];
  classes2024.forEach((classRow) => {
    (classRow.majors || []).forEach((major) => {
      const where = `${classRow.name}/${major.name}`;
      (major.spells || []).forEach((entry) => {
        const name = typeof entry === 'string' ? entry : (entry.name || entry.spell?.name);
        refs.push({ where: `${where} lv${entry.level ?? '?'}`, name, index: null });
      });
      const bare = [];
      collectBareRefs(major, (name) => bare.push(name));
      bare.forEach((name) => refs.push({ where: `${where} automation`, name, index: null }));
    });
  });
  return refs;
}

function unresolved(refs, byName) {
  return refs
    .map((ref) => {
      const rows = ref.name == null ? undefined : byName.get(ref.name);
      if (!rows) return `${ref.where} -> ${JSON.stringify(ref.name)} (no pool row)`;
      if (rows.length > 1) return `${ref.where} -> ${ref.name} (${rows.length} pool rows — ambiguous)`;
      if (ref.index != null && rows[0].index !== ref.index) {
        return `${ref.where} -> ${ref.name} index '${ref.index}' ≠ pool index '${rows[0].index}'`;
      }
      return null;
    })
    .filter(Boolean);
}

describe('subclass spell references resolve against their own ruleset spell pool', () => {
  const refs5eList = refs5e();
  const refs24List = refs2024();

  it('the walkers cover every reference shape the data carries (anti-hollow guard)', () => {
    // Census baseline 2026-11-19: 188 {spell:{index,name}} refs + bare
    // automation strings on the 5e side; 278 {name,level} refs + bare
    // automation strings/arrays on the 2024 side. Minimums keep a refactor
    // that silently stops walking a shape honest.
    expect(refs5eList.length).toBeGreaterThanOrEqual(189);
    expect(refs24List.length).toBeGreaterThanOrEqual(281);
    expect(refs5eList.some((r) => r.where.endsWith('automation'))).toBe(true);
    expect(refs24List.some((r) => r.where.endsWith('automation'))).toBe(true);
  });

  it('5e: every subclass spell ref resolves to exactly one public/data/spells.json row by name (and index where carried)', () => {
    expect(unresolved(refs5eList, byName5e)).toStrictEqual([]);
  });

  it('2024: every major spell ref resolves to exactly one public/data/2024/spells.json row by name', () => {
    expect(unresolved(refs24List, byName24)).toStrictEqual([]);
  });

  it('the 2026-11-19 census fixes stay fixed (canonical spellings pinned)', () => {
    // Per-ruleset dead spellings: 'Stoneskin' is legitimate 5e (pool row +
    // War/Land refs) but dangled on the 2024 side (pool row is 'Stone Skin');
    // 'Protection from Energy' is legitimate 2024 but was the wrong casing in
    // 5e subclass refs (pool row 'Protection From Energy').
    const names5e = refs5eList.map((r) => r.name);
    const names24 = refs24List.map((r) => r.name);
    ['Barskin', 'Disquise Self', 'Dissonant Wispers', 'Charm person', 'Protection from Energy', 'Commune with Nature']
      .forEach((dead) => {
        expect(names5e, `retired 5e dangling ref '${dead}' must never return`).not.toContain(dead);
      });
    expect(names24, "retired 2024 dangling ref 'Stoneskin' must never return").not.toContain('Stoneskin');
    const goo = classes5e.find((c) => c.name === 'Warlock').subclasses.find((s) => s.index === 'the-great-old-one');
    expect(goo.spells.map((e) => e.spell.name)).toEqual(
      expect.arrayContaining(['Dissonant Whispers', "Tasha's Hideous Laughter", 'Phantasmal Force'])
    );
  });
});
