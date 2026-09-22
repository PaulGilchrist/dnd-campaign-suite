// MA-0751: Fomorian Warping Hex — "The target gains 1 Exhaustion level."
// exhaustion is LEVEL-based (stackable to 6) and lives OUTSIDE the canonical
// CONDITIONS word list, so extractConditionsFromSaveEffect returns [] despite
// the canonical word being present (§239 fingerprint) — zero grant on a
// failed save. parseExhaustionLevelClause arms ONLY on exhaustion-level
// prose, byte-inert (null) elsewhere, and explicitly excludes the Salamander
// Inferno Master recurring burn-tick twin ("whenever it takes this burning
// damage" — §87 recurring clause, picker-route row). The parsed level rides
// buildAbilitySaveRollContext (inline block-save seam, MA-0711 slowedClauses
// twin shape) to saveProcessing's canonical exhaustionLevel grant.
import { describe, it, expect } from 'vitest';
import { parseExhaustionLevelClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { buildAbilitySaveRollContext } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const fomorian = monstersData.find(m => m.index === 'fomorian');
const fomorianRow = fomorian.actions.find(a => a.name === 'Warping Hex');

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

describe('MA-0751 parseExhaustionLevelClause', () => {
  it('data lock: Fomorian Warping Hex row (DC 16 WIS, 6d6 Psychic, 120 ft, recharge 4-6)', () => {
    expect(fomorianRow.save_dc).toBe(16);
    expect(fomorianRow.save_type).toBe('Wisdom');
    expect(fomorianRow.damage_dice_primary).toBe('6d6');
    expect(fomorianRow.damage_type_primary).toBe('Psychic');
    expect(fomorianRow.range).toBe('120 feet');
    expect(fomorianRow.recharge).toBe('4-6');
    expect(fomorianRow.save_effect).toBe('The target gains 1 Exhaustion level.');
  });

  it('fingerprint lock: canonical word present but CONDITIONS list yields nothing', () => {
    expect(extractConditionsFromSaveEffect(fomorianRow.save_effect)).toEqual([]);
  });

  it('arms level 1 on the Fomorian save_effect byte', () => {
    expect(parseExhaustionLevelClause(fomorianRow.save_effect)).toEqual({ effect: 'exhaustion', level: 1 });
  });

  it('multi-level + plural + case variants arm', () => {
    expect(parseExhaustionLevelClause('The target gains 2 exhaustion levels.')).toEqual({ effect: 'exhaustion', level: 2 });
    expect(parseExhaustionLevelClause('the target gains 1 Exhaustion level until the next dawn')).toEqual({ effect: 'exhaustion', level: 1 });
  });

  it('Salamander Inferno Master recurring burn-tick twin stays inert (null)', () => {
    const salamander = monstersData.find(m => m.index === 'salamander-inferno-master');
    const row = salamander.actions.find(a => a.name === 'Inferno Blast');
    expect(row.save_effect).toMatch(/gains 1 Exhaustion level whenever it takes this burning damage/i);
    expect(parseExhaustionLevelClause(row.save_effect)).toBeNull();
  });

  it('byte-inert: null for every clauseless prose / non-string', () => {
    expect(parseExhaustionLevelClause('The target is Poisoned.')).toBeNull();
    expect(parseExhaustionLevelClause('takes 12 Acid damage. Success: Half damage.')).toBeNull();
    expect(parseExhaustionLevelClause('gains 1 level of exhaustion immunity')).toBeNull();
    expect(parseExhaustionLevelClause(null)).toBeNull();
    expect(parseExhaustionLevelClause(undefined)).toBeNull();
    expect(parseExhaustionLevelClause(42)).toBeNull();
  });
});

describe('MA-0751 buildAbilitySaveRollContext threading', () => {
  it('arms exhaustionLevel {level:1} on the Fomorian inline save context', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Fomorian 1',
      target: { name: 'Bandit 1', type: 'npc' },
      spellName: null,
      action: fomorianRow,
      saveType: 'Wisdom',
      dcSuccess: 'half',
      saveDamageFormula: '6d6',
      saveConditions: extractConditionsFromSaveEffect(fomorianRow.save_effect),
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.exhaustionLevel).toEqual({ effect: 'exhaustion', level: 1 });
    expect(ctx.saveDc).toBe(16);
    expect(ctx.saveType).toBe('Wisdom');
  });

  it('byte-inert null on a clauseless save row', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Fomorian 1',
      target: { name: 'Bandit 1', type: 'npc' },
      spellName: null,
      action: { name: 'Bear Hug', save_dc: 16, save_type: 'Wisdom', save_effect: 'The target is Prone.' },
      saveType: 'Wisdom',
      dcSuccess: 'half',
      saveDamageFormula: null,
      saveConditions: ['prone'],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.exhaustionLevel).toBeNull();
  });
});
