// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import classes2024 from '../../../../../public/data/2024/classes.json';

// CLA-002: Abjure Foes (2024 Paladin lv9, automation.type 'set_condition')
// shipped without resourceCost:'channel_divinity', so conditionHandler's
// buildConditionAutoDefaults left saveAbility on the WIS default (DC 13 on
// a CHA 20 paladin) and handed the modal channelDivinityCharges:null — the
// CD spend/latch/refusal seam in SetConditionModal never engaged. The fix
// feeds the existing seam via data, mirroring the Cleric Turn Undead twin.

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
  rangeToFeet: vi.fn(),
}));

vi.mock('../../../shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../../../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn().mockResolvedValue([]),
}));

import { handle } from './conditionHandler.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { rangeToFeet } from '../../../rules/combat/rangeValidation.js';
import { getAbilityModifier } from '../../../shared/abilityLookup.js';

const CAMPAIGN_NAME = 'test-campaign';

function findAbjureFoesFeature() {
  const paladin = classes2024.find(c => c.name === 'Paladin');
  const level9 = (paladin.class_levels || []).find(l => l.level === 9);
  return (level9.features || []).find(f => f.name === 'Abjure Foes');
}

// ElderPaladin rig: lv20 Oath of the Ancients, CHA 20/+5, WIS 8/-1, PB +6.
function makeElderPaladin() {
  return {
    name: 'ElderPaladin',
    level: 20,
    proficiency: 6,
    abilities: [
      { name: 'Charisma', bonus: 5 },
      { name: 'Wisdom', bonus: -1 },
    ],
  };
}

describe('CLA-002 Abjure Foes Channel Divinity cost + CHA save DC', () => {
  const feature = findAbjureFoesFeature();

  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getAbilityModifier.mockReset();
    getCombatContext.mockReset().mockResolvedValue({ round: 1, creatures: [] });
    rangeToFeet.mockReset().mockReturnValue(60);
    addEntry.mockReset().mockResolvedValue({});
    getAbilityModifier.mockImplementation((_abilities, ability) => (ability === 'CHA' ? 5 : -1));
  });

  it('ground-truth 2024 classes.json feeds the CD seam (resourceCost + duration)', () => {
    expect(feature).toBeTruthy();
    expect(feature.level).toBe(9);
    expect(feature.automation).toMatchObject({
      type: 'set_condition',
      condition: 'frightened',
      resourceCost: 'channel_divinity',
      duration: '1_minute',
    });
  });

  it('builds the Channel Divinity DC from CHA (8 + PB 6 + CHA 5 = 19), not WIS', async () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 3 : null));

    const result = await handle({ name: 'Abjure Foes', automation: feature.automation }, makeElderPaladin(), CAMPAIGN_NAME, null);

    expect(result.type).toBe('modal');
    expect(result.payload.saveDc).toBe(19);
    expect(getAbilityModifier).toHaveBeenCalledWith(expect.anything(), 'CHA');
    expect(getAbilityModifier).not.toHaveBeenCalledWith(expect.anything(), 'WIS');
  });

  it('passes live channelDivinityCharges to the modal so SetConditionModal can spend 1', async () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 3 : null));

    const result = await handle({ name: 'Abjure Foes', automation: feature.automation }, makeElderPaladin(), CAMPAIGN_NAME, null);

    expect(result.payload.channelDivinityCharges).toBe(3);
    expect(result.payload.durationRounds).toBe(10);
  });

  it('refuses at 0 charges with no spend log and no modal', async () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 0 : null));

    const result = await handle({ name: 'Abjure Foes', automation: feature.automation }, makeElderPaladin(), CAMPAIGN_NAME, null);

    expect(result.type).toBe('popup');
    expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('activation log stamps the CHA-based DC 18', async () => {
    getRuntimeValue.mockImplementation((name, key) => (key === 'channelDivinityCharges' ? 2 : null));

    await handle({ name: 'Abjure Foes', automation: feature.automation }, makeElderPaladin(), CAMPAIGN_NAME, null);

    const logDesc = addEntry.mock.calls.find(c => String(c[1]?.description).includes('activated'))[1].description;
    expect(logDesc).toContain('DC 19');
    expect(logDesc).toContain('up to 5 targets within 60 ft.');
  });
});
