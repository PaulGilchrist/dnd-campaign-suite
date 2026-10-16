// @maintained-by-ai
// CLA-019: aura-granted condition-immunity channel feeding the condition-apply seams.
// Per the auras/ folder lane map in auraComboEffects.test.js: membership/range gating
// (cannot-act, ally-inclusion, isWithinRange, missing aura/name) is canonical THERE —
// this wrapper delegates wholesale to computeAuraComboEffects (source line 13), so
// re-running those gates here only re-runs delegated code. Pinned uniquely here:
// the wrapper's own guard (short {immunities, immunitySources} envelope, no delegation),
// envelope pass-through liveness (host + ally), and the covers/split/log pure functions.
// Condition keys are canonical disk list (conditionUtils.js: frightened/charmed/stunned).
// Call-time gating only — this channel has no clocks; immunity release is seam-driven.
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

// Discriminating bearer: two immunity channels on one host, 5e-shaped fields
// (type/target/range_expression) riding alongside — the channel reads ONLY
// conditionImmunity, so both ruleset shapes must produce the same envelope.
function auraBearer(name) {
  return {
    name,
    computedStats: {
      automation: {
        passives: [
          { name: 'Aura of Protection' },
          { name: 'Aura of Courage', type: 'passive_buff', target: 'allies_in_range', range_expression: '10_ft', conditionImmunity: 'frightened' },
          { name: 'Aura of Devotion', conditionImmunity: 'charmed' },
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
  // The wrapper's OWN contract: guard inputs return the SHORT envelope without
  // delegating — distinguishable from computeAuraComboEffects' full seven-key envelope.
  it('returns the short inert envelope without delegating on missing target/characters', async () => {
    for (const args of [
      { targetName: 'ElderPaladin', characters: [] },
      { targetName: 'ElderPaladin', characters: undefined },
      { targetName: '', characters: [auraBearer('ElderPaladin')] },
    ]) {
      await expect(getAuraConditionImmunities(args)).resolves.toEqual({ immunities: [], immunitySources: {} });
    }
  });

  it('passes the full delegated envelope through to the aura host and to in-range allies', async () => {
    const bearer = auraBearer('ElderPaladin');
    const expected = {
      speedBonus: 0,
      speedSource: null,
      immunities: ['frightened', 'charmed'],
      immunitySources: { frightened: 'ElderPaladin', charmed: 'ElderPaladin' },
      resistances: [],
      resistanceSource: null,
    };
    // Host rides its own aura via the self-bypass (ally list omits it).
    const host = await getAuraConditionImmunities({ targetName: 'ElderPaladin', characters: [bearer] });
    expect(host).toEqual(expected);

    // Ally listed by getAllyList rides the identical envelope through the same call.
    getAllyList.mockReturnValue(['ElderPaladin', 'EvasiveFighter']);
    const ally = await getAuraConditionImmunities({ targetName: 'EvasiveFighter', characters: [bearer] });
    expect(ally).toEqual(expected);
  });
});

describe('auraCoversCondition / splitAuraCoveredConditions', () => {
  it('matches case-insensitively, is inert on missing input, and splits covered vs applicable exactly', () => {
    const aura = { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } };
    expect(auraCoversCondition(aura, 'Frightened')).toBe(true);
    expect(auraCoversCondition(aura, 'CHARMED')).toBe(false);
    expect(auraCoversCondition(aura, '')).toBe(false);
    expect(auraCoversCondition(aura, undefined)).toBe(false);
    expect(auraCoversCondition(undefined, 'frightened')).toBe(false);
    expect(splitAuraCoveredConditions(['frightened', 'prone'], aura)).toEqual({ covered: ['frightened'], applicable: ['prone'] });
    expect(splitAuraCoveredConditions(undefined, aura)).toEqual({ covered: [], applicable: [] });
    expect(splitAuraCoveredConditions(['frightened', 'stunned'], undefined)).toEqual({ covered: [], applicable: ['frightened', 'stunned'] });
  });
});

describe('logAuraConditionImmunity', () => {
  it('writes a full automation envelope naming target, host, ability, and normalized condition', () => {
    const aura = { immunities: ['frightened'], immunitySources: { frightened: 'ElderPaladin' } };
    logAuraConditionImmunity({ campaignName, targetName: 'EvasiveFighter', conditionKey: 'Frightened', auraImmunities: aura, sourceAbility: 'Fear' });
    expect(logEntries).toHaveLength(1);
    const { timestamp, ...entry } = logEntries[0];
    expect(typeof timestamp).toBe('number');
    expect(entry).toEqual({
      type: 'automation',
      automationType: 'condition_immunity_aura',
      characterName: 'EvasiveFighter',
      sourceName: 'ElderPaladin',
      abilityName: 'Fear',
      description: 'EvasiveFighter is immune to Frightened (Aura of Courage from ElderPaladin) — condition not applied.',
    });
  });

  it.each([
    ['frightened', 'Aura of Courage', 'ElderPaladin'],
    ['charmed', 'Aura of Devotion', 'ElderPaladin'],
    ['stunned', 'aura immunity', null], // canonical condition with no known host → fallback label, no from-clause
  ])('labels %s as "%s" and defaults abilityName to the aura label (%s)', (conditionKey, auraName, host) => {
    const aura = { immunities: [conditionKey], immunitySources: host ? { [conditionKey]: host } : {} };
    logAuraConditionImmunity({ campaignName, targetName: 'Hero', conditionKey, auraImmunities: aura });
    expect(logEntries).toHaveLength(1);
    const label = conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1);
    const { timestamp, ...entry } = logEntries[0];
    expect(typeof timestamp).toBe('number');
    expect(entry).toEqual({
      type: 'automation',
      automationType: 'condition_immunity_aura',
      characterName: 'Hero',
      sourceName: host || undefined,
      abilityName: auraName,
      description: `Hero is immune to ${label} (${auraName}${host ? ` from ${host}` : ''}) — condition not applied.`,
    });
  });
});
