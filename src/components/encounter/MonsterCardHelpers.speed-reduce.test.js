// MA-1530: Steam Mephit Steam Breath authored failed-save Speed-reduce-by-N
// clause ("the target's Speed decreases by 10 feet until the end of the
// mephit's next turn") — parse arms the registered speed_reduction te
// producer at the SaveAttackAoeModal picker failed-save seam (MA-0146
// speed_zero twin parse shape; grant threading MA-0995/MA-1147 clock twin).
import { describe, it, expect } from 'vitest';
import { parseSpeedReduceClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-1530 parseSpeedReduceClause', () => {
  it('matches the authored Steam Mephit Steam Breath save_effect with numeric value', () => {
    const row = monstersData.find(m => m.index === 'steam-mephit')
      .actions.find(a => a.name === 'Steam Breath');
    expect(row.save_dc).toBe(10);
    expect(row.save_type).toBe('Constitution');
    expect(row.damage_dice_primary).toBe('2d4');
    expect(row.damage_type_primary).toBe('Fire');
    expect(row.range).toBe('15-foot Cone');
    expect(parseSpeedReduceClause(row.save_effect)).toEqual({ effect: 'speed_reduction', value: 10 });
  });

  it('case-insensitive, decrease/decreases, other numeric feet values', () => {
    expect(parseSpeedReduceClause('and the target\'s Speed decreases by 10 feet until the end of the mephit\'s next turn')).toEqual({ effect: 'speed_reduction', value: 10 });
    expect(parseSpeedReduceClause('speed decrease by 5 feet')).toEqual({ effect: 'speed_reduction', value: 5 });
    expect(parseSpeedReduceClause('Speed Decreases By 30 Feet')).toEqual({ effect: 'speed_reduction', value: 30 });
  });

  it('does NOT match speed_half/speed_zero/word-scan wording — no clause collision', () => {
    const scorching = monstersData.find(m => m.name === 'Adult Brass Dragon')
      .legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(parseSpeedReduceClause(scorching.save_effect)).toBeNull();
    const freezing = monstersData.find(m => m.index === 'adult-white-dragon')
      .legendary_actions.find(a => a.name === 'Freezing Burst');
    expect(parseSpeedReduceClause(freezing.save_effect)).toBeNull();
    expect(parseSpeedReduceClause('Speed reduced by 10 feet')).toBeNull();
    expect(parseSpeedReduceClause('Target is Poisoned.')).toBeNull();
  });

  it('ice-mephit Frost Breath sibling carries NO speed clause — byte-inert audit', () => {
    const frost = monstersData.find(m => m.index === 'ice-mephit')
      .actions.find(a => a.name === 'Frost Breath');
    expect(frost.save_effect).toBe('Half damage');
    expect(frost.description).not.toMatch(/Speed decreases? by \d+ feet/i);
    expect(parseSpeedReduceClause(frost.save_effect)).toBeNull();
  });

  it('frost-giant Great Bow save_effect decoy parses ONLY on disk inspection — attack row never reaches the picker save seam (no save_dc authored)', () => {
    const greatBow = monstersData.find(m => m.index === 'frost-giant')
      .actions.find(a => a.name === 'Great Bow');
    expect(greatBow.save_dc).toBeUndefined();
    expect(greatBow.attack_bonus).toBe(9);
    // clause text IS present on disk (prose decoy) — parser is pure text and
    // would match; the LIVE arm is unreachable because the row renders the
    // attack lane (attack_bonus, no save_dc → no save chip / no picker).
    expect(parseSpeedReduceClause(greatBow.save_effect)).toEqual({ effect: 'speed_reduction', value: 10 });
  });

  it('returns null for non-strings', () => {
    expect(parseSpeedReduceClause(null)).toBeNull();
    expect(parseSpeedReduceClause(undefined)).toBeNull();
    expect(parseSpeedReduceClause(42)).toBeNull();
  });

  it('reuses the registered speed_reduction te (Movement, MA-0995 reuse contract — NO new registry key)', async () => {
    const { getEffectDefinition } = await import('../../services/combat/conditions/targetEffectDefinitions.js');
    const def = getEffectDefinition('speed_reduction');
    expect(def).toBeTruthy();
    expect(def.group).toBe('Movement');
    expect(def.label).toBe('Speed Reduced');
    expect(def.fields).toEqual(['source', 'value']);
    expect(def.defaults.value).toBe(10);
  });
});
