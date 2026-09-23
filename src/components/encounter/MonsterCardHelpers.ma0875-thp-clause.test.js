// MA-0875: Gnoll Demoniac "Hunger of Yeenoghu" THP save_effect clause.
// parseTempHpGrantClause parses "gains N Temporary Hit Points" out of the
// row's save_effect into a structured grant arm ({ tempHp }) that rides the
// save context / picker prop to the failed-save grant seams (picker
// resolveSaveFailGrant + inline saveProcessing.grantFailedSaveTempHp,
// MA-0275 Fortify tempHpService replace-if-larger producer twins — no
// addExpiration clock, THP is consumed by damage). "Temporary Hit Points"
// is NOT in the canonical CONDITIONS word list (§50), so the clause needs
// this dedicated parser. Byte-inert null for every clauseless row, and the
// MA-0275 Animal Lord variant-chooser row (whose Fortify THP lands on BOTH
// outcomes through applyAnimalSpiritVariantGrant) must stay inert here.
import { describe, it, expect } from 'vitest';
import { parseTempHpGrantClause, parseAnimalSpiritVariants } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const gnollRow = () => monstersData.find(m => m.name === 'Gnoll Demoniac').actions.find(a => a.name === 'Hunger of Yeenoghu');
const animalLordRow = () => monstersData.find(m => m.name === 'Animal Lord').actions.find(a => a.name === 'Animal Spirit');

describe('MA-0875 parseTempHpGrantClause (Hunger of Yeenoghu THP clause)', () => {
  it('arms the authored gnoll save_effect with tempHp 10', () => {
    const row = gnollRow();
    expect(row.save_effect).toMatch(/gains 10 temporary hit points/i);
    expect(parseTempHpGrantClause(row.save_effect)).toEqual({ tempHp: 10 });
  });

  it('byte-inert null for clauseless save_effects', () => {
    expect(parseTempHpGrantClause(undefined)).toBeNull();
    expect(parseTempHpGrantClause(null)).toBeNull();
    expect(parseTempHpGrantClause('')).toBeNull();
    expect(parseTempHpGrantClause('The target takes 8d6 Necrotic damage. Success: Half damage only.')).toBeNull();
    expect(parseTempHpGrantClause('the target has the Poisoned condition until the end of its next turn')).toBeNull();
  });

  it('MA-0275 Animal Lord variant row stays inert — the chooser owns its Fortify THP (both outcomes)', () => {
    const row = animalLordRow();
    expect(parseAnimalSpiritVariants(row)).toBeTruthy();
    expect(parseTempHpGrantClause(row.save_effect)).toBeNull();
  });

  it('whole-database census: ONLY Hunger of Yeenoghu arms today (all other save_effects inert)', () => {
    const armed = [];
    for (const m of monstersData) {
      for (const a of (m.actions || [])) {
        if (parseTempHpGrantClause(a.save_effect)) armed.push(`${m.name}/${a.name}`);
      }
    }
    expect(armed).toEqual(['Gnoll Demoniac/Hunger of Yeenoghu']);
  });
});
