import { describe, it, expect, vi } from 'vitest';
import { computeAuraComboEffects } from './auraComboEffects.js';

vi.mock('./auraOfProtection.js', () => ({
  hasAura: vi.fn((stats, name) => stats?.automation?.passives?.some(p => p.name === name)),
  hasAuraOfProtection: vi.fn((stats) => stats?.automation?.passives?.some(p => p.name === 'Aura of Protection')),
  getAuraRangeFromStats: vi.fn(() => 10),
  hasCannotActCondition: vi.fn(() => false),
  isWithinRange: vi.fn(() => true),
}));

import { hasCannotActCondition, isWithinRange } from './auraOfProtection.js';

function makeCharacter(name, passives) {
  return {
    name,
    computedStats: {
      automation: { passives },
    },
  };
}

const AURA_OF_PROTECTION = { type: 'passive_buff', name: 'Aura of Protection', effect: 'saving_throw_bonus' };
const AURA_OF_ALACRITY = { type: 'passive_buff', name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: '+10 ft.' };
const AURA_OF_COURAGE = { type: 'passive_buff', name: 'Aura of Courage', conditionImmunity: 'frightened' };
const AURA_OF_DEVOTION = { type: 'passive_buff', name: 'Aura of Devotion', conditionImmunity: 'charmed' };
const AURA_OF_WARDING = { type: 'passive_buff', name: 'Aura of Warding', resistances: ['Necrotic', 'Psychic', 'Radiant'] };

describe('computeAuraComboEffects', () => {
  it('returns empty effects when no characters have auras', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Bob', []),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(0);
    expect(result.immunities).toEqual([]);
    expect(result.resistances).toEqual([]);
  });

  it('returns empty effects when only Aura of Protection is present (no secondary aura)', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(0);
    expect(result.immunities).toEqual([]);
    expect(result.resistances).toEqual([]);
  });

  it('applies Aura of Alacrity speed bonus', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(10);
    expect(result.speedSource).toBe('Paladin');
  });

  it('applies Aura of Courage frightened immunity', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.immunities).toContain('frightened');
    expect(result.immunitySources.frightened).toBe('Paladin');
  });

  it('applies Aura of Devotion charmed immunity', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.immunities).toContain('charmed');
    expect(result.immunitySources.charmed).toBe('Paladin');
  });

  it('applies Aura of Warding resistances', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
    expect(result.resistanceSource).toBe('Paladin');
  });

  it('applies all combo effects from a single Paladin', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY, AURA_OF_COURAGE, AURA_OF_DEVOTION, AURA_OF_WARDING]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(10);
    expect(result.speedSource).toBe('Paladin');
    expect(result.immunities).toContain('frightened');
    expect(result.immunities).toContain('charmed');
    expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
  });

  it('applies aura effects to the Paladin themselves', async () => {
    const chars = [
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
     ];
    const result = await computeAuraComboEffects({ targetName: 'Paladin', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(10);
    expect(result.speedSource).toBe('Paladin');
   });

  it('does not apply effects from incapacitated source', async () => {
    hasCannotActCondition.mockReturnValueOnce(true);
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(0);
  });

  it('does not apply effects from out-of-range source', async () => {
    isWithinRange.mockResolvedValueOnce(false);
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: 'some-map' });
    expect(result.speedBonus).toBe(0);
  });

  it('combines effects from multiple Paladins', async () => {
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.immunities).toContain('frightened');
    expect(result.immunities).toContain('charmed');
    expect(result.immunitySources.frightened).toBe('Paladin1');
    expect(result.immunitySources.charmed).toBe('Paladin2');
  });

  it('picks highest speed bonus from multiple sources', async () => {
    const auraAlacrity15 = { type: 'passive_buff', name: 'Aura of Alacrity', effect: 'speed_bonus', bonusExpression: '+15 ft.' };
    const chars = [
      makeCharacter('Alice', []),
      makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      makeCharacter('Paladin2', [AURA_OF_PROTECTION, auraAlacrity15]),
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(15);
    expect(result.speedSource).toBe('Paladin2');
  });

  it('ignores characters without computedStats', async () => {
    const chars = [
      makeCharacter('Alice', []),
      { name: 'Ghost' },
    ];
    const result = await computeAuraComboEffects({ targetName: 'Alice', characters: chars, campaignName: 'test', activeMapName: null });
    expect(result.speedBonus).toBe(0);
  });
});
