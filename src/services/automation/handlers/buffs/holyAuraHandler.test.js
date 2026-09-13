// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
  addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockReturnValue(Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, getHolyAuraTargets, isHolyAuraActive, applyHolyAura } from './holyAuraHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    spellAbilities: { saveDc: 15, modifier: 4 },
    proficiency: 4,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Holy Aura',
    automation: {
      type: 'holy_aura',
      ...automation,
    },
  };
}

function resetMocks() {
  runtimeState.getRuntimeValue.mockClear();
  runtimeState.setRuntimeValue.mockClear();
  expirations.addExpiration.mockClear();
  concentrationService.addConcentration.mockClear();
  combatData.getCombatSummary.mockClear();
  logService.addEntry.mockClear();
}

// ── Tests ──────────────────────────────────────────────────────

describe('holyAuraHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('target selection popup', () => {
    it('returns holy_aura_target_selection popup with creature list when combat context exists', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [
          { name: 'TestHero', type: 'Humanoid' },
          { name: 'Ally1', type: 'Humanoid' },
          { name: 'Ally2', type: 'Humanoid' },
        ],
      });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('holy_aura_target_selection');
      expect(result.payload.name).toBe('Holy Aura');
      expect(result.payload.creatureTargets).toEqual(['TestHero', 'Ally1', 'Ally2']);
      expect(result.payload.automation).toEqual({ type: 'holy_aura' });
    });

    it('returns holy_aura_target_selection popup with empty creature list when combat has no creatures', async () => {
      combatData.getCombatSummary.mockReturnValue({ creatures: [] });

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('holy_aura_target_selection');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('returns automation payload with empty object when action.automation is undefined', async () => {
      combatData.getCombatSummary.mockReturnValue({
        creatures: [{ name: 'TestHero', type: 'Humanoid' }],
      });

      const ps = makePlayerStats();
      const action = { name: 'Holy Aura' };

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('holy_aura_target_selection');
      expect(result.payload.automation).toEqual({});
    });

    it('returns error popup when no combat context', async () => {
      combatData.getCombatSummary.mockReturnValue(null);

      const ps = makePlayerStats();
      const action = makeAction();

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Holy Aura');
      expect(result.payload.description).toContain('No combat context found');
    });
  });
});

describe('holyAuraHandler.applyHolyAura', () => {
  beforeEach(() => {
    resetMocks();
    runtimeState.getRuntimeValue.mockReturnValue(null);
  });

  it('returns null when no target names provided', async () => {
    const ps = makePlayerStats();
    const action = makeAction();

    const result = await applyHolyAura(action, ps, campaignName, null, null);
    expect(result).toBeNull();

    const result2 = await applyHolyAura(action, ps, campaignName, null, []);
    expect(result2).toBeNull();
  });

  it('applies buff to each target and returns success popup', async () => {
    const ps = makePlayerStats({ name: 'PaladinSteve' });
    const action = makeAction({ auraRange: 30 });
    const targets = ['PaladinSteve', 'Ally1', 'Ally2'];

    const result = await applyHolyAura(action, ps, campaignName, null, targets);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Holy Aura');
    expect(result.payload.description).toContain('PaladinSteve, Ally1, Ally2');
    expect(result.payload.targetCount).toBe(3);
    expect(result.payload.targetNames).toEqual(targets);
  });

  it('applies buff to single target and returns success popup', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction();
    const targets = ['Ally1'];

    const result = await applyHolyAura(action, ps, campaignName, null, targets);

    expect(result.type).toBe('popup');
    expect(result.payload.targetCount).toBe(1);
    expect(result.payload.targetNames).toEqual(['Ally1']);
  });

  it('adds Holy Aura buff to each target\'s activeBuffs', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Cleric', 'Rogue'];

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'holyAuraSaveDc') return 15;
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Holy Aura',
          effect: 'holy_aura',
          duration: 'Concentration, up to 1 minute',
          sourceCharacter: 'Cleric',
          auraRange: 30,
        }),
      ]),
      campaignName,
    );

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Rogue',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Holy Aura',
          effect: 'holy_aura',
        }),
      ]),
      campaignName,
    );
  });

  it('uses default auraRange of 30 when action.automation has no auraRange', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs',
    );
    expect(buffCalls[0][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ auraRange: 30 }),
      ]),
    );
  });

  it('does not duplicate buff if already present', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Holy Aura', effect: 'holy_aura', sourceCharacter: 'Cleric' }];
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs'
    );
    expect(buffCalls).toHaveLength(0);
  });

  it('handles undefined activeBuffs the same as null', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return undefined;
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    const buffCalls = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs',
    );
    expect(buffCalls).toHaveLength(1);
    expect(buffCalls[0][2]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Holy Aura', effect: 'holy_aura' }),
      ]),
    );
  });

  it('registers expiration for each target', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1', 'Ally2'];

    runtimeState.getRuntimeValue.mockReturnValue(null);

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Cleric', targetName: 'Ally1', effects: expect.arrayContaining([
        expect.objectContaining({ type: 'remove_active_buff', buffName: 'Holy Aura' }),
      ]), campaignName, rounds: undefined, expireOnCreatureName: 'Cleric' });

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Cleric', targetName: 'Ally2', effects: expect.arrayContaining([
        expect.objectContaining({ type: 'remove_active_buff', buffName: 'Holy Aura' }),
      ]), campaignName, rounds: undefined, expireOnCreatureName: 'Cleric' });
  });

  it('registers concentration for caster', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockReturnValue(null);
    combatData.getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Cleric' }, { name: 'Ally1' }],
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      expect.objectContaining({ creatures: expect.any(Array) }),
      'Cleric',
      'Holy Aura',
      15,
    );
  });

  it('registers targetEffect for each target for badge display', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction({ auraRange: 30 });
    const targets = ['Paladin', 'Ally1'];

    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return [];
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    const targetEffectCalls = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'targetEffects',
    );
    expect(targetEffectCalls).toHaveLength(2);

    expect(targetEffectCalls[0]).toEqual([
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Paladin',
          effect: 'holy_aura',
          source: 'Paladin',
          duration: 'concentration',
        }),
      ]),
      campaignName,
      true,
    ]);

    expect(targetEffectCalls[1]).toEqual([
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Ally1',
          effect: 'holy_aura',
          source: 'Paladin',
          duration: 'concentration',
        }),
      ]),
      campaignName,
      true,
    ]);
  });

  it('replaces existing holy_aura targetEffect from same caster on same target', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const action = makeAction();
    const targets = ['Ally1'];

    const existingEffects = [
      { target: 'Other', effect: 'other_spell', source: 'Other' },
      { target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'old' },
    ];
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [];
      if (key === 'targetEffects') return existingEffects;
      return null;
    });

    await applyHolyAura(action, ps, campaignName, null, targets);

    const targetEffectCalls = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'targetEffects',
    );
    expect(targetEffectCalls).toHaveLength(1);
    expect(targetEffectCalls[0][2]).toEqual([
      { target: 'Other', effect: 'other_spell', source: 'Other' },
      { target: 'Ally1', effect: 'holy_aura', source: 'Paladin', duration: 'concentration' },
    ]);
  });

  it('stores targets in holyAuraTargets runtime key', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1', 'Ally2'];

    runtimeState.getRuntimeValue.mockReturnValue(null);

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'holyAuraTargets',
      targets,
      campaignName,
    );
  });

  it('logs to campaign for each target with full entry structure', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();
    const targets = ['Ally1', 'Ally2'];

    runtimeState.getRuntimeValue.mockReturnValue(null);

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(logService.addEntry).toHaveBeenCalledTimes(2);
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'spell_effect',
        characterName: 'Cleric',
        spellName: 'Holy Aura',
        targetName: 'Ally1',
        effects: ['Advantage on all saving throws', 'Other creatures have Disadvantage on attack rolls against them'],
        timestamp: expect.any(Number),
      }),
    );
    expect(logService.addEntry).toHaveBeenCalledWith(
      campaignName,
      expect.objectContaining({
        type: 'spell_effect',
        characterName: 'Cleric',
        spellName: 'Holy Aura',
        targetName: 'Ally2',
        effects: ['Advantage on all saving throws', 'Other creatures have Disadvantage on attack rolls against them'],
        timestamp: expect.any(Number),
      }),
    );
  });

  it('computes save DC from spellAbilities.saveDc', async () => {
    const ps = makePlayerStats({ name: 'Cleric', spellAbilities: { saveDc: 16 } });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockReturnValue(null);

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'holyAuraSaveDc',
      16,
      campaignName,
    );
  });

  it('falls back to 8 + proficiency when no saveDc', async () => {
    const ps = makePlayerStats({ name: 'Cleric', spellAbilities: {}, proficiency: 5 });
    const action = makeAction();
    const targets = ['Ally1'];

    runtimeState.getRuntimeValue.mockReturnValue(null);

    await applyHolyAura(action, ps, campaignName, null, targets);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'holyAuraSaveDc',
      13,
      campaignName,
    );
  });
});

describe('holyAuraHandler.getHolyAuraTargets', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns the stored targets array when it is a valid array', () => {
    const targets = ['Enemy1', 'Enemy2'];
    runtimeState.getRuntimeValue.mockReturnValue(targets);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toBe(targets);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'holyAuraTargets',
      campaignName,
    );
  });

  it('returns an empty array for non-array stored values', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('returns an empty array when stored value is a string', () => {
    runtimeState.getRuntimeValue.mockReturnValue('not-an-array');

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('returns an empty array when stored value is a number', () => {
    runtimeState.getRuntimeValue.mockReturnValue(42);

    const result = getHolyAuraTargets('TestHero', campaignName);

    expect(result).toEqual([]);
  });

  it('uses the playerName and campaignName parameters correctly', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    getHolyAuraTargets('DifferentPlayer', 'OtherCampaign');

    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'DifferentPlayer',
      'holyAuraTargets',
      'OtherCampaign',
    );
  });
});

describe('holyAuraHandler.isHolyAuraActive', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns true when targetName is in the targets array', () => {
    runtimeState.getRuntimeValue.mockReturnValue(['Ally1', 'Ally2', 'Target']);

    expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(true);
  });

  it('returns false when targetName is not in the targets array', () => {
    runtimeState.getRuntimeValue.mockReturnValue(['Ally1', 'Ally2']);

    expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(false);
  });

  it('returns false when targets array is empty', () => {
    runtimeState.getRuntimeValue.mockReturnValue([]);

    expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(false);
  });

  it('returns false when targets is null', () => {
    runtimeState.getRuntimeValue.mockReturnValue(null);

    expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(false);
  });

  it('returns false when targetName is an empty string', () => {
    runtimeState.getRuntimeValue.mockReturnValue(['Ally1', 'Ally2']);

    expect(isHolyAuraActive('', 'Cleric', campaignName)).toBe(false);
  });
});
