import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((name) => name),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
  getActiveCreatureName: vi.fn(),
  getCombatSummary: vi.fn(),
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 5),
}));

vi.mock('../../automation/handlers/spells/slowHandler.js', () => ({
  processSlowRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

import { applyTurnStartEffects } from './expirations.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function resetMocks() {
  vi.clearAllMocks();
  localStorage.clear();
  window.dispatchEvent = vi.fn();
}

describe('applyTurnStartEffects', () => {
  beforeEach(() => {
    resetMocks();
    getRuntimeValue.mockReset();
    setRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_name, _prop, _campaign) => null);
  });

  describe('early returns', () => {
    it('returns early when activeName is null', async () => {
      await applyTurnStartEffects(null, { turnStartEffects: [], targetEffects: [] }, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('returns early when playerStats is null or undefined', async () => {
      await applyTurnStartEffects('TestCharacter', null, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();

      await applyTurnStartEffects('TestCharacter', undefined, 'TestCampaign');
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('heroic_inspiration effect', () => {
    function setupInspiration(hasInspiration) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'hasInspiration') return hasInspiration;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('grants hasInspiration when effect is present and not already set', async () => {
      setupInspiration(false);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'heroic_inspiration', name: 'Heroic Warrior' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'hasInspiration',
        true,
        'TestCampaign'
      );
    });
  });

  describe('condition_removal effect (CLA-307: must NOT run at turn start)', () => {
    function setupConditions(conditions) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'activeConditions') return conditions;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('does NOT remove conditions at turn start — removal moved to owner turn end', async () => {
      setupConditions(['charmed', 'poisoned', 'blinded']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'condition_removal',
          name: 'Self-Restoration',
          conditions: ['charmed', 'frightened', 'poisoned']
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        expect.anything(),
        'TestCampaign'
      );
    });
  });

  describe('umbral_sight effect', () => {
    function setupUmbralSight(inDarkness, conditions) {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'umbralSightDarknessActive') return inDarkness;
        if (prop === 'activeConditions') return conditions;
        if (prop === 'targetEffects') return [];
        return null;
      });
    }

    it('adds invisible when in darkness and not already invisible', async () => {
      setupUmbralSight(true, ['fatigued']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued', 'invisible'],
        'TestCampaign'
      );
    });

    it('removes invisible when not in darkness and currently invisible', async () => {
      setupUmbralSight(false, ['fatigued', 'invisible']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'activeConditions',
        ['fatigued'],
        'TestCampaign'
      );
    });

    it('does nothing when already in the desired state', async () => {
      setupUmbralSight(true, ['fatigued', 'invisible']);

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'umbral_sight', name: 'Umbral Sight' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('elder_champion_regeneration effect', () => {
    it('heals when elderChampionActive is true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        15,
        'TestCampaign'
      );
    });

    it('caps healing at max hit points', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'elderChampionActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 18;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{
          type: 'elder_champion_regeneration',
          name: 'Elder Champion Regeneration',
          healExpression: '5',
        }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'currentHitPoints',
        20,
        'TestCampaign'
      );
    });
  });

  describe('regenerate buff healing', () => {
    it('heals when regenerateActive flag is true', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'regenerateActive') return true;
        if (prop === 'hitPoints') return 20;
        if (prop === 'currentHitPoints') return 10;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('Target', { turnStartEffects: [] }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Target',
        'currentHitPoints',
        11,
        'TestCampaign'
      );
    });
  });

  describe('bait_and_switch_clear turn-start effect', () => {
    it('clears baitAndSwitch state when effect is present', async () => {
      getRuntimeValue.mockImplementation((name, prop) => {
        if (prop === 'baitAndSwitchActive') return true;
        if (prop === 'targetEffects') return [];
        return null;
      });

      await applyTurnStartEffects('TestCharacter', {
        turnStartEffects: [{ type: 'bait_and_switch_clear' }]
      }, 'TestCampaign');

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchActive',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchBonus',
        null,
        'TestCampaign'
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'baitAndSwitchSource',
        null,
        'TestCampaign'
      );
    });
  });
});
