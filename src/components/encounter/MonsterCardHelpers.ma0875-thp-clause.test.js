// @maintained-by-ai
// MA-0875 owner lane: parseTempHpGrantClause truth table (#452/#523 THP-clause
// lane canon). Source: MonsterCardHelpers.js:339-345 — 4 distinct arms: falsy /
// non-string guard, "one of the following effects occurs" chooser guard,
// "(x only)" parenthetical guard, capture regex "gains N temporary hit points".
// { tempHp } rides the save context / picker prop to the failed-save grant seams —
// CONSUMERS CITED, NOT ECHOED: saveProcessing.grantFailedSaveTempHp + picker
// resolveSaveFailGrant owned by saveProcessing.ma0875-thp-grant.test.js (which
// re-parses the live row itself, :74/:84); threading at MonsterCardModal.jsx:489
// /:1883 owned by the Modal save-variant-shape lane (#452). No clocks — THP is
// consumed by damage via tempHpService replace-if-larger (MA-0275 Fortify twins).
// Cross-pinned exclusion for #498 (its header:7 cites this lane): the MA-0275
// Animal Lord variant row stays inert here — applyAnimalSpiritVariantGrant owns
// its Fortify THP on BOTH outcomes; arming here would double-grant, fail-only.
// Fiction rows (#396/#498 justified): disk census (below) pins Hunger of
// Yeenoghu as the ONLY arming row (N=10), and the sole THP+guard row (Animal
// Lord) trips BOTH guards at once — so distinct capture values, lowercase prose,
// non-string input (0 non-string save_effects on disk), and per-guard isolation
// legs are unreachable from disk; fictional strings pin them.
import { describe, it, expect } from 'vitest';
import { parseTempHpGrantClause, parseAnimalSpiritVariants } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const mons = monstersData.monsters || monstersData;
const gnollRow = () => mons.find(m => m.name === 'Gnoll Demoniac').actions.find(a => a.name === 'Hunger of Yeenoghu');
const animalLordRow = () => mons.find(m => m.name === 'Animal Lord').actions.find(a => a.name === 'Animal Spirit');

describe('MA-0875 parseTempHpGrantClause (Hunger of Yeenoghu THP clause)', () => {
  it('arms the clause: disk Gnoll row exact + fictional distinct-value/case capture', () => {
    const row = gnollRow();
    expect(row.save_effect).toMatch(/gains 10 temporary hit points/i);
    expect(parseTempHpGrantClause(row.save_effect)).toEqual({ tempHp: 10 });
    // fiction: census proves N=10 is the only on-disk capture — a distinct all-caps
    // value pins the number is parsed from the clause (not hardcoded) + /i flag.
    expect(parseTempHpGrantClause('the gnoll gains 7 TEMPORARY HIT POINTS')).toEqual({ tempHp: 7 });
  });

  it('byte-inert null: falsy, non-string, and clauseless prose (one leg per branch)', () => {
    expect(parseTempHpGrantClause(undefined)).toBeNull();
    expect(parseTempHpGrantClause('')).toBeNull();
    // fiction: 0 non-string save_effects on disk — pins the typeof guard past falsy.
    expect(parseTempHpGrantClause(42)).toBeNull();
    expect(parseTempHpGrantClause('The target takes 8d6 Necrotic damage. Success: Half damage only.')).toBeNull();
  });

  it('MA-0275 Animal Lord variant row stays inert — the chooser owns its Fortify THP (both outcomes)', () => {
    const row = animalLordRow();
    expect(parseAnimalSpiritVariants(row)).toBeTruthy();
    // this disk row trips BOTH guards at once (oneOf header + "(Forager Only)");
    // per-guard isolation is pinned by the fictional legs below.
    expect(row.save_effect).toMatch(/one of the following effects occurs/i);
    expect(parseTempHpGrantClause(row.save_effect)).toBeNull();
  });

  it('fictional guard isolation: each exclusion fires without the other (#498 double-grant wall)', () => {
    // oneOf guard alone (no "(x only)" parenthetical):
    expect(parseTempHpGrantClause('One of the following effects occurs: the target gains 5 Temporary Hit Points.')).toBeNull();
    // parenthetical guard alone (no oneOf header):
    expect(parseTempHpGrantClause('The animal lord gains 20 Temporary Hit Points (Forager Only).')).toBeNull();
  });

  it('whole-database census: ONLY Hunger of Yeenoghu arms today (all other save_effects inert)', () => {
    const armed = [];
    for (const m of mons) {
      for (const a of (m.actions || [])) {
        if (parseTempHpGrantClause(a.save_effect)) armed.push(`${m.name}/${a.name}`);
      }
    }
    expect(armed).toEqual(['Gnoll Demoniac/Hunger of Yeenoghu']);
  });
});
