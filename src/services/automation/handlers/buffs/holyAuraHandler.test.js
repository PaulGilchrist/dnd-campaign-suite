// @maintained-by-ai: 2026-10-15 — deterministic unit tests for the holyAuraHandler
// public contract (handle popup, applyHolyAura writes/registrations, targets store,
// isHolyAuraActive). registerTargetEffect update/append semantics are covered directly
// in targetEffectDefinitions.test.js — here we only pin the handler's call shape.
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

vi.mock('../../../combat/conditions/targetEffectDefinitions.js', () => ({
  registerTargetEffect: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle, getHolyAuraTargets, isHolyAuraActive, applyHolyAura } from './holyAuraHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as combatData from '../../../encounters/combatData.js';
import * as logService from '../../../ui/logService.js';
import { registerTargetEffect } from '../../../combat/conditions/targetEffectDefinitions.js';

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
  registerTargetEffect.mockClear();
}

// ── Tests ──────────────────────────────────────────────────────

describe('holyAuraHandler.handle', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns holy_aura_target_selection popup with creature list when combat context exists', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [
        { name: 'TestHero', type: 'Humanoid' },
        { name: 'Ally1', type: 'Humanoid' },
        { name: 'Ally2', type: 'Humanoid' },
      ],
    });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('holy_aura_target_selection');
    expect(result.payload.name).toBe('Holy Aura');
    expect(result.payload.creatureTargets).toEqual(['TestHero', 'Ally1', 'Ally2']);
    expect(result.payload.automation).toEqual({ type: 'holy_aura' });
  });

  it('returns popup with empty creature list when combat has no creatures', async () => {
    combatData.getCombatSummary.mockReturnValue({ creatures: [] });

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('holy_aura_target_selection');
    expect(result.payload.creatureTargets).toEqual([]);
  });

  it('returns automation payload with empty object when action.automation is undefined', async () => {
    combatData.getCombatSummary.mockReturnValue({
      creatures: [{ name: 'TestHero', type: 'Humanoid' }],
    });

    const result = await handle({ name: 'Holy Aura' }, makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('holy_aura_target_selection');
    expect(result.payload.automation).toEqual({});
  });

  it('returns error popup when no combat context', async () => {
    combatData.getCombatSummary.mockReturnValue(null);

    const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.name).toBe('Holy Aura');
    expect(result.payload.description).toContain('No combat context found');
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

    expect(await applyHolyAura(action, ps, campaignName, null, null)).toBeNull();
    expect(await applyHolyAura(action, ps, campaignName, null, [])).toBeNull();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(registerTargetEffect).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
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

    // Buff shape written for each target.
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'PaladinSteve',
      'activeBuffs',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Holy Aura',
          effect: 'holy_aura',
          duration: 'Concentration, up to 1 minute',
          sourceCharacter: 'PaladinSteve',
          auraRange: 30,
        }),
      ]),
      campaignName,
    );
    for (const target of ['Ally1', 'Ally2']) {
      expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
        target,
        'activeBuffs',
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Holy Aura',
            effect: 'holy_aura',
            duration: 'Concentration, up to 1 minute',
            sourceCharacter: 'PaladinSteve',
            auraRange: 30,
          }),
        ]),
        campaignName,
      );
    }
  });

  it('defaults auraRange to 30 when action.automation has no auraRange', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const action = makeAction();

    await applyHolyAura(action, ps, campaignName, null, ['Ally1']);

    const buffWrites = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs',
    );
    expect(buffWrites).toHaveLength(1);
    expect(buffWrites[0]).toEqual([
      'Ally1',
      'activeBuffs',
      [expect.objectContaining({
        name: 'Holy Aura',
        effect: 'holy_aura',
        duration: 'Concentration, up to 1 minute',
        sourceCharacter: 'Cleric',
        auraRange: 30,
      })],
      campaignName,
    ]);
  });

  it('does not rewrite activeBuffs when the target already has the buff, but still registers the targetEffect', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    runtimeState.getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'activeBuffs') return [{ name: 'Holy Aura', effect: 'holy_aura', sourceCharacter: 'Cleric' }];
      return null;
    });

    await applyHolyAura(makeAction(), ps, campaignName, null, ['Ally1']);

    const buffWrites = runtimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'activeBuffs',
    );
    expect(buffWrites).toHaveLength(0);
    expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'holy_aura', 'Cleric');
  });

  it('registers a holy_aura targetEffect for each target', async () => {
    const ps = makePlayerStats({ name: 'Paladin' });
    const targets = ['Paladin', 'Ally1'];

    await applyHolyAura(makeAction(), ps, campaignName, null, targets);

    expect(registerTargetEffect).toHaveBeenCalledTimes(2);
    expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Paladin', 'holy_aura', 'Paladin');
    expect(registerTargetEffect).toHaveBeenCalledWith(campaignName, 'Ally1', 'holy_aura', 'Paladin');
  });

  it('registers expiration for each target', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const targets = ['Ally1', 'Ally2'];

    await applyHolyAura(makeAction(), ps, campaignName, null, targets);

    expect(expirations.addExpiration).toHaveBeenCalledTimes(2);
    for (const targetName of targets) {
      expect(expirations.addExpiration).toHaveBeenCalledWith({
        attackerName: 'Cleric',
        targetName,
        effects: expect.arrayContaining([
          expect.objectContaining({ type: 'remove_active_buff', buffName: 'Holy Aura' }),
        ]),
        campaignName,
        rounds: undefined,
        expireOnCreatureName: 'Cleric',
      });
    }
  });

  it('registers concentration for caster', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    combatData.getCombatSummary.mockReturnValue({
      creatures: [{ name: 'Cleric' }, { name: 'Ally1' }],
    });

    await applyHolyAura(makeAction(), ps, campaignName, null, ['Ally1']);

    expect(concentrationService.addConcentration).toHaveBeenCalledWith(
      expect.objectContaining({ creatures: expect.any(Array) }),
      'Cleric',
      'Holy Aura',
      15,
    );
  });

  it('stores targets in holyAuraTargets runtime key', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const targets = ['Ally1', 'Ally2'];

    await applyHolyAura(makeAction(), ps, campaignName, null, targets);

    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Cleric',
      'holyAuraTargets',
      targets,
      campaignName,
    );
  });

  it('logs to campaign for each target with full entry structure', async () => {
    const ps = makePlayerStats({ name: 'Cleric' });
    const targets = ['Ally1', 'Ally2'];

    await applyHolyAura(makeAction(), ps, campaignName, null, targets);

    expect(logService.addEntry).toHaveBeenCalledTimes(2);
    for (const targetName of targets) {
      expect(logService.addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          type: 'spell_effect',
          characterName: 'Cleric',
          spellName: 'Holy Aura',
          targetName,
          effects: ['Advantage on all saving throws', 'Other creatures have Disadvantage on attack rolls against them'],
          timestamp: expect.any(Number),
        }),
      );
    }
  });

  it('computes save DC from spellAbilities.saveDc, falling back to 8 + proficiency', async () => {
    await applyHolyAura(makeAction(), makePlayerStats({ name: 'Cleric', spellAbilities: { saveDc: 16 } }), campaignName, null, ['Ally1']);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Cleric', 'holyAuraSaveDc', 16, campaignName);

    runtimeState.setRuntimeValue.mockClear();
    await applyHolyAura(makeAction(), makePlayerStats({ name: 'Cleric', spellAbilities: {}, proficiency: 5 }), campaignName, null, ['Ally1']);
    expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Cleric', 'holyAuraSaveDc', 13, campaignName);
  });
});

describe('holyAuraHandler.getHolyAuraTargets', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns the stored targets array, read by player and campaign', () => {
    const targets = ['Enemy1', 'Enemy2'];
    runtimeState.getRuntimeValue.mockReturnValue(targets);

    expect(getHolyAuraTargets('TestHero', campaignName)).toBe(targets);
    expect(runtimeState.getRuntimeValue).toHaveBeenCalledWith(
      'TestHero',
      'holyAuraTargets',
      campaignName,
    );
  });

  it('returns an empty array for missing or non-array stored values', () => {
    for (const stored of [null, undefined, 'not-an-array', 42]) {
      runtimeState.getRuntimeValue.mockReturnValue(stored);
      expect(getHolyAuraTargets('TestHero', campaignName)).toEqual([]);
    }
  });
});

describe('holyAuraHandler.isHolyAuraActive', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns true only when targetName is in the targets array', () => {
    runtimeState.getRuntimeValue.mockReturnValue(['Ally1', 'Ally2']);

    expect(isHolyAuraActive('Ally1', 'Cleric', campaignName)).toBe(true);
    expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(false);
    expect(isHolyAuraActive('', 'Cleric', campaignName)).toBe(false);
  });

  it('returns false when the targets store is empty or missing', () => {
    for (const stored of [[], null, undefined]) {
      runtimeState.getRuntimeValue.mockReturnValue(stored);
      expect(isHolyAuraActive('Target', 'Cleric', campaignName)).toBe(false);
    }
  });
});
