import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn((name) => [name]),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

import { computeAuraComboEffects } from './auraComboEffects.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';

function makeSourceEntry(name, computedStats) {
  return { name, computedStats };
}

function makePassive(name, extra = {}) {
  return { name, ...extra };
}

describe('computeAuraComboEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllyList.mockReturnValue(['Cleric']);
  });

  // ── Early returns / edge cases ────────────────────────────────

  it('returns all-zero/null defaults when characters is empty', async () => {
    const result = await computeAuraComboEffects({ targetName: 'Cleric', characters: [] });
    expect(result).toEqual({
      speedBonus: 0,
      speedSource: null,
      immunities: [],
      immunitySources: {},
      resistances: [],
      resistanceSource: null,
    });
  });

  it('skips entries with no name', async () => {
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('', { automation: { passives: [makePassive('Aura of Protection')] } })],
    });
    expect(result.speedBonus).toBe(0);
    expect(result.speedSource).toBeNull();
  });

  it('skips entries with null/undefined computedStats', async () => {
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Paladin', null), makeSourceEntry('Paladin', undefined)],
    });
    expect(result.speedBonus).toBe(0);
    expect(result.speedSource).toBeNull();
  });

  it('skips entries without Aura of Protection', async () => {
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Wizard', { automation: { passives: [makePassive('Spell Sniper')] } })],
    });
    expect(result.speedBonus).toBe(0);
    expect(result.speedSource).toBeNull();
  });

  it('skips sources with a cannot-act condition', async () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Paladin', { automation: { passives: [makePassive('Aura of Protection')] } })],
    });
    expect(result.speedBonus).toBe(0);
    expect(result.speedSource).toBeNull();
  });

  it('skips sources whose ally list does not include the target', async () => {
    getRuntimeValue.mockReturnValue([]);
    getAllyList.mockReturnValue(['OtherPlayer']);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Paladin', { automation: { passives: [makePassive('Aura of Protection')] } })],
    });
    expect(result.speedBonus).toBe(0);
  });

  it('skips sources out of range', async () => {
    getRuntimeValue.mockReturnValue([]);
    isWithinRange.mockResolvedValue(false);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Paladin', { automation: { passives: [makePassive('Aura of Protection')] } })],
    });
    expect(result.speedBonus).toBe(0);
  });

  // ── Speed bonus (Aura of Alacrity) ────────────────────────────

  describe('speed bonus (Aura of Alacrity)', () => {
    it('returns speed bonus when Aura of Alacrity with speed_bonus effect is present', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' })] },
        })],
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('defaults speed bonus to 10 when bonusExpression is absent', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus' })] },
        })],
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('skips speed bonus when bonusExpression is non-numeric', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: 'abc' })] },
        })],
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });

    it('selects the highest speed bonus from multiple sources', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' })] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '15' })] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.speedBonus).toBe(15);
      expect(result.speedSource).toBe('Paladin2');
    });

    it('does not apply speed bonus when effect is not speed_bonus', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'other_effect' })] },
        })],
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });

    it('does not apply speed bonus when passive name is not Aura of Alacrity', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Other Aura', { effect: 'speed_bonus', bonusExpression: '20' })] },
        })],
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });
  });

  // ── Condition immunity (Aura of Courage) ──────────────────────

  describe('condition immunity (Aura of Courage)', () => {
    it('adds frightened immunity when Aura of Courage passive is present', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Courage', { conditionImmunity: 'frightened' })] },
        })],
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin');
    });

    it('does not add frightened immunity when conditionImmunity is not frightened', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Courage', { conditionImmunity: 'charmed' })] },
        })],
      });
      expect(result.immunities).not.toContain('frightened');
      expect(result.immunitySources.frightened).toBeUndefined();
    });

    it('does not add frightened immunity when passive name is not Aura of Courage', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Other Aura', { conditionImmunity: 'frightened' })] },
        })],
      });
      expect(result.immunities).not.toContain('frightened');
    });

    it('records multiple sources for the same immunity (last one wins in source)', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Courage', { conditionImmunity: 'frightened' })] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Courage', { conditionImmunity: 'frightened' })] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin2');
    });
  });

  // ── Condition immunity (Aura of Devotion) ─────────────────────

  describe('condition immunity (Aura of Devotion)', () => {
    it('adds charmed immunity when Aura of Devotion passive is present', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Devotion', { conditionImmunity: 'charmed' })] },
        })],
      });
      expect(result.immunities).toContain('charmed');
      expect(result.immunitySources.charmed).toBe('Paladin');
    });

    it('does not add charmed immunity when conditionImmunity is not charmed', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Devotion', { conditionImmunity: 'frightened' })] },
        })],
      });
      expect(result.immunities).not.toContain('charmed');
      expect(result.immunitySources.charmed).toBeUndefined();
    });

    it('does not add charmed immunity when passive name is not Aura of Devotion', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Other Aura', { conditionImmunity: 'charmed' })] },
        })],
      });
      expect(result.immunities).not.toContain('charmed');
    });

    it('records multiple sources for charmed immunity (last one wins)', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Devotion', { conditionImmunity: 'charmed' })] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Devotion', { conditionImmunity: 'charmed' })] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.immunitySources.charmed).toBe('Paladin2');
    });
  });

  // ── Damage resistances (Aura of Warding) ──────────────────────

  describe('damage resistances (Aura of Warding)', () => {
    it('adds damage resistances when Aura of Warding passive is present with resistances array', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['fire', 'cold'] })] },
        })],
      });
      expect(result.resistances).toContain('fire');
      expect(result.resistances).toContain('cold');
      expect(result.resistanceSource).toBe('Paladin');
    });

    it('does not add resistances when resistances array is empty', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: [] })] },
        })],
      });
      expect(result.resistances).toEqual([]);
      expect(result.resistanceSource).toBeNull();
    });

    it('does not add resistances when resistances is undefined', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding')] },
        })],
      });
      expect(result.resistances).toEqual([]);
      expect(result.resistanceSource).toBeNull();
    });

    it('does not add resistances when passive name is not Aura of Warding', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Other Aura', { resistances: ['fire'] })] },
        })],
      });
      expect(result.resistances).toEqual([]);
    });

    it('merges resistances from multiple sources', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['fire'] })] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['cold'] })] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.resistances).toContain('fire');
      expect(result.resistances).toContain('cold');
      expect(result.resistanceSource).toBe('Paladin2');
    });

    it('deduplicates resistances from multiple sources', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['fire', 'psychic'] })] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['fire', 'radiant'] })] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.resistances.filter(r => r === 'fire').length).toBe(1);
      expect(result.resistances).toContain('psychic');
      expect(result.resistances).toContain('radiant');
    });
  });

  // ── Combined effects ──────────────────────────────────────────

  describe('combined effects', () => {
    it('applies all aura effects from a single source simultaneously', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [
            makePassive('Aura of Protection'),
            makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' }),
            makePassive('Aura of Courage', { conditionImmunity: 'frightened' }),
            makePassive('Aura of Devotion', { conditionImmunity: 'charmed' }),
            makePassive('Aura of Warding', { resistances: ['fire'] }),
          ] },
        })],
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
      expect(result.immunities).toContain('frightened');
      expect(result.immunities).toContain('charmed');
      expect(result.resistances).toContain('fire');
    });

    it('applies effects from multiple sources, selecting best speed and merging others', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const p1 = makeSourceEntry('Paladin1', {
        automation: { passives: [
          makePassive('Aura of Protection'),
          makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' }),
          makePassive('Aura of Courage', { conditionImmunity: 'frightened' }),
        ] },
      });
      const p2 = makeSourceEntry('Paladin2', {
        automation: { passives: [
          makePassive('Aura of Protection'),
          makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '20' }),
          makePassive('Aura of Devotion', { conditionImmunity: 'charmed' }),
          makePassive('Aura of Warding', { resistances: ['fire', 'cold'] }),
        ] },
      });
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [p1, p2],
      });
      expect(result.speedBonus).toBe(20);
      expect(result.speedSource).toBe('Paladin2');
      expect(result.immunities).toContain('frightened');
      expect(result.immunities).toContain('charmed');
      expect(result.resistances).toContain('fire');
      expect(result.resistances).toContain('cold');
      expect(result.resistanceSource).toBe('Paladin2');
    });
  });

  // ── Ally filtering ────────────────────────────────────────────

  describe('ally filtering', () => {
    it('uses getAllyList to filter candidates', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Ally1']);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' })] },
        })],
      });
      expect(result.speedBonus).toBe(0);
    });

    it('applies effects when target is in ally list', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue(['Cleric']);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' })] },
        })],
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('skips source when ally list is empty but target not included (defaults to self)', async () => {
      getRuntimeValue.mockReturnValue([]);
      getAllyList.mockReturnValue([]);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Alacrity', { effect: 'speed_bonus', bonusExpression: '10' })] },
        })],
      });
      expect(result.speedBonus).toBe(0);
    });
  });

  // ── Range checking ────────────────────────────────────────────

  describe('range checking', () => {
    it('calls isWithinRange with default 10 ft range', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection')] },
        })],
      });
      expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 10);
    });

    it('calls isWithinRange with 30 ft range when Aura Expansion is present', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')] },
        })],
      });
      expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 30);
    });
  });

  // ── Return value structure ────────────────────────────────────

  describe('return value structure', () => {
    it('returns an object with all expected keys', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection')] },
        })],
      });
      expect(result).toHaveProperty('speedBonus');
      expect(result).toHaveProperty('speedSource');
      expect(result).toHaveProperty('immunities');
      expect(result).toHaveProperty('immunitySources');
      expect(result).toHaveProperty('resistances');
      expect(result).toHaveProperty('resistanceSource');
    });

    it('returns immunities as array and immunitySources as object', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Courage', { conditionImmunity: 'frightened' })] },
        })],
      });
      expect(Array.isArray(result.immunities)).toBe(true);
      expect(typeof result.immunitySources).toBe('object');
      expect(result.immunitySources).not.toBeNull();
    });

    it('returns resistances as array and resistanceSource as string or null', async () => {
      getRuntimeValue.mockReturnValue([]);
      isWithinRange.mockResolvedValue(true);
      const result = await computeAuraComboEffects({
        targetName: 'Cleric',
        characters: [makeSourceEntry('Paladin', {
          automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura of Warding', { resistances: ['fire'] })] },
        })],
      });
      expect(Array.isArray(result.resistances)).toBe(true);
      expect(result.resistanceSource).toBe('Paladin');
    });
  });
});
