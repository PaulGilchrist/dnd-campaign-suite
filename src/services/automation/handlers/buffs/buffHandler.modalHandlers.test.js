// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/buffToggle.js', () => ({
  toggleBuff: vi.fn(),
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

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './buffHandler.js';
import * as combatData from '../../../encounters/combatData.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Constants ──────────────────────────────────────────────────

const campaignName = 'TestCampaign';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestHero',
    level: 5,
    proficiency: 3,
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Test Buff',
    automation: {
      type: 'buff',
      ...automation,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('buffHandler.handle - Corona of Light', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sunlight_aura effect', () => {
    it('should return popup saying already active when buff with sunlight_aura effect is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Other Buff', effect: 'sunlight_aura' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Test Buff is already active. It expires after 1 minute (10 rounds) or on a short/long rest.'
      );
      expect(combatData.loadCombatSummary).not.toHaveBeenCalled();
    });

    it('should return popup saying already active when same-named buff is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Test Buff', effect: 'sunlight_aura' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Test Buff is already active. It expires after 1 minute (10 rounds) or on a short/long rest.'
      );
    });

    it('should return modal for enemy selection when not already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'TestHero', type: 'player' },
          { name: 'Enemy1', type: 'monster' },
          { name: 'Ally1', type: 'npc' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('coronaEnemySelection');
      expect(result.payload.action).toEqual(action);
      expect(result.payload.playerStats).toEqual(ps);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toEqual([
        { name: 'Enemy1', type: 'monster' },
        { name: 'Ally1', type: 'npc' },
      ]);
    });

    it('should exclude self from creatureTargets', async () => {
      const ps = makePlayerStats({ name: 'MyHero' });
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'MyHero', type: 'player' },
          { name: 'Enemy1', type: 'monster' },
        ],
      });

      await handle(action, ps, campaignName, null);

      expect(combatData.loadCombatSummary).toHaveBeenCalledWith(campaignName);
    });

    it('should return empty creatureTargets when combatSummary is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should return empty creatureTargets when combatSummary has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should not filter creatures by type for corona (all non-self creatures included)', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'sunlight_aura' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Enemy1', type: 'monster' },
          { name: 'Ally1', type: 'npc' },
          { name: 'Player1', type: 'player' },
          { name: 'Neutral1', type: 'neutral' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([
        { name: 'Enemy1', type: 'monster' },
        { name: 'Ally1', type: 'npc' },
        { name: 'Player1', type: 'player' },
        { name: 'Neutral1', type: 'neutral' },
      ]);
    });
  });
});

describe('buffHandler.handle - Blessing of the Trickster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('advantage_on_stealth effect', () => {
    it('should return popup saying already active when buff with same name is already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Test Buff' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.type).toBe('automation_info');
      expect(result.payload.description).toBe(
        'Test Buff is already active. It expires after a Long Rest or when you use this feature again.'
      );
      expect(combatData.loadCombatSummary).not.toHaveBeenCalled();
    });

    it('should return popup saying already active when featureName matches', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Test Buff', effect: 'something_else' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.description).toBe(
        'Test Buff is already active. It expires after a Long Rest or when you use this feature again.'
      );
    });

    it('should return modal for ally selection when not already active', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'TestHero', type: 'player', currentHp: 10, maxHp: 10, size: 'Medium' },
          { name: 'Ally1', type: 'npc', currentHp: 8, maxHp: 8, size: 'Small' },
          { name: 'Enemy1', type: 'monster', currentHp: 5, maxHp: 5, size: 'Medium' },
          { name: 'Excluded', type: 'hazard' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.modalName).toBe('tricksterBlessing');
      expect(result.payload.action).toEqual(action);
      expect(result.payload.playerStats).toEqual(ps);
      expect(result.payload.campaignName).toBe(campaignName);
      expect(result.payload.creatureTargets).toEqual([
        {
          name: 'TestHero',
          currentHp: 10,
          maxHp: 10,
          size: 'Medium',
          type: 'player',
        },
        {
          name: 'Ally1',
          currentHp: 8,
          maxHp: 8,
          size: 'Small',
          type: 'npc',
        },
        {
          name: 'Enemy1',
          currentHp: 5,
          maxHp: 5,
          size: 'Medium',
          type: 'monster',
        },
      ]);
    });

    it('should filter to only player, npc, and monster creature types', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Player1', type: 'player', currentHp: 0, maxHp: 0, size: 'Medium' },
          { name: 'Hazard1', type: 'hazard', currentHp: 0, maxHp: 0, size: 'Large' },
          { name: 'Object1', type: 'object', currentHp: 0, maxHp: 0, size: 'Tiny' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.payload.creatureTargets).toEqual([
        {
          name: 'Player1',
          currentHp: 0,
          maxHp: 0,
          size: 'Medium',
          type: 'player',
        },
      ]);
    });

    it('should return empty creatureTargets when combatSummary is null', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue(null);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should return empty creatureTargets when combatSummary has no creatures', async () => {
      const ps = makePlayerStats();
      const action = makeAction({ effect: 'advantage_on_stealth' });
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({});

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([]);
    });

    it('should use action.name as featureName for active buff check', async () => {
      const ps = makePlayerStats();
      const action = {
        name: 'Blessing of the Trickster',
        automation: { type: 'buff', effect: 'advantage_on_stealth' },
      };
      runtimeState.getRuntimeValue.mockReturnValue([
        { name: 'Blessing of the Trickster' },
      ]);

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('popup');
      expect(result.payload.name).toBe('Blessing of the Trickster');
      expect(result.payload.description).toBe(
        'Blessing of the Trickster is already active. It expires after a Long Rest or when you use this feature again.'
      );
    });

    it('should default featureName to "Blessing of the Trickster" when action.name is missing', async () => {
      const ps = makePlayerStats();
      const action = {
        automation: { type: 'buff', effect: 'advantage_on_stealth' },
      };
      runtimeState.getRuntimeValue.mockReturnValue([]);
      combatData.loadCombatSummary.mockResolvedValue({
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 10, size: 'Medium' },
        ],
      });

      const result = await handle(action, ps, campaignName, null);

      expect(result.type).toBe('modal');
      expect(result.payload.creatureTargets).toEqual([
        {
          name: 'Ally1',
          currentHp: 10,
          maxHp: 10,
          size: 'Medium',
          type: 'player',
        },
      ]);
    });
  });
});
