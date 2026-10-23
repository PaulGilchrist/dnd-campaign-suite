// @maintained-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cloneDeep } from 'lodash';
import { findFeat } from './featFinder.js';
import feats5e from '../../../public/data/feats.json';
import feats2024 from '../../../public/data/2024/feats.json';

// featFinder lane: pure name-MATCH lookup (featFinder.js:4/8 use === on .name —
// NO class_levels/features array-index scan, so the #1509 index-bug family does not
// apply here; this is the name-match case-law lane). Store-free, clock-free, pure:
// reads only its two arguments; every fixture below is REAL disk rows imported from
// public/data/feats.json (5e, 42 rows) and public/data/2024/feats.json (71 rows),
// extracted programmatically, never retyped. Synthetic strings are X-labeled: the
// disk census (test 1) proves BOTH tables contain ZERO parenthetical-name rows, so
// any parenthetical query/variant row is necessarily synthetic input shape — it
// exercises findFeat's exact-then-stripped branch order over REAL target rows.
// Mock census: 0 vi.mock; console.error spy only where misses are intentional
// (found-lanes assert the spy stayed silent — the documented 'Boon Of Fortitude
// sheet-mount' noise class, MA-1891/1893 registry citations, is a MISS-side log;
// hit-side silence is the epic-boon regression kept from the prior suite).

const FIRST5_5E = feats5e.slice(0, 5).map(f => f.name);

afterEach(() => vi.restoreAllMocks());

describe('findFeat — exact-then-stripped name lookup over caller table (pure, disk rows)', () => {
  it('DISK LAW both rulesets: every real row resolves to identity with zero logs; census 0 parenthetical rows', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Census first (#1509-streak existence-census): quantify disk shapes.
    expect(feats5e.length).toBe(42);
    expect(feats2024.length).toBe(71);
    expect(feats5e.filter(f => /\(/.test(f.name)).length).toBe(0);
    expect(feats2024.filter(f => /\(/.test(f.name)).length).toBe(0);
    // Full-table round trip: every disk name resolves to its SAME row object.
    for (const f of feats5e) expect(findFeat(f.name, feats5e)).toBe(f);
    for (const f of feats2024) expect(findFeat(f.name, feats2024)).toBe(f);
    // Epic-boon regression (prior suite): real 2024 row hits silently.
    const boon = feats2024.find(f => f.name === 'Boon Of Fortitude');
    expect(findFeat('Boon Of Fortitude', feats2024)).toBe(boon);
    expect(spy).not.toHaveBeenCalled();
  });

  it('purity: arity 2, same-reference (no clone), disk table byte-unchanged after misses', () => {
    expect(findFeat.length).toBe(2);
    const gwm = feats5e.find(f => f.name === 'Great Weapon Master');
    expect(findFeat('Great Weapon Master', feats5e)).toBe(gwm);
    expect(findFeat('Great Weapon Master', feats5e)).toBe(gwm); // fresh call, same identity
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(findFeat('Nowhere To Be Found', feats5e)).toBeNull(); // miss arm; immutability probe below
    expect(spy).toHaveBeenCalledTimes(1);
    const diskFresh = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/feats.json'), 'utf8'));
    expect(feats5e).toStrictEqual(cloneDeep(diskFresh));
  });

  it('branch precedence: exact hit beats stripped hit (X: variant row synthetic — census proves 0 disk rows carry parentheses)', () => {
    const alert = feats5e.find(f => f.name === 'Alert');
    const Xvariant = { name: 'Alert (Variant)', description: 'STRUCT* synthetic precedence probe — no disk feats row contains parentheses (census test 1)' };
    const table = [...feats5e, Xvariant];
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(findFeat('Alert (Variant)', table)).toBe(Xvariant); // line 4 exact wins over line 8 stripped
    expect(findFeat('Alert (Variant)', table)).not.toBe(alert);
    expect(spy).not.toHaveBeenCalled();
  });

  it('stripped fallback finds REAL row when exact misses (X: query shape synthetic); fallback hit is log-silent', () => {
    const alert = feats5e.find(f => f.name === 'Alert');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(findFeat('Alert (Human)', feats5e)).toBe(alert); // X query → REAL Alert row by identity
    expect(spy).not.toHaveBeenCalled(); // fallback HIT never logs
  });

  it('miss taxonomy: BOTH miss paths identical shape — null + one console.error each (#1538 unified); case-fold never fires, exact log tuples, sample cap 5, empty-table sample []', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(findFeat('alert', feats5e)).toBeNull();            // exact === only — lowercase NEVER fires (#1533 contrast)
    expect(findFeat('Alertness', feats5e)).toBeNull();        // prefix near-miss of REAL 'Alert' (#1521 class)
    expect(findFeat('Mounted Combatant (2024)', feats5e)).toBeNull(); // X query; stripped 'Mounted Combatant' absent from 5e (near-miss 'Mounted Combat' NOT prefix-matched) → #1538 FIX: featFinder.js:7-12 paren-miss now FALLS THROUGH to the canonical :13/:14 exit — null + NOT FOUND log, never silent undefined
    expect(findFeat('Ritual Caster', feats2024)).toBeNull();  // ruleset drift: 5e-only feat misses 2024 table (#1533 family, disk-proven names)
    expect(findFeat('Alert', [])).toBeNull();                 // empty table: slice(0,5) on truthy [] → sample [] quantifies the vacuous ?. at :13
    expect(spy).toHaveBeenCalledTimes(5); // #1538: paren-miss arm now LOGS — one per miss, no silent arm
    expect(spy.mock.calls.map(c => c.slice(0, 2))).toEqual([
      ['[findFeat] NOT FOUND:', 'alert'],
      ['[findFeat] NOT FOUND:', 'Alertness'],
      ['[findFeat] NOT FOUND:', 'Mounted Combatant (2024)'],
      ['[findFeat] NOT FOUND:', 'Ritual Caster'],
      ['[findFeat] NOT FOUND:', 'Alert'],
    ]);
    const lastTuple = spy.mock.calls[4];
    expect(lastTuple[3]).toEqual([]); // empty table → sample [] (vacuous ?. at :13 quantified: slice runs on truthy [])
    expect(spy.mock.calls[0][3]).toEqual(FIRST5_5E); // cap: 42-row table samples exactly first 5 REAL names
  });

  it('both-miss-paths-identical-shape pin (#1348): paren-miss and direct-miss return the SAME null and log the SAME message shape', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Xquery = 'Mounted Combatant (2024)'; // X query; stripped name absent from 5e disk table (census test 1: 0 paren rows, so this arm is synthetic-input shape)
    const parenMiss = findFeat(Xquery, feats5e);   // pre-fix (#1538): undefined + ZERO logs
    const directMiss = findFeat('Alertness', feats5e); // canonical sibling miss: null + log
    expect(parenMiss).toBeNull();
    expect(directMiss).toBeNull();
    expect(parenMiss).toBe(directMiss); // same value identity — one miss vocabulary, no two-valued falsy split
    expect(spy).toHaveBeenCalledTimes(2); // BOTH arms log — the silent paren-arm is retired
    const [parenCall, directCall] = spy.mock.calls;
    expect(parenCall[0]).toBe(directCall[0]); // identical prefix '[findFeat] NOT FOUND:'
    expect(parenCall[2]).toBe(directCall[2]); // identical 'allFeats sample:' marker
    expect(parenCall[3]).toEqual(directCall[3]); // identical first-5 sample against the same table
    expect(parenCall[1]).toBe(Xquery); // honest context: the raw paren-query is what gets logged verbatim
    expect(directCall[1]).toBe('Alertness');
  });

  it('golden unguarded derefs throw TypeError with console untouched (allFeats missing; dict featName — documented PUT pitfall)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => findFeat('Alert', undefined)).toThrow(TypeError);
    expect(() => findFeat('Alert', undefined)).toThrow("Cannot read properties of undefined (reading 'find')"); // featFinder.js:4 — golden, do NOT guard
    expect(() => findFeat('Alert', null)).toThrow("Cannot read properties of null (reading 'find')");
    expect(() => findFeat({ name: 'Alert' }, feats5e)).toThrow("name.replace is not a function"); // dict-form featName escapes exact-miss, crashes in stripParenthetical (docs/test-setup-playbook.md 'dict form breaks findFeat name.replace')
    expect(spy).not.toHaveBeenCalled(); // crash precedes the NOT FOUND log at :13
  });
});
