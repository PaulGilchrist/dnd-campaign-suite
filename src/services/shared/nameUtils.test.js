// @maintained-by-ai
// LANE: src/services/shared/nameUtils.js — pure name-normalization helpers (zero deps, zero mocks, no timers).
// EXPORTS + CALLERS (grep 2026-10-24):
//   stripParenthetical  -> featFinder.js:6 (findFeat fallback strip), featValidation.js:200 (normalizeBackgroundFeatName).
//   stripNumericSuffix  -> DELETED fix#364 per rec #1540 (🗑 dead-export law): production import-surface census
//     re-confirmed zero consumers (only './nameUtils.js' importers anywhere = featFinder/featValidation, both
//     stripParenthetical-only; zero further hits repo-wide incl. *.mjs/*.cjs/*.md). Its lane retired with the
//     export (header note of 2026-10-22 said 'never delete test-side unilaterally' — owner fix#364 blanket
//     instructs DELETE, so test-side retires in the same pass, never before). The rec's other half — regex
//     /\s+\d+$/ re-implemented inline at 9 sites (MonsterCardHelpers.js:2012, Map.jsx:186,199,
//     AreaEffectTargetModalBase.jsx:14, monsterUtils.js:7, npcStatBlockUtils.js:3, damageRoll.js:135,
//     contextBuilder-map.js:286, server/services/ai/monsterActions.js:37) — stays QUEUED per mock/shared-kit law
//     (cross-territory sweep, owner batch call; the inline twins are live code, NOT dead with the export gone).
// DELEGATION DISCHARGE (#1538, verbatim claim: 'Removed: "no-space paren" (nameUtils.test.js owns the regex, covered)'):
//   Owned rows live: no-space-paren arm 'Grimjaw(Orc)' + 'Damage(No Weapons)' below; strip/extract arms
//   (empty-paren, multi-paren greedy, mid-string $-anchor, nested no-match) all pinned here. Cite rows: k2/k3/k4.
// PLAYBOOK INTERSECTION (docs/test-setup-playbook.md:393 '2024 feat PUT: string-form feats only — dict form
//   breaks findFeat name.replace'): findFeat delegates the crash to THIS layer — contract pinned byte-exact in
//   'unguarded deref' tests: dict/number/array -> TypeError 'name.replace is not a function' (stripParenthetical).
// NORMALIZATION LAW MATRIX:
//   stripParenthetical: name.replace(/\s*\([^)]*\)\s*$/, '').trim() — trailing-only paren block, \s-class flanks,
//     whole result trimmed; NO guard: nullish THROWS. Case-preserving (never lowercases).
// DISK CORPUS (imported at load, drift-tripwire asserts inside): feats.json 5e (42 top-level) + 2024/feats.json
//   (71 top-level, nested choice names included) = 323 names; exactly ONE paren name on disk:
//   '1d8 Damage (No Weapons)' (2024/feats.json:3250) -> '1d8 Damage'. Zero curly-apostrophe / zero non-ASCII /
//   zero trailing-numeric feat names (census 2026-10-22) => all other corpus rows are pass-through.
// KILL MATRIX (run live via sed mutants + vitest run on THIS file only, cp backup / cmp restore, never git):
//   k1 drop $ anchor (mid-string strip)      -> killed by 'Grimjaw (Orc) the Destroyer' row
//   k2 \s*->\s+ before \( (no-space fail)   -> killed by 'Grimjaw(Orc)' row (#1538 discharge)
//   k3 [^)]*->.* greedy                      -> killed by 'Grimjaw (Orc) (Subtype)' + nested rows
//   k4 drop .trim()                          -> killed by '  Grimjaw (Orc)  ' and '\n' rows
//   k5 \)->\) mismatch                       -> killed by every paren row
// PURE: inputs/outputs strings only; no state, no clock, no console (crash tests catch before featFinder's
// console.error line — untouched here); arity Function.length === 1 sole export, no default params.
import { describe, it, expect } from 'vitest';
import { stripParenthetical } from './nameUtils.js';
import feats5e from '../../../public/data/feats.json';
import feats2024 from '../../../public/data/2024/feats.json';

// Disk corpus extraction (structural walk, no regex oracle): every `name` string in both feat rulebooks.
function allNames(node, out = []) {
  if (Array.isArray(node)) node.forEach(n => allNames(n, out));
  else if (node && typeof node === 'object') {
    if (typeof node.name === 'string') out.push(node.name);
    Object.values(node).forEach(v => allNames(v, out));
  }
  return out;
}
const diskNames = allNames(feats5e).concat(allNames(feats2024));

describe('stripParenthetical — trailing paren-block removal (featFinder/featValidation lookup key)', () => {
  it('applies the regex law: strip trailing \\s*\\([^)]*\\)\\s* then trim; everything else passes through byte-exact', () => {
    expect(stripParenthetical.length).toBe(1);
    // trailing strip, space and NO space (#1538 delegation-discharge row k2):
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Grimjaw(Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Longfellow the Brave (Halfling)')).toBe('Longfellow the Brave');
    // empty parenthetical, total strip, empty input:
    expect(stripParenthetical('Grimjaw ()')).toBe('Grimjaw');
    expect(stripParenthetical('(Orc)')).toBe('');
    expect(stripParenthetical('')).toBe('');
    // $ anchor: non-trailing parens survive (k1):
    expect(stripParenthetical('Grimjaw (Orc) the Destroyer')).toBe('Grimjaw (Orc) the Destroyer');
    // [^)]* non-greedy-class: multi-paren strips ONLY the last; nested never matches (k3):
    expect(stripParenthetical('Grimjaw (Orc) (Subtype)')).toBe('Grimjaw (Orc)');
    expect(stripParenthetical('Grimjaw (Orc (Subtype))')).toBe('Grimjaw (Orc (Subtype))');
    // \s-class flanks include tab/newline; result trimmed both ends, interior double-space preserved (k4):
    expect(stripParenthetical('Grimjaw\t(Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Grimjaw (Orc)\n')).toBe('Grimjaw');
    expect(stripParenthetical('  Grimjaw (Orc)  ')).toBe('Grimjaw');
    expect(stripParenthetical('Grimjaw  the  (x)')).toBe('Grimjaw  the');
    // case trail: never retypes case (disk 'Boon Of Energy Resistance' titlecase family, #1538 disk-row form):
    expect(stripParenthetical('Boon Of Energy Resistance')).toBe('Boon Of Energy Resistance');
    expect(stripParenthetical('Cook\'s Utensils')).toBe('Cook\'s Utensils');
  });

  it('disk feat corpus (both rulesets, imported at load): exactly one paren name, stripped byte-exact; all 322 others pass through; idempotent on every name', () => {
    const parenNames = diskNames.filter(n => /\(/.test(n));
    // Drift tripwire: if disk gains/loses paren feat names, update this census honestly (existence-census-first).
    expect(parenNames).toEqual(['1d8 Damage (No Weapons)']); // public/data/2024/feats.json:3250
    const stripped = diskNames.map(stripParenthetical);
    expect(stripped).toEqual(
      diskNames.map(n => (n === '1d8 Damage (No Weapons)' ? '1d8 Damage' : n)),
    );
    // idempotence law (#1535-form): f(f(x)) === f(x) across the whole real corpus:
    expect(stripped.map(stripParenthetical)).toEqual(stripped);
  });

  it('unguarded deref: every non-string throws TypeError, nullish NOT absorbed; dict-form crash precedent docs/test-setup-playbook.md:393', () => {
    expect(() => stripParenthetical(null)).toThrow(TypeError);
    expect(() => stripParenthetical(undefined)).toThrow(TypeError);
    // dict form (the PUT-pitfall shape that crashes findFeat, featFinder.test.js:98 cites this lane):
    expect(() => stripParenthetical({ name: 'Alert' })).toThrow('name.replace is not a function');
    expect(() => stripParenthetical(0)).toThrow('name.replace is not a function');
    expect(() => stripParenthetical(['Alert'])).toThrow('name.replace is not a function');
  });
});
