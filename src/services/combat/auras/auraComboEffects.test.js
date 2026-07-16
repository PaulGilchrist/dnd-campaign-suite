import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(),
  hasCannotActCondition: vi.fn(),
  getAuraRangeFromStats: vi.fn((stats) => {
    const hasExpansion = stats?.automation?.passives?.some(p => p.name === 'Aura Expansion') ?? false;
    return hasExpansion ? 30 : 10;
  }),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

import { computeAuraComboEffects } from './auraComboEffects.js';
import { hasAuraOfProtection, hasCannotActCondition } from './auraOfProtection.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';

function makeStats(passives) {
  return { automation: { passives: passives || [] } };
}

function makeCharacter(name, passives) {
  return { name, computedStats: makeStats(passives) };
}

const AURA_OF_PROTECTION = { name: 'Aura of Protection', type: 'passive_buff', effect: 'saving_throw_bonus' };
const AURA_OF_ALACRITY = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+10 ft.' };
const AURA_OF_ALACRITY_NO_BONUS = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus' };
const AURA_OF_COURAGE = { name: 'Aura of Courage', type: 'passive_buff', conditionImmunity: 'frightened' };
const AURA_OF_DEVOTION = { name: 'Aura of Devotion', type: 'passive_buff', conditionImmunity: 'charmed' };
const AURA_OF_WARDING = { name: 'Aura of Warding', type: 'passive_buff', resistances: ['Necrotic', 'Psychic', 'Radiant'] };

describe('computeAuraComboEffects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasAuraOfProtection.mockImplementation(() => true);
    hasCannotActCondition.mockImplementation(() => false);
    isWithinRange.mockResolvedValue(true);
    getRuntimeValue.mockReturnValue([]);
  });

  it('returns empty results when there are no characters or no valid aura bearers', async () => {
    hasAuraOfProtection.mockReturnValue(false);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [], campaignName: 'C', activeMapName: '',
    });
    expect(result).toEqual({ speedBonus: 0, speedSource: null, immunities: [], immunitySources: {}, resistances: [], resistanceSource: null });
  });

  it('skips sources with a cannot-act condition', async () => {
    hasCannotActCondition.mockReturnValue(true);
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY, AURA_OF_COURAGE, AURA_OF_WARDING]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result).toEqual({ speedBonus: 0, speedSource: null, immunities: [], immunitySources: {}, resistances: [], resistanceSource: null });
  });

  it('applies speed bonus from a single Paladin', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result).toEqual({ speedBonus: 10, speedSource: 'Paladin', immunities: [], immunitySources: {}, resistances: [], resistanceSource: null });
  });

  it('defaults to 10 when bonusExpression is missing', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY_NO_BONUS]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result).toEqual({ speedBonus: 10, speedSource: 'Paladin', immunities: [], immunitySources: {}, resistances: [], resistanceSource: null });
  });

  it('picks highest speed bonus from multiple sources regardless of order', async () => {
    const p1 = makeCharacter('Paladin1', [AURA_OF_ALACRITY]);
    const p2 = makeCharacter('Paladin2', [{ ...AURA_OF_ALACRITY, bonusExpression: '+20 ft.' }]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: '',
    });
    expect(result).toEqual({ speedBonus: 20, speedSource: 'Paladin2', immunities: [], immunitySources: {}, resistances: [], resistanceSource: null });
  });

  it('applies effects to the aura bearer themselves', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY, AURA_OF_COURAGE, AURA_OF_DEVOTION, AURA_OF_WARDING]);
    const result = await computeAuraComboEffects({
      targetName: 'Paladin', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result.speedBonus).toBe(10);
    expect(result.speedSource).toBe('Paladin');
    expect(result.immunities).toContain('frightened');
    expect(result.immunities).toContain('charmed');
    expect(result.resistances).toContain('Necrotic');
  });

  it('adds frightened and charmed immunities with correct sources', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_COURAGE, AURA_OF_DEVOTION]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result.immunities).toEqual(['frightened', 'charmed']);
    expect(result.immunitySources.frightened).toBe('Paladin');
    expect(result.immunitySources.charmed).toBe('Paladin');
  });

  it('applies resistances with correct source', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_WARDING]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result.resistances).toEqual(['Necrotic', 'Psychic', 'Radiant']);
    expect(result.resistanceSource).toBe('Paladin');
  });

  it('deduplicates and merges resistances from multiple sources', async () => {
    const p1 = makeCharacter('Paladin1', [AURA_OF_WARDING]);
    const p2 = makeCharacter('Paladin2', [AURA_OF_WARDING]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: '',
    });
    expect(result.resistances).toEqual(['Necrotic', 'Psychic', 'Radiant']);
  });

  it('still applies effects from other sources when one is out of range', async () => {
    isWithinRange.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const p1 = makeCharacter('Paladin1', [AURA_OF_ALACRITY]);
    const p2 = makeCharacter('Paladin2', [AURA_OF_COURAGE]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [p1, p2], campaignName: 'C', activeMapName: 'Map',
    });
    expect(result.speedBonus).toBe(0);
    expect(result.immunities).toContain('frightened');
  });

  it('applies effects when selectedAllies includes the target', async () => {
    getRuntimeValue.mockReturnValue(['Cleric']);
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result.speedBonus).toBe(10);
  });

  it('skips sources where selectedAllies excludes the target', async () => {
    getRuntimeValue.mockReturnValue(['OtherPlayer']);
    const paladin = makeCharacter('Paladin', [AURA_OF_ALACRITY]);
    const result = await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: '',
    });
    expect(result.speedBonus).toBe(0);
  });

  it('calls isWithinRange with the correct range (30 for Aura Expansion)', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_PROTECTION, { name: 'Aura Expansion', type: 'passive_buff' }]);
    await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: 'Map',
    });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 30);
  });

  it('calls isWithinRange with the correct range (10 without Aura Expansion)', async () => {
    const paladin = makeCharacter('Paladin', [AURA_OF_PROTECTION]);
    await computeAuraComboEffects({
      targetName: 'Cleric', characters: [paladin], campaignName: 'C', activeMapName: 'Map',
    });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Cleric', 10);
  });
});
