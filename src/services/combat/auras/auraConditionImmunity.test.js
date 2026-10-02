// CLA-019: aura-granted condition-immunity channel feeding the condition-apply seams.
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

const logEntries = [];
vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn((campaignName, entry) => {
    logEntries.push(entry);
    return Promise.resolve();
  }),
}));

import {
  getAuraConditionImmunities,
  auraCoversCondition,
  splitAuraCoveredConditions,
  logAuraConditionImmunity,
} from './auraConditionImmunity.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';

const campaignName = 'test-campaign';

function paladinEntry(name, extraPassives = []) {
  return {
    name,
    computedStats: {
      automation: {
        passives: [
          { name: 'Aura of Protection' },
          { name: 'Aura of Courage', conditionImmunity: 'frightened' },
          ...extraPassives,
        ],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  logEntries.length = 0;
  getRuntimeValue.mockReturnValue([]);
  getAllyList.mockReturnValue(['EvasiveFighter']);
  isWithinRange.mockResolvedValue(true);
});

describe('getAuraConditionImmunities', () => {
  it('returns empty channel without awaiting when characters missing/empty', async () => {
    await expect(getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: [] })).resolves.toEqual({ immunities: [], immunitySources: {} });
    await expect(getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: undefined })).resolves.toEqual({ immunities: [], immunitySources: {} });
    await expect(getAuraConditionImmunities({ targetName: '', characters: [paladinEntry('Paladin')] })).resolves.toEqual({ immunities: [], immunitySources: {} });
  });

  it('covers aura host (self) and in-range ally with frightened via Aura of Courage', async () => {
    const result = await getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: [paladinEntry('ElderPaladin')] });
    expect(result.immunities).toContain('frightened');
    expect(result.immunitySources.frightened).toBe('ElderPaladin');

    getAllyList.mockReturnValue(['ElderPaladin', 'EvasiveFighter']);
    const ally = await getAuraConditionImmunities({ targetName: 'EvasiveFighter', characters: [paladinEntry('ElderPaladin')] });
    expect(ally.immunities).toContain('frightened');
  });

  it('does not cover out-of-range non-allies (control target)', async () => {
    getAllyList.mockReturnValue(['EvasiveFighter']);
    const result = await getAuraConditionImmunities({ targetName: 'Thug 1', characters: [paladinEntry('ElderPaladin')] });
    expect(result.immunities).toEqual([]);
  });

  it('does not cover when source is incapacitated (cannot-act gate)', async () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    const result = await getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: [paladinEntry('ElderPaladin')] });
    expect(result.immunities).toEqual([]);
  });

  it('does not cover when out of isWithinRange (enforcement parity with resistances)', async () => {
    isWithinRange.mockResolvedValue(false);
    const result = await getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: [paladinEntry('ElderPaladin')] });
    expect(result.immunities).toEqual([]);
  });

  it('is ruleset-agnostic: 5e-shaped Aura of Courage passive rides the same channel', async () => {
    // 5e classes.json Aura of Courage automation is the identical passive_buff/conditionImmunity shape
    const entry = { name: 'OathPaladin', computedStats: { automation: { passives: [{ name: 'Aura of Protection' }, { name: 'Aura of Courage', type: 'passive_buff', target: 'allies_in_range', range_expression: '10_ft', conditionImmunity: 'frightened' }] } } };
    const result = await getAuraConditionImmunities({ targetName: 'OathPaladin', characters: [entry] });
    expect(result.immunities).toContain('frightened');
  });

  it('Aura of Devotion charmed rides the same channel (data-driven)', async () => {
    const entry = paladinEntry('DevotionPaladin', [{ name: 'Aura of Devotion', conditionImmunity: 'charmed' }]);
    const result = await getAuraConditionImmunities({ targetName: 'DevotionPaladin', characters: [entry] });
    expect(result.immunities).toContain('frightened');
    expect(result.immunities).toContain('charmed');
  });
});

describe('auraCoversCondition / splitAuraCoveredConditions', () => {
  it('matches case-insensitively and splits covered vs applicable', () => {
    const aura = { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } };
    expect(auraCoversCondition(aura, 'Frightened')).toBe(true);
    expect(auraCoversCondition(aura, 'charmed')).toBe(false);
    expect(auraCoversCondition(undefined, 'frightened')).toBe(false);
    const split = splitAuraCoveredConditions(['frightened', 'prone'], aura);
    expect(split.covered).toEqual(['frightened']);
    expect(split.applicable).toEqual(['prone']);
  });
});

describe('logAuraConditionImmunity', () => {
  it('writes an automation condition_immunity_aura entry naming aura + host', () => {
    const aura = { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } };
    logAuraConditionImmunity({ campaignName, targetName: 'EvasiveFighter', conditionKey: 'frightened', auraImmunities: aura, sourceAbility: 'Fear' });
    expect(logEntries).toHaveLength(1);
    const entry = logEntries[0];
    expect(entry.type).toBe('automation');
    expect(entry.automationType).toBe('condition_immunity_aura');
    expect(entry.characterName).toBe('EvasiveFighter');
    expect(entry.sourceName).toBe('ElderPaladin');
    expect(entry.description).toContain('EvasiveFighter is immune to Frightened (Aura of Courage from ElderPaladin)');
  });

  it('labels charmed as Aura of Devotion', () => {
    const aura = { immunities: ['charmed'], immunitySources: { charmed: 'DevotionPaladin' } };
    logAuraConditionImmunity({ campaignName, targetName: 'Hero', conditionKey: 'charmed', auraImmunities: aura });
    expect(logEntries[0].description).toContain('immune to Charmed (Aura of Devotion from DevotionPaladin)');
  });
});
