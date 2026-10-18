// @maintained-by-ai: 2026-10-18 — MA-0322 OWNER truth-table for extractFlatHitDamage
// (MonsterCardHelpers.js:3070-3085): flat prose "Hit: N <Type> damage." with NO
// damage_dice_primary → constant numeric string; every dice-bearing row stays byte-inert.
// Disk fixtures BY NAME parsed from monsters.json (#387 — no hand transcriptions).
// Trimmed 23→9 cases: distinct-branch inputs only. badger/Bite (MA-0332) and bat/Bite
// (MA-0364) are byte-shape twins of awakened-shrub/Rake (identical branch + output '1').
// Consumer cite-skips: flying-snake/Bite flat '1' + dice-primary inert row →
// MonsterCardModal.ma0747-composite-damage.test.jsx:53,69; goat/Ram flat '1' (trailing
// "or 2 (1d4)" rider) → MonsterCardModal.ma0885-goat-ram-charge.test.jsx:202;
// flat crit-invariance (parseConstant dice-less) → ma0747-composite-damage.test.jsx:52-57.
// Fiction fixtures (#498 justification): the two synthetic rows below — disk has ZERO
// "Failure:/Success: N (XdY)" rows and ZERO "Hit: N (<non-dice>)" rows, but both lock the
// MA-0747 guard's exact adjacency: keyword+dice blocks, non-adjacent dice does not.
import { describe, it, expect } from 'vitest';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const diskRow = (index, name) => monstersData.find(m => m.index === index).actions.find(a => a.name === name);

describe('extractFlatHitDamage owner truth-table (MA-0322 flat prose / MA-0747 guard scope)', () => {
  // exact disk row BY NAME → output; every case is a distinct branch of the extractor.
  it.each([
    ['awakened-shrub', 'Rake', '1'],                  // HTML-tagged <strong>Hit:</strong> — strip branch (:3073)
    ['crawling-claw', 'Slam', '2'],                   // constant ≠ "1" — amount comes from prose, not a hardcode
    ['gas-spore', 'Touch', '1'],                      // trailing ", and the creature must…" rider + lowercase type — unanchored /i match (:3083)
    ['scorpion', 'Sting', '1'],                       // MA-0747: dice only in secondary rider "plus 3 (1d6)" does NOT block flat primary
    ['aarakocra', 'Talon', null],                     // guard (:3082): dice adjacent to Hit: → byte-inert (extractDamageDiceFromDescription owns those)
    ['aberrant-spirit-beholderkin', 'Eye Ray', null], // bare dice "Hit: 1d8+3+spell level…" — digits must not leak a false flat "1"
    ['aarakocra-aeromancer', 'Multiattack', null],    // no Hit: clause at all
  ])('%s/%s disk row → %s', (index, name, expected) => {
    expect(extractFlatHitDamage(diskRow(index, name))).toBe(expected);
  });

  it('guard blocks keyword-adjacent dice only — fiction rows, zero disk matches (Fiction: #498)', () => {
    // Failure: clause dice → null (guard keyword alternation beyond Hit:).
    expect(extractFlatHitDamage({ description: 'Hit: 1 Piercing damage. Failure: 3 (1d6) Poison damage.' })).toBe(null);
    // non-dice paren after the amount → match regex cannot span "(" → null.
    expect(extractFlatHitDamage({ description: 'Hit: 7 (advantage) slashing damage.' })).toBe(null);
  });

  it('missing or empty action → null (:3071-3072 falsy-description guard)', () => {
    expect(extractFlatHitDamage(undefined)).toBe(null);
    expect(extractFlatHitDamage({})).toBe(null);
    expect(extractFlatHitDamage({ description: '' })).toBe(null);
  });
});
