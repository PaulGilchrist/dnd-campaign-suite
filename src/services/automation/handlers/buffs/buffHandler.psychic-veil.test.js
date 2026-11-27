// @maintained-by-ai 2026-11-26
// Generic temp_buff tracked-uses lane of buffHandler.handle: the
// gateTrackedBuffUses / gateBuffUses / consumeBuffUse / resolveBuffUsesMax
// contract (Psychic Veil once-per-long-rest gate, psionic-energy-die escape
// hatch incl. both getPsionicEnergy sources, OFF-leg no-refund/no-log,
// no-uses gate skip, all five resolveBuffUsesMax branches). This lane never
// reaches buffDurationToRounds (that minutes×10 helper is flight-lane only,
// owner-pending divergence filed under buffHandler.buffDurationToRounds) —
// no clock pin here. Adrenaline Rush's parallel uses lane
// (resolveAdrenalineUsesMax via the bonus_action_dash delegate) and the
// no-uses long_rest popup are pinned in buffHandler.basic-effects.test.js;
// invisible / see_invisibility / haste side-effect copy lives in
// buffHandler.advanced-effects.test.js; the flight-lane refusal copy lives
// in buffHandler.draconic-flight.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
  isBuffActive: vi.fn(),
}));

vi.mock('../class-warlock/tempTeleportHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../class-cleric-paladin/vowOfEnmityHandler.js', () => ({
  handle: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/shared/abilityLookup.js', () => ({
  getAbilityModifier: vi.fn(),
}));

vi.mock('../class-druid/wildShapeCreatureBuilder.js', () => ({
  cleanupWildShape: vi.fn(),
}));

vi.mock('./tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

import { handle } from './buffHandler.js';
import * as buffToggle from '../../common/buffToggle.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

const campaignName = 'test-campaign';

function makeSoulknife(overrides = {}) {
  return {
    name: 'AasimarTest',
    level: 14,
    proficiency: 5,
    ...overrides,
  };
}

function makePsychicVeil() {
  return {
    name: 'Psychic Veil',
    automation: {
      type: 'temp_buff',
      effect: 'invisible',
      duration: '1_hour',
      action: 'action',
      uses: '1',
      recharge: 'long_rest',
      resourceCost: 'psionic_energy',
      casting_time: '1 action',
    },
  };
}

// getRuntimeValue stub for a stored-uses scenario: given uses count is the
// runtime-stored psychicVeilUses value; everything else reads empty.
function stubUses(uses) {
  runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'psychicVeilUses') return uses;
    if (key === 'activeBuffs') return [];
    if (key === 'activeConditions') return [];
    return undefined;
  });
}

describe('buffHandler.handle - Psychic Veil once-per-long-rest gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
    stubUses(undefined);
  });

  it('consumes the tracked use on activation, stores psychicVeilUses 0, and logs the activation', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();

    const result = await handle(action, ps, campaignName, null);

    // toggleBuff is THE activation seam: exact self-target arguments.
    expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
      ps.name,
      action.name,
      action.automation,
      campaignName,
      ps.name,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'psychicVeilUses',
      0,
      campaignName,
    );
    expect(result.payload.description).toBe(
      'Psychic Veil activated on yourself (1_hour) (0 uses remaining)',
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: ps.name,
        abilityName: 'Psychic Veil',
        description: expect.stringContaining('activated Psychic Veil (0 uses remaining)'),
      }),
    );
  });

  // NOTE: the tracked-uses refusal popup path in gateBuffUses does NOT log
  // to the campaign log, unlike the parallel no-uses long-rest refusal —
  // reported as a source divergence; deliberately not pinned either way.
  it('refuses re-activation at 0 uses with gate popup and no buff write', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'psychicVeilUses') return 0;
      if (key === 'psionicEnergy') return 0;
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toBe(
      'Psychic Veil has been used and cannot be used again until a Long Rest.',
    );
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // Escape hatch: at 0 uses, resourceCost 'psionic_energy' pays one die and
  // the buff activates anyway — the die count comes from the stored runtime
  // value, falling back to _trackedResources.psionicEnergy.max (getPsionicEnergy).
  // The exhausted psychicVeilUses is still rewritten as 0 (max(0, -1)): the
  // hatch is pay-per-activation, not a banked restore — pinned honestly.
  it.each([
    ['stored runtime psionicEnergy 3', undefined, 3, 2],
    ['_trackedResources fallback max 10', 10, undefined, 9],
  ])('restores activation by expending 1 Psionic Energy Die at 0 uses (%s)', async (_label, trackedMax, stored, expectedAfter) => {
    const ps = makeSoulknife({
      _trackedResources: { psionicEnergy: { current: stored ?? 0, max: trackedMax ?? 0 } },
    });
    const action = makePsychicVeil();
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'psychicVeilUses') return 0;
      if (key === 'psionicEnergy') return stored;
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'psionicEnergy',
      expectedAfter,
      campaignName,
    );
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'psychicVeilUses',
      0,
      campaignName,
    );
    expect(buffToggle.toggleBuff).toHaveBeenCalledWith(
      ps.name,
      action.name,
      action.automation,
      campaignName,
      ps.name,
    );
    expect(result.payload.description).toBe(
      'Psychic Veil activated on yourself (1_hour) (0 uses remaining)',
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: ps.name,
        abilityName: 'Psychic Veil',
        description: expect.stringContaining(`restore a use of Psychic Veil. Psionic Energy: ${expectedAfter}.`),
      }),
    );
  });

  it('toggling OFF does not refund the consumed use and writes no log', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'psychicVeilUses') return 0;
      if (key === 'activeBuffs') return [{ name: 'Psychic Veil', effect: 'invisible' }];
      if (key === 'activeConditions') return ['invisible'];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toBe('Psychic Veil toggled OFF');
    // The invisibility side-effect legitimately writes condition state, so
    // the refund pin must target the uses key specifically.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      ps.name,
      'psychicVeilUses',
      expect.anything(),
      campaignName,
    );
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('leaves temp_buff features WITHOUT uses untouched (Invisibility regression guard)', async () => {
    const ps = makeSoulknife();
    const action = {
      name: 'Natural Revelation',
      automation: { type: 'temp_buff', effect: 'see_invisibility', duration: '1_hour' },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toBe('Natural Revelation activated on yourself (1_hour)');
    expect(result.payload.description).not.toContain('uses remaining');
    // gateTrackedBuffUses skips entirely (uses/usesMax both null): no
    // *Uses write and no side-effect write for this effect — zero-write pin.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // All five resolveBuffUsesMax branches in the generic tracked-uses lane,
  // with no stored value. The Adrenaline Rush parallel
  // (resolveAdrenalineUsesMax via the bonus_action_dash delegate) is pinned
  // in buffHandler.basic-effects.test.js — this lane is generic temp_buff
  // and stays distinct from those pins.
  it.each([
    ['numeric string uses', { uses: '2' }, 1],
    ['numeric uses', { uses: 3 }, 2],
    ['proficiency_bonus uses', { uses: 'proficiency_bonus' }, 1],
    ['numeric usesMax with no uses', { usesMax: 2 }, 1],
    ['default 1 when uses unrecognizable and usesMax absent', { uses: 'half' }, 0],
  ])('resolves max uses from %s and consumes one', async (_label, automation, expectedWritten) => {
    const ps = makeSoulknife({ proficiency: 2 });
    const action = {
      name: 'Multi Buff',
      automation: { type: 'temp_buff', effect: 'some_effect', duration: '1_minute', ...automation },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'multiBuffUses',
      expectedWritten,
      campaignName,
    );
    expect(result.payload.description).toContain(`${expectedWritten} use${expectedWritten !== 1 ? 's' : ''} remaining`);
  });
});
