// @maintained-by-ai — MA-0038 OWNER truth-table for parseConcentrationDisadvantageClause (MonsterCardHelpers.js:63).
// Clause parse arms the registered concentration_disadvantage te (targetEffectDefinitions.js:43) via the
// MonsterCardModal save context (MonsterCardModal.jsx:1797, :1840) onto the saveProcessing te producer
// (saveProcessing.js:928). Consumers echo cite-skip — own lanes: saveProcessing.concentration-disadvantage.test.js,
// createConcentrationHandlers.te-disadvantage.test.jsx, concentrationPromptRoll.te-disadvantage.test.js,
// targetEffectDefinitions.test.js:580. Fixtures are BY NAME verbatim disk citations: monsters.json
// adult-black-dragon Cloud of Insects save_effect/description (:1171/:1166, DC 17) and ancient-black-dragon
// save_effect (:3279, DC 21) — the old inline Ancient fixture was TRUNCATED vs disk (dropped the trailing
// " Success: ..." sentence); re-pulled verbatim. Fiction decoys (header justification, #498): plain-damage,
// speed-half, and Advantage-to-maintain strings are synthetic collision decoys — Advantage wording lives only in
// player-feat prose (2024/feats.json:3294), never a monster save_effect; the parser is pure text in/out and
// never a fabricated clock — concentration stays concentration 🔴.
import { describe, it, expect } from 'vitest';
import { parseConcentrationDisadvantageClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const adultCloud = monstersData.find(m => m.index === 'adult-black-dragon')
  .legendary_actions.find(a => a.name === 'Cloud of Insects');
const ancientCloud = monstersData.find(m => m.index === 'ancient-black-dragon')
  .legendary_actions.find(a => a.name === 'Cloud of Insects');

describe('MA-0038 parseConcentrationDisadvantageClause', () => {
  it('matches adult Cloud of Insects save_effect verbatim (monsters.json:1171) and ancient two-outcome-suffix twin verbatim (:3279)', () => {
    expect(adultCloud.save_dc).toBe(17);
    expect(adultCloud.save_type).toBe('Dexterity');
    expect(parseConcentrationDisadvantageClause(adultCloud.save_effect)).toEqual({ effect: 'concentration_disadvantage' });
    expect(ancientCloud.save_dc).toBe(21);
    expect(ancientCloud.save_effect).toMatch(/Success: The dragon can't take this action again/u);
    expect(parseConcentrationDisadvantageClause(ancientCloud.save_effect)).toEqual({ effect: 'concentration_disadvantage' });
  });

  it('matches <strong>Concentration</strong> markup — optional tag branch fed by on-disk description prose (:1166/:3274)', () => {
    expect(adultCloud.description).toContain('maintain <strong>Concentration</strong>');
    expect(parseConcentrationDisadvantageClause(adultCloud.description)).toEqual({ effect: 'concentration_disadvantage' });
    expect(parseConcentrationDisadvantageClause(ancientCloud.description)).toEqual({ effect: 'concentration_disadvantage' });
  });

  it('returns null for collision decoys and non-string inputs — never double-arms other riders', () => {
    expect(parseConcentrationDisadvantageClause('10 (3d6) Fire damage')).toBeNull();
    expect(parseConcentrationDisadvantageClause("Half damage, and the target's Speed is halved until the end of its next turn")).toBeNull();
    expect(parseConcentrationDisadvantageClause('Advantage on Constitution saving throws to maintain Concentration')).toBeNull();
    expect(parseConcentrationDisadvantageClause(null)).toBeNull();
    expect(parseConcentrationDisadvantageClause(undefined)).toBeNull();
    expect(parseConcentrationDisadvantageClause(42)).toBeNull();
  });

  it('Cloud of Insects clause is invisible to the CONDITION vocabulary (MonsterCardHelpers.js:56-61) — the gap this parse exists for', () => {
    expect(extractConditionsFromSaveEffect(adultCloud.save_effect)).toEqual([]);
  });
});
