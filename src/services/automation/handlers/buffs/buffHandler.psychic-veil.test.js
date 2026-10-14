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

describe('buffHandler.handle - Psychic Veil once-per-long-rest gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: false });
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'activeConditions') return [];
      return undefined;
    });
  });

  it('consumes the tracked use on activation and stores psychicveilUses 0', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'psychicveilUses',
      0,
      campaignName,
    );
    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(result.payload.description).toContain('activated on yourself (1_hour)');
    expect(result.payload.description).toContain('0 uses remaining');
  });

  it('refuses re-activation at 0 uses with gate popup and no buff write', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'psychicveilUses') return 0;
      if (key === 'psionicEnergy') return 0;
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toContain('cannot be used again until a Long Rest');
    expect(buffToggle.toggleBuff).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('restores activation by expending 1 Psionic Energy Die at 0 uses', async () => {
    const ps = makeSoulknife({ _trackedResources: { psionicEnergy: { current: 3, max: 10 } } });
    const action = makePsychicVeil();
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'psychicveilUses') return 0;
      if (key === 'psionicEnergy') return 3;
      if (key === 'activeBuffs') return [];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'psionicEnergy',
      2,
      campaignName,
    );
    expect(buffToggle.toggleBuff).toHaveBeenCalled();
    expect(result.payload.description).toContain('activated on yourself');
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: ps.name,
        abilityName: 'Psychic Veil',
        description: expect.stringContaining('expended 1 Psionic Energy Die'),
      }),
    );
  });

  it('toggling OFF does not refund the consumed use', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();
    buffToggle.toggleBuff.mockReturnValue({ wasActive: true });
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'psychicveilUses') return 0;
      if (key === 'activeBuffs') return [{ name: 'Psychic Veil', effect: 'invisible' }];
      if (key === 'activeConditions') return ['invisible'];
      return undefined;
    });

    const result = await handle(action, ps, campaignName, null);

    expect(result.payload.description).toBe('Psychic Veil toggled OFF');
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      ps.name,
      'psychicveilUses',
      expect.anything(),
      campaignName,
    );
  });

  it('logs ability_use on activation', async () => {
    const ps = makeSoulknife();
    const action = makePsychicVeil();

    await handle(action, ps, campaignName, null);

    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'ability_use',
        characterName: ps.name,
        abilityName: 'Psychic Veil',
        description: expect.stringContaining('activated Psychic Veil'),
      }),
    );
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
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith(
      ps.name,
      'naturalrevelationUses',
      expect.anything(),
      campaignName,
    );
  });

  it('supports multi-use numeric and proficiency_bonus uses declarations', async () => {
    const ps = makeSoulknife({ proficiency: 2 });
    const action = {
      name: 'Multi Buff',
      automation: { type: 'temp_buff', effect: 'some_effect', duration: '1_minute', uses: 'proficiency_bonus' },
    };

    const result = await handle(action, ps, campaignName, null);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      ps.name,
      'multibuffUses',
      1,
      campaignName,
    );
    expect(result.payload.description).toContain('1 use remaining');
  });
});
