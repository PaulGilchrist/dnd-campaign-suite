// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './extraActionHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../../../services/encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Action Surge',
    description: 'Instantly take another action',
    automation: {
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('extraActionHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReset();
    useRuntimeState.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  });

  describe('oncePerCombat check', () => {
    it('returns popup when combat round > 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true });

      combatData.loadCombatSummary.mockResolvedValue({ round: 2, creatures: [] });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Action Surge can only be used once per combat.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('sets uses to 0 after first successful use in combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, uses: 1 });

      combatData.loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });

      await handle(action, ps, campaignName);

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'actionSurgeUses',
        0,
        campaignName,
        true,
      );
    });
  });

  describe('firstRoundOnly check', () => {
    it('returns popup when current round > 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ firstRoundOnly: true });

      combatData.getCurrentCombatRound.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Action Surge can only be used in the first round of combat.',
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('uses limit (usesMax > 0)', () => {
    it('returns popup when no uses remaining (usesUsed is 0)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Action Surge has no uses remaining. Recharges on a Short Rest.',
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('uses custom recharge message from auto.recharge', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2, recharge: 'Long Rest' });

      useRuntimeState.getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe(
        'Action Surge has no uses remaining. Recharges on a Long Rest.',
      );
    });

    it('decrements uses and returns success when usesUsed > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      useRuntimeState.getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'actionSurgeUses',
        1,
        campaignName,
        true,
      );
    });

    it('uses custom resourceKey from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 3, resourceKey: 'customUses' });

      useRuntimeState.getRuntimeValue.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'customUses',
        2,
        campaignName,
        true,
      );
    });

    it('uses default uses of 1 when auto.uses is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      useRuntimeState.getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'actionSurgeUses',
        0,
        campaignName,
        true,
      );
    });
  });

  describe('oncePerTurn check', () => {
    it('returns popup when already used this turn', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(undefined)  // usesUsed (undefined -> usesMax=2, passes)
        .mockReturnValueOnce(1);         // usedThisRound === currentRound
      combatData.getCurrentCombatRound.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Action Surge can only be used once per turn.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('marks as used this turn and decrements when not yet used', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)   // usesUsed
        .mockReturnValue(undefined); // usedThisRound (falsy)
      combatData.getCurrentCombatRound.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'actionSurgeUsedThisRound',
        1,
        campaignName,
        true,
      );
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'TestHero',
        'actionSurgeUses',
        1,
        campaignName,
        true,
      );
    });

    it('allows use in a new round when usedThisRound !== currentRound', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(2)
        .mockReturnValueOnce(1); // usedThisRound = 1
      combatData.getCurrentCombatRound.mockReturnValue(2); // current round is 2

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('interaction: oncePerCombat + oncePerTurn', () => {
    it('blocks when oncePerCombat already used (round > 1) regardless of oncePerTurn', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, oncePerTurn: true, uses: 1 });

      combatData.loadCombatSummary.mockResolvedValue({ round: 3, creatures: [] });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Action Surge can only be used once per combat.');
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes oncePerCombat but blocks oncePerTurn on second use in same combat', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, oncePerTurn: true, uses: 1 });

      combatData.loadCombatSummary.mockResolvedValue({ round: 1, creatures: [] });
      useRuntimeState.getRuntimeValue
        .mockReturnValueOnce(1)
        .mockReturnValueOnce(1); // usedThisRound === currentRound
      combatData.getCurrentCombatRound.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe('Action Surge can only be used once per turn.');
    });
  });

  describe('interaction: firstRoundOnly + uses', () => {
    it('blocks on firstRoundOnly check before checking uses', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ firstRoundOnly: true, uses: 5 });

      combatData.getCurrentCombatRound.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Action Surge can only be used in the first round of combat.',
      );
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('success popup payload', () => {
    it('returns automation_info popup with action name and description', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 1 });

      useRuntimeState.getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Action Surge');
      expect(result.payload.description).toBe('Instantly take another action');
    });

    it('includes automationType in payload when set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'action_surge', uses: 1 });

      useRuntimeState.getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automationType).toBe('action_surge');
    });
  });
});
