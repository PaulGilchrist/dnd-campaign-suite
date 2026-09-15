// MA-0146: Adult White Dragon Freezing Burst authored failed-save speed-zero
// clause — parse arms the speed_zero producer (te + activeCondition) at the
// picker/saveProcessing failed-save seams (MA-0073 speed_half pattern).
import { describe, it, expect } from 'vitest';
import { parseSpeedZeroClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

describe('MA-0146 parseSpeedZeroClause', () => {
  it('matches the authored Adult White Dragon Freezing Burst save_effect', () => {
    const row = monstersData.find(m => m.index === 'adult-white-dragon')
      .legendary_actions.find(a => a.name === 'Freezing Burst');
    expect(parseSpeedZeroClause(row.save_effect)).toEqual({ effect: 'speed_zero' });
  });

  it('case-insensitive "Speed is 0" match', () => {
    expect(parseSpeedZeroClause('and the target\'s Speed is 0 until the end of the target\'s next turn')).toEqual({ effect: 'speed_zero' });
    expect(parseSpeedZeroClause('speed is 0')).toEqual({ effect: 'speed_zero' });
  });

  it('does NOT match speed_half/speed_reduction wording — no clause collision', () => {
    const scorching = monstersData.find(m => m.name === 'Adult Brass Dragon')
      .legendary_actions.find(a => a.name === 'Scorching Sands');
    expect(parseSpeedZeroClause(scorching.save_effect)).toBeNull();
    expect(parseSpeedZeroClause('Speed reduced by 10 feet')).toBeNull();
    expect(parseSpeedZeroClause('Target is Poisoned.')).toBeNull();
  });

  it('returns null for non-strings', () => {
    expect(parseSpeedZeroClause(null)).toBeNull();
    expect(parseSpeedZeroClause(undefined)).toBeNull();
    expect(parseSpeedZeroClause(42)).toBeNull();
  });

  it('registers the speed_zero te in the targetEffects registry (Movement)', async () => {
    const { TARGET_EFFECT_DEFINITIONS, getEffectDefinition } = await import('../../services/combat/conditions/targetEffectDefinitions.js');
    const def = TARGET_EFFECT_DEFINITIONS.find(d => d.effect === 'speed_zero');
    expect(def).toBeTruthy();
    expect(def.group).toBe('Movement');
    expect(def.label).toBe('Speed 0');
    expect(getEffectDefinition('speed_zero')).toBeTruthy();
  });
});
