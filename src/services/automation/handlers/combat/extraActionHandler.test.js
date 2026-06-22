import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  loadCombatSummary: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './extraActionHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound, loadCombatSummary } from '../../../../services/encounters/combatData.js';

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
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
  });

  describe('uses limit (usesMax > 0)', () => {
    it('should return no-uses popup when usesUsed is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Action Surge');
      expect(result.payload.description).toBe('Action Surge has no uses remaining. Recharges on a Short Rest.');
    });

    it('should return no-uses popup when usesUsed is negative', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(-1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toContain('no uses remaining');
    });

    it('should use custom recharge message from auto.recharge', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2, recharge: 'Long Rest' });

      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.description).toBe('Action Surge has no uses remaining. Recharges on a Long Rest.');
    });

    it('should decrement uses and return success when usesUsed > 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 1, campaignName, true);
    });

    it('should use custom resourceKey from automation', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 3, resourceKey: 'customUses' });

      getRuntimeValue.mockReturnValue(3);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'customUses', 2, campaignName, true);
    });

    it('should decrement from usesMax default when no stored value (usesUsed is undefined)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(undefined);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 1, campaignName, true);
    });

    it('should use default uses of 1 when auto.uses is missing', async () => {
      const ps = makePlayerStats();
      const action = makeAction({});

      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 0, campaignName, true);
    });

    it('should not decrement when usesUsed is already 0 after re-check', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      // First call returns 0 (no uses), which would return early
      // But if somehow gets past the first check, second call also returns 0
      getRuntimeValue.mockReturnValue(0);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toContain('no uses remaining');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('oncePerTurn', () => {
    it('should return once-per-turn popup when already used this turn', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      getRuntimeValue
        .mockReturnValueOnce(undefined)  // First call: usesUsed (undefined -> usesMax=2, passes check)
        .mockReturnValueOnce(1);         // Second call: actionSurgeUsedThisRound (matches current round)
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Action Surge can only be used once per turn.');
    });

    it('should mark as used this turn and decrement when not yet used', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      getRuntimeValue
        .mockReturnValueOnce(2)   // First call: usesUsed
        .mockReturnValue(undefined); // Second call: actionSurgeUsedThisRound (falsy)
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUsedThisRound', 1, campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 1, campaignName, true);
    });

    it('should skip oncePerTurn check when oncePerTurn is not set', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'actionSurgeUsedThisRound', 1, campaignName, true);
    });

    it('should still decrement uses when oncePerTurn is true and first use', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 3 });

      getRuntimeValue
        .mockReturnValueOnce(3)   // First call: usesUsed
        .mockReturnValue(undefined); // Second call: actionSurgeUsedThisRound (falsy)
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);

      await handle(action, ps, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUsedThisRound', 1, campaignName, true);
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 2, campaignName, true);
    });
  });

  describe('uses === 0 (defaults to 1 via ||)', () => {
    it('should treat uses=0 as uses=1 and decrement normally', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 0 });

      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 0, campaignName, true);
    });

    it('should succeed without checking runtime state when uses is 0', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 0, oncePerTurn: true });

      getRuntimeValue.mockReturnValue(false);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });

  describe('success popup payload', () => {
    it('should return automation_info popup with action details', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 1 });

      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.name).toBe('Action Surge');
      expect(result.payload.description).toBe('Instantly take another action');
      expect(result.payload.automation).toEqual({ uses: 1 });
    });

    it('should include automationType in payload', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ type: 'action_surge', uses: 1 });

      getRuntimeValue.mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.payload.automationType).toBe('action_surge');
    });
  });

  describe('default resource key', () => {
    it('should use actionSurgeUses as default resourceKey', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ uses: 2 });

      getRuntimeValue.mockReturnValue(2);

      await handle(action, ps, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 1, campaignName, true);
    });

    it('should use actionSurgeUses as default for oncePerTurn flag', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerTurn: true, uses: 2 });

      getRuntimeValue
        .mockReturnValueOnce(2)   // First call: usesUsed
        .mockReturnValue(undefined); // Second call: actionSurgeUsedThisRound (falsy)
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);

      await handle(action, ps, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUsedThisRound', 1, campaignName, true);
    });
  });

  describe('oncePerCombat', () => {
    beforeEach(() => {
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);
      vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
    });

    it('should return once-per-combat popup when round > 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, uses: 1 });

      vi.mocked(loadCombatSummary).mockResolvedValue({ round: 2, creatures: [] });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Action Surge can only be used once per combat.');
    });

    it('should succeed when round is 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, uses: 1 });

      vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });

    it('should set uses to 0 after use when oncePerCombat is true', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ oncePerCombat: true, uses: 1 });

      vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });

      await handle(action, ps, campaignName);

      expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'actionSurgeUses', 0, campaignName, true);
    });
  });

  describe('firstRoundOnly', () => {
    beforeEach(() => {
      vi.mocked(getCurrentCombatRound).mockReturnValue(1);
      vi.mocked(loadCombatSummary).mockResolvedValue({ round: 1, creatures: [] });
    });

    it('should return first-round-only popup when round > 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ firstRoundOnly: true, uses: 1 });

      vi.mocked(getCurrentCombatRound).mockReturnValue(2);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe('Action Surge can only be used in the first round of combat.');
    });

    it('should succeed when round is 1', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ firstRoundOnly: true, uses: 1 });

      vi.mocked(getCurrentCombatRound).mockReturnValue(1);

      const result = await handle(action, ps, campaignName);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
    });
  });
});
